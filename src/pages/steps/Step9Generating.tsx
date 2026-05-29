import { useCallback, useEffect, useRef, useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { useWizard } from "@/contexts/WizardContext";
import WizardHeader from "@/components/WizardHeader";
import { buildBrief } from "@/lib/buildBrief";
import { coverMessages, useRotatingMessage } from "@/lib/loadingMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const MIN_DURATION = 6000; // soft floor so animation doesn't feel cut short

export default function Step11Generating() {
  const { answers, setAnswer, setIsGenerating } = useWizard();
  const navigate = useNavigate();
  const name = (answers.childName || "your little one").trim();

  const [done, setDone] = useState(false);
  const [coverDone, setCoverDone] = useState(false);
  const [errored, setErrored] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startedAt = useRef<number>(Date.now());

  const title = (answers.selectedConcept?.title || "").trim();

  const message = useRotatingMessage(coverMessages(name), 2200);

  const runGeneration = useCallback(async () => {
    setErrored(null);
    setCoverDone(false);
    setDone(false);
    setIsGenerating(true);
    startedAt.current = Date.now();

    const concept = answers.selectedConcept || {};
    try {
      const brief = buildBrief(answers);

      // Load the picked art-style preview as a data URL so the cover model
      // gets the same image the user picked on Step 6 as a visual reference.
      let styleReferenceImage: string | undefined;
      try {
        const { ART_STYLES } = await import("@/lib/artStyles");
        const style = ART_STYLES.find((s) => s.value === brief.artStyle);
        if (style?.preview) {
          const resp = await fetch(style.preview);
          const blob = await resp.blob();
          styleReferenceImage = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Could not load style reference image", e);
      }

      const characterPortraitDataUrl =
        (answers.characterPortrait as { dataUrl?: string } | undefined)?.dataUrl;

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-cover",
        {
          body: {
            brief,
            title: concept.title || "",
            summary: concept.summary || "",
            styleReferenceImage,
            characterPortraitDataUrl,
          },
        },
      );
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const imageDataUrl = data?.imageDataUrl as string | undefined;
      if (!imageDataUrl) throw new Error("No cover image returned.");

      setAnswer("selectedConcept", {
        ...concept,
        coverImage: imageDataUrl,
      });

      setCoverDone(true);
      const elapsed = Date.now() - startedAt.current;
      const wait = Math.max(0, MIN_DURATION - elapsed);
      setTimeout(() => {
        setDone(true);
        setIsGenerating(false);
      }, wait);
    } catch (e: any) {
      const msg = e?.message || "Cover generation failed.";
      setErrored(msg);
      setCoverDone(false);
      setDone(false);
      setIsGenerating(false); // unlock nav so they can go Back if needed
      toast({ title: "Cover hit a snag", description: msg });
    }
  }, [answers, setAnswer, setIsGenerating]);

  useEffect(() => {
    runGeneration();
    // Cleanup: if the user navigates away mid-flight, release the lock.
    return () => setIsGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div
      className="flex flex-col min-h-[100dvh]"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <WizardHeader currentStep={10} />

      <div className="flex-1 flex flex-col items-center justify-center px-4 relative">
        <style>{`
          @keyframes book-open {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(-35deg); }
          }
          @keyframes page-flutter {
            0%, 100% { transform: rotateY(0deg); }
            50% { transform: rotateY(-8deg); }
          }
          @keyframes float-sparkle {
            0% { opacity: 0; transform: translateY(0) scale(0); }
            20% { opacity: 1; transform: translateY(-10px) scale(1); }
            100% { opacity: 0; transform: translateY(-60px) scale(0.5); }
          }
          @keyframes check-pop {
            0% { opacity: 0; transform: scale(0.5); }
            60% { opacity: 1; transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes btn-fade {
            0% { opacity: 0; transform: translateY(12px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .sparkle {
            position: absolute;
            border-radius: 50%;
            background: hsl(var(--wizard-primary));
            animation: float-sparkle 2.4s ease-out infinite;
          }
        `}</style>

        {/* Title header */}
        <div className="text-center mb-6 px-2 max-w-sm">
          <p
            className="text-xs uppercase tracking-[0.18em] mb-1"
            style={{ color: "hsl(var(--wizard-primary) / 0.55)" }}
          >
            Now making
          </p>
          <h1
            className="text-2xl leading-tight"
            style={{ color: "hsl(var(--wizard-primary))", fontFamily: "'Source Serif 4', serif" }}
          >
            {title ? `"${title}"` : "Your book"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}>
            for {name}
          </p>
        </div>

        {/* Book animation */}
        <div className="relative w-40 h-48 mb-8" style={{ perspective: "600px" }}>
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="sparkle"
              style={{
                width: 4 + (i % 3) * 2,
                height: 4 + (i % 3) * 2,
                left: `${15 + i * 12}%`,
                bottom: `${20 + (i % 4) * 15}%`,
                animationDelay: `${i * 0.35}s`,
                opacity: done ? 0 : undefined,
              }}
            />
          ))}

          <svg
            viewBox="0 0 160 200"
            className="w-full h-full"
            style={{ filter: "drop-shadow(0 8px 24px hsl(var(--wizard-primary) / 0.18))" }}
          >
            <rect x="30" y="10" width="100" height="180" rx="4" fill="hsl(var(--wizard-primary) / 0.15)" stroke="hsl(var(--wizard-primary) / 0.3)" strokeWidth="1.5" />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={34 + i * 2}
                y={14 + i}
                width="92"
                height="172"
                rx="2"
                fill="#fff"
                stroke="hsl(var(--wizard-primary) / 0.1)"
                strokeWidth="0.5"
                style={{
                  transformOrigin: "left center",
                  animation: done
                    ? "none"
                    : `page-flutter ${1.8 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
            <rect
              x="30"
              y="10"
              width="100"
              height="180"
              rx="4"
              fill="hsl(var(--wizard-primary))"
              style={{
                transformOrigin: "left center",
                animation: done ? "none" : "book-open 3s ease-in-out infinite alternate",
              }}
            />
            <rect x="28" y="10" width="6" height="180" rx="2" fill="hsl(var(--wizard-primary) / 0.8)" />
            <rect x="50" y="60" width="60" height="6" rx="3" fill="hsl(var(--wizard-primary-foreground, 0 0% 100%) / 0.6)" style={{ transformOrigin: "left center", animation: done ? "none" : "book-open 3s ease-in-out infinite alternate" }} />
            <rect x="55" y="74" width="40" height="4" rx="2" fill="hsl(var(--wizard-primary-foreground, 0 0% 100%) / 0.35)" style={{ transformOrigin: "left center", animation: done ? "none" : "book-open 3s ease-in-out infinite alternate" }} />
          </svg>

          {done && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ animation: "check-pop 0.5s ease-out forwards" }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "hsl(var(--wizard-primary))" }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
          )}
        </div>

        <div className="h-10 flex items-center justify-center mb-4 overflow-hidden">
          <p
            key={message}
            className="text-lg font-medium text-center"
            style={{
              color: "hsl(var(--wizard-primary))",
              animation: "btn-fade 0.4s ease-out",
            }}
          >
            ✨ {done ? "Your book is ready!" : message}
          </p>
        </div>

        <p className="text-sm italic text-center mb-6" style={{ color: "hsl(var(--wizard-primary) / 0.5)" }}>
          Every word, every illustration — made just for {name}.
        </p>

        {/* Live checklist */}
        <ul
          className="w-full max-w-xs space-y-2 mb-8 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: "hsl(var(--wizard-primary) / 0.05)",
            border: "1px solid hsl(var(--wizard-primary) / 0.1)",
          }}
        >
          <ChecklistRow state="done" label="Story written" />
          <ChecklistRow state={coverDone ? "done" : "active"} label={coverDone ? "Cover painted" : "Painting the cover…"} />
          <ChecklistRow state={done ? "done" : coverDone ? "active" : "pending"} label={done ? "Pages bound" : "Binding the pages"} />
        </ul>

        {done && !errored && (
          <button
            onClick={() => navigate(pathForStep(10))}
            className="px-8 py-4 rounded-full text-base font-semibold"
            style={{
              backgroundColor: "hsl(var(--wizard-primary))",
              color: "#fff",
              animation: "btn-fade 0.6s ease-out",
            }}
          >
            ✨ Your book is ready — take a look
          </button>
        )}

        {errored && (
          <div
            className="flex flex-col items-center gap-3 max-w-xs text-center"
            style={{ animation: "btn-fade 0.4s ease-out" }}
          >
            <p className="text-sm text-[#2b4e18]/70">
              We had a little trouble painting the cover. Let's try again —
              your story is safe.
            </p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="px-6 py-3 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: "hsl(var(--wizard-primary))",
                color: "#fff",
              }}
            >
              ✨ Try again
            </button>
            <button
              onClick={() => navigate(pathForStep(8))}
              className="text-xs underline text-[#2b4e18]/60"
            >
              Back to the story
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type RowState = "done" | "active" | "pending";

function ChecklistRow({ state, label }: { state: RowState; label: string }) {
  return (
    <li
      className="flex items-center gap-3 text-sm transition-opacity"
      style={{
        color:
          state === "pending"
            ? "hsl(var(--wizard-primary) / 0.45)"
            : "hsl(var(--wizard-primary))",
        opacity: state === "pending" ? 0.7 : 1,
      }}
    >
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full shrink-0"
        style={{
          backgroundColor:
            state === "done"
              ? "hsl(var(--wizard-primary))"
              : "hsl(var(--wizard-primary) / 0.12)",
          border:
            state === "pending"
              ? "1.5px solid hsl(var(--wizard-primary) / 0.3)"
              : "none",
        }}
      >
        {state === "done" && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {state === "active" && (
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: "hsl(var(--wizard-primary))",
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
        )}
      </span>
      <span className={state === "active" ? "font-medium" : ""}>{label}</span>
    </li>
  );
}
