import type { NextRequest } from "next/server";
import {
  insertCorrections,
  type NewCorrection,
  type CorrectionScope,
} from "@/lib/supabase/corrections";
import { revisePlan } from "@/lib/ai/agents/reviser";
import { loadPersistedPlan, updatePersistedPlan } from "@/lib/supabase/persist";
import type { Domain, ExperimentPlan } from "@/lib/types";

export const runtime = "nodejs";
// Reviser is a single Haiku call — should finish in 5-10s, but allow
// headroom in case the plan is large.
export const maxDuration = 60;

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
    scope?: CorrectionScope;
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

  const scope: CorrectionScope = body.scope === "general" ? "general" : "experiment";
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
      scope,
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

  // For experiment-scoped feedback, immediately revise *this* plan with
  // a single Haiku pass. General-scope feedback only ever feeds the
  // next-plan few-shot, so we skip the revise call there.
  let revisedPlan: ExperimentPlan | null = null;
  const experimentId = body.experimentId ?? null;
  if (scope === "experiment" && experimentId) {
    try {
      const persisted = await loadPersistedPlan(experimentId);
      if (persisted?.plan) {
        const revised = await revisePlan(persisted.plan, records);
        if (revised) {
          // Carry forward fields the reviser may have dropped — keep the
          // run stats and verification status pinned to the original.
          const merged: ExperimentPlan = {
            ...revised,
            runStats: revised.runStats ?? persisted.plan.runStats,
            verificationPending: persisted.plan.verificationPending,
            confidenceSummary:
              revised.confidenceSummary ?? persisted.plan.confidenceSummary,
          };
          await updatePersistedPlan(experimentId, merged);
          revisedPlan = merged;
        }
      }
    } catch (err) {
      // Soft-fail: corrections are saved even if the revise step fails.
      // The UI will get a confirmation but no revisedPlan, and PlanWindow
      // keeps showing the original.
      console.warn(
        "[corrections] revise step soft-failed:",
        (err as Error).message
      );
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      inserted: result.inserted,
      scope,
      revisedPlan,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
