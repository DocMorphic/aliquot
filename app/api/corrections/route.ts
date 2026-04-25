import type { NextRequest } from "next/server";
import { insertCorrections, type NewCorrection } from "@/lib/supabase/corrections";
import type { Domain } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/corrections
 * Body: {
 *   experimentId: string | null;        // last plan's experiment id (UUID); ignored if not a UUID
 *   planId?: string;                     // explicit plan id, takes precedence over experimentId
 *   domain: Domain;
 *   corrections: Array<{
 *     sectionPath: string;
 *     original?: string;
 *     corrected: string;
 *     rationale?: string;
 *     rating: number;
 *   }>;
 * }
 *
 * Persists scientist corrections to Supabase `corrections` table.
 * Retrieved by the Generator agent via the get_corrections tool on
 * subsequent plans in the same domain — closes the feedback loop.
 *
 * For the 24h scope this stores raw text without an embedding. The
 * Generator does recency-only retrieval (latest N in domain, ordered
 * by rating). Adding pgvector similarity is a follow-up — schema and
 * column are already in place.
 */
export async function POST(req: NextRequest) {
  let body: {
    experimentId?: string | null;
    planId?: string | null;
    domain?: Domain;
    corrections?: Array<{
      sectionPath?: string;
      original?: string;
      corrected?: string;
      rationale?: string;
      rating?: number;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.domain) {
    return new Response(JSON.stringify({ error: "domain is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!Array.isArray(body.corrections) || body.corrections.length === 0) {
    return new Response(
      JSON.stringify({ error: "corrections array required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const records: NewCorrection[] = body.corrections
    .filter((c) => c.corrected && c.corrected.trim().length > 0)
    .map((c) => ({
      planId: body.planId ?? body.experimentId ?? null,
      domain: body.domain!,
      sectionPath: c.sectionPath ?? "general",
      original: c.original,
      corrected: c.corrected!,
      rationale: c.rationale,
      rating: typeof c.rating === "number" ? c.rating : 4,
    }));

  if (records.length === 0) {
    return new Response(
      JSON.stringify({ error: "no valid corrections (corrected text required)" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const result = await insertCorrections(records);
  if (result.error) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ ok: true, inserted: result.inserted }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
