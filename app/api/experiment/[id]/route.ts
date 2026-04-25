import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/experiment/:id
 * Polling endpoint for clients that lost the SSE stream. Returns the
 * persisted plan from Supabase.
 *
 * STUB — wire up Supabase fetch once env vars are configured.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return new Response(
    JSON.stringify({
      id,
      status: "not_implemented",
      message: "Supabase fetch not wired yet. Use SSE on /api/experiment/run.",
    }),
    {
      status: 501,
      headers: { "content-type": "application/json" },
    }
  );
}
