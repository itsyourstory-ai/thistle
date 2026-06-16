import { Button } from "@/components/ui/button";
import ProgressBar from "./ProgressBar";
import DevTestPanel from "./DevTestPanel";
import { useNavigate } from "react-router-dom";
import { useDraft } from "@/contexts/DraftContext";

export default function WizardHeader({
  currentStep,
  onDevSkip,
}: {
  currentStep: number;
  /** Dev-only bypass: ignores validation, always advances to the next step. */
  onDevSkip?: () => void;
}) {
  const { saveNow } = useDraft();
  const navigate = useNavigate();

  async function handleSaveExit() {
    await saveNow();
    navigate('/dashboard');
  }

  return (
    <header
      className="sticky top-0 z-30 relative border-b border-black/10 w-full bg-wizard-bg"
    >
      {/* Progress bar: always horizontally centered in its own row */}
      <div className="flex justify-center px-4 pt-3 pb-1 sm:py-3">
        <ProgressBar currentStep={currentStep} />
      </div>

      {/* Buttons: centered below progress bar on mobile, absolute-right on sm+ */}
      <div className="flex justify-center items-center gap-2 px-4 pb-2 sm:pb-0 sm:absolute sm:right-4 sm:top-0 sm:bottom-0">
        {onDevSkip && (
          <button
            type="button"
            onClick={onDevSkip}
            title="Developer bypass — skips validation"
            className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/70 hover:text-muted-foreground hover:border-muted-foreground/70 transition-colors"
          >
            Skip step
          </button>
        )}
        {import.meta.env.DEV && <DevTestPanel />}
        <Button variant="wizardGhost" size="sm" className="rounded-xl font-medium" onClick={handleSaveExit}>
          Save &amp; exit
        </Button>
      </div>
    </header>
  );
}
