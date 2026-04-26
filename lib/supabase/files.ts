import { getServerSupabase } from "./client";

const BUCKET = "experiment-files";
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — fits Vercel Hobby body limit
const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export interface ExperimentFileRecord {
  id: string;
  name: string;
  type: string | null;
  size: number | null;
  uploadedAt: string;
  url: string;
}

/**
 * Idempotent — checks for the bucket and creates it (public, 4MB cap)
 * if it doesn't exist. Uploads on Hobby Vercel are limited to ~4.5MB
 * by the platform anyway, so the bucket cap matches.
 */
async function ensureBucket(): Promise<void> {
  const sb = getServerSupabase();
  const { data: existing } = await sb.storage.getBucket(BUCKET);
  if (existing) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (error && !/already exists/i.test(error.message)) throw error;
}

export async function uploadExperimentFile(
  experimentId: string,
  file: File
): Promise<ExperimentFileRecord> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 4MB cap)`);
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw new Error(`File type not allowed: ${file.type}`);
  }
  await ensureBucket();
  const sb = getServerSupabase();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const safe = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
  const path = `${experimentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const buf = await file.arrayBuffer();
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const { data: row, error: insErr } = await sb
    .from("experiment_files")
    .insert({
      experiment_id: experimentId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      file_size: file.size,
    })
    .select("id, uploaded_at")
    .single();
  if (insErr) {
    // Roll back the storage upload if metadata insert failed.
    await sb.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw insErr;
  }
  void ext;
  return {
    id: row.id,
    name: file.name,
    type: file.type || null,
    size: file.size,
    uploadedAt: row.uploaded_at,
    url: pub.publicUrl,
  };
}

export async function listExperimentFiles(
  experimentId: string
): Promise<ExperimentFileRecord[]> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("experiment_files")
      .select("id, file_name, content_type, file_size, uploaded_at, storage_path")
      .eq("experiment_id", experimentId)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.file_name,
      type: row.content_type,
      size: row.file_size,
      uploadedAt: row.uploaded_at,
      url: sb.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    }));
  } catch (err) {
    console.warn("[listExperimentFiles] failed:", (err as Error).message);
    return [];
  }
}

export async function deleteExperimentFile(fileId: string): Promise<boolean> {
  try {
    const sb = getServerSupabase();
    const { data: row } = await sb
      .from("experiment_files")
      .select("storage_path")
      .eq("id", fileId)
      .single();
    if (row?.storage_path) {
      await sb.storage.from(BUCKET).remove([row.storage_path]).catch(() => undefined);
    }
    const { error } = await sb.from("experiment_files").delete().eq("id", fileId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[deleteExperimentFile] failed:", (err as Error).message);
    return false;
  }
}
