import { getAnthropic } from "../client";
import { MODELS } from "@/lib/constants";
import { extractJson } from "../json";

const SYSTEM = `You are gatekeeping the input to a scientific experiment-planning tool.

A specific hypothesis names:
1. A specific intervention (what is being changed)
2. A measurable outcome with a threshold (what will be measured, by how much)
3. A mechanism (why it should work)
4. An implied control (what's being compared to)

Three verdicts:

- "specific" — the input has all four elements above. No reformulation needed.
- "informal" — the input has clear scientific intent but is phrased casually or
  is missing one or two of the four elements. We can confidently rephrase it
  into a proper hypothesis. Example informal: "does drinking matcha lower
  stress?" — clear question, but lacks threshold/mechanism/control.
- "too_vague" — the input is a goal or aspiration without enough scientific
  intent to even guess at a specific hypothesis. Example: "AI will improve
  drug discovery", "find a cure for cancer".

Respond with STRICT JSON only:

{
  "verdict": "specific" | "informal" | "too_vague",
  "reason": "<one sentence explaining what's missing — only set when not 'specific'>",
  "refined": "<a single specific reformulation, ~25-50 words, with intervention + outcome with threshold + mechanism + control — set on BOTH 'informal' AND 'too_vague'>",
  "suggestions": [
    "<distinct specific reformulation A>",
    "<distinct specific reformulation B>"
  ]
}

When verdict is "too_vague", STILL produce a best-guess "refined" rewrite.
Pick the most likely scientific interpretation of what the user wants to test.
The user will see the rewrite and edit it if they meant something else — your
job is to commit to a concrete hypothesis they can react to. Only leave
"refined" empty when the input is so unrelated to science that no honest
guess is possible (e.g. random keystrokes, profanity, off-topic chat).

"suggestions" is a fallback ONLY for the case above where you cannot produce
a refined rewrite. When you DO produce a refined rewrite, leave suggestions
as []. When you cannot, populate suggestions with TWO plausible scientific
reformulations the user might choose between.

Lean toward "informal" over "too_vague" when there's any clear scientific
direction in the input. Lean toward "informal" over "specific" when the
phrasing is casual or missing a threshold/control even if everything else
is implied.`;

export type ValidatorVerdict = "specific" | "informal" | "too_vague";

export interface ValidatorResult {
  verdict: ValidatorVerdict;
  reason?: string;
  refined?: string;
  suggestions: string[];
}

export async function validateHypothesis(hypothesis: string): Promise<ValidatorResult> {
  const trimmed = hypothesis.trim();
  // Hard short-circuit: anything under ~25 chars is almost certainly vague.
  if (trimmed.length < 25) {
    return {
      verdict: "too_vague",
      reason:
        "Hypothesis is too short — it needs an intervention, an outcome with a threshold, a mechanism, and a control.",
      suggestions: [],
    };
  }

  const client = getAnthropic();
  const res = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 700,
    system: SYSTEM,
    messages: [{ role: "user", content: trimmed }],
  });

  const text =
    res.content.find((b) => b.type === "text")?.type === "text"
      ? (res.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  const parsed = extractJson<ValidatorResult>(text);
  if (!parsed) {
    return { verdict: "specific", suggestions: [] };
  }
  const verdict: ValidatorVerdict =
    parsed.verdict === "informal" || parsed.verdict === "too_vague"
      ? parsed.verdict
      : "specific";
  return {
    verdict,
    reason: parsed.reason,
    refined: typeof parsed.refined === "string" ? parsed.refined : undefined,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 2) : [],
  };
}
