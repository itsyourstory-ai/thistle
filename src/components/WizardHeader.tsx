import ProgressBar from "./ProgressBar";

export default function WizardHeader({
  currentStep,
  onDevSkip,
}: {
  currentStep: number;
  /** Dev-only bypass: ignores validation, always advances to the next step. */
  onDevSkip?: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-30 relative flex items-center justify-between px-4 py-3 border-b border-black/10 w-full"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <div className="w-[70px]" />

      <div className="absolute left-1/2 -translate-x-1/2">
        <ProgressBar currentStep={currentStep} />
      </div>

      <div className="flex items-center gap-2">
        {onDevSkip && (
          <button
            type="button"
            onClick={onDevSkip}
            title="Developer bypass — skips validation"
            className="text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/70 hover:text-muted-foreground hover:border-muted-foreground/70 transition-colors"
          >
            ⚙ dev: skip step
          </button>
        )}
        <button
          className="text-sm font-medium px-3 py-1.5 rounded-xl transition-colors hover:bg-black/5"
          style={{ color: "hsl(var(--wizard-primary))" }}
        >
          Save &amp; exit
        </button>
      </div>
    </header>
  );
}
