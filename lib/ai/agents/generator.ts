import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, cachedSystemBlock } from "../client";
import { MODELS } from "@/lib/constants";
import { tavilyCatalogSearchBatch } from "@/lib/search/tavily";
import { getRecentCorrections } from "@/lib/supabase/corrections";
import type { AttachmentForModel } from "@/lib/supabase/files";
import type { Domain, ExperimentPlan, Reference } from "@/lib/types";
import { extractReagents } from "./reagent-extractor";

/**
 * Plan-B generator (post-v8 fix).
 *
 * The old generator used a Sonnet tool-use loop where the model
 * orchestrated catalog searches itself across multiple turns. That
 * burned 60-90s on biology hypotheses (15-25s per Sonnet round trip ×
 * 2-4 turns), which doesn't fit Vercel Hobby's 60s function cap.
 *
 * This version splits the work so Sonnet only has to do ONE round trip:
 *   1. extractReagents (Haiku, ~3s) — pull a specific reagent list
 *      from the hypothesis
 *   2. tavilyCatalogSearchBatch (~5-10s) — fan out catalog lookups in
 *      parallel
 *   3. getRecentCorrections (Supabase, <1s) — read seed/expert corrections
 *   4. Sonnet plan synthesis (~25-35s) — single call with all pre-fetched
 *      data inline. Sonnet emits the structured plan via the submit_plan
 *      tool (only tool available, called exactly once).
 *
 * Total budget: ~35-50s, comfortably inside 60s.
 */

const SYSTEM = `You are a senior PI drafting a complete, operationally realistic experiment plan.

You receive a scientific hypothesis, a list of reagents whose catalog numbers have already been looked up for you, recent expert corrections from past scientist reviews, and reference papers from the literature QC stage. Your job is to produce a plan that another PI would trust enough to order materials and run on Monday.

CRITICAL RULES:
1. NEVER invent catalog numbers, supplier names, or prices. Use the catalog data provided. If a reagent has no catalog hit, mark verified=false and best-guess but flag it in the notes.
2. Apply expert corrections when applicable — they encode hard-won lab knowledge.
3. Be specific: name antibody clones, reagent grades, mouse strains, cell-line passage limits.
4. Use × g not rpm for centrifugation. Concentrations in molar units (nM/µM/mM). Times in min/h. Temperatures in °C.
5. Include a control condition for every comparative claim.
6. ALWAYS populate the equipment field with 3-6 entries — major instruments only (centrifuge, plate reader, flow cytometer, HPLC, microscope, anaerobic chamber, potentiostat, controlled-rate freezer). Do NOT list reagents in equipment.

You output via a single call to the submit_plan tool. Schema:

{
  "domain": "biology" | "chemistry" | "physics" | "climate",
  "protocol": [{ "index": 1, "text": "...", "duration": "30 min" | "2 h" | "Day 1-3", "citations": [{"refId":"R1"}] }],
  "materials": [{
    "reagent": "Anti-CRP capture antibody (clone C7, mouse mAb)",
    "supplier": "Sigma-Aldrich",
    "catalogNumber": "C7-100",
    "quantity": "100 µg",
    "unitPrice": 412,
    "currency": "$",
    "url": "https://www.sigmaaldrich.com/...",
    "verified": true
  }],
  "budget": {
    "lines": [{ "category": "materials"|"labor"|"equipment"|"overhead", "label": "...", "amount": 1196, "currency": "$" }],
    "total": 7743,
    "currency": "$"
  },
  "timeline": [{ "index": 1, "name": "...", "duration": "1 week", "durationDays": 7, "dependsOn": [] }],
  "validation": [{ "metric": "Limit of detection", "threshold": "< 0.5 mg/L", "method": "...", "citations": [{"refId":"R1"}] }],
  "equipment": ["Refrigerated centrifuge (5,000 × g): cell pelleting", "Flow cytometer: viability"],
  "notes": "Short caveats — known failure modes, assumptions, anything a real PI should be told. 2-5 sentences."
}

Aim for: ~5-8 protocol steps, ~6-12 materials, ~3-6 budget lines, ~3-6 timeline phases, ~2-4 validation criteria, ~3-6 equipment items.

CURRENCY: render all prices and budget amounts in {{CURRENCY}} (USD = $, EUR = €, GBP = £). Numeric values stay numeric (no commas, no symbol).`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "submit_plan",
    description:
      "Submit the structured experiment plan. Pass the entire plan JSON as the `plan` argument. This is the ONLY tool — call it exactly once.",
    input_schema: {
      type: "object" as const,
      properties: {
        plan: {
          type: "object",
          description: "Full plan JSON matching the schema in the system prompt.",
        },
      },
      required: ["plan"],
    },
  },
];

export interface GeneratorOptions {
  currency?: "USD" | "EUR" | "GBP";
  /** Files the user attached during prompting. Become Anthropic
   *  content blocks the model can read alongside the hypothesis. */
  attachments?: AttachmentForModel[];
}

interface CatalogHit {
  reagent: string;
  url: string;
  title: string;
  snippet: string;
}

export async function generatePlan(
  hypothesis: string,
  domain: Domain,
  references: Reference[],
  options: GeneratorOptions = {}
): Promise<ExperimentPlan> {
  // 1. Reagent extraction (Haiku, ~3s)
  console.log(`[generate] step1 reagent-extraction start`);
  const reagents = await extractReagents(hypothesis, domain);
  console.log(`[generate] step1 done, ${reagents.length} reagents`);

  // 2. Parallel Tavily catalog lookups + corrections in parallel
  console.log(`[generate] step2 catalog+corrections start`);
  const [catalogResults, corrections] = await Promise.all([
    tavilyCatalogSearchBatch(reagents).catch((err) => {
      console.warn("[generate] tavily batch failed:", (err as Error).message);
      return [] as { reagent: string; result: import("@/lib/search/tavily").TavilyResult | null }[];
    }),
    getRecentCorrections(domain, 5).catch(() => []),
  ]);
  const hits: CatalogHit[] = catalogResults
    .filter((c) => c.result !== null)
    .map((c) => ({
      reagent: c.reagent,
      url: c.result!.url,
      title: c.result!.title,
      // Trim snippet to keep input tokens low — we mainly need the URL +
      // title for the model to extract a catalog #. Long content hurts
      // Sonnet/Haiku TTFT.
      snippet: (c.result!.content ?? "").slice(0, 250),
    }));
  console.log(
    `[generate] step2 done, ${hits.length}/${catalogResults.length} catalog hits, ${corrections.length} corrections`
  );

  // 3. Sonnet plan synthesis (single tool-use call to submit_plan)
  console.log(`[generate] step3 sonnet-synthesis start`);
  const result = await synthesizePlan({
    hypothesis,
    domain,
    references,
    reagents,
    hits,
    corrections,
    currency: options.currency ?? "USD",
    attachments: options.attachments ?? [],
  });
  console.log(`[generate] step3 done`);
  return result;
}

interface SynthesizeArgs {
  hypothesis: string;
  domain: Domain;
  references: Reference[];
  reagents: string[];
  hits: CatalogHit[];
  corrections: Awaited<ReturnType<typeof getRecentCorrections>>;
  currency: "USD" | "EUR" | "GBP";
  attachments: AttachmentForModel[];
}

async function synthesizePlan(args: SynthesizeArgs): Promise<ExperimentPlan> {
  const client = getAnthropic();
  const renderedSystem = SYSTEM.replace(/\{\{CURRENCY\}\}/g, args.currency);

  const referencesBlock = args.references.length
    ? `\n## Literature references (cite as R1, R2, ...):\n${args.references
        .map(
          (r, i) =>
            `[R${i + 1}] ${r.title} — ${r.authors.slice(0, 3).join(", ")}${
              r.authors.length > 3 ? " et al." : ""
            }${r.year ? ` (${r.year})` : ""}`
        )
        .join("\n")}`
    : "";

  const reagentsBlock = args.reagents.length
    ? `\n## Reagents to include (extracted from your hypothesis):\n${args.reagents.map((r) => `  - ${r}`).join("\n")}`
    : "";

  const catalogBlock = args.hits.length
    ? `\n## Catalog data (use these — already verified live against supplier domains):\n${args.hits
        .map(
          (h) =>
            `### "${h.reagent}"\n  URL: ${h.url}\n  Title: ${h.title}\n  Snippet: ${h.snippet}`
        )
        .join("\n\n")}`
    : "";

  const correctionsBlock = args.corrections.length
    ? `\n## Recent expert corrections in this domain (apply when relevant):\n${args.corrections
        .map(
          (c, i) =>
            `${i + 1}. [section: ${c.section_path}] originally: "${c.original ?? "—"}" → corrected: "${c.corrected}"${
              c.rationale ? ` — ${c.rationale}` : ""
            }`
        )
        .join("\n")}`
    : "";

  // Anthropic supports multi-block user messages: [text, image, document, ...].
  // We assemble the prose context as one text block, then append each
  // user-uploaded file as its native block type (image, document) and
  // inline text files into the prose. This lets Haiku/Sonnet read PDFs
  // and images natively as additional grounding for the plan.
  const textIntro = `# Hypothesis
${args.hypothesis}

# Domain
${args.domain}

# Currency
${args.currency}
${reagentsBlock}
${catalogBlock}
${correctionsBlock}
${referencesBlock}`;

  const fileNotes: string[] = [];
  const fileBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const a of args.attachments) {
    if (a.kind === "image" && a.base64) {
      fileNotes.push(`- Image: ${a.name}`);
      fileBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type:
            (a.contentType as
              | "image/png"
              | "image/jpeg"
              | "image/webp"
              | "image/gif") ?? "image/png",
          data: a.base64,
        },
      });
    } else if (a.kind === "document" && a.base64) {
      fileNotes.push(`- PDF: ${a.name}`);
      fileBlocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: a.base64,
        },
        title: a.name,
      });
    } else if (a.kind === "text" && a.text) {
      fileNotes.push(
        `- Text: ${a.name}${a.truncated ? " (truncated)" : ""}\n\n\`\`\`\n${a.text}\n\`\`\``
      );
    }
  }

  const userBlocks: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text:
        textIntro +
        (fileNotes.length
          ? "\n\n# User-attached reference files\n" + fileNotes.join("\n")
          : ""),
    },
    ...fileBlocks,
    {
      type: "text",
      text:
        "\nProduce the plan now by calling submit_plan with the full plan JSON. Use the catalog data above for every material entry — extract real catalog numbers from the URLs/titles/snippets. Apply expert corrections where applicable. Take user-attached files into account as grounding (paper PDFs should inform the protocol; equipment images should constrain the equipment list).",
    },
  ];

  // Haiku 4.5 for plan synthesis — Tavily already grounded the catalog
  // numbers, so this step is structured-output formatting of pre-fetched
  // facts, not novel reasoning. 3-5× faster than Sonnet 4.6.
  const response = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 8000,
    system: cachedSystemBlock(renderedSystem),
    tools: TOOLS,
    tool_choice: { type: "tool", name: "submit_plan" },
    messages: [{ role: "user", content: userBlocks }],
  });

  // Find the submit_plan tool_use block
  const toolUse = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === "submit_plan"
  );
  if (!toolUse) {
    throw new Error(
      `synthesizePlan: model did not call submit_plan (stop_reason=${response.stop_reason})`
    );
  }
  const partial = (toolUse.input as { plan?: Partial<ExperimentPlan> })?.plan ?? {};
  return finalizePlan(partial, args.hypothesis, args.domain, args.references);
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
    equipment: Array.isArray(partial.equipment) ? partial.equipment : undefined,
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
