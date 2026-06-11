import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BookCardProps {
  id: string;
  title: string;
  childName: string;
  createdAt: string;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BookCard({ id, title, childName, createdAt }: BookCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-5">
      <h3 className="font-heading text-xl font-semibold text-wizard">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{childName}</p>
      <p className="text-sm text-muted-foreground">{formatDate(createdAt)}</p>
      <div className="mt-4">
        <Button variant="wizard" size="sm" asChild>
          <Link to={`/dev/story-preview/${id}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}
