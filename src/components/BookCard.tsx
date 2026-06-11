import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface BookCardProps {
  id: string;
  title: string;
  childName: string;
  createdAt: string; // ISO date string
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
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{childName}</p>
        <p className="text-sm text-muted-foreground mt-1">{formatDate(createdAt)}</p>
      </CardContent>
      <CardFooter>
        <Button variant="wizard" size="sm" asChild>
          <Link to={`/dev/story-preview/${id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
