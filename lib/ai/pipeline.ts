import type { PipelineEvent } from "@/lib/types";
import { validateHypothesis } from "./agents/validator";
import { classifyDomain } from "./agents/classifier";
import { litQc } from "./agents/lit-qc";
import { createExperimentRecord } from "@/lib/supabase/persist";

export interface PipelineOptions {
  /** Currency to render the budget in. Persisted with the experiment
   *  so Phase 2 (generator) can apply it. */
  currency?: "USD" | "EUR" | "GBP";
}

/**
 * Phase 1 pipeline orchestrator (sync SSE, target ≤15s).
 *
 * Stages:
 *   0. validate    (Haiku, ≤3s) — gates vague prompts
 *   1. classify    (Haiku, ≤2s)
 *   2. lit_qc      (Sonnet + OpenAlex + arXiv, ≤10s)
 *   3. persist     (Supabase experiment + references row)
 *   4. experiment_started — emits the new experimentId
 *
 * Generator now lives in Phase 2 (POST /api/experiment/[id]/generate)
 * and verifier+score in Phase 3 (POST /api/experiment/[id]/verify),
 * so each phase fits inside the Vercel Hobby 60s function cap.
 *
 * The currency is forwarded as a hint via dataTransfer-style URL param
 * on the Phase 2 fetch (the client manages that).
 */
export async function* runPipeline(
  hypothesis: string,
  _options: PipelineOptions = {}
): AsyncGenerator<PipelineEvent, void, unknown> {
  try {
    yield { type: "stage", stage: "validating", message: "Checking hypothesis specificity…" };
    const validation = await validateHypothesis(hypothesis);
    if (validation.verdict === "too_vague") {
      yield {
        type: "needs_refinement",
        reason:
          validation.reason ??
          "This hypothesis is too vague — it needs a specific intervention, a measurable outcome with a threshold, a mechanism, and an implied control.",
        suggestions: validation.suggestions,
      };
      return;
    }

    yield { type: "stage", stage: "classifying", message: "Identifying scientific domain…" };
    const domain = await classifyDomain(hypothesis);

    yield { type: "stage", stage: "lit_qc", message: "Searching the literature…" };
    const lit = await litQc(hypothesis, domain);
    yield { type: "lit_qc", novelty: lit.novelty, references: lit.references };

    // Persist the experiment shell so the client gets an id to use for
    // Phase 2 + 3.
    const experimentId = await createExperimentRecord({
      hypothesis,
      domain,
      novelty: lit.novelty,
      references: lit.references,
    });

    yield {
      type: "experiment_started",
      experimentId: experimentId ?? `local-${Date.now().toString(36)}`,
      hypothesis,
      domain,
    };
  } catch (err) {
    console.error("[pipeline] failure:", err);
    yield { type: "error", message: (err as Error).message ?? "Pipeline error" };
  }
}
