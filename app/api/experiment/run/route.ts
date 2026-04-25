import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/ai/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  let body: { hypothesis?: string };
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runPipeline(hypothesis)) {
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
