import { getServerSupabase } from "./client";
import type { Domain } from "@/lib/types";

export interface CorrectionRecord {
  id: string;
  plan_id: string | null;
  domain: Domain;
  section_path: string;
  original: string | null;
  corrected: string;
  rationale: string | null;
  rating: number | null;
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
    const { data, error } = await sb
      .from("corrections")
      .select("*")
      .eq("domain", domain)
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
}

export async function insertCorrections(
  corrections: NewCorrection[]
): Promise<{ inserted: number; error?: string }> {
  if (corrections.length === 0) return { inserted: 0 };
  try {
    const sb = getServerSupabase();
    // The schema has plan_id as a nullable FK; filter out invalid plan_ids
    // (e.g. our `local-...` fallback IDs) so we don't break the FK constraint.
    const rows = corrections.map((c) => ({
      plan_id: isUuid(c.planId) ? c.planId : null,
      domain: c.domain,
      section_path: c.sectionPath,
      original: c.original ?? null,
      corrected: c.corrected,
      rationale: c.rationale ?? null,
      rating: c.rating,
    }));
    const { error } = await sb.from("corrections").insert(rows);
    if (error) throw error;
    return { inserted: rows.length };
  } catch (err) {
    return { inserted: 0, error: (err as Error).message };
  }
}

function isUuid(s: string | null): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
