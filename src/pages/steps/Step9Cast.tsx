import { useEffect, useRef, useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useWizard } from "@/contexts/WizardContext";
import WizardShell from "@/components/WizardShell";
import { buildBrief } from "@/lib/buildBrief";
import { coverMessages, portraitMessages, useRotatingMessage } from "@/lib/loadingMessages";
import { callEdge } from "@/lib/edgeFunctions";
import { toast } from "@/hooks/use-toast";
import { useCharacterPortrait } from "@/hooks/useCharacterPortrait";
import { useSupportingPortraits } from "@/hooks/useSupportingPortraits";
import ImageLightbox from "@/components/ImageLightbox";

type CoverState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; dataUrl: string }
  | { status: "error"; error: string };

export default function Step9Cast() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const navigate = useNavigate();
  const name = (answers.childName || "your little one").trim();

  // Guard against deep-linking past the story step.
  // AIDEV-NOTE: if we land here without a summary, the cover generator has
  // nothing to work with, so push the user back to fill in Step 8 first.
  useEffect(() => {
    if (!answers.selectedConcept?.summary) {
      navigate(pathForStep(8), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title: string = answers.selectedConcept?.title || `${name}'s Adventure`;
  const summary: string = answers.selectedConcept?.summary || "";

  const coverMsg = useRotatingMessage(coverMessages(name), 2400);
  const portraitMsg = useRotatingMessage(portraitMessages(name), 2200);

  const [cover, setCover] = useState<CoverState>(
    answers.selectedConcept?.coverImage
      ? { status: "ready", dataUrl: answers.selectedConcept.coverImage }
      : { status: "idle" },
  );
  const coverGenSig = useRef<string>("");

  const portrait = useCharacterPortrait();
  const { portraits: supportingPortraits, regenerate: regenerateSupporting } = useSupportingPortraits();
  const supportingChars: any[] = Array.isArray(answers.supportingCharacters) ? answers.supportingCharacters : [];

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  // Gate the Continue button on the cover being ready.
  useEffect(() => {
    setCanContinue(cover.status === "ready");
  }, [cover.status, setCanContinue]);

  const missingHintText =
    cover.status !== "ready" ? "Waiting for the cover to finish…" : undefined;

  const generateCover = async () => {
    if (!summary.trim() || !title.trim()) return;
    const sig = `${title}::${summary}::${portrait.dataUrl ? "p" : "np"}`;
    coverGenSig.current = sig;
    setCover({ status: "loading" });
    try {
      const brief = buildBrief(answers);
      const { data, error: fnError } = await callEdge("generate-cover", {
        brief: brief as unknown as Record<string, unknown>,
        title,
        summary,
        characterPortraitDataUrl: portrait.dataUrl,
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const url: string | undefined = data?.imageDataUrl;
      if (!url) throw new Error("No cover image returned.");
      setCover({ status: "ready", dataUrl: url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't draw the cover.";
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

  // onBeforeContinue: save the approved concept, optionally run dev flow,
  // and return false so we control navigation ourselves (navigate is called
  // inside approve when not in dev mode, letting the dev flow redirect differently).
  const approve = async (): Promise<boolean> => {
    const coverImage = cover.status === "ready" ? cover.dataUrl : (answers.selectedConcept as any)?.coverImage;

    const approvedConcept = {
      ...(answers.selectedConcept || {}),
      ...(coverImage ? { coverImage } : {}),
    };
    setAnswer("selectedConcept", approvedConcept);

    // Dev-only: ?dev=1 fires the full-book engine and routes to the dev preview
    // INSTEAD of the normal Generating step. Without ?dev=1, behavior unchanged.
    const isDev = new URLSearchParams(window.location.search).get("dev") === "1";
    if (isDev) {
      try {
        const brief = buildBrief({
          ...answers,
          selectedConcept: approvedConcept,
        });
        const { data, error: fnError } = await callEdge("generate-book", { brief: brief as unknown as Record<string, unknown> });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        if (!data?.id) throw new Error("No book id returned.");
        navigate(`/dev/story-preview/${data.id}`);
        // Return false — we navigated ourselves; shell should not also navigate.
        return false;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Full-book generation failed.";
        toast({ title: "Dev: book engine error", description: msg });
        // Fall through to normal flow on failure.
      }
    }

    // Return true — let WizardShell navigate to the next step.
    return true;
  };

  return (
    <WizardShell
      continueLabel="Approve & continue →"
      missingHint={missingHintText}
      onBeforeContinue={approve}
    >
      <div className="space-y-10">
        <div className="space-y-2">
          <h1
            className="font-heading text-3xl sm:text-4xl font-semibold"
            style={{ color: "hsl(var(--wizard-primary))" }}
          >
            {title}
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's the cover and your characters. Looking good?
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {/* Cover preview */}
          <div className="flex flex-col items-start">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-wizard/55 mb-2 text-left">
              Cover preview
            </p>
            <div
              className="rounded-2xl overflow-hidden border border-wizard/[.18] bg-white shadow-md"
              style={{
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
                      alt: `Cover of ${title}`,
                    })
                  }
                  className="w-full h-full block cursor-zoom-in"
                  aria-label="Enlarge cover"
                >
                  <img
                    src={cover.dataUrl}
                    alt={`Cover of ${title}`}
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

          {/* Character portraits */}
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
                .filter((c) => c?.id)
                .map((c) => ({
                  key: c.id as string,
                  label: c.name ? c.name as string : "A surprise friend 🎁",
                  state: (supportingPortraits[c.id] as any) ?? { status: "loading" },
                  onRetry: () => regenerateSupporting(c.id),
                })),
            ];

            return (
              <div className="flex flex-wrap items-start justify-start gap-4">
                {cast.map((m) => (
                  <div key={m.key} className="flex flex-col items-center">
                    <div
                      className="rounded-2xl overflow-hidden border border-wizard/[.18] bg-white shadow-sm"
                      style={{
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

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </WizardShell>
  );
}
