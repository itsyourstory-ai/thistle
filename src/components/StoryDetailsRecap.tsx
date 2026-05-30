// Recap card showing the user's selected story details.
// Extracted from Step10Preview so it can be shown on the summary/preview page.

const AGE_LABEL: Record<string, string> = {
  "0-2": "0–2",
  "3-5": "3–5",
  "6-8": "6–8",
  "9-12": "9–12",
};

const GENRE_LABEL: Record<string, string> = {
  adventure: "Adventure",
  fantasy: "Fantasy",
  "sci-fi": "Sci-Fi / Space",
  mystery: "Mystery",
  everyday: "Everyday Life",
  bedtime: "Bedtime",
  sports: "Sports",
  "fairy-tale": "Fairy Tale",
  animals: "Animals / Nature",
  superhero: "Superhero",
};

const MOOD_LABEL: Record<string, string> = {
  funny: "Funny",
  heartwarming: "Heartwarming",
  calm: "Calm",
  whimsical: "Whimsical",
  brave: "Brave",
  mysterious: "Mysterious",
};

const LESSON_LABEL: Record<string, string> = {
  courage: "Courage",
  kindness: "Kindness",
  resilience: "Resilience",
  friendship: "Friendship",
  curiosity: "Curiosity",
  "self-confidence": "Self-confidence",
  sharing: "Sharing & generosity",
  nature: "Caring for nature",
  empathy: "Empathy",
  "just-fun": "Just for fun",
};

const INTEREST_INFO: Record<string, { emoji: string; label: string }> = {
  dinosaurs: { emoji: "🦕", label: "Dinosaurs" },
  dogs: { emoji: "🐶", label: "Dogs" },
  cats: { emoji: "🐱", label: "Cats" },
  "farm-animals": { emoji: "🐄", label: "Farm Animals" },
  "bugs-butterflies": { emoji: "🦋", label: "Bugs & Butterflies" },
  pirates: { emoji: "🏴‍☠️", label: "Pirates" },
  superheroes: { emoji: "🦸", label: "Superheroes" },
  unicorns: { emoji: "🦄", label: "Unicorns" },
  dragons: { emoji: "🐉", label: "Dragons" },
  "mermaids-magic": { emoji: "🧜", label: "Mermaids & Magic" },
  trains: { emoji: "🚂", label: "Trains" },
  "cars-trucks": { emoji: "🚗", label: "Cars & Trucks" },
  "bikes-scooters": { emoji: "🛴", label: "Bikes & Scooters" },
  planes: { emoji: "✈️", label: "Planes" },
  "construction-trucks": { emoji: "🚜", label: "Construction Trucks" },
  soccer: { emoji: "⚽", label: "Soccer" },
  basketball: { emoji: "🏀", label: "Basketball" },
  swimming: { emoji: "🏊", label: "Swimming" },
  gymnastics: { emoji: "🤸", label: "Gymnastics" },
  "dancing-ballet": { emoji: "💃", label: "Dancing/Ballet" },
  "art-drawing": { emoji: "🎨", label: "Art & Drawing" },
  music: { emoji: "🎵", label: "Music" },
  "reading-books": { emoji: "📚", label: "Reading & Books" },
  "building-lego": { emoji: "🧱", label: "Building/LEGO" },
  "science-experiments": { emoji: "🔬", label: "Science & Experiments" },
  "camping-outdoors": { emoji: "🏕️", label: "Camping & Outdoors" },
  "snow-winter": { emoji: "❄️", label: "Snow & Winter" },
  "rainbows-colors": { emoji: "🌈", label: "Rainbows & Colors" },
  "space-stars": { emoji: "🌟", label: "Space & Stars" },
  "robots-machines": { emoji: "🤖", label: "Robots & Machines" },
};

const SPECIAL_THING_INFO: Record<string, { emoji: string; label: string }> = {
  "stuffed-animal": { emoji: "🧸", label: "Stuffed Animal" },
  pet: { emoji: "🐕", label: "Pet" },
  doll: { emoji: "🧍", label: "Doll or Action Figure" },
  "toy-vehicle": { emoji: "🚗", label: "Toy Vehicle" },
  blanket: { emoji: "🛏️", label: "Blanket or Comfort Item" },
  clothing: { emoji: "👑", label: "Clothing or Accessory" },
  sports: { emoji: "⚽", label: "Sports or Outdoor Gear" },
  instrument: { emoji: "🎸", label: "Musical Instrument" },
  food: { emoji: "🍕", label: "Food" },
};

function formatSpecialThing(st: any): string | null {
  if (!st || !st.category) return null;
  const info = SPECIAL_THING_INFO[st.category];
  if (!info) return null;
  const d = st.details || {};
  const detail =
    d.name || d.food || d.description || d.breed || d.color ||
    d.animalType || d.dollType || d.vehicleType || d.clothingType ||
    d.instrumentType || d.sport || d.pattern || "";
  return detail ? `${info.emoji} ${info.label} — ${detail}` : `${info.emoji} ${info.label}`;
}

function formatCharacters(answers: Record<string, any>): string | null {
  const parts: string[] = [];
  const proto = answers.protagonist;
  const protoName = (proto?.name || answers.childName || "").trim();
  if (protoName) parts.push(`${protoName} ★`);

  const supporting = (answers.supportingCharacters as any[]) || [];
  for (const c of supporting) {
    const rel =
      c.relationship === "Other"
        ? (c.relationshipOther || "Other").trim()
        : (c.relationship || "").trim();
    const nm = c.surpriseName ? "" : (c.name || "").trim();
    if (nm && rel) parts.push(`${rel} (${nm})`);
    else if (nm) parts.push(nm);
    else if (rel) parts.push(rel);
  }
  return parts.length ? parts.join(" · ") : null;
}

function SummaryRow({
  label,
  children,
  artHsl,
}: {
  label: string;
  children: React.ReactNode;
  artHsl: string;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 items-baseline py-1.5">
      <span
        className="text-[10px] uppercase tracking-widest font-semibold"
        style={{ color: `hsl(${artHsl} / 0.7)` }}
      >
        {label}
      </span>
      <div
        className="text-sm leading-snug"
        style={{ color: "hsl(var(--wizard-primary) / 0.9)" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function StoryDetailsRecap({
  answers,
  artHsl = "100 52% 20%",
}: {
  answers: Record<string, any>;
  artHsl?: string;
}) {
  const ageLabel = AGE_LABEL[answers.ageRange as string];
  const genreLabel = GENRE_LABEL[answers.genre as string];
  const moodLabel = MOOD_LABEL[answers.mood as string];
  const lessonLabel = LESSON_LABEL[answers.lesson as string];
  const interestsRaw =
    (answers.interestsList as Array<{ word?: string; emoji?: string }>) || [];
  const interests = interestsRaw
    .map((e) => ({ word: (e?.word || "").trim(), emoji: e?.emoji }))
    .filter((e) => e.word.length > 0);
  const customInterest = (answers.customInterest as string)?.trim();
  const charactersLine = formatCharacters(answers);

  const storyTypeBits = [genreLabel, moodLabel].filter(Boolean);
  const storyTypeLine = storyTypeBits.length ? storyTypeBits.join(" · ") : null;

  const placeholder = <span className="italic opacity-50">Not chosen</span>;

  return (
    <div
      className="w-full rounded-2xl p-5 border"
      style={{
        backgroundColor: `hsl(${artHsl} / 0.08)`,
        borderColor: `hsl(${artHsl} / 0.2)`,
      }}
    >
      <p
        className="text-[10px] uppercase tracking-widest mb-3 font-semibold"
        style={{ color: `hsl(${artHsl})` }}
      >
        Your story details
      </p>

      <div className="divide-y" style={{ borderColor: `hsl(${artHsl} / 0.15)` }}>
        <SummaryRow label="Age range" artHsl={artHsl}>
          {ageLabel || placeholder}
        </SummaryRow>

        <SummaryRow label="Story type" artHsl={artHsl}>
          {storyTypeLine || placeholder}
        </SummaryRow>

        <SummaryRow label="Life lesson" artHsl={artHsl}>
          {lessonLabel || placeholder}
        </SummaryRow>

        <SummaryRow label="Interests" artHsl={artHsl}>
          {interests.length > 0 || customInterest ? (
            <div className="flex flex-wrap gap-1.5">
              {interests.map((entry) => {
                const info = INTEREST_INFO[entry.word];
                const emoji = entry.emoji || info?.emoji || "✨";
                const label = info?.label || entry.word;
                return (
                  <span
                    key={entry.word}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `hsl(${artHsl} / 0.18)`,
                      color: "hsl(var(--wizard-primary))",
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </span>
                );
              })}
              {customInterest && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `hsl(${artHsl} / 0.18)`,
                    color: "hsl(var(--wizard-primary))",
                  }}
                >
                  <span>✍️</span>
                  <span>{customInterest}</span>
                </span>
              )}
            </div>
          ) : (
            placeholder
          )}
        </SummaryRow>

        <SummaryRow label="Characters" artHsl={artHsl}>
          {charactersLine || placeholder}
        </SummaryRow>
      </div>
    </div>
  );
}

export { formatSpecialThing, formatCharacters };
