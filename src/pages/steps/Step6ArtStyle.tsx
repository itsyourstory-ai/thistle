import { useEffect } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { ART_STYLES } from "@/lib/artStyles";

function getDefaultArtStyle(genre: string): string {
  if (["adventure", "superhero", "sports"].includes(genre)) return "bold-bright";
  if (["bedtime", "everyday"].includes(genre)) return "dreamy-pastel";
  if (["fantasy", "fairy-tale"].includes(genre)) return "watercolor";
  return "cozy-sketch";
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

  const cardClass = (selected: boolean) =>
    `cursor-pointer rounded-2xl p-3 text-left transition-all border-2 shadow-sm ${
      selected
        ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)]"
        : "border-transparent bg-white hover:shadow-md"
    }`;

  return (
    <WizardShell>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
            Pick an illustration style.
          </h1>
          <p className="text-muted-foreground text-lg">
            How should {name}'s story look?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ART_STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setAnswer("artStyle", s.value)}
              className={cardClass(artStyle === s.value)}
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
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center italic">
          We pre-selected the best style for your story — feel free to change it.
        </p>
      </div>
    </WizardShell>
  );
}
