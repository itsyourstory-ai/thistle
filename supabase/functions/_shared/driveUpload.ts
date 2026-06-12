// Shared Google Drive upload helpers for book images.
//
// Used by both:
//   - generate-book-images (progressive per-image uploads as they're created)
//   - export-book-images-to-drive (final cleanup batch for anything missed)

import { getAccessToken, redactUrl } from "./googleAuth.ts";

const GD_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Not a base64 data URL");
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

// ---- Retry policy ------------------------------------------------------

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [500, 1500, 4000];

function jitter(ms: number): number {
  const delta = ms * 0.25;
  return Math.round(ms + (Math.random() * 2 - 1) * delta);
}

class HttpError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(status: number, msg: string, retryAfterMs?: number) {
    super(msg);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

async function uploadOnce(
  name: string,
  parentId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = "thistle-" + crypto.randomUUID();
  const metadata = JSON.stringify({ name, parents: [parentId], mimeType: mime });

  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    metadata + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mime}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const token = await getAccessToken();
  const resp = await fetch(
    `${GD_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const text = await resp.text();
  if (!resp.ok) {
    let retryAfterMs: number | undefined;
    const ra = resp.headers.get("retry-after");
    if (ra) {
      const sec = parseFloat(ra);
      if (!isNaN(sec)) retryAfterMs = Math.min(10_000, Math.round(sec * 1000));
    }
    // Body may carry tokens/PII — log server-side only, never in the thrown Error.
    console.error(`Upload ${name} → ${resp.status}: ${text.slice(0, 400)}`);
    throw new HttpError(
      resp.status,
      `Upload ${name} → ${resp.status}`,
      retryAfterMs,
    );
  }
  return JSON.parse(text);
}

export interface AttemptEvent {
  attempt: number;            // 1-based
  outcome: "ok" | "retry" | "failed";
  http_status?: number;
  duration_ms: number;
  error?: string;
}

export async function uploadImageWithRetry(
  name: string,
  parentId: string,
  dataUrl: string,
  onAttempt?: (ev: AttemptEvent) => void,
): Promise<{ id: string; webViewLink: string }> {
  const { bytes, mime } = dataUrlToBytes(dataUrl);
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const started = Date.now();
    try {
      const file = await uploadOnce(name, parentId, bytes, mime);
      onAttempt?.({ attempt: attempt + 1, outcome: "ok", duration_ms: Date.now() - started });
      return file;
    } catch (e) {
      lastErr = e;
      const duration_ms = Date.now() - started;
      const isHttp = e instanceof HttpError;
      const status = isHttp ? (e as HttpError).status : undefined;
      const retriable = !isHttp || RETRY_STATUSES.has(status!);
      const terminal = !retriable || attempt === MAX_ATTEMPTS - 1;
      onAttempt?.({
        attempt: attempt + 1,
        outcome: terminal ? "failed" : "retry",
        http_status: status,
        duration_ms,
        error: e instanceof Error ? e.message : String(e),
      });
      if (terminal) break;
      const backoff = (isHttp && (e as HttpError).retryAfterMs) || jitter(BACKOFF_MS[attempt]);
      console.warn(`Drive upload retry ${attempt + 1}/${MAX_ATTEMPTS - 1} for ${name} in ${backoff}ms (status ${status ?? "n/a"})`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---- Book folder resolution -------------------------------------------
//
// Resolves the flat book folder (drive_folder_id) from the generated_books row.
// If the manuscript export hasn't run yet, kicks it off first.

export async function ensureBookFolder(
  supabase: any,
  bookId: string,
): Promise<{ id: string; webViewLink: string }> {
  let { data: row, error } = await supabase
    .from("generated_books")
    .select("id,drive_folder_id,drive_folder_url")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw new Error(`DB read failed: ${error.message}`);
  if (!row) throw new Error(`Book ${bookId} not found`);

  if (!row.drive_folder_id) {
    try {
      await supabase.functions.invoke("export-book-to-drive", {
        body: { book_id: bookId },
      });
    } catch (e) {
      console.error("Manuscript export pre-step failed:", e);
    }
    const reread = await supabase
      .from("generated_books")
      .select("drive_folder_id,drive_folder_url")
      .eq("id", bookId)
      .maybeSingle();
    row = reread.data || row;
  }

  if (!row?.drive_folder_id) {
    throw new Error("Book has no Drive folder yet; manuscript export must run first.");
  }

  return { id: row.drive_folder_id, webViewLink: row.drive_folder_url };
}

// ---- Per-row upload + DB stamp ----------------------------------------

export function fileNameFor(kind: string, slot: number): string {
  if (kind === "portrait") return `portrait-${slot}.png`;
  if (kind === "cover") return `cover.png`;
  return `page-${String(slot).padStart(2, "0")}.png`;
}

export interface BookImageRow {
  id: string;
  book_id: string;
  kind: string;
  slot: number;
  image_data_url?: string | null;
  drive_file_id?: string | null;
}

export type UploadSource = "progressive" | "cleanup";

async function logAttempt(
  supabase: any,
  img: BookImageRow,
  source: UploadSource,
  ev: AttemptEvent,
  drive?: { id: string; webViewLink: string },
): Promise<void> {
  try {
    await supabase.from("book_image_upload_attempts").insert({
      book_image_id: img.id,
      book_id: img.book_id,
      kind: img.kind,
      slot: img.slot,
      attempt: ev.attempt,
      source,
      outcome: ev.outcome,
      http_status: ev.http_status ?? null,
      duration_ms: ev.duration_ms ?? null,
      error: ev.error ? ev.error.slice(0, 500) : null,
      drive_file_id: drive?.id ?? null,
      drive_file_url: drive?.webViewLink ?? null,
    });
  } catch (e) {
    console.error("logAttempt insert failed:", e);
  }
}

/**
 * Uploads a single book_images row to Drive and stamps the row with the
 * resulting drive_file_id / drive_file_url. Clears image_data_url on success.
 * Returns true if uploaded (or already had drive_file_id), false on failure.
 * Never throws — failures are logged + recorded in the row's `error` field
 * and a per-attempt row is appended to book_image_upload_attempts.
 */
export async function uploadAndStampImage(
  supabase: any,
  img: BookImageRow,
  parentId: string,
  source: UploadSource = "cleanup",
): Promise<boolean> {
  if (img.drive_file_id) return true;
  if (!img.image_data_url) return false;
  const name = fileNameFor(img.kind, img.slot);
  let lastOk: { id: string; webViewLink: string } | undefined;
  const pending: AttemptEvent[] = [];
  try {
    const file = await uploadImageWithRetry(name, parentId, img.image_data_url, (ev) => {
      pending.push(ev);
    });
    lastOk = file;
    await supabase
      .from("book_images")
      .update({
        drive_file_id: file.id,
        drive_file_url: file.webViewLink,
        image_data_url: null,
      })
      .eq("id", img.id);
    for (const ev of pending) {
      await logAttempt(supabase, img, source, ev, ev.outcome === "ok" ? lastOk : undefined);
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Upload failed for ${name}:`, msg);
    try {
      await supabase
        .from("book_images")
        .update({ error: msg.slice(0, 500) })
        .eq("id", img.id);
    } catch (_) { /* ignore */ }
    for (const ev of pending) {
      await logAttempt(supabase, img, source, ev);
    }
    return false;
  }
}

/**
 * Convenience helper for generate-book-images: looks up the freshly-upserted
 * row by (book_id, kind, slot) and uploads it. Fire-and-forget friendly.
 */
export async function uploadByKindSlot(
  supabase: any,
  bookId: string,
  kind: string,
  slot: number,
  parentId: string,
  source: UploadSource = "progressive",
): Promise<boolean> {
  const { data, error } = await supabase
    .from("book_images")
    .select("id,book_id,kind,slot,image_data_url,drive_file_id")
    .eq("book_id", bookId)
    .eq("kind", kind)
    .eq("slot", slot)
    .maybeSingle();
  if (error || !data) {
    console.warn(`uploadByKindSlot: row not found for ${kind}/${slot}: ${error?.message}`);
    return false;
  }
  return await uploadAndStampImage(supabase, data as BookImageRow, parentId, source);
}
