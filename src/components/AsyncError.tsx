import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";

/**
 * Inline "the request failed" state with an optional retry. Use this when an
 * async call (edge function, fetch) fails inside a page or section. Built on
 * EmptyState so the empty/error treatments stay visually consistent.
 *
 * The long AI steps (8 & 11) keep their own bespoke retry UI — reach for this
 * for everything else.
 */
export default function AsyncError({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: {
  title?: string;
  /** Human-readable detail (often an error message). */
  message?: ReactNode;
  /** When provided, renders a retry button that calls this. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <EmptyState
      emoji="🌧️"
      title={title}
      description={message}
      className={className}
      action={
        onRetry && (
          <Button variant="wizard" onClick={onRetry}>
            {retryLabel}
          </Button>
        )
      }
    />
  );
}
