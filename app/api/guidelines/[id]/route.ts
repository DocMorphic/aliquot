import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/guidelines/:id
 *
 * Removes a general guideline so it stops being injected into future
 * plans. Per-experiment notes (scope='experiment') are not deletable
 * here — they're audit-trail rows tied to specific runs.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return new Response(JSON.stringify({ error: "invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const sb = getServerSupabase();
    const { error } = await sb
      .from("corrections")
      .delete()
      .eq("id", id)
      .eq("scope", "general");
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
