import type { ReactNode } from "react";

/**
 * Standardized step page header. Left-aligned title + subtitle used at the
 * top of every wizard step (and the preview/checkout page) so heading
 * typography, color, and spacing stay identical app-wide.
 */
export default function StepHeader({
  title,
  subtitle,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h1
        className="font-heading text-3xl sm:text-4xl font-semibold text-left"
        style={{ color: "hsl(var(--wizard-primary))" }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-muted-foreground text-lg text-left">{subtitle}</p>
      )}
    </div>
  );
}
