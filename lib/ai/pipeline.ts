import type { PipelineEvent } from "@/lib/types";
import { validateHypothesis } from "./agents/validator";
import { classifyDomain } from "./agents/classifier";
import { litQc } from "./agents/lit-qc";
import { generatePlan } from "./agents/generator";
import { verifyPlan } from "./agents/verifier";
import { annotateConfidence } from "./agents/confidence";
import { persistExperiment } from "@/lib/supabase/persist";

export interface PipelineOptions {
  /** Currency to render the budget in. Generator uses this in its system prompt. */
  currency?: "USD" | "EUR" | "GBP";
}

/**
 * Pipeline orchestrator. Yields PipelineEvent objects as each stage
 * completes; /api/experiment/run wraps this in an SSE response.
 *
 * Stages currently wired:
 *   0. validate    (Haiku — gates vague prompts)
 *   1. classify    (Haiku — domain routing)
 *   2. lit_qc      (Sonnet + OpenAlex + arXiv)
 *   3. generate    (Sonnet + Tavily tool use)
 *   4. verify      (Tavily catalog re-check)
 *   5. score       (deterministic confidence)
 *   6. persist     (Supabase, soft-fail)
 *
 * Skeptic + revise stages are intentionally deferred — the cost is high
 * and verifier already catches the most common failure mode (hallucinated
 * catalog #s).
 */
export async function* runPipeline(
  hypothesis: string,
  options: PipelineOptions = {}
): AsyncGenerator<PipelineEvent, void, unknown> {
  const startedAt = Date.now();
  try {
    // Stage 0 — validator (cheap Haiku call). Stops early if vague.
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
    let plan = await generatePlan(hypothesis, domain, lit.references, {
      currency: options.currency ?? "USD",
    });
    yield { type: "plan_partial", plan };

    yield {
      type: "stage",
      stage: "verifying",
      message: `✅ Verifying ${plan.materials.length} catalog numbers…`,
    };
    plan = await verifyPlan(plan);

    yield { type: "stage", stage: "scoring", message: "📊 Computing confidence scores…" };
    plan = await annotateConfidence(plan);

    // Attach run telemetry so the UI can show "Generated in X s · ~$Y".
    const durationMs = Date.now() - startedAt;
    plan = {
      ...plan,
      runStats: {
        durationMs,
        // Rough fixed estimate covers the typical full pipeline:
        // Sonnet generator + verifier ~$0.10–0.18, Haiku stages ~$0.001,
        // Tavily covered by the user's redeem code. Replace with a real
        // token-counter once we want fine-grained billing in the demo.
        estimatedCostUsd: roundCost(0.15 + plan.materials.length * 0.005),
        toolCalls: plan.materials.length, // approximate — Tavily call per material
      },
    };

    const experimentId = await persistExperiment({
      hypothesis,
      novelty: lit.novelty,
      references: lit.references,
      plan,
    });

    yield {
      type: "plan_done",
      plan,
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
