import type { NextRequest } from "next/server";
import {
  uploadExperimentFile,
  listExperimentFiles,
} from "@/lib/supabase/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Uploads can take a few seconds; give them headroom but stay under
// Vercel Hobby's body size cap (~4.5MB).
export const maxDuration = 30;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * GET /api/experiments/:id/files
 * List uploaded attachments for an experiment.
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
  const files = await listExperimentFiles(id);
  return new Response(JSON.stringify({ files }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * POST /api/experiments/:id/files
 * multipart/form-data with a `file` field. Uploads to Supabase Storage
 * (bucket "experiment-files") and inserts a metadata row. Public URL
 * returned for client-side display.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return new Response(JSON.stringify({ error: "invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "expected multipart/form-data" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "missing file" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const record = await uploadExperimentFile(id, file);
    return new Response(JSON.stringify({ file: record }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "upload failed" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
