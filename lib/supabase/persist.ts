import { getServerSupabase } from "./client";
import type { ExperimentPlan, Novelty, Reference } from "@/lib/types";

/**
 * Persist a draft experiment + plan + references to Supabase at the
 * end of Phase 1 (post-generator, pre-verifier). Returns the
 * experiment id so the SSE stream can hand it to the client, which
 * will use it to call the Phase 2 verify endpoint.
 *
 * Soft-fails: if anything goes wrong (env not set, RLS, network), we
 * log and return null. The pipeline still completes and the user sees
 * the generated plan; persistence is non-critical for the demo path.
 */
export async function persistExperiment(args: {
  hypothesis: string;
  novelty: Novelty;
  references: Reference[];
  plan: ExperimentPlan;
}): Promise<string | null> {
  try {
    const sb = getServerSupabase();

    const { data: exp, error: expErr } = await sb
      .from("experiments")
      .insert({
        hypothesis: args.hypothesis,
        domain: args.plan.domain,
        status: "done",
        novelty: args.novelty,
      })
      .select("id")
      .single();
    if (expErr) throw expErr;
    const experimentId = exp.id as string;

    await Promise.all([
      sb.from("plans").insert({
        experiment_id: experimentId,
        version: 1,
        plan_json: args.plan,
        confidence_summary: args.plan.confidenceSummary,
      }),
      args.references.length > 0
        ? sb.from("references_found").insert(
            args.references.map((r) => ({
              experiment_id: experimentId,
              doi: r.doi,
              url: r.url,
              title: r.title,
              authors: r.authors,
              year: r.year,
              source: r.source,
              similarity: r.similarity,
            }))
          )
        : Promise.resolve(),
    ]);

    return experimentId;
  } catch (err) {
    console.warn("[persistExperiment] soft-failed:", (err as Error).message);
    return null;
  }
}

/**
 * Phase 2: replace the persisted plan with the verified + scored
 * version. Called by /api/experiment/[id]/verify after running the
 * verifier and confidence annotator.
 *
 * Returns the previously-persisted plan with the new fields applied,
 * or null if anything goes wrong (caller surfaces the error to the UI).
 */
export async function loadPersistedPlan(
  experimentId: string
): Promise<{ hypothesis: string; novelty: Novelty | null; references: Reference[]; plan: ExperimentPlan } | null> {
  try {
    const sb = getServerSupabase();
    const { data: exp, error: expErr } = await sb
      .from("experiments")
      .select("hypothesis, novelty")
      .eq("id", experimentId)
      .single();
    if (expErr || !exp) return null;

    const { data: planRow } = await sb
      .from("plans")
      .select("plan_json")
      .eq("experiment_id", experimentId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (!planRow) return null;

    const { data: refRows } = await sb
      .from("references_found")
      .select("*")
      .eq("experiment_id", experimentId);

    const references: Reference[] = (refRows ?? []).map((r): Reference => ({
      title: r.title,
      authors: r.authors ?? [],
      year: r.year ?? undefined,
      source: (r.source as Reference["source"]) ?? "semantic_scholar",
      doi: r.doi ?? undefined,
      url: r.url ?? undefined,
      similarity: r.similarity ?? undefined,
    }));

    return {
      hypothesis: exp.hypothesis,
      novelty: exp.novelty as Novelty | null,
      references,
      plan: planRow.plan_json as ExperimentPlan,
    };
  } catch (err) {
    console.warn("[loadPersistedPlan] soft-failed:", (err as Error).message);
    return null;
  }
}

export async function updatePersistedPlan(
  experimentId: string,
  plan: ExperimentPlan
): Promise<boolean> {
  try {
    const sb = getServerSupabase();
    const { error } = await sb
      .from("plans")
      .update({
        plan_json: plan,
        confidence_summary: plan.confidenceSummary,
      })
      .eq("experiment_id", experimentId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[updatePersistedPlan] soft-failed:", (err as Error).message);
    return false;
  }
}
