import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWizard } from "@/contexts/WizardContext";
import { TOTAL_STEPS, pathForStep } from "@/lib/wizardSteps";

// Short, accurate step names for tooltips. Matches the current 10-step flow.
const STEP_LABELS: Record<number, string> = {
  1: "Who's it for?",
  2: "From & Occasion",
  3: "Story Type",
  4: "Life Lessons",
  5: "Interests",
  6: "Art Style",
  7: "Characters",
  8: "Story Summary",
  9: "Generating",
  10: "Preview & Buy",
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
  8: "Your story is taking shape 📖",
  9: "Stitching every page together ✨",
  10: "Tada — meet your storybook 🎉",
};

export default function ProgressBar({ currentStep }: { currentStep: number }) {
  const navigate = useNavigate();
  const { isGenerating } = useWizard();

  const safeStep = Math.min(Math.max(currentStep, 1), TOTAL_STEPS);
  const message = PROGRESS_MESSAGES[safeStep] ?? PROGRESS_MESSAGES[1];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <TooltipProvider delayDuration={0}>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const stepNum = i + 1;
            const locked = isGenerating;
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    role="button"
                    tabIndex={locked ? -1 : 0}
                    aria-disabled={locked}
                    onClick={() => {
                      if (locked) return;
                      navigate(pathForStep(stepNum));
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      locked
                        ? "cursor-not-allowed pointer-events-none"
                        : "cursor-pointer hover:scale-y-150"
                    }`}
                    style={{
                      width: 24,
                      backgroundColor:
                        i < currentStep
                          ? "hsl(var(--wizard-primary))"
                          : "hsl(var(--wizard-primary) / 0.15)",
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Step {stepNum}: {STEP_LABELS[stepNum]}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      {/* `key` forces a remount on step change so the CSS animation replays as
          a soft fade-in instead of an abrupt text swap. */}
      <span
        key={safeStep}
        className="text-xs text-muted-foreground font-medium tracking-wide opacity-0 animate-[fadeIn_400ms_ease-out_forwards] mt-[3px]"
      >
        {message}
      </span>
    </div>
  );
}
