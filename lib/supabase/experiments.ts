import { getServerSupabase } from "./client";
import type { Domain, Novelty, ExperimentPlan } from "@/lib/types";

export interface ExperimentSummary {
  id: string;
  hypothesis: string;
  domain: Domain | null;
  novelty: Novelty | null;
  createdAt: string;
  /** Plan summary fields, null if no plan persisted yet. */
  materialsCount: number | null;
  protocolStepsCount: number | null;
  budgetTotal: number | null;
  budgetCurrency: string | null;
  overallConfidence: number | null;
}

interface PlansSummaryRow {
  plan_json: ExperimentPlan;
  confidence_summary: ExperimentPlan["confidenceSummary"] | null;
}

interface ExperimentRow {
  id: string;
  hypothesis: string;
  domain: Domain | null;
  novelty: Novelty | null;
  created_at: string;
  // Supabase typed as array even with limit(1) on the inner select.
  plans: PlansSummaryRow[] | null;
}

/**
 * List recent experiments + their latest plan summary. Used by the
 * Library window. Soft-fails to [] if Supabase is unreachable.
 *
 * Joined query: experiments left-joined with plans (most-recent plan
 * per experiment via order/limit). The plan_json blob is decoded just
 * for the summary fields we need; we don't ship full plans to the
 * Library — those load on demand via a future detail endpoint.
 */
export async function listRecentExperiments(limit = 20): Promise<ExperimentSummary[]> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("experiments")
      .select(
        `id, hypothesis, domain, novelty, created_at,
         plans!inner ( plan_json, confidence_summary )`
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return (data as ExperimentRow[] | null ?? []).map((row): ExperimentSummary => {
      const plan = row.plans?.[0]?.plan_json ?? null;
      const confidence = row.plans?.[0]?.confidence_summary ?? null;
      return {
        id: row.id,
        hypothesis: row.hypothesis,
        domain: row.domain,
        novelty: row.novelty,
        createdAt: row.created_at,
        materialsCount: plan?.materials?.length ?? null,
        protocolStepsCount: plan?.protocol?.length ?? null,
        budgetTotal: plan?.budget?.total ?? null,
        budgetCurrency: plan?.budget?.currency ?? null,
        overallConfidence: confidence?.overall ?? null,
      };
    });
  } catch (err) {
    console.warn("[listRecentExperiments] failed:", (err as Error).message);
    return [];
  }
}
