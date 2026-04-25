import { getAnthropic } from "../client";
import { MODELS } from "@/lib/constants";
import { extractJson } from "../json";

const SYSTEM = `You are gatekeeping the input to a scientific experiment-planning tool.

A specific hypothesis names:
1. A specific intervention (what is being changed)
2. A measurable outcome with a threshold (what will be measured, by how much)
3. A mechanism (why it should work)
4. An implied control (what's being compared to)

A vague hypothesis is a goal or aspiration without these specifics.
Examples of TOO VAGUE: "AI will improve drug discovery", "we should test new materials for solar cells", "find a cure for cancer".
Examples of SPECIFIC: "Replacing sucrose with trehalose in the freezing medium will increase post-thaw HeLa viability by ≥15 percentage points vs DMSO", "L. rhamnosus GG supplementation will reduce intestinal permeability ≥30% in C57BL/6 mice".

Respond with STRICT JSON only:
{
  "verdict": "specific" | "too_vague",
  "reason": "<one sentence explaining what's missing — only set when too_vague>",
  "suggestions": [
    "<a specific reformulation, ~25-50 words, complete with intervention + outcome + threshold + mechanism + control>",
    "<a different specific reformulation>"
  ]
}

Set "suggestions" to two distinct, plausible specific hypotheses the user might have meant. Set to [] when verdict is "specific".`;

export interface ValidatorResult {
  verdict: "specific" | "too_vague";
  reason?: string;
  suggestions: string[];
}

export async function validateHypothesis(hypothesis: string): Promise<ValidatorResult> {
  const trimmed = hypothesis.trim();
  // Hard short-circuit: anything under ~25 chars is almost certainly vague.
  // Saves a Haiku roundtrip on egregious cases.
  if (trimmed.length < 25) {
    return {
      verdict: "too_vague",
      reason: "Hypothesis is too short — it needs an intervention, an outcome with a threshold, a mechanism, and a control.",
      suggestions: [],
    };
  }

  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: trimmed }],
  });

  const text =
    res.content.find((b) => b.type === "text")?.type === "text"
      ? (res.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  const parsed = extractJson<ValidatorResult>(text);
  if (!parsed) {
    // Fallback: assume specific to avoid blocking on parse failures.
    return { verdict: "specific", suggestions: [] };
  }
  return {
    verdict: parsed.verdict ?? "specific",
    reason: parsed.reason,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 2) : [],
  };
}
