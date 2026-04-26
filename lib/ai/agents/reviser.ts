import { getAnthropic } from "../client";
import { MODELS } from "@/lib/constants";
import type { ExperimentPlan } from "@/lib/types";
import { extractJson } from "../json";

const SYSTEM = `You revise experiment plans to incorporate scientist feedback.

You will receive:
- The current plan as JSON
- A list of corrections from a scientist reviewer

Your job: produce an updated plan that honors EVERY correction. Apply the
scientist's intent literally (if they say "delete step 1", remove the first
protocol step and renumber). Keep everything else unchanged — do not
rewrite, restyle, or improve sections the scientist did not flag.

Rules:
- Preserve the exact JSON shape of the input plan. Same keys. Same
  nested types. Numbers stay numbers, arrays stay arrays.
- If a correction targets the protocol, materials, equipment, budget,
  timeline, validation, or caveats arrays, edit those arrays.
- If removing a protocol step changes the budget total or material list,
  update them consistently.
- Keep all existing source URLs, catalog numbers, and citations unless
  a correction explicitly changes them.
- Set runStats to the existing runStats; do not invent new metrics.
- Output STRICT JSON only — no preamble, no markdown fences.

Output schema: the same ExperimentPlan JSON, with edits applied.`;

interface CorrectionInput {
  sectionPath: string;
  original?: string | null;
  corrected: string;
  rationale?: string | null;
}

/**
 * Apply scientist corrections to a single plan and return the revised
 * version. Used by the corrections endpoint when scope='experiment'
 * — the user asked for a change to *this* plan, not a domain-wide
 * guideline. Runs as a single Haiku call for low latency (~5-10s).
 *
 * Soft-fails: if the model returns malformed JSON or an empty plan,
 * we return null and the caller keeps the original plan in place.
 */
export async function revisePlan(
  plan: ExperimentPlan,
  corrections: CorrectionInput[]
): Promise<ExperimentPlan | null> {
  if (corrections.length === 0) return null;
  const client = getAnthropic();

  const correctionsText = corrections
    .map((c, i) => {
      const lines: string[] = [`${i + 1}. Section: ${c.sectionPath}`];
      if (c.original) lines.push(`   Was: ${c.original}`);
      lines.push(`   Apply: ${c.corrected}`);
      if (c.rationale) lines.push(`   Why: ${c.rationale}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const userMessage = `Current plan:
${JSON.stringify(plan, null, 2)}

Scientist corrections (apply each one literally):
${correctionsText}

Return the full revised plan as STRICT JSON.`;

  try {
    const res = await client.messages.create({
      model: MODELS.fast,
      max_tokens: 6000,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      res.content.find((b) => b.type === "text")?.type === "text"
        ? (res.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
        : "";

    const revised = extractJson<ExperimentPlan>(text);
    if (!revised || typeof revised !== "object") return null;
    // Sanity-check that the model didn't drop required arrays.
    if (
      !Array.isArray(revised.protocol) ||
      !Array.isArray(revised.materials)
    ) {
      console.warn("[revisePlan] revised plan missing required arrays");
      return null;
    }
    return revised;
  } catch (err) {
    console.warn("[revisePlan] failed:", (err as Error).message);
    return null;
  }
}
