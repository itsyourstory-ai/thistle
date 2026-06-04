import { useEffect, useRef, useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { Pencil, RefreshCw, Check, X } from "lucide-react";
import { useWizard } from "@/contexts/WizardContext";
import WizardHeader from "@/components/WizardHeader";
import StoryDetailsRecap from "@/components/StoryDetailsRecap";
import { buildBrief } from "@/lib/buildBrief";
import { summaryMessages, useRotatingMessage } from "@/lib/loadingMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCharacterPortrait } from "@/hooks/useCharacterPortrait";
import { useSupportingPortraits } from "@/hooks/useSupportingPortraits";

type StoryConcept = {
  title?: string;
  summary?: string;
  user_visible_summary?: string;
  framework_id?: string;
  framework_reason?: string;
  story_seed?: Record<string, unknown>;
  personalization_notes?: Record<string, unknown>;
  full_book_instruction?: string;
  user_edited?: boolean;
};

export default function Step10Summary() {
  const { answers, setAnswer } = useWizard();
  const navigate = useNavigate();
  const name = (answers.childName || "your little one").trim();

  const [concept, setConcept] = useState<StoryConcept | null>(answers.selectedConcept || null);
  const [title, setTitle] = useState<string>(answers.selectedConcept?.title || "");
  const [summary, setSummary] = useState<string>(answers.selectedConcept?.summary || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  const previousSummaryRef = useRef<string>("");
  const loadingMsg = useRotatingMessage(summaryMessages(name), 2000);

  // AIDEV-NOTE: portrait hooks are intentionally mounted here (but not rendered)
  // so portrait generation warms in the background while the user reads the
  // story summary. Results are stored in WizardContext and picked up by Step9Cast.
  useCharacterPortrait();
  useSupportingPortraits();

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const brief = buildBrief(answers);
      const { data, error: fnError } = await supabase.functions.invoke("generate-summary", {
        body: {
          brief,
          previousSummary: previousSummaryRef.current || undefined,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const newTitle = String(data?.title || "").trim();
      const newSummary = String(data?.summary || data?.user_visible_summary || "").trim();
      if (!newSummary) throw new Error("Empty summary returned.");

      const nextConcept: StoryConcept = {
        ...data,
        title: newTitle,
        summary: newSummary,
        user_visible_summary: data?.user_visible_summary || newSummary,
      };

      setConcept(nextConcept);
      setTitle(newTitle);
      setSummary(newSummary);
      previousSummaryRef.current = newSummary;
    } catch (e: any) {
      const msg = e?.message || "Something went wrong.";
      setError(msg);
      toast({ title: "Couldn't craft the story", description: msg });
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on first arrival if nothing yet
  useEffect(() => {
    if (!summary && !loading) {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = () => {
    setDraft(summary);
    setDraftTitle(title);
    setEditing(true);
  };

  const saveEdit = () => {
    const editedTitle = draftTitle.trim();
    const editedSummary = draft.trim();
    setTitle(editedTitle);
    setSummary(editedSummary);
    setConcept({
      title: editedTitle,
      summary: editedSummary,
      user_visible_summary: editedSummary,
      user_edited: true,
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const continueToCast = () => {
    if (!summary.trim()) return;
    const visibleTitle = title.trim() || `${name}'s Adventure`;
    const visibleSummary = summary.trim();

    const approvedConcept: StoryConcept = concept?.user_edited
      ? {
          title: visibleTitle,
          summary: visibleSummary,
          user_visible_summary: visibleSummary,
          user_edited: true,
        }
      : {
          ...(concept || {}),
          title: visibleTitle,
          summary: visibleSummary,
          user_visible_summary: visibleSummary,
        };

    setAnswer("selectedConcept", approvedConcept);
    navigate(pathForStep(9));
  };

  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ backgroundColor: "hsl(var(--wizard-bg))" }}>
      <WizardHeader currentStep={8} />

      <main className="flex-1 flex justify-center px-4 pt-12 pb-20">
        <div className="w-full" style={{ maxWidth: "700px" }}>
          <div className="space-y-10">
            <div className="space-y-2">
              <h1
                className="font-heading text-3xl sm:text-4xl font-semibold"
                style={{ color: "hsl(var(--wizard-primary))" }}
              >
                Here's {name}'s story
              </h1>
              <p className="text-muted-foreground text-lg">
                Read it, refresh it, or tweak it before we draw the pictures.
              </p>
            </div>

            <div className="flex flex-col gap-10">
              {/* Book title */}
              {!editing && (
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="font-heading text-2xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
                    {title || `${name}'s Adventure`}
                  </h2>
                  <button
                    type="button"
                    onClick={fetchSummary}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-black/10 text-[hsl(var(--wizard-primary))]/70 bg-white hover:text-[hsl(var(--wizard-primary))] disabled:opacity-50 shrink-0"
                    aria-label="Regenerate title and summary"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              )}

              {/* Summary card */}
              <div
                className="rounded-2xl border bg-white p-6 shadow-sm"
                style={{ borderColor: "hsl(var(--wizard-primary) / 0.18)" }}
              >
                {loading && !summary ? (
                  <div className="space-y-3">
                    <div className="h-6 w-2/3 mx-auto rounded animate-pulse bg-black/5" />
                    <div className="h-3 w-full rounded animate-pulse bg-black/5" />
                    <div className="h-3 w-full rounded animate-pulse bg-black/5" />
                    <div className="h-3 w-5/6 rounded animate-pulse bg-black/5" />
                    <div className="h-3 w-full rounded animate-pulse bg-black/5" />
                    <div className="h-3 w-4/5 rounded animate-pulse bg-black/5" />
                    <p
                      className="text-center text-sm italic pt-3"
                      style={{ color: "hsl(var(--wizard-primary) / 0.6)" }}
                    >
                      {loadingMsg}
                    </p>
                  </div>
                ) : editing ? (
                  <div className="flex flex-col gap-3">
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      maxLength={80}
                      placeholder="Working title"
                      className="font-heading text-2xl font-semibold text-[hsl(var(--wizard-primary))] bg-transparent border-b border-black/10 focus:outline-none focus:border-[hsl(var(--wizard-primary))] px-1 py-1"
                    />
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={10}
                      className="w-full text-base font-serif leading-relaxed text-[hsl(var(--wizard-primary))]/90 bg-transparent border border-black/10 rounded-xl p-3 focus:outline-none focus:border-[hsl(var(--wizard-primary))]"
                    />
                    <div className="flex items-center justify-between text-xs text-[hsl(var(--wizard-primary))]/60">
                      <span>{wordCount(draft)} words</span>
                      <span className="italic">Tip: aim for ~150 words for the best book length.</span>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-black/15 text-[hsl(var(--wizard-primary))]"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: "hsl(var(--wizard-primary))" }}
                      >
                        <Check className="w-4 h-4" /> Save changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {loading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
                        <p className="text-sm italic" style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}>
                          {loadingMsg}
                        </p>
                      </div>
                    )}
                    <p className="text-base font-serif leading-relaxed whitespace-pre-wrap text-[hsl(var(--wizard-primary))]/90">
                      {summary}
                    </p>
                    <p className="text-xs text-[hsl(var(--wizard-primary))]/45 text-right mt-3">
                      {wordCount(summary)} words
                    </p>
                  </div>
                )}

                {error && !loading && !editing && <p className="text-sm text-red-600 mt-3 text-center">{error}</p>}
              </div>

              {/* Edit controls (Refresh already lives next to the title) */}
              {!editing && (
                <div className="flex items-center justify-center gap-3">
                  {summary && !loading && (
                    <button
                      type="button"
                      onClick={startEdit}
                      aria-label="Edit summary"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-black/15 text-[hsl(var(--wizard-primary))] bg-white"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>
              )}

              <div className="mt-2">
                <StoryDetailsRecap answers={answers} />
              </div>

              <p className="text-center text-xs italic" style={{ color: "hsl(var(--wizard-primary) / 0.5)" }}>
                Refresh as many times as you like. Once it's just right, continue to see the cover and characters.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky bottom CTA */}
      <div
        className="sticky bottom-0 z-30 px-4 py-4 flex justify-center border-t border-black/10"
        style={{ backgroundColor: "hsl(var(--wizard-bg) / 0.9)" }}
      >
        <div className="w-full flex items-center gap-3" style={{ maxWidth: "700px" }}>
          <button
            type="button"
            onClick={() => navigate(pathForStep(7))}
            className="flex-1 basis-0 py-4 rounded-full text-base font-semibold border-2"
            style={{
              borderColor: "hsl(var(--wizard-primary))",
              color: "hsl(var(--wizard-primary))",
              backgroundColor: "transparent",
            }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={continueToCast}
            disabled={!summary || loading || editing}
            className="flex-1 basis-0 py-4 rounded-full text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "hsl(var(--wizard-primary))",
              color: "#fff",
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
