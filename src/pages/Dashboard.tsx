import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/DashboardHeader";
import DraftCard from "@/components/DraftCard";
import BookCard from "@/components/BookCard";
import { supabase } from "@/integrations/supabase/client";
import { deserializeAnswers } from "@/lib/draftPhotos";
import { useWizard } from "@/contexts/WizardContext";

interface BookParsed {
  meta?: { title?: string };
  cover_text?: string;
}

interface BookRow {
  parsed?: BookParsed | null;
  childName?: string | null;
  selectedConcept?: { title?: string } | null;
}

function getBookTitle(book: BookRow): string {
  return (
    book.parsed?.meta?.title ||
    book.parsed?.cover_text ||
    (book.selectedConcept as { title?: string } | null)?.title ||
    "Untitled"
  );
}

function getChildName(book: BookRow): string {
  return (book.childName as string | null) || "Unknown";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { seedAnswers, setDraftId, resetWizard } = useWizard();

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ["book_drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_drafts")
        .select("id, child_name, current_step, updated_at")
        .order("updated_at", { ascending: false })
        .limit(25);
      if (error) { console.error("Drafts query error:", error); return []; }
      return data ?? [];
    },
    staleTime: 1000 * 30,
    retry: 1,
  });

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["generated_books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_books")
        .select("id, created_at, status, parsed, brief->childName, brief->selectedConcept")
        .eq("status", "ok")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) { console.error("Books query error:", error); return []; }
      return data ?? [];
    },
    staleTime: 1000 * 30,
    retry: 1,
  });

  async function resumeDraft(draft: { id: string }) {
    const { data, error } = await supabase
      .from("book_drafts")
      .select("answers, current_step")
      .eq("id", draft.id)
      .single();
    if (error || !data) { console.error("Resume draft fetch error:", error); return; }
    const deserialized = await deserializeAnswers(data.answers as Record<string, unknown>);
    seedAnswers(deserialized);
    setDraftId(draft.id);
    navigate(data.current_step);
  }

  async function deleteDraft(id: string) {
    await supabase.from("book_drafts").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["book_drafts"] });
  }

  return (
    <div className="min-h-screen bg-wizard-bg">
      <DashboardHeader />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* Create new */}
        <div>
          <Button
            variant="wizard"
            size="pill"
            onClick={() => { resetWizard(); navigate("/step/1-name"); }}
          >
            + Create a new book
          </Button>
        </div>

        {/* In Progress */}
        <section>
          <h2 className="font-heading text-2xl font-semibold text-wizard mb-4">In Progress</h2>
          {draftsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drafts yet. Start creating your first book!</p>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => (
                <DraftCard
                  key={d.id}
                  childName={d.child_name || "Unnamed draft"}
                  currentStep={d.current_step}
                  updatedAt={d.updated_at}
                  onResume={() => resumeDraft({ id: d.id })}
                  onDelete={() => deleteDraft(d.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* My Books */}
        <section>
          <h2 className="font-heading text-2xl font-semibold text-wizard mb-4">My Books</h2>
          {booksLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : books.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books yet. Create your first one above!</p>
          ) : (
            <div className="space-y-3">
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  id={b.id}
                  title={getBookTitle(b as BookRow)}
                  childName={getChildName(b as BookRow)}
                  createdAt={b.created_at}
                />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
