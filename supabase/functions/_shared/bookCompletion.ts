// Decides whether a book is finished once its images have been generated,
// then marks it done or failed and emails the buyer.
//
// AIDEV-NOTE: A book is "done" when its story and images are generated.
// Whether the images also reached the team's Google Drive is deliberately NOT
// part of that decision (THI-40): Drive is an internal backup, so a Drive
// outage must never turn a customer's finished book into a "failed" one. A
// failed upload keeps its image in the database, so nothing is lost.

import { maybeSendFailed, maybeSendReady, type GeneratedBookRow } from "./bookEmails.ts";

export interface VerdictGap {
  kind: "portrait" | "page" | "cover";
  slot: number;
  reason: "not_generated";
}

export interface Verdict {
  ok: boolean;
  /** Images that were never generated. Any gap here makes the book incomplete. */
  gaps: VerdictGap[];
  /** Generated images that are not in Drive, as "kind/slot". Informational only. */
  notUploaded: string[];
}

export async function setPipeline(
  supabase: any,
  bookId: string,
  status: string,
  progress: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("generated_books")
    .update({
      pipeline_status: status,
      pipeline_progress: progress,
      // Forward progress clears any stale error from a prior premature/failed attempt.
      pipeline_error: null,
    })
    .eq("id", bookId);
}

export async function verifyComplete(
  supabase: any,
  bookId: string,
  parsed: any,
): Promise<Verdict> {
  const pages = Array.isArray(parsed?.pages) ? parsed.pages : [];
  const requiredPageSlots = pages
    .filter((p: any) => p.image_prompt)
    .map((p: any) => Number(p.page_number));

  const { data: rows, error } = await supabase
    .from("book_images")
    .select("kind,slot,status,drive_file_id")
    .eq("book_id", bookId);
  if (error) throw new Error(`verifyComplete read failed: ${error.message}`);

  const byKey = new Map<string, { status: string; drive_file_id: string | null }>();
  for (const r of rows || []) {
    byKey.set(`${r.kind}/${r.slot}`, { status: r.status, drive_file_id: r.drive_file_id });
  }

  const gaps: VerdictGap[] = [];
  const notUploaded: string[] = [];
  const check = (kind: "portrait" | "page" | "cover", slot: number) => {
    const row = byKey.get(`${kind}/${slot}`);
    if (!row || row.status !== "ok") {
      gaps.push({ kind, slot, reason: "not_generated" });
    } else if (!row.drive_file_id) {
      notUploaded.push(`${kind}/${slot}`);
    }
  };

  check("portrait", 1);
  for (const s of requiredPageSlots) check("page", s);
  // Cover is generated elsewhere; only enforce if a row exists.
  if (byKey.has("cover/1")) check("cover", 1);

  return { ok: gaps.length === 0, gaps, notUploaded };
}

export function summarizeGaps(gaps: VerdictGap[]): string {
  const pagesMissing = gaps.filter((g) => g.kind === "page").map((g) => g.slot);
  const parts: string[] = [];
  if (pagesMissing.length) parts.push(`missing ${pagesMissing.length} page(s) (${pagesMissing.join(", ")})`);
  for (const g of gaps) {
    if (g.kind === "page") continue;
    parts.push(`${g.kind}${g.slot > 1 ? ` ${g.slot}` : ""} not generated`);
  }
  return `Book incomplete: ${parts.join("; ")}`;
}

export type FinishResult =
  | { ok: true; notUploaded: string[] }
  | { ok: false; summary: string; gaps: VerdictGap[] };

/**
 * Final step of the image pipeline. Marks the book done (and sends the
 * "ready" email) when every image was generated, or failed (and sends the
 * "failed" email) when any image is missing. Images that never reached
 * Drive are logged with console.error so they show up in error alerts, but
 * the buyer still gets their book.
 */
export async function finishBook(
  supabase: any,
  bookRow: GeneratedBookRow,
  parsed: any,
): Promise<FinishResult> {
  const bookId = bookRow.id;
  const verdict = await verifyComplete(supabase, bookId, parsed);

  if (!verdict.ok) {
    const summary = summarizeGaps(verdict.gaps);
    console.error("Book verification failed:", summary);
    await supabase
      .from("generated_books")
      .update({
        pipeline_status: "failed",
        pipeline_error: summary.slice(0, 1000),
      })
      .eq("id", bookId);
    await maybeSendFailed(supabase, bookRow);
    return { ok: false, summary, gaps: verdict.gaps };
  }

  if (verdict.notUploaded.length > 0) {
    console.error(
      `Book ${bookId} is done, but ${verdict.notUploaded.length} image(s) did not upload to Drive: ` +
        `${verdict.notUploaded.join(", ")}. Re-run export-book-images-to-drive to retry.`,
    );
  }

  await setPipeline(supabase, bookId, "done", {
    stage: "done", current: 1, total: 1, message: "All done!",
  });
  await maybeSendReady(supabase, bookRow);
  return { ok: true, notUploaded: verdict.notUploaded };
}
