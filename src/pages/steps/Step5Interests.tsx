import { useEffect, useMemo, useRef } from "react";
import { Plus, X } from "lucide-react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";

type AgeRange = "0-2" | "3-5" | "6-8" | "9-12";
type Gender = "girl" | "boy" | "non-binary" | "surprise";
type Suggestion = { emoji: string; word: string };
type Entry = { word: string; emoji?: string };

const MAX_INTERESTS = 3;

const s = (emoji: string, word: string): Suggestion => ({ emoji, word });

const BASE_BY_AGE: Record<AgeRange, Suggestion[]> = {
  "0-2": [
    s("🐾", "animals"), s("🫧", "bubbles"), s("🎵", "music"), s("🦆", "ducks"),
    s("🙈", "peekaboo"), s("📚", "books"), s("🌈", "colors"), s("💃", "dancing"),
    s("💦", "splashing"), s("🧸", "soft toys"), s("🚚", "trucks"), s("🤗", "hugs"),
    s("🐶", "puppies"), s("🛁", "bath time"),
  ],
  "3-5": [
    s("🦕", "dinosaurs"), s("🐾", "animals"), s("🚚", "trucks"), s("🎨", "drawing"),
    s("🐛", "bugs"), s("🌊", "the ocean"), s("🚀", "space"), s("🧱", "building"),
    s("🫧", "bubbles"), s("🎵", "music"), s("🐶", "puppies"), s("🛝", "playgrounds"),
    s("🌈", "rainbows"), s("📖", "bedtime stories"),
  ],
  "6-8": [
    s("🎨", "drawing"), s("⚽", "soccer"), s("🏊", "swimming"), s("🧁", "baking"),
    s("🐾", "animals"), s("🚀", "space"), s("🔬", "science"), s("✨", "magic"),
    s("📚", "reading"), s("🧱", "lego"), s("🚲", "biking"), s("🏕️", "camping"),
    s("🧩", "puzzles"), s("🎵", "music"),
  ],
  "9-12": [
    s("🛹", "skateboarding"), s("🎮", "gaming"), s("🏀", "basketball"), s("⚽", "soccer"),
    s("🎨", "drawing"), s("📚", "reading"), s("🔬", "science"), s("🤖", "robots"),
    s("🔍", "mysteries"), s("🎵", "music"), s("💻", "coding"), s("🧁", "baking"),
    s("🚲", "biking"), s("📷", "photography"),
  ],
};

const BOOST_BY_GENDER: Partial<Record<Gender, Partial<Record<AgeRange, Suggestion[]>>>> = {
  girl: {
    "0-2": [s("👑","princesses"), s("🪆","dolls"), s("🌸","flowers"), s("🐱","kittens"), s("🩰","ballet"), s("🍵","tea parties"), s("🦋","butterflies"), s("🧚","fairies")],
    "3-5": [s("👑","princesses"), s("🦄","unicorns"), s("🧜","mermaids"), s("🩰","ballet"), s("🧚","fairies"), s("🐴","horses"), s("🧁","baking"), s("🐱","kittens")],
    "6-8": [s("🐴","horses"), s("💃","dancing"), s("🤸","gymnastics"), s("👗","fashion"), s("💖","friendship"), s("✂️","crafts"), s("🧜","mermaids"), s("🎤","singing")],
    "9-12": [s("🏐","volleyball"), s("👗","fashion"), s("🐴","horses"), s("💖","friendship"), s("✍️","writing stories"), s("💃","dance"), s("🤸","gymnastics"), s("✂️","crafts")],
  },
  boy: {
    "0-2": [s("🚚","trucks"), s("🚂","trains"), s("⚾","balls"), s("🚗","cars"), s("🐶","puppies"), s("🦕","dinosaurs"), s("🔧","tools"), s("🧱","blocks")],
    "3-5": [s("🦸","superheroes"), s("🏴‍☠️","pirates"), s("🚒","fire trucks"), s("🛡️","knights"), s("👹","monsters"), s("🥷","ninjas"), s("🏎️","race cars"), s("🔧","tools")],
    "6-8": [s("🦸","superheroes"), s("🥷","ninjas"), s("🏴‍☠️","pirates"), s("🛹","skateboards"), s("⛏️","minecraft-style worlds"), s("⚽","soccer"), s("🛡️","knights"), s("🐉","dragons")],
    "9-12": [s("🛹","skateboarding"), s("🎮","video games"), s("🏀","basketball"), s("🏃","parkour"), s("🚗","cars"), s("🤖","robots"), s("🎸","guitar"), s("🎣","fishing")],
  },
};

function buildPool(age: AgeRange, gender: string): Suggestion[] {
  const base = BASE_BY_AGE[age] ?? BASE_BY_AGE["3-5"];
  const boost =
    gender && (gender === "girl" || gender === "boy")
      ? BOOST_BY_GENDER[gender as Gender]?.[age] ?? []
      : [];
  const seen = new Set<string>();
  return [...boost, ...base].filter((it) => {
    const k = it.word.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const PLACEHOLDER = "type here";

export default function Step4b() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const name = ((answers.childName as string) || "").trim() || "your little one";
  const age = (answers.ageRange as AgeRange) || "3-5";
  const gender = (answers.gender as string) || "";
  const list: Entry[] = (answers.interestsList as Entry[]) || [];
  const focusIdxRef = useRef<number | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setCanContinue(true);
  }, [setCanContinue]);

  // Focus newly-added inputs
  useEffect(() => {
    if (focusIdxRef.current !== null) {
      const el = inputRefs.current[focusIdxRef.current];
      el?.focus();
      focusIdxRef.current = null;
    }
  });

  const pool = useMemo(() => buildPool(age, gender), [age, gender]);

  const enteredSet = useMemo(
    () => new Set(list.map((e) => e.word.trim().toLowerCase()).filter(Boolean)),
    [list],
  );

  const visibleChips = useMemo(
    () => pool.filter((it) => !enteredSet.has(it.word.toLowerCase())).slice(0, 10),
    [pool, enteredSet],
  );

  const setList = (next: Entry[]) => setAnswer("interestsList", next);

  const addEntry = (word: string, emoji?: string) => {
    if (list.length >= MAX_INTERESTS) return;
    if (word && enteredSet.has(word.toLowerCase())) return;
    // Fill first empty slot if one exists
    const emptyIdx = list.findIndex((e) => !e.word.trim());
    if (emptyIdx >= 0 && word) {
      const next = list.slice();
      next[emptyIdx] = { word, emoji };
      setList(next);
      return;
    }
    const next = [...list, { word, emoji }];
    setList(next);
    if (!word) focusIdxRef.current = next.length - 1;
  };

  const updateEntry = (idx: number, word: string) => {
    const next = list.slice();
    const prev = next[idx];
    // Drop emoji if user edits the suggestion text
    const emoji = prev?.emoji && prev.word === word ? prev.emoji : undefined;
    next[idx] = { word, emoji };
    setList(next);
  };

  const removeEntry = (idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const atCap = list.length >= MAX_INTERESTS;

  const pillBase =
    "inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-base font-medium transition-all";
  const pillFilledStyle = {
    backgroundColor: "hsl(var(--wizard-primary) / 0.10)",
    color: "hsl(var(--wizard-primary))",
  } as const;

  return (
    <WizardShell showSkip>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1
            className="font-heading text-3xl sm:text-4xl font-semibold"
            style={{ color: "hsl(var(--wizard-primary))" }}
          >
            What does {name} love?
          </h1>
          <p className="text-muted-foreground text-lg">
            Add up to 3 things they're into.
          </p>
        </div>

        {/* Filled pills + add button */}
        <div className="flex flex-wrap gap-2 min-h-[44px]">
          {list.map((entry, idx) => {
            const size = entry.word ? Math.max(entry.word.length, 1) : PLACEHOLDER.length;
            return (
              <div key={idx} className={pillBase} style={pillFilledStyle}>
                {entry.emoji && <span aria-hidden>{entry.emoji}</span>}
                <input
                  ref={(el) => (inputRefs.current[idx] = el)}
                  value={entry.word}
                  onChange={(e) => updateEntry(idx, e.target.value)}
                  placeholder={PLACEHOLDER}
                  size={size}
                  className="bg-transparent border-0 outline-none p-0 text-base font-medium placeholder:text-[hsl(var(--wizard-primary)/0.5)]"
                  style={{ color: "hsl(var(--wizard-primary))" }}
                />
                <button
                  type="button"
                  onClick={() => removeEntry(idx)}
                  aria-label="Remove interest"
                  className="-ml-1 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {!atCap && (
            <button
              type="button"
              onClick={() => addEntry("")}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-base font-medium border-2 border-dashed transition-all hover:bg-[hsl(var(--wizard-primary)/0.05)]"
              style={{
                borderColor: "hsl(var(--wizard-primary) / 0.4)",
                color: "hsl(var(--wizard-primary))",
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Add interest</span>
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          ⚠️ Please don't reference copyrighted material (movies, TV shows, singers, brands, etc.) — we can't include them in your book.
        </p>

        {!atCap && visibleChips.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-medium text-muted-foreground text-base">Click to add:</h2>
            <div className="flex flex-wrap gap-2">
              {visibleChips.map((it) => (
                <button
                  key={it.word}
                  type="button"
                  onClick={() => addEntry(it.word, it.emoji)}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-base font-medium border-2 border-dashed transition-all hover:bg-[hsl(var(--wizard-primary)/0.05)] hover:-translate-y-0.5"
                  style={{
                    borderColor: "hsl(var(--wizard-primary) / 0.4)",
                    color: "hsl(var(--wizard-primary))",
                  }}
                >
                  <span aria-hidden>{it.emoji}</span>
                  <span>{it.word}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {atCap && (
          <p className="text-sm text-muted-foreground">
            That's plenty — 3 is the sweet spot ✨
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold">Why we ask:</span> {name}'s interests become woven into the story — making it uniquely theirs.
        </p>
      </div>
    </WizardShell>
  );
}
