/**
 * Wrapper around the generated_books status poll in Step9Generating.
 *
 * In test mode, returns a scripted progression based on elapsed time since
 * the first call for a given book id — so the generating step's animation,
 * progress bar, and "ready" state all work without a real Supabase DB row.
 *
 * In live mode (or test mode off), passes straight through to Supabase.
 *
 * AIDEV-NOTE: Mock book ids from the generate-book fixture are prefixed with
 * "mock-book-" so this helper can recognise them even if test mode is toggled
 * mid-flight.
 */

import { supabase } from "@/integrations/supabase/client";
import { getTestMode, isForcedError } from "./testMode";

export interface BookStatusRow {
  pipeline_status: string | null;
  pipeline_progress: {
    stage: string;
    current: number;
    total: number;
  } | null;
  pipeline_error: string | null;
}

// Scripted progression timeline (ms from first poll):
//   0  –  600 ms  → idle (no progress visible yet)
//   600 – 1200 ms → story stage
//  1200 – 4200 ms → pages 1..8
//  4200+          → done
const PAGE_COUNT = 8;

const startTimes = new Map<string, number>();

function getMockStatus(bookId: string): BookStatusRow {
  if (!startTimes.has(bookId)) {
    startTimes.set(bookId, Date.now());
  }
  const elapsed = Date.now() - startTimes.get(bookId)!;

  if (isForcedError("generate-book")) {
    return {
      pipeline_status: "failed",
      pipeline_progress: null,
      pipeline_error: "[test mode] Forced error on generate-book",
    };
  }

  if (elapsed < 600) {
    return { pipeline_status: "idle", pipeline_progress: null, pipeline_error: null };
  }

  if (elapsed < 1200) {
    return {
      pipeline_status: "story",
      pipeline_progress: { stage: "story", current: 1, total: 1 },
      pipeline_error: null,
    };
  }

  if (elapsed < 4200) {
    // Interpolate pages 1..PAGE_COUNT over 3000 ms
    const pagesElapsed = elapsed - 1200;
    const pagesTotal = 3000;
    const current = Math.min(PAGE_COUNT, Math.max(1, Math.ceil((pagesElapsed / pagesTotal) * PAGE_COUNT)));
    return {
      pipeline_status: current < PAGE_COUNT ? "pages" : "pages",
      pipeline_progress: { stage: "pages", current, total: PAGE_COUNT },
      pipeline_error: null,
    };
  }

  // done
  startTimes.delete(bookId); // reset so re-runs work
  return {
    pipeline_status: "done",
    pipeline_progress: { stage: "pages", current: PAGE_COUNT, total: PAGE_COUNT },
    pipeline_error: null,
  };
}

/**
 * Fetches the current status of a book generation job.
 *
 * @param bookId  The id from generate-book's response.
 */
export async function getBookStatus(bookId: string): Promise<BookStatusRow | null> {
  // Use mock progression for any mock book id, or when test mode is on.
  if (import.meta.env.DEV) {
    const mode = getTestMode();
    if (mode.enabled || bookId.startsWith("mock-book-")) {
      return getMockStatus(bookId);
    }
  }

  // Live path — query Supabase exactly as before.
  const { data } = await supabase
    .from("generated_books")
    .select("pipeline_status,pipeline_progress,pipeline_error")
    .eq("id", bookId)
    .maybeSingle();

  return data as BookStatusRow | null;
}
