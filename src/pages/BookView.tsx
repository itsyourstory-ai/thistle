// Customer-facing view of a book (THI-20): /book/:id, behind ProtectedRoute.
//
// Ownership is enforced by the existing `Users read own generated_books` RLS
// policy: a book that isn't the signed-in user's simply comes back as no row,
// and we show the Not Found page. Images come from the get-book-image edge
// function (see BookReader).

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/DashboardHeader";
import BookReader, { type ReaderPage } from "@/components/BookReader";
import EmptyState from "@/components/EmptyState";
import AsyncError from "@/components/AsyncError";
import LoadingScreen from "@/components/LoadingScreen";
import NotFound from "@/pages/NotFound";
import { pipelineMessage } from "@/lib/loadingMessages";
import { isStuckAtStory, retryBook } from "@/lib/bookRetry";

const SUPPORT_EMAIL = "support@thistlebook.com";
const POLL_MS = 5000;
// How often the page re-checks whether a story has been running too long. The
// row doesn't change when a worker dies, so nothing else would re-render it.
const STUCK_CHECK_MS = 30_000;
// Postgres "invalid input syntax for type uuid": the URL id isn't a real book id.
const INVALID_UUID = "22P02";

interface BookViewRow {
  id: string;
  pipeline_status: string | null;
  pipeline_progress: { stage: string; current: number; total: number; started_at?: string } | null;
  parsed: unknown;
  child: { name?: string } | null;
}

function SupportLink() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
      {SUPPORT_EMAIL}
    </a>
  );
}

// The current (V2) book shape has a cover and a list of pages. Older rows
// (spread-based) don't, and can't be shown by this reader.
function readableBook(parsed: unknown) {
  const p = parsed as
    | { meta?: { title?: string }; cover?: { title?: string }; pages?: ReaderPage[] }
    | null;
  if (!p || !p.cover || !Array.isArray(p.pages) || p.pages.length === 0) return null;
  const title = p.meta?.title || p.cover.title || "Your book";
  return { title, pages: p.pages };
}

// "Try again" for a book that failed or got stuck (THI-10). The buyer's paid
// order holds everything the server needs, so this only says which book.
function RetryAction({ bookId, onRestarted }: { bookId: string; onRestarted: () => Promise<unknown> }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function retry() {
    setRetrying(true);
    setError(null);
    setNote(null);
    try {
      const result = await retryBook(bookId);
      if (!result.ok) {
        setError(result.message);
      } else if (!result.restarted) {
        // The server says the book is already running, so nothing was restarted.
        setNote("We checked, and your book is still being made. Please check back in a few minutes.");
      } else {
        // The row now shows progress again, and the page goes back to checking on it.
        await onRestarted();
      }
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button variant="wizard" size="pill" onClick={retry} disabled={retrying}>
        {retrying ? "Restarting…" : "Try again"}
      </Button>
      {error && (
        <p role="alert" className="max-w-[36ch] text-sm text-destructive">
          {error}
        </p>
      )}
      {note && <p className="max-w-[36ch] text-sm text-muted-foreground">{note}</p>}
      <p className="max-w-[36ch] text-xs text-muted-foreground">
        Still stuck? Email <SupportLink /> and we'll sort it out.
      </p>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-wizard-bg">
      <DashboardHeader />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Link to="/dashboard" className="inline-block text-sm text-wizard underline underline-offset-2">
          ← My books
        </Link>
        {children}
      </main>
    </div>
  );
}

export default function BookView() {
  const { id } = useParams<{ id: string }>();

  // Ticks so a page left open notices a story that has run too long.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), STUCK_CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["book", id],
    queryFn: async (): Promise<BookViewRow | null> => {
      // AIDEV-NOTE: Never select the whole `brief` here. It holds the child's
      // photos. `brief->child` is just name/age/gender/language.
      const { data, error } = await supabase
        .from("generated_books")
        // `as string` stops supabase-js from type-parsing the JSON path (TS2589).
        .select("id, pipeline_status, pipeline_progress, parsed, brief->child" as string)
        .eq("id", id!)
        .maybeSingle();
      if (error) {
        if (error.code === INVALID_UUID) return null;
        throw error;
      }
      return data as unknown as BookViewRow | null;
    },
    enabled: !!id,
    // Keep checking while the book is still being made, so the page turns into
    // the book on its own.
    refetchInterval: (query) => {
      const row = query.state.data;
      if (!row) return false;
      return row.pipeline_status === "done" || row.pipeline_status === "failed" ? false : POLL_MS;
    },
  });

  if (isLoading) return <LoadingScreen messages={["Opening your book…"]} />;
  // Only when there's nothing to show: one failed background re-check while the
  // book is being made shouldn't replace the progress screen with an error.
  if (isError && !data) {
    return (
      <Shell>
        <AsyncError message="We couldn't load this book." onRetry={() => refetch()} />
      </Shell>
    );
  }
  if (!data) return <NotFound />;

  if (data.pipeline_status === "failed") {
    return (
      <Shell>
        <EmptyState
          emoji="🌧️"
          title="Something went wrong with this book"
          description="We're sorry. Your payment is safe. Try again and we'll pick up where we left off."
          action={<RetryAction bookId={data.id} onRestarted={refetch} />}
        />
      </Shell>
    );
  }

  // The story run died without marking the book failed, so the page would show
  // "still being made" forever. Offer the same retry (the server restarts it).
  if (isStuckAtStory(data.pipeline_status, data.pipeline_progress, now)) {
    return (
      <Shell>
        <EmptyState
          emoji="⏳"
          title="This is taking longer than usual"
          description="Your book looks stuck. Your payment is safe. Try again and we'll start it again."
          action={<RetryAction bookId={data.id} onRestarted={refetch} />}
        />
      </Shell>
    );
  }

  if (data.pipeline_status !== "done") {
    const name = data.child?.name || "your little one";
    const progress = data.pipeline_progress;
    const message = progress
      ? pipelineMessage(progress.stage, progress.current, progress.total, name)
      : `Writing ${name}'s story…`;
    return (
      <Shell>
        <EmptyState
          emoji="✨"
          title="Your book is still being made"
          description={<>{message} We'll email you the moment it's ready. This page updates on its own.</>}
        />
      </Shell>
    );
  }

  const book = readableBook(data.parsed);
  if (!book) {
    return (
      <Shell>
        <EmptyState
          emoji="📖"
          title="This book can't be shown here yet"
          description={
            <>
              Email <SupportLink /> and we'll get it to you.
            </>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-heading text-3xl font-semibold text-wizard text-center">{book.title}</h1>
      <BookReader bookId={data.id} pages={book.pages} />
    </Shell>
  );
}
