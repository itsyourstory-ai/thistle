import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import DashboardHeader from "@/components/DashboardHeader";
import DraftCard from "@/components/DraftCard";
import BookCard from "@/components/BookCard";
import { supabase } from "@/integrations/supabase/client";
import { deserializeAnswers } from "@/lib/draftPhotos";
import { useWizard } from "@/contexts/WizardContext";

function getBookTitle(book: { parsed?: any; brief?: any }): string {
  return (
    book.parsed?.meta?.title ||
    book.parsed?.cover_text ||
    book.brief?.selectedConcept?.title ||
    "Untitled"
  );
}

function getChildName(book: { brief?: any }): string {
  return book.brief?.childName || "Unknown";
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
        .select("id, child_name, current_step, updated_at, answers")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["generated_books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_books")
        .select("id, created_at, brief, parsed, status")
        .eq("status", "ok")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function resumeDraft(draft: {
    id: string;
    answers: Record<string, unknown>;
    current_step: string;
  }) {
    const deserialized = await deserializeAnswers(draft.answers);
    seedAnswers(deserialized);
    setDraftId(draft.id);
    navigate(draft.current_step);
  }

  async function deleteDraft(id: string) {
    await supabase.from("book_drafts").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["book_drafts"] });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--wizard-bg))" }}>
      <DashboardHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* Create new */}
        <section>
          <Button
            onClick={() => {
              resetWizard();
              navigate("/step/1-name");
            }}
          >
            + Create a new book
          </Button>
        </section>

        {/* In Progress drafts */}
        <section>
          <h2 className="text-lg font-semibold mb-4">In Progress</h2>
          {draftsLoading ? (
            <div>Loading...</div>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No drafts yet. Start creating your first book!
            </p>
          ) : (
            drafts.map((d) => (
              <DraftCard
                key={d.id}
                id={d.id}
                childName={d.child_name || "Unnamed draft"}
                currentStep={d.current_step}
                updatedAt={d.updated_at}
                onResume={() => resumeDraft(d)}
                onDelete={() => deleteDraft(d.id)}
              />
            ))
          )}
        </section>

        {/* My Books */}
        <section>
          <h2 className="text-lg font-semibold mb-4">My Books</h2>
          {booksLoading ? (
            <div>Loading...</div>
          ) : books.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No books yet. Create your first one above!
            </p>
          ) : (
            books.map((b) => (
              <BookCard
                key={b.id}
                id={b.id}
                title={getBookTitle(b)}
                childName={getChildName(b)}
                createdAt={b.created_at}
              />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
