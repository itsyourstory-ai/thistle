import { Button } from "@/components/ui/button";
import { stepNumFromSlug, TOTAL_STEPS } from "@/lib/wizardSteps";

interface DraftCardProps {
  childName: string;
  currentStep: string;
  updatedAt: string;
  onResume: () => void;
  onDelete: () => void;
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function stepLabelFromPath(currentStep: string): string {
  const slug = currentStep.split("/step/")[1] ?? currentStep;
  const num = stepNumFromSlug(slug);
  return `Step ${num} of ${TOTAL_STEPS}`;
}

export default function DraftCard({
  childName,
  currentStep,
  updatedAt,
  onResume,
  onDelete,
}: DraftCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {stepLabelFromPath(currentStep)}
      </p>
      <h3 className="font-heading text-xl font-semibold text-wizard mt-1">{childName}</h3>
      <p className="text-sm text-muted-foreground mt-1">{relativeTime(updatedAt)}</p>
      <div className="flex items-center gap-2 mt-4">
        <Button variant="wizard" size="sm" onClick={onResume}>
          Resume
        </Button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete draft"
          className="ml-auto inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
