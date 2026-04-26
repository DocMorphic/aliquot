import { getServerSupabase } from "./client";
import type { Domain, ExperimentPlan, Novelty, Reference } from "@/lib/types";

/**
 * Phase 1: create the experiment row + persist references_found.
 * No plan is saved yet — Phase 2's generator will save the draft plan.
 *
 * Soft-fails on any error (env missing, RLS, network) and returns null;
 * the SSE pipeline still streams stages but the client gets a sentinel
 * "local-..." id and Phase 2/3 are skipped.
 */
export async function createExperimentRecord(args: {
  hypothesis: string;
  domain: Domain;
  novelty: Novelty;
  references: Reference[];
}): Promise<string | null> {
  try {
    const sb = getServerSupabase();

    const { data: exp, error: expErr } = await sb
      .from("experiments")
      .insert({
        hypothesis: args.hypothesis,
        domain: args.domain,
        status: "running",
        novelty: args.novelty,
      })
      .select("id")
      .single();
    if (expErr) throw expErr;
    const experimentId = exp.id as string;

    if (args.references.length > 0) {
      await sb.from("references_found").insert(
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
      );
    }

    return experimentId;
  } catch (err) {
    console.warn("[createExperimentRecord] soft-failed:", (err as Error).message);
    return null;
  }
}

/** Load just the bare experiment shell — used by /generate to recover
 *  the hypothesis / domain / references after Phase 1 persisted them. */
export async function loadExperimentForGeneration(experimentId: string): Promise<{
  hypothesis: string;
  domain: Domain;
  novelty: Novelty | null;
  references: Reference[];
} | null> {
  try {
    const sb = getServerSupabase();
    const { data: exp, error } = await sb
      .from("experiments")
      .select("hypothesis, domain, novelty")
      .eq("id", experimentId)
      .single();
    if (error || !exp) return null;

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
      domain: exp.domain as Domain,
      novelty: exp.novelty as Novelty | null,
      references,
    };
  } catch (err) {
    console.warn("[loadExperimentForGeneration] soft-failed:", (err as Error).message);
    return null;
  }
}

/** Phase 2: insert the draft plan (post-generator). */
export async function saveDraftPlan(
  experimentId: string,
  plan: ExperimentPlan
): Promise<boolean> {
  try {
    const sb = getServerSupabase();
    const { error } = await sb.from("plans").insert({
      experiment_id: experimentId,
      version: 1,
      plan_json: plan,
      confidence_summary: plan.confidenceSummary,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[saveDraftPlan] soft-failed:", (err as Error).message);
    return false;
  }
}

/** Phase 3: replace the persisted plan with the verified + scored
 *  version. Same body as before — just renamed for clarity. */
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
    // Mark the experiment fully done now that verification is complete.
    await sb.from("experiments").update({ status: "done" }).eq("id", experimentId);
    return true;
  } catch (err) {
    console.warn("[updatePersistedPlan] soft-failed:", (err as Error).message);
    return false;
  }
}
