import type { NextRequest } from "next/server";
import { runPipeline } from "@/lib/ai/pipeline";
import { attachTempUploadsToExperiment } from "@/lib/supabase/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AttachmentInput {
  storagePath: string;
  fileName: string;
  contentType: string | null;
  fileSize: number;
}

/**
 * POST /api/experiment/run
 * Body: {
 *   hypothesis: string;
 *   currency?: "USD" | "EUR" | "GBP";
 *   attachments?: { storagePath, fileName, contentType, fileSize }[]
 * }
 * Response: text/event-stream of PipelineEvent JSON objects.
 *
 * If attachments are supplied (uploaded earlier via /api/uploads/file),
 * we associate them with the new experiment row right after Phase 1
 * persists it, so the generator endpoint can pick them up later as
 * AI context.
 */
export async function POST(req: NextRequest) {
  let body: {
    hypothesis?: string;
    currency?: "USD" | "EUR" | "GBP";
    attachments?: AttachmentInput[];
  };
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
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runPipeline(hypothesis, { currency })) {
          send(event);
          // After Phase 1 persists the experiment row, link any temp
          // uploads to it so /generate can find them.
          if (event.type === "experiment_started" && attachments.length > 0) {
            void attachTempUploadsToExperiment(event.experimentId, attachments).catch(
              (err) => console.warn("[run] attach uploads failed:", err.message)
            );
          }
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
