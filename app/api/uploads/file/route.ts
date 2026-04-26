import type { NextRequest } from "next/server";
import { uploadTempFile } from "@/lib/supabase/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/uploads/file
 * multipart/form-data with a `file` field. Stores the file in the
 * experiment-files bucket under uploads/* and returns metadata. The
 * HypothesisWindow uploads here while the user is still typing; the
 * returned `storagePath` is then passed into /api/experiment/run as
 * an attachment so the new experiment row can claim it.
 */
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
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
    const upload = await uploadTempFile(file);
    return new Response(JSON.stringify({ upload }), {
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
