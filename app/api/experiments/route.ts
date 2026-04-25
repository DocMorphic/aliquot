import { listRecentExperiments } from "@/lib/supabase/experiments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/experiments?limit=20
 * Returns recent experiments + plan summary for the Library window.
 * Server-only; uses Supabase service role.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 20;

  const experiments = await listRecentExperiments(limit);
  return new Response(JSON.stringify({ experiments }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
