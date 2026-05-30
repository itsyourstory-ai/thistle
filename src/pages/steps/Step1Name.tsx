import { useEffect, useState } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectableTile } from "@/components/SelectableTile";
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

  useEffect(() => {
    setAnswer("bookBelongsTo", true);
  }, []);

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


  return (
    <WizardShell>
      <div className="space-y-10">
        {/* Heading */}
        <div className="space-y-2">
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

        {/* Name + Gender side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
          {/* Name */}
          <div className="space-y-2">
            <h2 className="font-heading text-xl sm:text-2xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
              Name
            </h2>
            <Input
              value={name}
              onChange={(e) => setAnswer("childName", e.target.value)}
              placeholder="e.g. Emma, John, etc."
              className="text-base font-medium h-10 w-full rounded-xl border-input bg-white shadow-sm focus-visible:ring-[hsl(var(--wizard-primary))]"
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <h2 className="font-heading text-xl sm:text-2xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
              Gender
            </h2>
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
        <div className="space-y-2 w-full pt-4">
          <h2 className="font-heading text-xl sm:text-2xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
            What language do they speak?
          </h2>
          <div className="flex flex-wrap gap-3">
            {LANGUAGES.map((l) => (
              <SelectableTile
                key={l.value}
                selected={language === l.value}
                onClick={() => setAnswer("language", l.value)}
                className="px-5 py-3 text-center"
              >
                <span className="block text-sm font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
                  {l.label}
                </span>
              </SelectableTile>
            ))}
            <div className="rounded-2xl px-5 py-3 text-center border-2 border-transparent bg-muted opacity-50 shadow-sm">
              <span className="block text-sm font-semibold text-muted-foreground">More coming soon</span>
            </div>
          </div>
        </div>

        {/* Book type tiles (drives age range) */}
        <div className="space-y-4 pt-4">
          <h2 className="font-heading text-xl sm:text-2xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
            How old are they?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5 w-full">
            {AGE_RANGES.map((a) => (
              <SelectableTile
                key={a.value}
                selected={age === a.value}
                onClick={() => setAnswer("ageRange", a.value)}
                className="group flex flex-col items-center gap-3 p-4 sm:p-5"
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
                <span className="block text-base sm:text-lg font-semibold leading-tight text-center" style={{ color: "hsl(var(--wizard-primary))" }}>
                  {a.label}
                </span>
                <span className="block text-sm text-muted-foreground -mt-2 text-center">
                  {a.sub}
                </span>
              </SelectableTile>
            ))}
          </div>
        </div>

      </div>
    </WizardShell>
  );
}
