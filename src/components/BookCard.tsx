import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BookCardProps {
  id: string;
  title: string;
  childName: string;
  createdAt: string;
  /** `generated_books.pipeline_status`: "done", "failed", or any in-progress stage. */
  pipelineStatus: string | null;
}

function statusLabel(pipelineStatus: string | null): { text: string; className: string } {
  if (pipelineStatus === "done") return { text: "Ready", className: "bg-wizard/10 text-wizard" };
  if (pipelineStatus === "failed") return { text: "Something went wrong", className: "bg-destructive/10 text-destructive" };
  return { text: "Being made", className: "bg-black/5 text-muted-foreground" };
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BookCard({ id, title, childName, createdAt, pipelineStatus }: BookCardProps) {
  const status = statusLabel(pipelineStatus);
  return (
    <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-xl font-semibold text-wizard">{title}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
          {status.text}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{childName}</p>
      <p className="text-sm text-muted-foreground">{formatDate(createdAt)}</p>
      <div className="mt-4">
        <Button variant="wizard" size="sm" asChild>
          <Link to={`/book/${id}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}
