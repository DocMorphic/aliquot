import type { PipelineEvent } from "@/lib/types";
import { classifyDomain } from "./agents/classifier";
import { litQc } from "./agents/lit-qc";
import { generatePlan } from "./agents/generator";
import { verifyPlan } from "./agents/verifier";
import { annotateConfidence } from "./agents/confidence";
import { persistExperiment } from "@/lib/supabase/persist";

/**
 * Pipeline orchestrator. Yields PipelineEvent objects as each stage
 * completes; /api/experiment/run wraps this in an SSE response.
 *
 * Stages currently wired:
 *   1. classify (Haiku)
 *   2. lit_qc (Sonnet + Semantic Scholar + arXiv)
 *   3. generate (Sonnet + Tavily tool use)
 *   4. verify (Tavily catalog re-check)
 *   5. score (deterministic confidence)
 *   6. persist (Supabase soft-fail)
 *
 * Skeptic + revise stages are intentionally deferred — the cost is high
 * and verifier already catches the most common failure mode (hallucinated
 * catalog #s). Wire them in after the demo is stable.
 */
export async function* runPipeline(
  hypothesis: string
): AsyncGenerator<PipelineEvent, void, unknown> {
  try {
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
    let plan = await generatePlan(hypothesis, domain, lit.references);
    yield { type: "plan_partial", plan };

    yield {
      type: "stage",
      stage: "verifying",
      message: `✅ Verifying ${plan.materials.length} catalog numbers…`,
    };
    plan = await verifyPlan(plan);

    yield { type: "stage", stage: "scoring", message: "📊 Computing confidence scores…" };
    plan = await annotateConfidence(plan);

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
