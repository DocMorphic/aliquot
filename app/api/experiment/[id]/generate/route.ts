import type { NextRequest } from "next/server";
import { generatePlan } from "@/lib/ai/agents/generator";
import {
  loadExperimentForGeneration,
  saveDraftPlan,
} from "@/lib/supabase/persist";
import type { ExperimentPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Phase 2 — generator only. Tightest budget. With MAX_TOOL_TURNS=2
// the model batches all tool calls in turn 1 and submits on turn 2,
// fitting the Vercel Hobby 60s cap with headroom.
export const maxDuration = 60;

interface GenerateBody {
  currency?: "USD" | "EUR" | "GBP";
}

/**
 * POST /api/experiment/:id/generate
 *
 * Phase 2 of the pipeline. Hydrates the hypothesis + domain + references
 * from the experiment row that Phase 1 just persisted, runs the
 * generator with Tavily tool use, saves the draft plan, returns it
 * with verificationPending=true. The client will immediately call
 * /verify next.
 *
 * Body (optional): { currency: "USD" | "EUR" | "GBP" }
 *
 * Idempotent: calling twice on the same id will just generate again
 * and insert a second plan row. The verifier endpoint always reads
 * the most recent version, so this is safe.
 */
export async function POST(
  req: NextRequest,
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

  let body: GenerateBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const currency: "USD" | "EUR" | "GBP" =
    body.currency === "EUR" || body.currency === "GBP" ? body.currency : "USD";

  const exp = await loadExperimentForGeneration(id);
  if (!exp) {
    return new Response(JSON.stringify({ error: "experiment not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    console.log(
      `[generate] start id=${id} domain=${exp.domain} hypothesis_len=${exp.hypothesis.length}`
    );
    const draftPlan = await generatePlan(
      exp.hypothesis,
      exp.domain,
      exp.references,
      { currency }
    );
    const phase2Ms = Date.now() - startedAt;
    console.log(
      `[generate] done id=${id} duration_ms=${phase2Ms} materials=${draftPlan.materials.length} protocol_steps=${draftPlan.protocol.length}`
    );

    const planWithStats: ExperimentPlan = {
      ...draftPlan,
      verificationPending: true,
      runStats: {
        durationMs: phase2Ms,
        estimatedCostUsd: roundCost(0.10 + draftPlan.materials.length * 0.003),
        toolCalls: draftPlan.materials.length,
      },
    };

    const persisted = await saveDraftPlan(id, planWithStats);
    if (!persisted) {
      console.warn(`[generate] saveDraftPlan failed id=${id}`);
    }

    return new Response(JSON.stringify({ plan: planWithStats }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = (err as Error).message ?? "generate failed";
    const stack = (err as Error).stack;
    // Verbose log so the failure shows up in Vercel runtime logs with
    // enough context to debug — id, elapsed time (catch timeout), the
    // error message, and a stack trace.
    console.error(
      `[generate] FAILED id=${id} elapsed_ms=${elapsed} error=${message}`,
      stack
    );
    return new Response(
      JSON.stringify({
        error: message,
        elapsedMs: elapsed,
        hint:
          elapsed > 55000
            ? "function timed out — generator took longer than the 60s Vercel Hobby cap"
            : undefined,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function roundCost(usd: number): number {
  return Math.round(usd * 100) / 100;
}
