import { useEffect } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { SelectableTile } from "@/components/SelectableTile";

// Buyer relationships — matches engine's BookEngineInput["buyer_relationship"].
const RELATIONSHIPS = [
  { value: "parent", label: "Parent", emoji: "👨‍👩‍👧" },
  { value: "grandparent", label: "Grandparent", emoji: "🧓" },
  { value: "teacher", label: "Teacher", emoji: "📚" },
  { value: "friend", label: "Friend", emoji: "💛" },
  { value: "other", label: "Someone else", emoji: "✨" },
] as const;

// Occasions — matches engine's BookEngineInput["occasion"].
const OCCASIONS = [
  { value: "birthday", label: "Birthday", emoji: "🎂" },
  { value: "christmas", label: "Christmas", emoji: "🎄" },
  { value: "easter", label: "Easter", emoji: "🐰" },
  { value: "new_sibling", label: "New sibling", emoji: "👶" },
  { value: "first_day", label: "First day", emoji: "🎒" },
  { value: "graduation", label: "Graduation", emoji: "🎓" },
  { value: "baptism", label: "Baptism", emoji: "🕊️" },
  { value: "just_because", label: "Just because", emoji: "💝" },
  { value: "other", label: "Other", emoji: "✨" },
] as const;

export default function StepWhoIsItFor() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const childName = (answers.childName as string)?.trim() || "them";
  const buyerRelationship = (answers.buyer_relationship as string) || "";
  const occasion = (answers.occasion as string) || "";

  // Both required to continue.
  useEffect(() => {
    setCanContinue(buyerRelationship !== "" && occasion !== "");
  }, [buyerRelationship, occasion, setCanContinue]);

  const tileExtras = "px-4 py-4 text-center";


  return (
    <WizardShell>
      <div className="space-y-10">
        {/* Heading — warm, encouraging */}
        <div className="space-y-2">
          <h1
            className="font-heading text-3xl sm:text-4xl font-semibold"
            style={{ color: "hsl(var(--wizard-primary))" }}
          >
            What a thoughtful gift 💛
          </h1>
          <p className="text-muted-foreground text-lg">
            Tell us a little about who's giving this book to {childName} — we'll
            use it to write the perfect dedication.
          </p>
        </div>

        {/* Buyer relationship */}
        <section className="space-y-3">
          <div className="space-y-1">
            <h2
              className="font-heading text-xl sm:text-2xl font-semibold text-left"
              style={{ color: "hsl(var(--wizard-primary))" }}
            >
              What is your relationship to {childName}?
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
            {RELATIONSHIPS.map((r) => (
              <SelectableTile
                key={r.value}
                selected={buyerRelationship === r.value}
                onClick={() => setAnswer("buyer_relationship", r.value)}
                className={tileExtras}
              >
                <div className="text-2xl mb-1">{r.emoji}</div>
                <div
                  className="text-sm font-semibold leading-tight"
                  style={{ color: "hsl(var(--wizard-primary))" }}
                >
                  {r.label}
                </div>
              </SelectableTile>
            ))}
          </div>
        </section>

        {/* Occasion */}
        <section className="space-y-3">
          <div className="space-y-1">
            <h2
              className="font-heading text-xl sm:text-2xl font-semibold text-left"
              style={{ color: "hsl(var(--wizard-primary))" }}
            >
              What's the occasion?
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
            {OCCASIONS.map((o) => (
              <SelectableTile
                key={o.value}
                selected={occasion === o.value}
                onClick={() => setAnswer("occasion", o.value)}
                className={tileExtras}
              >
                <div className="text-2xl mb-1">{o.emoji}</div>
                <div
                  className="text-sm font-semibold leading-tight"
                  style={{ color: "hsl(var(--wizard-primary))" }}
                >
                  {o.label}
                </div>
              </SelectableTile>
            ))}
          </div>
        </section>

      </div>
    </WizardShell>
  );
}
