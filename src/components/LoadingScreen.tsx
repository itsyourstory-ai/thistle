import { genericMessages, useRotatingMessage } from "@/lib/loadingMessages";

/**
 * Branded full-page loading state: a spinner plus a rotating reassurance
 * message. For long AI waits the wizard steps use their own bespoke
 * animations; reach for this for generic "fetching a page" waits.
 */
export default function LoadingScreen({
  messages = genericMessages,
  intervalMs = 2200,
}: {
  /** Rotating reassurance copy. Defaults to the generic set. */
  messages?: string[];
  intervalMs?: number;
}) {
  const message = useRotatingMessage(messages, intervalMs);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 px-4"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-10 w-10 rounded-full border-[3px] border-transparent animate-spin"
        style={{
          borderTopColor: "hsl(var(--wizard-primary))",
          borderRightColor: "hsl(var(--wizard-primary))",
          borderBottomColor: "hsl(var(--wizard-primary) / 0.2)",
          borderLeftColor: "hsl(var(--wizard-primary) / 0.2)",
        }}
        aria-hidden="true"
      />
      <p className="text-base italic" style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}>
        {message}
      </p>
    </div>
  );
}
