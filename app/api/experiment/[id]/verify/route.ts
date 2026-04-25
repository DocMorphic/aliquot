import type { NextRequest } from "next/server";
import { verifyPlan } from "@/lib/ai/agents/verifier";
import { annotateConfidence } from "@/lib/ai/agents/confidence";
import { loadPersistedPlan, updatePersistedPlan } from "@/lib/supabase/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Phase 2 — verifier does Tavily round-trips per material (parallel,
// capped at 5 in flight) plus the confidence annotator. Comfortably
// fits in the Vercel Hobby 60s window even with ~12 materials.
export const maxDuration = 60;

/**
 * POST /api/experiment/:id/verify
 *
 * Phase 2 of the pipeline. Loads the draft plan that Phase 1 just
 * persisted, runs the verifier (Tavily catalog re-checks) and the
 * confidence annotator, writes the verified plan back to Supabase,
 * and returns it. Idempotent — calling twice on the same experimentId
 * just re-verifies and overwrites.
 *
 * Response shape: { plan: ExperimentPlan } where the returned plan no
 * longer has `verificationPending`. The client merges this back into
 * the live experiment context.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  const { id } = await params;
  if (!isUuid(id)) {
    return new Response(JSON.stringify({ error: "invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const persisted = await loadPersistedPlan(id);
  if (!persisted) {
    return new Response(JSON.stringify({ error: "experiment not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    let plan = await verifyPlan(persisted.plan);
    plan = await annotateConfidence(plan);
    const phase2Ms = Date.now() - startedAt;

    // Roll the Phase-2 timing into runStats. Add a small estimated
    // verifier cost (Tavily covered, just compute time so call it $0).
    const merged = {
      ...plan,
      verificationPending: false,
      runStats: {
        durationMs: (persisted.plan.runStats?.durationMs ?? 0) + phase2Ms,
        estimatedCostUsd:
          (persisted.plan.runStats?.estimatedCostUsd ?? 0) +
          plan.materials.length * 0.001,
        toolCalls:
          (persisted.plan.runStats?.toolCalls ?? 0) + plan.materials.length,
      },
    };

    await updatePersistedPlan(id, merged);

    return new Response(JSON.stringify({ plan: merged }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "verify failed" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
