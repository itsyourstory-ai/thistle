import { useCallback, useEffect, useRef, useState } from "react";
import { pathForStep } from "@/lib/wizardSteps";
import { useNavigate } from "react-router-dom";
import { useWizard } from "@/contexts/WizardContext";
import WizardHeader from "@/components/WizardHeader";
import { buildBrief } from "@/lib/buildBrief";
import { coverMessages, pipelineMessage, useRotatingMessage } from "@/lib/loadingMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const MIN_DURATION = 6000; // soft floor so animation doesn't feel cut short

export default function Step10Generating() {
  const { answers, setAnswer, setIsGenerating } = useWizard();
  const navigate = useNavigate();
  const name = (answers.childName || "your little one").trim();
  const title = (answers.selectedConcept?.title || "").trim();
  const plan = answers.selectedPlan === "digital" ? "Digital Book" : "Printed Hardcover + Digital";

  const [done, setDone] = useState(false);
  const [errored, setErrored] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<{ stage: string; current: number; total: number } | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());
  const pollRef = useRef<number | null>(null);

  const message = useRotatingMessage(coverMessages(name), 2200);
  const pipelineMsg = progress
    ? pipelineMessage(progress.stage, progress.current, progress.total, name)
    : `Writing ${name}'s story…`;

  const runGeneration = useCallback(async () => {
    setErrored(null);
    setDone(false);
    setProgress(null);
    setBookId(null);
    setIsGenerating(true);
    startedAt.current = Date.now();

    try {
      const brief = buildBrief(answers);
      const seed = (answers.characterPortrait as { dataUrl?: string } | undefined)?.dataUrl || null;
      const { data: bookResp, error: bookErr } = await supabase.functions.invoke(
        "generate-book",
        {
          body: {
            brief,
            buyer_name: answers.buyer_name || "",
            buyer_email: answers.buyer_email || "",
            seed_portrait_data_url: seed,
          },
        },
      );
      if (bookErr) throw bookErr;
      if (bookResp?.error) throw new Error(bookResp.error);
      const id: string | undefined = bookResp?.id;
      if (!id) throw new Error("Book id missing from response.");
      setBookId(id);
      setAnswer("bookId", id);
    } catch (e: any) {
      const msg = e?.message || "Couldn't start the book.";
      setErrored(msg);
      setIsGenerating(false);
      toast({ title: "Hit a snag", description: msg });
    }
  }, [answers, setAnswer, setIsGenerating]);

  useEffect(() => {
    runGeneration();
    return () => setIsGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Poll book progress
  useEffect(() => {
    if (!bookId) return;
    let lastKey = "";
    let lastAt = Date.now();
    const tick = async () => {
      const { data } = await supabase
        .from("generated_books")
        .select("pipeline_status,pipeline_progress,pipeline_error")
        .eq("id", bookId)
        .maybeSingle();
      if (!data) return;
      const status = (data.pipeline_status as string) || "idle";
      const prog = (data.pipeline_progress as any) || null;
      const err = (data.pipeline_error as string) || null;
      if (prog) setProgress(prog);

      const key = `${status}:${prog?.stage}:${prog?.current}/${prog?.total}`;
      if (key !== lastKey) {
        lastKey = key;
        lastAt = Date.now();
      } else if (
        status !== "done" &&
        status !== "failed" &&
        status !== "story" &&
        Date.now() - lastAt > 90_000
      ) {
        lastAt = Date.now();
        void supabase.functions.invoke("generate-book-images", { body: { book_id: bookId } });
      }

      if (status === "done") {
        if (pollRef.current) window.clearInterval(pollRef.current);
        const elapsed = Date.now() - startedAt.current;
        setTimeout(() => {
          setDone(true);
          setIsGenerating(false);
        }, Math.max(0, MIN_DURATION - elapsed));
      } else if (status === "failed") {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setErrored(err || "Generation failed.");
        setIsGenerating(false);
      }
    };
    pollRef.current = window.setInterval(tick, 3000);
    tick();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [bookId, setIsGenerating]);

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
            Now crafting
          </p>
          <h1
            className="text-2xl leading-tight"
            style={{ color: "hsl(var(--wizard-primary))", fontFamily: "'Source Serif 4', serif" }}
          >
            {title ? `"${title}"` : "Your book"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(var(--wizard-primary) / 0.7)" }}>
            for {name} · {plan}
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
            key={done ? "done" : pipelineMsg || message}
            className="text-lg font-medium text-center"
            style={{
              color: "hsl(var(--wizard-primary))",
              animation: "btn-fade 0.4s ease-out",
            }}
          >
            ✨ {done ? "Your book is ready!" : (pipelineMsg || message)}
          </p>
        </div>

        <p className="text-sm italic text-center mb-6" style={{ color: "hsl(var(--wizard-primary) / 0.5)" }}>
          Every word, every illustration — made just for {name}.
        </p>

        {/* Progress bar */}
        {!done && !errored && progress && progress.total > 0 && (
          <div className="w-full max-w-xs mb-6">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "hsl(var(--wizard-primary) / 0.15)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round((progress.current / progress.total) * 100))}%`,
                  backgroundColor: "hsl(var(--wizard-primary))",
                }}
              />
            </div>
            <p className="text-xs text-center mt-2" style={{ color: "hsl(var(--wizard-primary) / 0.6)" }}>
              {progress.stage === "pages"
                ? `Page ${progress.current} of ${progress.total}`
                : progress.stage === "portraits"
                  ? `Portrait ${progress.current} of ${progress.total}`
                  : "Getting started…"}
            </p>
          </div>
        )}

        {done && !errored && (
          <div className="flex flex-col items-center gap-3" style={{ animation: "btn-fade 0.6s ease-out" }}>
            <p className="text-sm text-center max-w-sm" style={{ color: "hsl(var(--wizard-primary) / 0.75)" }}>
              We'll email everything to <span className="font-semibold">{answers.buyer_email}</span> shortly.
            </p>
            <button
              onClick={() => navigate(pathForStep(1))}
              className="px-8 py-4 rounded-full text-base font-semibold"
              style={{ backgroundColor: "hsl(var(--wizard-primary))", color: "#fff" }}
            >
              🎉 Back to start
            </button>
          </div>
        )}

        {errored && (
          <div
            className="flex flex-col items-center gap-3 max-w-xs text-center"
            style={{ animation: "btn-fade 0.4s ease-out" }}
          >
            <p className="text-sm text-[#2b4e18]/70">
              We had a little trouble crafting the book. Let's try again — your order is safe.
            </p>
            <button
              onClick={() => setAttempt((n) => n + 1)}
              className="px-6 py-3 rounded-full text-sm font-semibold"
              style={{ backgroundColor: "hsl(var(--wizard-primary))", color: "#fff" }}
            >
              ✨ Try again
            </button>
            <button
              onClick={() => navigate(pathForStep(9))}
              className="text-xs underline text-[#2b4e18]/60"
            >
              Back to checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
