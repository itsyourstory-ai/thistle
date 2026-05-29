import { useParams } from "react-router-dom";
import WizardShell from "@/components/WizardShell";

const STEP_TITLES: Record<number, string> = {
  2: "What kind of story?",
  3: "What should the story teach?",
  4: "What are they interested in?",
  5: "Something special",
  6: "Add characters",
  7: "Make it yours",
  8: "The cover",
  9: "Generating...",
  10: "Preview",
  11: "Buy",
};

export default function StepPlaceholder() {
  const { step } = useParams<{ step: string }>();
  const n = Number(step) || 2;

  return (
    <WizardShell>
      <div className="text-center space-y-4">
        <h1 className="font-heading text-4xl font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
          {STEP_TITLES[n] ?? `Step ${n}`}
        </h1>
        <p className="text-muted-foreground text-lg">This step will be built soon.</p>
      </div>
    </WizardShell>
  );
}
