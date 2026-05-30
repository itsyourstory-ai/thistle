import { useEffect, useRef, useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { Pencil, RefreshCw, Check, X } from "lucide-react";
import { useWizard } from "@/contexts/WizardContext";
import WizardHeader from "@/components/WizardHeader";
import StoryDetailsRecap from "@/components/StoryDetailsRecap";
import { buildBrief } from "@/lib/buildBrief";
import { summaryMessages, portraitMessages, coverMessages, useRotatingMessage } from "@/lib/loadingMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCharacterPortrait } from "@/hooks/useCharacterPortrait";
import { useSupportingPortraits } from "@/hooks/useSupportingPortraits";
import ImageLightbox from "@/components/ImageLightbox";

type CoverState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; dataUrl: string }
  | { status: "error"; error: string };

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
  const coverMsg = useRotatingMessage(coverMessages(name), 2400);

  const [cover, setCover] = useState<CoverState>(
    answers.selectedConcept?.coverImage
      ? { status: "ready", dataUrl: answers.selectedConcept.coverImage }
      : { status: "idle" },
  );
  const coverGenSig = useRef<string>("");

  // Portraits of the full cast (kicked off in Step 7). Idempotent and now
  // always generates — even when no reference photo was uploaded.
  const portrait = useCharacterPortrait();
  const { portraits: supportingPortraits, regenerate: regenerateSupporting } = useSupportingPortraits();
  const supportingChars: any[] = Array.isArray(answers.supportingCharacters) ? answers.supportingCharacters : [];
  const portraitMsg = useRotatingMessage(portraitMessages(name), 2200);

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

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
      setCover({ status: "idle" }); // re-draw cover for the new summary
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

  const generateCover = async () => {
    if (!summary.trim() || !title.trim()) return;
    const sig = `${title}::${summary}::${portrait.dataUrl ? "p" : "np"}`;
    coverGenSig.current = sig;
    setCover({ status: "loading" });
    try {
      const brief = buildBrief(answers);
      const { data, error: fnError } = await supabase.functions.invoke("generate-cover", {
        body: {
          brief,
          title,
          summary,
          characterPortraitDataUrl: portrait.dataUrl,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const url: string | undefined = data?.imageDataUrl;
      if (!url) throw new Error("No cover image returned.");
      setCover({ status: "ready", dataUrl: url });
    } catch (e: any) {
      const msg = e?.message || "Couldn't draw the cover.";
      setCover({ status: "error", error: msg });
      toast({ title: "Cover hit a snag", description: msg });
    }
  };

  // Auto-kick the cover when summary + hero portrait are ready.
  useEffect(() => {
    if (cover.status === "idle" && summary.trim() && title.trim() && portrait.status === "ready") {
      generateCover();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.status, summary, title, portrait.status]);

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

  const buildApprovedConcept = (): StoryConcept => {
    const visibleTitle = title.trim() || `${name}'s Adventure`;
    const visibleSummary = summary.trim();
    const coverImage = cover.status === "ready" ? cover.dataUrl : (concept as any)?.coverImage;

    if (concept?.user_edited) {
      return {
        title: visibleTitle,
        summary: visibleSummary,
        user_visible_summary: visibleSummary,
        user_edited: true,
        ...(coverImage ? { coverImage } : {}),
      } as StoryConcept;
    }

    return {
      ...(concept || {}),
      title: visibleTitle,
      summary: visibleSummary,
      user_visible_summary: visibleSummary,
      ...(coverImage ? { coverImage } : {}),
    } as StoryConcept;
  };

  const approve = async () => {
    if (!summary.trim()) return;
    const approvedConcept = buildApprovedConcept();
    setAnswer("selectedConcept", approvedConcept);

    // Dev-only: ?dev=1 fires the full-book engine and routes to the dev preview
    // INSTEAD of the normal Generating step. Without ?dev=1, behavior unchanged.
    const isDev = new URLSearchParams(window.location.search).get("dev") === "1";
    if (isDev) {
      setLoading(true);
      try {
        const brief = buildBrief({
          ...answers,
          selectedConcept: approvedConcept,
        });
        const { data, error: fnError } = await supabase.functions.invoke("generate-book", { body: { brief } });
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
                Refresh as many times as you like. Once it's just right, approve and we'll move on to checkout.
              </p>

              {/* Cover preview */}
              <div className="flex flex-col items-start">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[hsl(var(--wizard-primary))]/55 mb-2 text-left">
                  Cover preview
                </p>
                <div
                  className="rounded-2xl overflow-hidden border bg-white shadow-md"
                  style={{
                    borderColor: "hsl(var(--wizard-primary) / 0.18)",
                    width: 260,
                    aspectRatio: "1 / 1",
                  }}
                >
                  {cover.status === "ready" ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          src: cover.dataUrl,
                          alt: `Cover of ${title || `${name}'s book`}`,
                        })
                      }
                      className="w-full h-full block cursor-zoom-in"
                      aria-label="Enlarge cover"
                    >
                      <img
                        src={cover.dataUrl}
                        alt={`Cover of ${title || `${name}'s book`}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : cover.status === "error" ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                      <p className="text-xs text-[hsl(var(--wizard-primary))]/70">Couldn't draw the cover.</p>
                      <button
                        type="button"
                        onClick={generateCover}
                        className="text-xs underline text-[hsl(var(--wizard-primary))]"
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 animate-pulse bg-black/5">
                      <p className="text-xs italic text-center text-[hsl(var(--wizard-primary))]/70">{coverMsg}</p>
                    </div>
                  )}
                </div>
                {cover.status === "ready" && (
                  <button
                    type="button"
                    onClick={generateCover}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[hsl(var(--wizard-primary))]/60 hover:text-[hsl(var(--wizard-primary))]"
                  >
                    <RefreshCw className="w-3 h-3" /> Redraw cover
                  </button>
                )}
              </div>

              {(() => {
                const cast: Array<{
                  key: string;
                  label: string;
                  state: { status: string; dataUrl?: string; error?: string };
                  onRetry: () => void;
                }> = [
                  {
                    key: "hero",
                    label: name,
                    state: portrait,
                    onRetry: portrait.regenerate,
                  },
                  ...supportingChars
                    .filter((c) => c?.id && c?.name)
                    .map((c) => ({
                      key: c.id as string,
                      label: c.name as string,
                      state: (supportingPortraits[c.id] as any) ?? { status: "loading" },
                      onRetry: () => regenerateSupporting(c.id),
                    })),
                ];

                return (
                  <div className="flex flex-wrap items-start justify-start gap-4">
                    {cast.map((m) => (
                      <div key={m.key} className="flex flex-col items-center">
                        <div
                          className="rounded-2xl overflow-hidden border bg-white shadow-sm"
                          style={{
                            borderColor: "hsl(var(--wizard-primary) / 0.18)",
                            width: 140,
                            aspectRatio: "2 / 3",
                          }}
                        >
                          {m.state.status === "ready" && m.state.dataUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setLightbox({
                                  src: m.state.dataUrl!,
                                  alt: `Portrait of ${m.label}`,
                                })
                              }
                              className="w-full h-full block cursor-zoom-in"
                              aria-label={`Enlarge portrait of ${m.label}`}
                            >
                              <img
                                src={m.state.dataUrl}
                                alt={`Portrait of ${m.label}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : m.state.status === "error" ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center gap-2">
                              <p className="text-xs text-[hsl(var(--wizard-primary))]/70">Portrait hit a snag.</p>
                              <button
                                type="button"
                                onClick={m.onRetry}
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
                        <p className="mt-2 text-xs font-medium text-[hsl(var(--wizard-primary))]/80">{m.label}</p>
                        {m.state.status === "ready" && (
                          <button
                            type="button"
                            onClick={m.onRetry}
                            className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-[hsl(var(--wizard-primary))]/60 hover:text-[hsl(var(--wizard-primary))]"
                          >
                            <RefreshCw className="w-3 h-3" /> Refresh
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
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
            onClick={approve}
            disabled={!summary || loading || editing}
            className="flex-1 basis-0 py-4 rounded-full text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "hsl(var(--wizard-primary))",
              color: "#fff",
            }}
          >
            Approve & continue →
          </button>
        </div>
      </div>

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
