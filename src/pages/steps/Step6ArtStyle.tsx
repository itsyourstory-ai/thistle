import { useEffect } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { ART_STYLES } from "@/lib/artStyles";
import { SelectableTile } from "@/components/SelectableTile";

function getDefaultArtStyle(genre: string): string {
  if (["adventure", "superhero", "sports"].includes(genre)) return "geometric-pop";
  if (["bedtime", "everyday"].includes(genre)) return "hand-drawn-charm";
  if (["fantasy", "fairy-tale"].includes(genre)) return "cozy-gouache";
  return "papercraft-collage";
}


export default function Step7() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const name = (answers.childName as string) || "your little one";
  const artStyle = (answers.artStyle as string) || "";

  useEffect(() => {
    setCanContinue(true);
    if (!answers.artStyle) setAnswer("artStyle", getDefaultArtStyle(answers.genre || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WizardShell>
      <div className="space-y-10">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
            Pick an illustration style.
          </h1>
          <p className="text-muted-foreground text-lg">
            How should {name}'s story look?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ART_STYLES.map((s) => (
            <SelectableTile
              key={s.value}
              selected={artStyle === s.value}
              onClick={() => setAnswer("artStyle", s.value)}
              className="p-3 text-left"
            >
              <div
                className="w-full overflow-hidden rounded-xl mb-2 bg-muted"
                style={{ aspectRatio: "2 / 3" }}
              >
                <img
                  src={s.preview}
                  alt={`Example: ${s.label}`}
                  width={512}
                  height={768}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="block text-base font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
                <span aria-hidden className="mr-1">{s.emoji}</span>{s.label}
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">{s.desc}</span>
            </SelectableTile>
          ))}
        </div>
      </div>
    </WizardShell>
  );
}
