import type { ReactNode } from "react";

/**
 * Branded full-screen message used for whole-page states: 404, the 500 error
 * boundary fallback, and any "this page can't be shown" situation. Mirrors the
 * wizard brand (bg + primary tokens, heading font, emoji + pill action).
 */
export default function FullScreenMessage({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description?: ReactNode;
  /** Optional call-to-action rendered below the text (e.g. a link or button). */
  action?: ReactNode;
}) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 text-center"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <div className="w-full max-w-[420px] space-y-4">
        <div className="text-5xl" aria-hidden="true">
          {emoji}
        </div>
        <h1
          className="font-heading text-3xl sm:text-4xl font-semibold"
          style={{ color: "hsl(var(--wizard-primary))" }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
        {action && <div className="pt-2 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
