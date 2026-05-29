import { useEffect, useState } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import bookBoard from "@/assets/book-board.jpg";
import bookPicture from "@/assets/book-picture.jpg";
import bookEarly from "@/assets/book-early.jpg";
import bookChapter from "@/assets/book-chapter.jpg";

const AGE_RANGES = [
  { value: "0-2", label: "Board Book", sub: "Ages 0–2", image: bookBoard },
  { value: "3-5", label: "Picture Book", sub: "Ages 3–5", image: bookPicture },
  { value: "6-8", label: "Early Reader", sub: "Ages 6–8", image: bookEarly },
  { value: "9-12", label: "Chapter Book", sub: "Ages 9–12", image: bookChapter },
];

const GENDERS = [
  { value: "girl", label: "Girl" },
  { value: "boy", label: "Boy" },
  { value: "non-binary", label: "Gender neutral" },
];

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "español", label: "Español" },
];

export default function Step1() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const name = (answers.childName as string) || "";
  const age = (answers.ageRange as string) || "";
  const gender = (answers.gender as string) || "";
  const language = (answers.language as string) || "english";
  const bookBelongsTo = answers.bookBelongsTo !== false;

  const [headingVisible, setHeadingVisible] = useState(true);
  const [headingText, setHeadingText] = useState("Who is this book for?");

  // Update heading when name changes
  useEffect(() => {
    const target = name.trim()
      ? `Let's make a book for ${name.trim()}.`
      : "Who is this book for?";

    if (target !== headingText) {
      setHeadingVisible(false);
      const t = setTimeout(() => {
        setHeadingText(target);
        setHeadingVisible(true);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [name]);

  useEffect(() => {
    setCanContinue(name.trim().length > 0 && age !== "" && gender !== "");
  }, [name, age, gender, setCanContinue]);

  const pillClass = (selected: boolean) =>
    `cursor-pointer rounded-2xl px-5 py-3 text-center transition-all border-2 shadow-sm ${
      selected
        ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)]"
        : "border-transparent bg-white hover:shadow-md"
    }`;

  const chipClass = (selected: boolean) =>
    `cursor-pointer rounded-2xl px-4 py-3 text-center transition-all border-2 shadow-sm ${
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
            className="font-heading text-3xl sm:text-4xl font-semibold transition-opacity duration-300"
            style={{
              color: "hsl(var(--wizard-primary))",
              opacity: headingVisible ? 1 : 0,
            }}
          >
            {headingText}
          </h1>
          <p className="text-muted-foreground text-lg">
            Give us a few details so we can tailor the book to them.
          </p>
        </div>

        {/* Name input */}
        {/* Name + Gender side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
          {/* Name */}
          <div className="space-y-2">
            <label className="block text-center text-2xl font-sans font-semibold text-[hsl(var(--wizard-primary))]">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setAnswer("childName", e.target.value)}
              placeholder="e.g. Emma, John, etc."
              className="text-center text-base font-medium h-10 w-full rounded-xl border-input bg-white shadow-sm focus-visible:ring-[hsl(var(--wizard-primary))]"
            />
            <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={bookBelongsTo}
                onCheckedChange={(checked) => setAnswer("bookBelongsTo", !!checked)}
                className="border-[hsl(var(--wizard-primary))] data-[state=checked]:bg-[hsl(var(--wizard-primary))]"
              />
              <span className="text-sm text-muted-foreground">Add "This book belongs to" page</span>
            </label>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label className="block text-center text-2xl font-sans font-semibold text-[hsl(var(--wizard-primary))]">
              Gender
            </label>
            <Select value={gender} onValueChange={(v) => setAnswer("gender", v)}>
              <SelectTrigger className="rounded-xl bg-white">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Book language — own row */}
        <div className="space-y-2 w-full">
          <label className="block text-center text-2xl font-sans font-semibold text-[hsl(var(--wizard-primary))]">
            What language do they speak?
          </label>
          <div className="flex flex-wrap justify-center gap-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setAnswer("language", l.value)}
                className={pillClass(language === l.value)}
              >
                <span className="block text-sm font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
                  {l.label}
                </span>
              </button>
            ))}
            <div className="rounded-2xl px-5 py-3 text-center border-2 border-transparent bg-muted opacity-50 shadow-sm">
              <span className="block text-sm font-semibold text-muted-foreground">More coming soon</span>
            </div>
          </div>
        </div>

        {/* Book type tiles (drives age range) */}
        <div className="space-y-4 pt-4">
          <div className="text-center space-y-1">
            <h2
              className="font-heading text-2xl sm:text-3xl font-semibold"
              style={{ color: "hsl(var(--wizard-primary))" }}
            >
              Pick a book type
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Choose the format that fits them best.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 w-full">
            {AGE_RANGES.map((a) => {
              const selected = age === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAnswer("ageRange", a.value)}
                  className={`group flex flex-col items-center gap-3 rounded-2xl p-4 sm:p-5 transition-all border-2 ${
                    selected
                      ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)] shadow-lg scale-[1.02]"
                      : "border-transparent bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  }`}
                >
                  <div className="w-full overflow-hidden rounded-xl bg-muted" style={{ aspectRatio: "1/1" }}>
                    <img
                      src={a.image}
                      alt={`${a.label} example`}
                      width={512}
                      height={512}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <span className="block text-base sm:text-lg font-semibold leading-tight" style={{ color: "hsl(var(--wizard-primary))" }}>
                    {a.label}
                  </span>
                  <span className="block text-sm text-muted-foreground -mt-2">
                    {a.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </WizardShell>
  );
}
