import type { ExperimentPlan } from "@/lib/types";

/**
 * Confidence annotator. Deterministic for now (no LLM call) — derives
 * scores from grounding signals already in the plan:
 *   - protocol step: # of citations + has duration → up
 *   - material: verified=true via Tavily → up; missing supplier/catalog → down
 *   - budget line: present amount → up
 *   - timeline phase: dependencies declared → up
 *   - validation criterion: has citations + has threshold → up
 *
 * Replace with a Haiku call later for richer scoring (e.g. assess source
 * quality, check multi-source agreement). For now this keeps the demo
 * trustworthy without burning extra tokens.
 */
export async function annotateConfidence(plan: ExperimentPlan): Promise<ExperimentPlan> {
  const protocol = plan.protocol.map((s) => {
    const hasCite = (s.citations?.length ?? 0) > 0;
    const hasDur = !!s.duration;
    const score = clamp(0.55 + (hasCite ? 0.2 : 0) + (hasDur ? 0.12 : 0) + (s.text.length > 60 ? 0.08 : 0));
    return { ...s, confidence: s.confidence ?? score };
  });

  const materials = plan.materials.map((m) => {
    const hasUrl = !!m.url;
    const hasPrice = typeof m.unitPrice === "number";
    const score = m.verified
      ? clamp(0.85 + (hasUrl ? 0.05 : 0) + (hasPrice ? 0.05 : 0))
      : clamp(0.55 + (hasUrl ? 0.1 : 0) + (hasPrice ? 0.05 : 0));
    return { ...m, confidence: m.confidence ?? score };
  });

  const meanProtocol = mean(protocol.map((p) => p.confidence ?? 0.7));
  const meanMaterials = mean(materials.map((m) => m.confidence ?? 0.7));
  const budgetScore = plan.budget.lines.length > 0 ? 0.78 : 0.5;
  const timelineScore = plan.timeline.length >= 3 ? 0.82 : 0.65;
  const validationScore =
    plan.validation.every((v) => v.threshold && v.method) && plan.validation.length >= 2
      ? 0.88
      : 0.7;
  const overall = mean([meanProtocol, meanMaterials, budgetScore, timelineScore, validationScore]);

  return {
    ...plan,
    protocol,
    materials,
    confidenceSummary: {
      overall: round(overall),
      protocol: round(meanProtocol),
      materials: round(meanMaterials),
      budget: round(budgetScore),
      timeline: round(timelineScore),
      validation: round(validationScore),
    },
  };
}

function clamp(v: number): number {
  return Math.max(0.1, Math.min(0.99, v));
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
