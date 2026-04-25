import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/corrections
 * Body: {
 *   experimentId: string | null;
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
 * Persists scientist corrections to Supabase `corrections` table along with
 * an embedding so the Generator agent can retrieve similar past corrections
 * via pgvector and inject them as few-shot examples on subsequent plans
 * in the same domain.
 *
 * STUB — wire up Supabase write + Anthropic embedding once env vars are
 * configured. Currently echoes the payload so the UI flow works end-to-end.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { corrections } = body ?? {};
    if (!Array.isArray(corrections) || corrections.length === 0) {
      return new Response(
        JSON.stringify({ error: "corrections array required" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        ok: true,
        saved: corrections.length,
        note: "Stub implementation — Supabase persistence not wired yet.",
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Invalid request" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }
}
