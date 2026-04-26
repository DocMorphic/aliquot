import type { NextRequest } from "next/server";
import { generatePlan } from "@/lib/ai/agents/generator";
import {
  loadExperimentForGeneration,
  saveDraftPlan,
} from "@/lib/supabase/persist";
import type { ExperimentPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generator can take 30-60s on biology hypotheses. Vercel Hobby
// historically capped at 60s but Fluid Compute (default for
// Next.js 15+) allows higher numbers on I/O-bound work; if Vercel
// rejects 120 the build fails and we'll roll back. Combined with the
// 50s in-process timeout below, a true Vercel-level kill should be
// rare: we'd rather surface a clean app-level error than have the
// runtime murder the function before the catch block runs.
export const maxDuration = 120;

// Internal hard limit. We Promise.race this against the generator so
// the catch block always runs and the user gets a real error message.
const GENERATOR_TIMEOUT_MS = 55_000;

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
    // Race the generator against an in-process timeout so the catch
    // block always runs (and we always log + return a real error
    // before Vercel kills the function).
    const draftPlan = await Promise.race([
      generatePlan(exp.hypothesis, exp.domain, exp.references, { currency }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Generator exceeded ${GENERATOR_TIMEOUT_MS / 1000}s (in-process timeout — try a more specific hypothesis or upgrade Vercel to Pro)`
              )
            ),
          GENERATOR_TIMEOUT_MS
        )
      ),
    ]);
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
