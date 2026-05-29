import { useEffect, useRef, useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { Pencil, RefreshCw, Check, X } from "lucide-react";
import { useWizard } from "@/contexts/WizardContext";
import WizardHeader from "@/components/WizardHeader";
import { buildBrief } from "@/lib/buildBrief";
import { summaryMessages, portraitMessages, useRotatingMessage } from "@/lib/loadingMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCharacterPortrait } from "@/hooks/useCharacterPortrait";

export default function Step10Summary() {
  const { answers, setAnswer } = useWizard();
  const navigate = useNavigate();
  const name = (answers.childName || "your little one").trim();

  const [title, setTitle] = useState<string>(answers.selectedConcept?.title || "");
  const [summary, setSummary] = useState<string>(answers.selectedConcept?.summary || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  const previousSummaryRef = useRef<string>("");
  const loadingMsg = useRotatingMessage(summaryMessages(name), 2000);

  // Portrait of the protagonist (kicked off in Step 6). Idempotent — won't
  // refire if the user uploaded a photo earlier; will lazily trigger here if
  // they arrived with a photo but no portrait yet.
  const portrait = useCharacterPortrait();
  const portraitMsg = useRotatingMessage(portraitMessages(name), 2200);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const brief = buildBrief(answers);
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-summary",
        {
          body: {
            brief,
            previousSummary: previousSummaryRef.current || undefined,
          },
        },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const newTitle = String(data?.title || "").trim();
      const newSummary = String(data?.summary || "").trim();
      if (!newSummary) throw new Error("Empty summary returned.");
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
    setTitle(draftTitle.trim());
    setSummary(draft.trim());
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const approve = async () => {
    if (!summary.trim()) return;
    setAnswer("selectedConcept", {
      title: title.trim() || `${name}'s Adventure`,
      summary: summary.trim(),
    });

    // Dev-only: ?dev=1 fires the full-book engine and routes to the dev preview
    // INSTEAD of the normal Generating step. Without ?dev=1, behavior unchanged.
    const isDev = new URLSearchParams(window.location.search).get("dev") === "1";
    if (isDev) {
      setLoading(true);
      try {
        const brief = buildBrief(answers);
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-book",
          { body: { brief } },
        );
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        if (!data?.id) throw new Error("No book id returned.");
        navigate(`/dev/story-preview/${data.id}`);
        return;
      } catch (e: any) {
        const msg = e?.message || "Full-book generation failed.";
        toast({ title: "Dev: book engine error", description: msg });
        setLoading(false);
        // Fall through to normal flow on failure.
      }
    }

    navigate(pathForStep(9));
  };

  const wordCount = (s: string) =>
    s.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      className="flex flex-col min-h-[100dvh]"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <WizardHeader currentStep={9} />

      <main className="flex-1 flex justify-center px-4 pt-8 pb-32">
        <div className="w-full" style={{ maxWidth: "700px" }}>
          {portrait.hasPhoto && portrait.status !== "idle" && (
            <div className="mb-6 flex flex-col items-center">
              <div
                className="rounded-2xl overflow-hidden border bg-white shadow-sm"
                style={{
                  borderColor: "hsl(var(--wizard-primary) / 0.18)",
                  width: 160,
                  aspectRatio: "2 / 3",
                }}
              >
                {portrait.status === "ready" && portrait.dataUrl ? (
                  <img
                    src={portrait.dataUrl}
                    alt={`Portrait of ${name}`}
                    className="w-full h-full object-cover"
                  />
                ) : portrait.status === "error" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center gap-2">
                    <p className="text-xs text-[hsl(var(--wizard-primary))]/70">
                      Portrait hit a snag.
                    </p>
                    <button
                      type="button"
                      onClick={portrait.regenerate}
                      className="text-xs underline text-[hsl(var(--wizard-primary))]"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 gap-2 animate-pulse bg-black/5">
                    <p className="text-xs italic text-center text-[hsl(var(--wizard-primary))]/70">
                      {portraitMsg}
                    </p>
                  </div>
                )}
              </div>
              {portrait.status === "ready" && (
                <button
                  type="button"
                  onClick={portrait.regenerate}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-[hsl(var(--wizard-primary))]/70 hover:text-[hsl(var(--wizard-primary))]"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh portrait
                </button>
              )}
            </div>
          )}

          <h1 className="font-heading font-semibold text-center mb-1 text-4xl md:text-3xl text-[hsl(var(--wizard-primary))]">
            Here's {name}'s story
          </h1>
          <p
            className="text-sm text-center mb-6"
            style={{ color: "hsl(var(--wizard-primary) / 0.65)" }}
          >
            Read it, refresh it, or tweak it before we draw the pictures.
          </p>

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
                  <span className="italic">
                    Tip: aim for ~100 words for the best book length.
                  </span>
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
                    <p
                      className="text-sm italic"
                      style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}
                    >
                      {loadingMsg}
                    </p>
                  </div>
                )}
                <h2 className="font-heading text-2xl font-semibold text-center text-[hsl(var(--wizard-primary))] mb-3">
                  {title || `${name}'s Adventure`}
                </h2>
                <p className="text-base font-serif leading-relaxed whitespace-pre-wrap text-[hsl(var(--wizard-primary))]/90">
                  {summary}
                </p>
                <p className="text-xs text-[hsl(var(--wizard-primary))]/45 text-right mt-3">
                  {wordCount(summary)} words
                </p>
              </div>
            )}

            {error && !loading && !editing && (
              <p className="text-sm text-red-600 mt-3 text-center">{error}</p>
            )}
          </div>

          {/* Refresh + Edit controls */}
          {!editing && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                type="button"
                onClick={fetchSummary}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border border-black/15 text-[hsl(var(--wizard-primary))] bg-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Crafting…" : summary ? "Refresh" : "Try again"}
              </button>
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

          <p
            className="text-center text-xs italic mt-6"
            style={{ color: "hsl(var(--wizard-primary) / 0.5)" }}
          >
            Refresh as many times as you like. Once it's just right, approve
            and we'll bring the cover to life.
          </p>
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
            onClick={approve}
            disabled={!summary || loading || editing}
            className="flex-1 basis-0 py-4 rounded-full text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "hsl(var(--wizard-primary))",
              color: "#fff",
            }}
          >
            Approve & illustrate →
          </button>
        </div>
      </div>
    </div>
  );
}
