import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchBookImage } from "@/lib/bookImages";
import { getLayout } from "@/lib/pageLayouts";

export interface ReaderPage {
  page_number: number;
  text: string;
  layout_id: string;
  image_prompt: string | null;
}

interface BookReaderProps {
  bookId: string;
  pages: ReaderPage[];
}

// AIDEV-NOTE: Images load one at a time (and the next page in the background)
// because each is a multi-MB base64 string. Never fetch the whole book up front.
// staleTime Infinity: a finished book's images never change. gcTime is short so
// a long read doesn't keep dozens of big strings in memory.
// There is no cover image: the approved cover isn't stored anywhere (see
// _shared/bookImage.ts), so the book opens on its title page.
function imageQuery(bookId: string, slot: number) {
  return {
    queryKey: ["book-image", bookId, slot],
    queryFn: () => fetchBookImage(bookId, slot),
    staleTime: Infinity,
    gcTime: 2 * 60 * 1000,
  };
}

function BookImage({ bookId, slot, alt }: { bookId: string; slot: number; alt: string }) {
  const { data, isError, refetch } = useQuery(imageQuery(bookId, slot));

  if (data) {
    return <img src={data} alt={alt} className="w-full aspect-square object-cover rounded-xl" />;
  }
  if (isError) {
    return (
      <div className="w-full aspect-square rounded-xl bg-wizard/5 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">We couldn't load this picture.</p>
        <Button variant="wizardOutline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label="Loading picture"
      className="w-full aspect-square rounded-xl bg-wizard/10 animate-pulse"
    />
  );
}

function PageView({ bookId, page }: { bookId: string; page: ReaderPage }) {
  const hasImage = !!page.image_prompt;
  const hasText = !!page.text?.trim();
  // Text sits above the picture only when the print layout puts it at the top.
  const textFirst = getLayout(page.layout_id)?.textPlacement === "top";

  const text = hasText ? (
    <p className="font-heading text-lg sm:text-xl leading-relaxed text-center text-wizard whitespace-pre-wrap">
      {page.text}
    </p>
  ) : null;

  if (!hasImage) {
    return (
      <div className="w-full aspect-square flex items-center justify-center px-4">{text}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {textFirst && text}
      <BookImage
        bookId={bookId}
        slot={page.page_number}
        alt={`Illustration for page ${page.page_number}`}
      />
      {!textFirst && text}
    </div>
  );
}

/** Read-only reader for a finished book: one page at a time, starting at the title page. */
export default function BookReader({ bookId, pages }: BookReaderProps) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const last = pages.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave browser shortcuts (Alt+Left = Back) and form fields alone.
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, last));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  // Warm up the next page's picture so turning the page feels instant.
  useEffect(() => {
    const next = pages[index + 1];
    if (next?.image_prompt) {
      void queryClient.prefetchQuery(imageQuery(bookId, next.page_number));
    }
  }, [bookId, pages, index, queryClient]);

  return (
    <section aria-label="Book reader" className="space-y-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-black/10 p-4">
        <PageView key={pages[index].page_number} bookId={bookId} page={pages[index]} />
      </div>

      <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
        <Button
          variant="wizardOutline"
          size="sm"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
        >
          Previous
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Page {index + 1} of {pages.length}
        </p>
        <Button
          variant="wizard"
          size="sm"
          onClick={() => setIndex((i) => Math.min(i + 1, last))}
          disabled={index === last}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
