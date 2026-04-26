import { getServerSupabase } from "./client";
import type { Domain } from "@/lib/types";

export type CorrectionScope = "experiment" | "general";

export interface CorrectionRecord {
  id: string;
  plan_id: string | null;
  domain: Domain;
  section_path: string;
  original: string | null;
  corrected: string;
  rationale: string | null;
  rating: number | null;
  scope: CorrectionScope;
  created_at: string;
}

/**
 * Retrieve recent expert corrections for a given domain. The Generator
 * agent's get_corrections tool calls this and injects the results as
 * few-shot examples in the next plan's system prompt.
 *
 * For the 24h scope this is recency-only retrieval (no pgvector
 * similarity yet) — domain match + rating order is good enough to
 * demo "the system gets smarter as it accumulates feedback." Add
 * embeddings (Voyage AI) for better matching once the demo is stable.
 */
export async function getRecentCorrections(
  domain: Domain,
  limit = 5
): Promise<CorrectionRecord[]> {
  try {
    const sb = getServerSupabase();
    // Only general guidelines feed back into future plans. Per-experiment
    // notes (scope='experiment') are kept as audit trail but never injected
    // as few-shot examples — they were specific to that one run.
    const { data, error } = await sb
      .from("corrections")
      .select("*")
      .eq("domain", domain)
      .eq("scope", "general")
      .order("rating", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CorrectionRecord[];
  } catch (err) {
    console.warn("[getRecentCorrections] failed:", (err as Error).message);
    return [];
  }
}

export interface NewCorrection {
  planId: string | null;
  domain: Domain;
  sectionPath: string;
  original?: string;
  corrected: string;
  rationale?: string;
  rating: number;
  scope: CorrectionScope;
}

export async function insertCorrections(
  corrections: NewCorrection[]
): Promise<{ inserted: number; error?: string }> {
  if (corrections.length === 0) return { inserted: 0 };
  try {
    const sb = getServerSupabase();

    // The client passes `experimentId` as planId, but the corrections
    // table FKs to plans.id, not experiments.id. Resolve actual plan
    // ids by looking them up in batch — one query, idempotent.
    const candidateIds = Array.from(
      new Set(
        corrections
          .map((c) => c.planId)
          .filter((id): id is string => isUuid(id))
      )
    );
    const idMap = new Map<string, string>();
    if (candidateIds.length > 0) {
      // Try matching as experiment_id first (the common case from the
      // ReviewWindow), then merge in any direct plan id matches.
      const { data: byExp } = await sb
        .from("plans")
        .select("id, experiment_id")
        .in("experiment_id", candidateIds)
        .order("version", { ascending: false });
      for (const row of byExp ?? []) {
        if (!idMap.has(row.experiment_id)) idMap.set(row.experiment_id, row.id);
      }
      const stillUnknown = candidateIds.filter((id) => !idMap.has(id));
      if (stillUnknown.length > 0) {
        const { data: byPlan } = await sb
          .from("plans")
          .select("id")
          .in("id", stillUnknown);
        for (const row of byPlan ?? []) idMap.set(row.id, row.id);
      }
    }

    const rows = corrections.map((c) => ({
      plan_id: c.planId && idMap.has(c.planId) ? idMap.get(c.planId)! : null,
      domain: c.domain,
      section_path: c.sectionPath,
      original: c.original ?? null,
      corrected: c.corrected,
      rationale: c.rationale ?? null,
      rating: c.rating,
      scope: c.scope,
    }));
    const { error } = await sb.from("corrections").insert(rows);
    if (error) throw error;
    return { inserted: rows.length };
  } catch (err) {
    return { inserted: 0, error: (err as Error).message };
  }
}

function isUuid(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
