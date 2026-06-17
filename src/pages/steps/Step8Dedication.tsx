import { useEffect } from "react";
import WizardShell from "@/components/WizardShell";
import StepHeader from "@/components/StepHeader";
import { Textarea } from "@/components/ui/textarea";
import { useWizard } from "@/contexts/WizardContext";

export default function Step8Dedication() {
  const { answers, setAnswer, setCanContinue } = useWizard();

  const childName = (
    (answers.childName as string) ||
    (answers.protagonist as { name?: string } | undefined)?.name ||
    "you"
  ).trim();

  const defaultDedication = `For ${childName}, with all our love.`;
  const dedicationText = answers.dedicationText as string | undefined;
  const value = dedicationText !== undefined ? dedicationText : defaultDedication;

  // Seed the default on first visit so it flows through to the brief
  // even if the user doesn't edit it.
  useEffect(() => {
    if (answers.dedicationText === undefined) {
      setAnswer("dedicationText", defaultDedication);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCanContinue(value.trim().length > 0);
  }, [value, setCanContinue]);

  const missingHint = !value.trim() ? "Write a dedication to continue." : undefined;

  return (
    <WizardShell missingHint={missingHint}>
      <div className="space-y-10">
        <StepHeader
          title="Write their dedication 💌"
          subtitle="This message appears on the first page of the book. You can keep the default or make it your own."
        />

        <Textarea
          value={value}
          onChange={(e) => setAnswer("dedicationText", e.target.value)}
          rows={6}
          placeholder={defaultDedication}
          className="text-base leading-relaxed resize-none"
        />
      </div>
    </WizardShell>
  );
}
