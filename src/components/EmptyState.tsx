import type { ReactNode } from "react";

/**
 * Reusable in-page empty state for lists/sections that have no content yet
 * (e.g. no supporting characters, no saved books). Centers an emoji, a short
 * message, and an optional action. For whole-page states (404/500) use
 * FullScreenMessage instead.
 */
export default function EmptyState({
  emoji,
  title,
  description,
  action,
  className = "",
}: {
  emoji: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 ${className}`}
      style={{ borderColor: "hsl(var(--wizard-primary) / 0.25)" }}
    >
      <div className="text-4xl" aria-hidden="true">
        {emoji}
      </div>
      <h3
        className="font-heading text-xl font-semibold"
        style={{ color: "hsl(var(--wizard-primary))" }}
      >
        {title}
      </h3>
      {description && (
        <p className="max-w-[36ch] text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
