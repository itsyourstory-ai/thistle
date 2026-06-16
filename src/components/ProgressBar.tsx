import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWizard } from "@/contexts/WizardContext";
import { TOTAL_STEPS, pathForStep } from "@/lib/wizardSteps";

// Short, accurate step names for tooltips and the visible step counter.
// Matches the current 11-step flow.
const STEP_LABELS: Record<number, string> = {
  1: "Who's it for?",
  2: "From & Occasion",
  3: "Story Type",
  4: "Life Lessons",
  5: "Interests",
  6: "Art Style",
  7: "Characters",
  8: "Story",
  9: "Cast & Cover",
  10: "Checkout",
  11: "Generating",
};

// Warm, child-focused encouragement that swaps as the user advances.
// Keep these short — they sit in a tiny caption under the dots.
const PROGRESS_MESSAGES: Record<number, string> = {
  1: "Let's meet the star of the show ⭐",
  2: "What a thoughtful gift 💛",
  3: "Time to choose the adventure 🌱",
  4: "Every great story teaches something 📚",
  5: "Their favorite things, woven in ✨",
  6: "Picking the perfect look 🎨",
  7: "Gathering their cast of friends 🧸",
  8: "Tada — meet your storybook 🎉",
  9: "Your characters are coming to life 🎨",
  10: "Almost ready to print 💌",
  11: "Stitching every page together ✨",
};

export default function ProgressBar({ currentStep }: { currentStep: number }) {
  const navigate = useNavigate();
  const { isGenerating } = useWizard();

  const safeStep = Math.min(Math.max(currentStep, 1), TOTAL_STEPS);
  const message = PROGRESS_MESSAGES[safeStep] ?? PROGRESS_MESSAGES[1];
  const label = STEP_LABELS[safeStep] ?? STEP_LABELS[1];

  return (
    <div className="flex flex-col items-center gap-1">
      <TooltipProvider delayDuration={0}>
        <div className="flex">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const stepNum = i + 1;
            const locked = isGenerating;
            // Three visual states: completed, current, future
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            const isFuture = stepNum > currentStep;

            // Future dots are not navigable; completed + current are (unless locked)
            const isDisabled = locked || isFuture;

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  {/* Padded hit area for touch — visual bar stays slim */}
                  <div
                    data-step={stepNum}
                    role="button"
                    tabIndex={isDisabled ? -1 : 0}
                    aria-disabled={isDisabled}
                    aria-label={`Step ${stepNum}: ${STEP_LABELS[stepNum]}`}
                    onClick={() => {
                      if (isDisabled) return;
                      navigate(pathForStep(stepNum));
                    }}
                    className={`py-2 px-0.5 ${isDisabled ? "cursor-default pointer-events-none" : "cursor-pointer"}`}
                  >
                    <div
                      data-step-dot={stepNum}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isCurrent
                          ? "ring-2 ring-offset-1 ring-[hsl(var(--wizard-primary)/0.4)] scale-y-110"
                          : !isDisabled
                          ? "hover:scale-y-150"
                          : ""
                      }`}
                      style={{
                        width: 24,
                        backgroundColor:
                          isCompleted || isCurrent
                            ? "hsl(var(--wizard-primary))"
                            : "hsl(var(--wizard-primary) / 0.15)",
                      }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Step {stepNum}: {STEP_LABELS[stepNum]}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Visible step counter: "Step X of N · Label" */}
      <span className="text-xs text-muted-foreground/70 font-normal tracking-wide mt-0.5">
        Step {safeStep} of {TOTAL_STEPS} · {label}
      </span>

      {/* `key` forces a remount on step change so the CSS animation replays as
          a soft fade-in instead of an abrupt text swap. */}
      <span
        key={safeStep}
        className="text-xs text-muted-foreground font-medium tracking-wide opacity-0 animate-[fadeIn_400ms_ease-out_forwards]"
      >
        {message}
      </span>
    </div>
  );
}
