import { useEffect } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";

const LESSONS = [
  { value: "courage", emoji: "💪", label: "Courage", desc: "Being brave even when scared" },
  { value: "kindness", emoji: "💛", label: "Kindness", desc: "Caring for others" },
  { value: "resilience", emoji: "🌱", label: "Resilience", desc: "Getting back up after falling down" },
  { value: "friendship", emoji: "🤝", label: "Friendship", desc: "What it means to be a good friend" },
  { value: "curiosity", emoji: "🔍", label: "Curiosity", desc: "Exploring and asking questions" },
  { value: "self-confidence", emoji: "🪞", label: "Self-confidence", desc: "Believing in yourself" },
  { value: "sharing", emoji: "🤲", label: "Sharing & generosity", desc: "The joy of giving" },
  { value: "nature", emoji: "🌍", label: "Caring for nature", desc: "Protecting our planet" },
  { value: "empathy", emoji: "🫂", label: "Empathy", desc: "Understanding others' feelings" },
  { value: "just-fun", emoji: "✨", label: "Just for fun", desc: "No lesson needed — pure adventure" },
];

export default function Step3() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const name = (answers.childName as string) || "your little one";
  const lesson = (answers.lesson as string) || "";

  useEffect(() => {
    setCanContinue(lesson !== "");
  }, [lesson, setCanContinue]);

  const selectedLesson = LESSONS.find((l) => l.value === lesson);

  const cardClass = (selected: boolean) =>
    `cursor-pointer rounded-2xl p-4 text-left transition-all border-2 shadow-sm ${
      selected
        ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)]"
        : "border-transparent bg-white hover:shadow-md"
    }`;

  return (
    <WizardShell>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1
            className="font-heading text-3xl sm:text-4xl font-semibold"
            style={{ color: "hsl(var(--wizard-primary))" }}
          >
            Every great story has a heart.
          </h1>
          <p className="text-muted-foreground text-lg">
            What do you want {name} to carry with them after the last page?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {LESSONS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setAnswer("lesson", l.value)}
              className={cardClass(lesson === l.value)}
            >
              <span className="text-2xl">{l.emoji}</span>
              <span
                className="block text-base font-semibold mt-1"
                style={{ color: "hsl(var(--wizard-primary))" }}
              >
                {l.label}
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {l.desc}
              </span>
            </button>
          ))}
        </div>

        {selectedLesson && (
          <p className="text-center text-muted-foreground text-sm animate-fade-in">
            {name}'s story will be about{" "}
            <span className="font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
              {selectedLesson.label.toLowerCase()}
            </span>
            .
          </p>
        )}
      </div>
    </WizardShell>
  );
}
