import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/ai/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby caps SSE streams at 60s. Our full pipeline can take
// 100-150s for biology hypotheses with many catalog lookups; the
// stream gets cut at 60s on Hobby, which means the user sees the
// generator's tool-use partial events but the final plan_done may
// not arrive. Set maxDuration explicitly to claim the full cap;
// upgrade to Pro (300s) before the demo if the cut-off causes pain.
export const maxDuration = 60;

/**
 * POST /api/experiment/run
 * Body: { hypothesis: string }
 * Response: text/event-stream of PipelineEvent JSON objects.
 *
 * Each event is emitted as `data: <json>\n\n` per the SSE protocol so
 * the browser EventSource (or our fetch + ReadableStream consumer in
 * use-experiment.ts) can parse a stream of JSON-encoded PipelineEvent
 * values.
 */
export async function POST(req: NextRequest) {
  let body: { hypothesis?: string; currency?: "USD" | "EUR" | "GBP" };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const hypothesis = (body.hypothesis ?? "").trim();
  if (!hypothesis) {
    return new Response(
      JSON.stringify({ error: "hypothesis is required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }
  const currency: "USD" | "EUR" | "GBP" =
    body.currency === "EUR" || body.currency === "GBP" ? body.currency : "USD";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runPipeline(hypothesis, { currency })) {
          send(event);
        }
      } catch (err) {
        send({ type: "error", message: (err as Error).message ?? "Pipeline error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
