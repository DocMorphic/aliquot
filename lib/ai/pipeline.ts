import type { PipelineEvent } from "@/lib/types";
import { validateHypothesis } from "./agents/validator";
import { classifyDomain } from "./agents/classifier";
import { litQc } from "./agents/lit-qc";
import { generatePlan } from "./agents/generator";
import { persistExperiment } from "@/lib/supabase/persist";

export interface PipelineOptions {
  /** Currency to render the budget in. Generator uses this in its system prompt. */
  currency?: "USD" | "EUR" | "GBP";
}

/**
 * Phase 1 pipeline orchestrator (sync, must fit in <55s on Vercel Hobby).
 * Yields PipelineEvent objects; /api/experiment/run wraps this in SSE.
 *
 * Stages:
 *   0. validate    (Haiku, ≤3s)
 *   1. classify    (Haiku, ≤2s)
 *   2. lit_qc      (Sonnet + OpenAlex + arXiv, ≤10s)
 *   3. generate    (Sonnet + Tavily tool use, MAX_TOOL_TURNS=4, ≤40s)
 *   4. persist     (Supabase draft, ≤2s)
 *   5. plan_done   (un-verified plan + verificationPending=true)
 *
 * Verifier + confidence + final persist run in Phase 2 via the
 * /api/experiment/{id}/verify endpoint, kicked off by the client as
 * soon as the plan_done event arrives. This keeps the SSE stream
 * inside the 60s budget while still delivering verified marks.
 */
export async function* runPipeline(
  hypothesis: string,
  options: PipelineOptions = {}
): AsyncGenerator<PipelineEvent, void, unknown> {
  const startedAt = Date.now();
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

    yield {
      type: "stage",
      stage: "generating",
      message: "Drafting protocol with grounded sources…",
    };
    const draftPlan = await generatePlan(hypothesis, domain, lit.references, {
      currency: options.currency ?? "USD",
    });

    // Attach Phase-1 telemetry. estimatedCostUsd will be revised
    // upward in Phase 2 once verifier costs are known.
    const phaseOneMs = Date.now() - startedAt;
    const planForPersist = {
      ...draftPlan,
      verificationPending: true,
      runStats: {
        durationMs: phaseOneMs,
        estimatedCostUsd: roundCost(0.10 + draftPlan.materials.length * 0.003),
        toolCalls: draftPlan.materials.length,
      },
    };

    const experimentId = await persistExperiment({
      hypothesis,
      novelty: lit.novelty,
      references: lit.references,
      plan: planForPersist,
    });

    yield {
      type: "plan_done",
      plan: planForPersist,
      experimentId: experimentId ?? `local-${Date.now().toString(36)}`,
    };
  } catch (err) {
    console.error("[pipeline] failure:", err);
    yield { type: "error", message: (err as Error).message ?? "Pipeline error" };
  }
}

function roundCost(usd: number): number {
  return Math.round(usd * 100) / 100;
}
