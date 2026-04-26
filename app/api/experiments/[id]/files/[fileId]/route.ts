import type { NextRequest } from "next/server";
import { deleteExperimentFile } from "@/lib/supabase/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * DELETE /api/experiments/:id/files/:fileId
 * Removes both the storage object and the metadata row.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { fileId } = await params;
  if (!isUuid(fileId)) {
    return new Response(JSON.stringify({ error: "invalid fileId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const ok = await deleteExperimentFile(fileId);
  if (!ok) {
    return new Response(JSON.stringify({ error: "delete failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
