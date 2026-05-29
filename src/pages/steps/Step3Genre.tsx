import { useEffect } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";

const GENRES = [
  { value: "adventure", emoji: "🗺️", label: "Adventure", desc: "Epic quests and daring journeys" },
  { value: "fantasy", emoji: "🐉", label: "Fantasy", desc: "Magic, dragons, enchanted worlds" },
  { value: "sci-fi", emoji: "🚀", label: "Sci-Fi / Space", desc: "Robots, planets, future tech" },
  { value: "mystery", emoji: "🔍", label: "Mystery", desc: "Solving puzzles and clues" },
  { value: "everyday", emoji: "🏡", label: "Everyday Life", desc: "Relatable slice-of-life moments" },
  { value: "bedtime", emoji: "🌙", label: "Bedtime", desc: "Gentle wind-down stories" },
  { value: "sports", emoji: "⚽", label: "Sports", desc: "Teamwork, goals, and glory" },
  { value: "fairy-tale", emoji: "👑", label: "Fairy Tale", desc: "Classic once-upon-a-time magic" },
  { value: "animals", emoji: "🐾", label: "Animals / Nature", desc: "Furry friends and wild adventures" },
  { value: "superhero", emoji: "🦸", label: "Superhero", desc: "Powers, capes, and saving the day" },
];

const MOODS = [
  { value: "funny", emoji: "😂", label: "Funny" },
  { value: "heartwarming", emoji: "❤️", label: "Heartwarming" },
  { value: "calm", emoji: "🧘", label: "Calm" },
  { value: "whimsical", emoji: "✨", label: "Whimsical" },
  { value: "brave", emoji: "🦁", label: "Brave" },
  { value: "mysterious", emoji: "🌑", label: "Mysterious" },
];

export default function Step2() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const name = (answers.childName as string) || "your little one";
  const genre = (answers.genre as string) || "";
  const mood = (answers.mood as string) || "";

  useEffect(() => {
    setCanContinue(genre !== "" && mood !== "");
  }, [genre, mood, setCanContinue]);

  const cardClass = (selected: boolean) =>
    `cursor-pointer rounded-2xl p-4 text-left transition-all border-2 shadow-sm ${
      selected
        ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)]"
        : "border-transparent bg-white hover:shadow-md"
    }`;


  return (
    <WizardShell>
      <div className="space-y-8">
        {/* Heading */}
        <div className="text-center space-y-2">
          <h1
            className="font-heading text-3xl sm:text-4xl font-semibold"
            style={{ color: "hsl(var(--wizard-primary))" }}
          >
            What kind of story should this be?
          </h1>
          <p className="text-muted-foreground text-lg">
            Pick the vibe — this shapes the whole adventure.
          </p>
        </div>

        {/* Genre grid */}
        <div className="space-y-3">
          <label className="block text-center text-2xl font-sans font-semibold text-[hsl(var(--wizard-primary))]">
            Genre
          </label>
          <div className="grid grid-cols-2 gap-3">
            {GENRES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setAnswer("genre", g.value)}
                className={cardClass(genre === g.value)}
              >
                <span className="text-2xl">{g.emoji}</span>
                <span
                  className="block text-base font-semibold mt-1"
                  style={{ color: "hsl(var(--wizard-primary))" }}
                >
                  {g.label}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {g.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Mood grid */}
        <div className="space-y-3">
          <label className="block text-center text-2xl font-sans font-semibold text-[hsl(var(--wizard-primary))]">
            Mood
          </label>
          <div className="grid grid-cols-3 gap-3">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setAnswer("mood", m.value)}
                className={cardClass(mood === m.value)}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span
                  className="block text-base font-semibold mt-1"
                  style={{ color: "hsl(var(--wizard-primary))" }}
                >
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
