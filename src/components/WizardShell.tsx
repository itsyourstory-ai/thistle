import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import WizardHeader from "./WizardHeader";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/contexts/WizardContext";
import { TOTAL_STEPS, pathForStep, stepNumFromSlug } from "@/lib/wizardSteps";
import type { ReactNode } from "react";

export default function WizardShell({
  children,
  showSkip = false,
  maxWidth = 700,
  onBeforeContinue,
}: {
  children: ReactNode;
  showSkip?: boolean;
  maxWidth?: number;
  /** Optional gate. Return false (or a Promise resolving to false) to block
   *  navigation — useful for "are you sure?" confirmations. */
  onBeforeContinue?: () => boolean | Promise<boolean>;
}) {
  const { step } = useParams<{ step: string }>();
  const location = useLocation();
  const slugFromPath = location.pathname.match(/^\/step\/([^/]+)$/)?.[1];
  const currentStep = stepNumFromSlug(step ?? slugFromPath);
  const navigate = useNavigate();
  const { canContinue } = useWizard();

  const goBack = () => {
    if (currentStep > 1) navigate(pathForStep(currentStep - 1));
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS) navigate(pathForStep(currentStep + 1));
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    if (onBeforeContinue) {
      const ok = await onBeforeContinue();
      if (!ok) return;
    }
    goNext();
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-wizard-bg">
      <WizardHeader currentStep={currentStep} onDevSkip={goNext} />

      {/* Content */}
      <main className="flex-1 flex justify-center px-4 pt-12 pb-20">
        <div className="w-full" style={{ maxWidth: `${maxWidth}px` }}>{children}</div>
      </main>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-30 px-4 py-4 flex flex-col items-center gap-2 border-t border-black/10 bg-wizard-bg">
        <div className="flex justify-center items-center gap-3 w-full" style={{ maxWidth: "700px" }}>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="wizardOutline"
              size="pill"
              onClick={goBack}
              className="flex-1 basis-0 transition-all"
            >
              ← Back
            </Button>
          )}
          {showSkip && (
            <Button
              type="button"
              variant="wizardGhost"
              size="pill"
              onClick={goNext}
              className="transition-all"
            >
              Skip
            </Button>
          )}
          <Button
            type="button"
            variant="wizard"
            size="pill"
            onClick={handleContinue}
            disabled={!canContinue}
            className="flex-1 basis-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue →
          </Button>
        </div>
      </div>
    </div>
  );
}
