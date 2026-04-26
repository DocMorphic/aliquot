import { getServerSupabase } from "./client";

const BUCKET = "experiment-files";
const MAX_BYTES = 4 * 1024 * 1024; // 4MB — fits Vercel Hobby body limit
// Cap on text content fed to the model (per file). Larger PDFs/images
// stay base64'd as document/image blocks; text files truncate.
export const MAX_TEXT_INLINE_BYTES = 60_000;
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
export async function ensureBucket(): Promise<void> {
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

/**
 * Pre-experiment upload: file goes into the bucket but we don't insert
 * a metadata row yet. The HypothesisWindow uploads here while the
 * user is still typing, then on Run the new experiment row gets
 * created and we link the temp paths to it.
 */
export interface TempUpload {
  storagePath: string;
  fileName: string;
  contentType: string | null;
  fileSize: number;
  url: string;
}

export async function uploadTempFile(file: File): Promise<TempUpload> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 4MB cap)`);
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    throw new Error(`File type not allowed: ${file.type}`);
  }
  await ensureBucket();
  const sb = getServerSupabase();
  const safe = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
  const storagePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
  const buf = await file.arrayBuffer();
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    fileName: file.name,
    contentType: file.type || null,
    fileSize: file.size,
    url: pub.publicUrl,
  };
}

/**
 * Associate already-uploaded temp files with a freshly created experiment.
 * Inserts experiment_files rows pointing at each temp storage path.
 */
export async function attachTempUploadsToExperiment(
  experimentId: string,
  uploads: { storagePath: string; fileName: string; contentType: string | null; fileSize: number }[]
): Promise<ExperimentFileRecord[]> {
  if (uploads.length === 0) return [];
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("experiment_files")
      .insert(
        uploads.map((u) => ({
          experiment_id: experimentId,
          storage_path: u.storagePath,
          file_name: u.fileName,
          content_type: u.contentType,
          file_size: u.fileSize,
        }))
      )
      .select("id, file_name, content_type, file_size, uploaded_at, storage_path");
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
    console.warn("[attachTempUploadsToExperiment] failed:", (err as Error).message);
    return [];
  }
}

/**
 * Loads attachments + downloads each file's bytes from Storage.
 * For PDFs/images we keep them as binary (base64'd later for the
 * Anthropic SDK), for text we decode + truncate. The Generator turns
 * the result into Anthropic content blocks.
 */
export interface AttachmentForModel {
  name: string;
  contentType: string | null;
  size: number;
  /** Set when the file is text and we'll inline it in the user message. */
  text?: string;
  /** Base64-encoded payload for image/PDF document blocks. */
  base64?: string;
  /** "image" | "document" | "text" — how the Generator should treat it. */
  kind: "image" | "document" | "text";
  truncated?: boolean;
}

const TEXT_MIME_PREFIX = ["text/"];
const TEXT_MIME_EXACT = new Set([
  "application/json",
  "text/markdown",
  "text/csv",
  "text/plain",
]);

export async function loadAttachmentsForModel(
  experimentId: string
): Promise<AttachmentForModel[]> {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from("experiment_files")
      .select("file_name, content_type, file_size, storage_path")
      .eq("experiment_id", experimentId);
    if (error || !data) return [];

    const out: AttachmentForModel[] = [];
    for (const row of data) {
      const type = (row.content_type ?? "").toLowerCase();
      const isImage = type.startsWith("image/");
      const isPdf = type === "application/pdf";
      const isText =
        TEXT_MIME_EXACT.has(type) || TEXT_MIME_PREFIX.some((p) => type.startsWith(p));

      try {
        const { data: blob, error: dlErr } = await sb.storage
          .from(BUCKET)
          .download(row.storage_path);
        if (dlErr || !blob) continue;
        if (isImage || isPdf) {
          const bytes = await blob.arrayBuffer();
          const base64 = Buffer.from(bytes).toString("base64");
          out.push({
            name: row.file_name,
            contentType: row.content_type,
            size: row.file_size ?? bytes.byteLength,
            base64,
            kind: isImage ? "image" : "document",
          });
        } else if (isText) {
          const fullText = await blob.text();
          const truncated = fullText.length > MAX_TEXT_INLINE_BYTES;
          const text = truncated ? fullText.slice(0, MAX_TEXT_INLINE_BYTES) : fullText;
          out.push({
            name: row.file_name,
            contentType: row.content_type,
            size: row.file_size ?? fullText.length,
            text,
            truncated,
            kind: "text",
          });
        }
        // Unknown types are skipped on the model side; the user still
        // sees them in the Plan window's Files tab.
      } catch {
        // ignore individual file failures
      }
    }
    return out;
  } catch (err) {
    console.warn("[loadAttachmentsForModel] failed:", (err as Error).message);
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
