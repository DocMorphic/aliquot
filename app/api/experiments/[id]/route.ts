import type { NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/client";
import type { ExperimentPlan, Reference, Domain, Novelty } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExperimentDetail {
  id: string;
  hypothesis: string;
  domain: Domain | null;
  novelty: Novelty | null;
  createdAt: string;
  plan: ExperimentPlan | null;
  references: Reference[];
}

/**
 * GET /api/experiments/:id
 *
 * Returns the full persisted plan + references for one experiment.
 * Used by the Library window's "Load in Plan window" action so a user
 * can re-open any past run in the existing PlanWindow UI.
 */
export async function GET(
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
    const [{ data: exp, error: expErr }, { data: plans }, { data: refs }] = await Promise.all([
      sb.from("experiments").select("*").eq("id", id).single(),
      sb
        .from("plans")
        .select("plan_json, version, created_at")
        .eq("experiment_id", id)
        .order("version", { ascending: false })
        .limit(1),
      sb.from("references_found").select("*").eq("experiment_id", id),
    ]);

    if (expErr || !exp) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const plan = (plans?.[0]?.plan_json as ExperimentPlan | undefined) ?? null;

    const detail: ExperimentDetail = {
      id: exp.id,
      hypothesis: exp.hypothesis,
      domain: exp.domain,
      novelty: exp.novelty,
      createdAt: exp.created_at,
      plan,
      references: (refs ?? []).map((r): Reference => ({
        title: r.title,
        authors: r.authors ?? [],
        year: r.year ?? undefined,
        source: (r.source as Reference["source"]) ?? "semantic_scholar",
        doi: r.doi ?? undefined,
        url: r.url ?? undefined,
        similarity: r.similarity ?? undefined,
      })),
    };

    return new Response(JSON.stringify(detail), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
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
