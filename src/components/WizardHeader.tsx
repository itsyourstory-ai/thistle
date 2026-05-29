import ProgressBar from "./ProgressBar";

export default function WizardHeader({ currentStep }: { currentStep: number }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-black/10 w-full"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <div className="w-[70px]" />

      <ProgressBar currentStep={currentStep} />

      <button
        className="text-sm font-medium px-3 py-1.5 rounded-xl transition-colors hover:bg-black/5"
        style={{ color: "hsl(var(--wizard-primary))" }}
      >
        Save &amp; exit
      </button>
    </header>
  );
}
