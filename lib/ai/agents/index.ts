// =====================================================================
// Aliquot — agent stubs
// =====================================================================
// Each export here will become a real Anthropic SDK call once env keys
// are configured. They're invoked by lib/ai/pipeline.ts in the order:
//   classifyDomain → litQc → generatePlan → critique → revise → verify → annotate
//
// The pipeline currently runs against deterministic mocks in pipeline.ts
// so the UI is testable without API keys. When you implement these,
// update pipeline.ts to delegate.
//
// IMPORTANT: every Sonnet call should pass `system: cachedSystemBlock(...)`
// from "@/lib/ai/client" so the long shared system prompt is cached for
// the 5-minute prompt-cache TTL — saves ~70% on input tokens after the
// first call inside a single experiment.

import type {
  Domain,
  Novelty,
  Reference,
  ExperimentPlan,
} from "@/lib/types";

export async function classifyDomain(_hypothesis: string): Promise<Domain> {
  throw new Error("TODO: implement Haiku classifier (lib/ai/agents/classifier.ts)");
}

export async function litQc(
  _hypothesis: string,
  _domain: Domain
): Promise<{ novelty: Novelty; references: Reference[] }> {
  throw new Error("TODO: implement Sonnet lit-qc with Semantic Scholar + arXiv search");
}

export async function generatePlan(
  _hypothesis: string,
  _domain: Domain,
  _references: Reference[]
): Promise<ExperimentPlan> {
  throw new Error("TODO: implement Sonnet generator with tool use (search_protocols, search_catalog, get_corrections)");
}

export async function critiquePlan(_plan: ExperimentPlan): Promise<string[]> {
  throw new Error("TODO: implement adversarial Sonnet skeptic");
}

export async function revisePlan(
  _plan: ExperimentPlan,
  _critique: string[]
): Promise<ExperimentPlan> {
  throw new Error("TODO: implement Sonnet revise");
}

export async function verifyPlan(plan: ExperimentPlan): Promise<ExperimentPlan> {
  throw new Error("TODO: implement Sonnet verifier with Tavily catalog re-check");
}

export async function annotateConfidence(
  _plan: ExperimentPlan
): Promise<ExperimentPlan> {
  throw new Error("TODO: implement Haiku confidence annotator");
}
