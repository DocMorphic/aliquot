import { getServerSupabase } from "./client";
import type { ExperimentPlan, Novelty, Reference } from "@/lib/types";

/**
 * Persist a completed experiment + plan to Supabase. Returns the
 * experiment id so the SSE stream can include it for client-side
 * polling and the corrections write path.
 *
 * Soft-fails: if anything goes wrong (env not set, RLS, network), we log
 * and return null. The pipeline still completes and the user sees the
 * generated plan; persistence is non-critical for the demo path.
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

    // Plan + references run in parallel — neither blocks the other.
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
