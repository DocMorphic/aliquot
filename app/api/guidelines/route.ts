import { getServerSupabase } from "@/lib/supabase/client";
import type { CorrectionRecord } from "@/lib/supabase/corrections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guidelines
 *
 * Lists every general (domain-wide) correction the user has saved.
 * These are the rows the Generator pulls in as few-shot examples for
 * future plans in the same domain. The Guidelines window shows them
 * so the user can review + delete outdated ones.
 */
export async function GET() {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("corrections")
      .select("*")
      .eq("scope", "general")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return new Response(
      JSON.stringify({ guidelines: (data ?? []) as CorrectionRecord[] }),
      {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
