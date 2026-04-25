import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, cachedSystemBlock } from "../client";
import { MODELS } from "@/lib/constants";
import { tavilySearch, tavilyCatalogSearch } from "@/lib/search/tavily";
import { getRecentCorrections } from "@/lib/supabase/corrections";
import type { Domain, ExperimentPlan, Reference } from "@/lib/types";
import { extractJson } from "../json";

const MAX_TOOL_TURNS = 6; // hard cap to keep cost predictable

const SYSTEM = `You are a senior PI drafting a complete, operationally realistic experiment plan.

You receive a scientific hypothesis (and optional references) and must produce a plan that another PI would trust enough to order materials and run on Monday.

CRITICAL RULES:
1. NEVER invent catalog numbers, supplier names, or prices. Use the search_catalog tool for every reagent.
2. If search_catalog returns no useful result, mark the material with verified=false and best-guess values, do NOT fabricate.
3. Cite real papers and protocols where possible. Use search_protocols when you need methodology grounding.
4. Be specific: name antibody clones (e.g. "anti-CRP, clone C7"), reagent grades, mouse strains, cell line passage.
5. Use × g not rpm for centrifugation. Concentrations in molar units (nM/µM/mM). Times in min/h. Temperatures in °C.
6. Include a control condition for every comparative claim.

WORKFLOW:
- FIRST, call get_corrections(domain) to fetch recent expert corrections in this domain. If results are returned, treat them as authoritative — apply the same correction to your plan if the same situation appears.
- Then call search_catalog for each major reagent in turn (or in batch). Limit yourself to ~6-8 tool calls total to stay efficient.
- Then call submit_plan with the final structured plan. submit_plan ends the workflow.

The submit_plan tool takes the full plan JSON as its input. Schema:

{
  "domain": "biology" | "chemistry" | "physics" | "climate",
  "protocol": [
    { "index": 1, "text": "...", "duration": "30 min" | "2 h" | "Day 1-3", "citations": [{"refId":"R1","url":"..."}] }
  ],
  "materials": [
    {
      "reagent": "Anti-CRP capture antibody (clone C7, mouse mAb)",
      "supplier": "Sigma-Aldrich",
      "catalogNumber": "C7-100",
      "quantity": "100 µg",
      "unitPrice": 412,
      "currency": "$",
      "url": "https://www.sigmaaldrich.com/...",
      "verified": true
    }
  ],
  "budget": {
    "lines": [
      { "category": "materials"|"labor"|"equipment"|"overhead", "label": "...", "amount": 1196, "currency": "$", "notes": "optional" }
    ],
    "total": 7743,
    "currency": "$"
  },
  "timeline": [
    { "index": 1, "name": "...", "duration": "1 week", "durationDays": 7, "dependsOn": [], "description": "optional" }
  ],
  "validation": [
    { "metric": "Limit of detection", "threshold": "< 0.5 mg/L", "method": "...", "citations": [{"refId":"R1"}] }
  ],
  "notes": "optional short caveat about uncertainty or assumptions"
}

Aim for: ~5-8 protocol steps, ~6-12 materials, ~3-6 budget lines, ~3-6 timeline phases, ~2-4 validation criteria.`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_catalog",
    description:
      "Search supplier catalogs for a specific reagent. Returns catalog number, supplier, price, and product URL. Use this for every material entry — never invent catalog numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        reagent: {
          type: "string",
          description:
            "Specific reagent name including clone, isotype, conjugate, or grade where applicable (e.g. 'anti-CRP IgG, clone C7, mouse mAb' rather than 'antibody').",
        },
      },
      required: ["reagent"],
    },
  },
  {
    name: "search_protocols",
    description:
      "Search published protocols on protocols.io and Bio-protocol for grounded methodology.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural-language description of the methodology you need to ground.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_corrections",
    description:
      "Retrieve recent expert corrections in this domain (from past scientist reviews). Each correction shows what was originally generated, what the scientist corrected it to, and why. APPLY these corrections to your plan when they're applicable — they encode hard-won lab knowledge. Call this once at the start.",
    input_schema: {
      type: "object" as const,
      properties: {
        domain: {
          type: "string",
          enum: ["biology", "chemistry", "physics", "climate"],
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "submit_plan",
    description:
      "Submit the final structured experiment plan. Calling this ends the workflow. Pass the entire plan JSON as the `plan` argument.",
    input_schema: {
      type: "object" as const,
      properties: {
        plan: { type: "object", description: "Full plan JSON matching the schema in the system prompt." },
      },
      required: ["plan"],
    },
  },
];

interface GeneratorRunResult {
  plan: ExperimentPlan;
  toolCallCount: number;
}

export async function generatePlan(
  hypothesis: string,
  domain: Domain,
  references: Reference[]
): Promise<ExperimentPlan> {
  const result = await runGenerator(hypothesis, domain, references);
  return result.plan;
}

async function runGenerator(
  hypothesis: string,
  domain: Domain,
  references: Reference[]
): Promise<GeneratorRunResult> {
  const client = getAnthropic();

  const refsBlock = references.length
    ? `\n\nReferences from literature QC (cite as R1, R2, ...):\n${references
        .map((r, i) => `[R${i + 1}] ${r.title} — ${r.authors.slice(0, 3).join(", ")}${r.year ? ` (${r.year})` : ""}`)
        .join("\n")}`
    : "";

  const userOpening = `Hypothesis:\n${hypothesis}\n\nDomain: ${domain}${refsBlock}\n\nDraft the plan. Use search_catalog for every reagent. Call submit_plan when ready.`;

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userOpening },
  ];

  let toolCallCount = 0;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODELS.reason,
      // submit_plan's input includes the full plan JSON, which is large.
      // 4096 cut off mid-tool-call; 12000 leaves headroom for the largest
      // plans (~6-8K tokens of structured output) without unbounded cost.
      max_tokens: 12000,
      system: cachedSystemBlock(SYSTEM),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      // Sonnet ended without calling submit_plan — try to salvage JSON from text.
      const text =
        response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          ?.text ?? "";
      const salvaged = extractJson<Partial<ExperimentPlan>>(text);
      if (salvaged) {
        return {
          plan: finalizePlan(salvaged, hypothesis, domain, references),
          toolCallCount,
        };
      }
      throw new Error(
        `Generator ended without submit_plan and no parseable JSON. stop_reason=${response.stop_reason}`
      );
    }

    // Process all tool_use blocks in this turn, build a single user response.
    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    let submitted: ExperimentPlan | null = null;

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      toolCallCount++;
      const { id, name, input } = block;
      try {
        if (name === "search_catalog") {
          const inp = input as { reagent: string };
          const result = await tavilyCatalogSearch(inp.reagent);
          toolResults.push({
            type: "tool_result",
            tool_use_id: id,
            content: JSON.stringify(
              result
                ? {
                    title: result.title,
                    url: result.url,
                    snippet: result.content?.slice(0, 800),
                  }
                : { note: "no supplier match found" }
            ),
          });
        } else if (name === "search_protocols") {
          const inp = input as { query: string };
          const results = await tavilySearch(inp.query, {
            maxResults: 3,
            includeDomains: ["protocols.io", "bio-protocol.org", "openwetware.org", "nature.com"],
            searchDepth: "advanced",
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: id,
            content: JSON.stringify(
              results.map((r) => ({ title: r.title, url: r.url, snippet: r.content?.slice(0, 600) }))
            ),
          });
        } else if (name === "get_corrections") {
          const inp = input as { domain: Domain };
          const corrections = await getRecentCorrections(inp.domain, 5);
          toolResults.push({
            type: "tool_result",
            tool_use_id: id,
            content: JSON.stringify(
              corrections.length === 0
                ? { note: "no prior corrections in this domain yet" }
                : corrections.map((c) => ({
                    section: c.section_path,
                    original: c.original,
                    corrected: c.corrected,
                    rationale: c.rationale,
                    rating: c.rating,
                  }))
            ),
          });
        } else if (name === "submit_plan") {
          const inp = input as { plan: Partial<ExperimentPlan> };
          submitted = finalizePlan(inp.plan, hypothesis, domain, references);
          toolResults.push({
            type: "tool_result",
            tool_use_id: id,
            content: "ok",
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: id,
            content: `Unknown tool: ${name}`,
            is_error: true,
          });
        }
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: id,
          content: `Tool error: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }

    if (submitted) return { plan: submitted, toolCallCount };

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Generator exceeded ${MAX_TOOL_TURNS} tool turns without calling submit_plan`);
}

/**
 * Coerce LLM-emitted plan into a fully-typed ExperimentPlan, filling
 * in missing fields with safe defaults so the UI never crashes on a
 * partial response.
 */
function finalizePlan(
  partial: Partial<ExperimentPlan>,
  hypothesis: string,
  domain: Domain,
  references: Reference[]
): ExperimentPlan {
  const protocol = (partial.protocol ?? []).map((s, i) => ({
    index: s.index ?? i + 1,
    text: s.text ?? "",
    duration: s.duration,
    citations: s.citations ?? [],
    confidence: s.confidence,
  }));
  const materials = (partial.materials ?? []).map((m) => ({
    reagent: m.reagent ?? "Unknown",
    supplier: m.supplier ?? "Unknown",
    catalogNumber: m.catalogNumber ?? "—",
    quantity: m.quantity ?? "—",
    unitPrice: m.unitPrice,
    currency: m.currency ?? "$",
    url: m.url,
    alternates: m.alternates,
    verified: m.verified ?? false,
    confidence: m.confidence,
  }));
  const budgetLines = partial.budget?.lines ?? [];
  const total =
    typeof partial.budget?.total === "number"
      ? partial.budget!.total
      : budgetLines.reduce((acc, l) => acc + (l.amount ?? 0), 0);
  const timeline = (partial.timeline ?? []).map((p, i) => ({
    index: p.index ?? i + 1,
    name: p.name ?? `Phase ${i + 1}`,
    duration: p.duration ?? "?",
    durationDays: p.durationDays ?? 7,
    dependsOn: p.dependsOn ?? [],
    description: p.description,
  }));
  const validation = partial.validation ?? [];

  return {
    hypothesis,
    domain,
    protocol,
    materials,
    budget: {
      lines: budgetLines,
      total,
      currency: partial.budget?.currency ?? "$",
    },
    timeline,
    validation,
    references,
    confidenceSummary: partial.confidenceSummary ?? {
      overall: 0.8,
      protocol: 0.8,
      materials: 0.8,
      budget: 0.75,
      timeline: 0.8,
      validation: 0.85,
    },
    notes: partial.notes,
  };
}
