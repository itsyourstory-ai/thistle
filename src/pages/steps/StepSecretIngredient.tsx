import { useEffect, useRef } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "dropdown" | "photo";
  options?: string[];
  placeholder?: string;
  maxLength?: number;
}

interface CategoryDef {
  value: string;
  emoji: string;
  label: string;
  fields: FieldDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    value: "stuffed-animal", emoji: "🧸", label: "Stuffed Animal",
    fields: [
      { key: "animalType", label: "Animal type", type: "dropdown", options: ["Bear", "Bunny", "Dog", "Cat", "Elephant", "Monkey", "Dinosaur", "Unicorn", "Other"] },
      { key: "color", label: "Color(s)", type: "text", placeholder: "e.g. Purple with a pink belly" },
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Flopsy" },
      { key: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    value: "pet", emoji: "🐕", label: "Pet",
    fields: [
      { key: "animalType", label: "Animal type", type: "dropdown", options: ["Dog", "Cat", "Fish", "Bird", "Hamster", "Rabbit", "Turtle", "Horse", "Other"] },
      { key: "breed", label: "Breed / description", type: "text", placeholder: "e.g. Golden Retriever" },
      { key: "color", label: "Color", type: "text", placeholder: "e.g. Golden with white paws" },
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Max" },
      { key: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    value: "doll", emoji: "🧍", label: "Doll or Action Figure",
    fields: [
      { key: "dollType", label: "Type", type: "dropdown", options: ["Baby doll", "Fashion doll", "Action figure", "Figurine", "Toy animal", "Other"] },
      { key: "description", label: "Hair / outfit description", type: "text", placeholder: "e.g. Blonde hair with a sparkly dress" },
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Captain Zoom" },
      { key: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    value: "toy-vehicle", emoji: "🚗", label: "Toy Vehicle",
    fields: [
      { key: "vehicleType", label: "Type", type: "dropdown", options: ["Car", "Truck", "Train", "Plane", "Rocket", "Boat", "Bike", "Scooter", "Skateboard", "Other"] },
      { key: "color", label: "Color", type: "text", placeholder: "e.g. Red" },
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Lightning" },
      { key: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    value: "blanket", emoji: "🛏️", label: "Blanket or Comfort Item",
    fields: [
      { key: "color", label: "Color(s)", type: "text", placeholder: "e.g. Blue with white trim" },
      { key: "pattern", label: "Pattern", type: "dropdown", options: ["Solid", "Striped", "Polka dot", "Patchwork", "Stars"] },
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Blankie" },
      { key: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    value: "clothing", emoji: "👑", label: "Clothing or Accessory",
    fields: [
      { key: "clothingType", label: "Type", type: "dropdown", options: ["Cape", "Costume", "Hat", "Boots", "Jewelry", "Backpack", "Tutu", "Crown", "Other"] },
      { key: "color", label: "Color", type: "text", placeholder: "e.g. Red and gold" },
      { key: "description", label: "Description", type: "text", placeholder: "e.g. A sparkly superhero cape" },
      { key: "photo", label: "Photo", type: "photo" },
    ],
  },
  {
    value: "sports", emoji: "⚽", label: "Sports or Outdoor Gear",
    fields: [
      { key: "sport", label: "Sport / activity", type: "dropdown", options: ["Soccer", "Basketball", "Baseball", "Football", "Tennis", "Swimming", "Gymnastics", "Camping", "Other"] },
      { key: "color", label: "Color (if non-standard)", type: "text", placeholder: "e.g. Neon green" },
    ],
  },
  {
    value: "instrument", emoji: "🎸", label: "Musical Instrument",
    fields: [
      { key: "instrumentType", label: "Type", type: "dropdown", options: ["Guitar", "Piano", "Drums", "Ukulele", "Violin", "Trumpet", "Flute", "Other"] },
      { key: "color", label: "Color (if non-standard)", type: "text", placeholder: "e.g. Blue sparkle" },
    ],
  },
  {
    value: "food", emoji: "🍕", label: "Food",
    fields: [
      { key: "food", label: "What food?", type: "text", placeholder: "e.g. Pizza" },
    ],
  },
];

export default function Step5() {
  const { answers, setAnswer, setCanContinue } = useWizard();
  const name = (answers.childName as string) || "your little one";
  const specialThing = (answers.specialThing as { category: string; details: Record<string, string> } | null) ?? null;
  const followUpRef = useRef<HTMLDivElement>(null);

  const selectedCategory = specialThing?.category ?? null;
  const details = specialThing?.details ?? {};

  useEffect(() => {
    setCanContinue(true);
  }, [setCanContinue]);

  const selectCategory = (value: string) => {
    if (selectedCategory === value) {
      setAnswer("specialThing", null);
    } else {
      setAnswer("specialThing", { category: value, details: {} });
      setTimeout(() => followUpRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  };

  const setDetail = (key: string, value: string) => {
    setAnswer("specialThing", {
      category: selectedCategory!,
      details: { ...details, [key]: value },
    });
  };

  const handlePhoto = (key: string, file: File | null) => {
    if (!file) {
      setDetail(key, "");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDetail(key, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const activeCategoryDef = CATEGORIES.find((c) => c.value === selectedCategory);

  const cardClass = (selected: boolean) =>
    `cursor-pointer rounded-2xl p-4 text-left transition-all border-2 shadow-sm ${
      selected
        ? "border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)]"
        : "border-transparent bg-white hover:shadow-md"
    }`;

  return (
    <WizardShell showSkip>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1
            className="font-heading text-3xl sm:text-4xl font-semibold"
            style={{ color: "hsl(var(--wizard-primary))" }}
          >
            Sneak in a surprise
          </h1>
          <p className="text-muted-foreground text-lg">
            Add a favorite thing from {name}'s life — we'll give it a cameo in the story! Optional, but guaranteed to get a reaction.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => selectCategory(cat.value)}
              className={cardClass(selectedCategory === cat.value)}
            >
              <span className="text-2xl">{cat.emoji}</span>
              <span
                className="block text-base font-semibold mt-1"
                style={{ color: "hsl(var(--wizard-primary))" }}
              >
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        {activeCategoryDef && (
          <div ref={followUpRef} className="space-y-4 animate-fade-in">
            <h2
              className="text-lg font-semibold text-center"
              style={{ color: "hsl(var(--wizard-primary))" }}
            >
              Tell us about the {activeCategoryDef.label.toLowerCase()}
            </h2>
            {activeCategoryDef.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-center text-2xl font-sans font-semibold text-[hsl(var(--wizard-primary))]">
                  {field.label}
                </label>
                {field.type === "dropdown" ? (
                  <Select
                    value={details[field.key] || ""}
                    onValueChange={(v) => setDetail(field.key, v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Choose one…" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options!.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "photo" ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhoto(field.key, e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-[hsl(var(--wizard-primary)/0.1)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[hsl(var(--wizard-primary))] hover:file:bg-[hsl(var(--wizard-primary)/0.15)] cursor-pointer"
                    />
                    {details[field.key] && (
                      <img
                        src={details[field.key]}
                        alt="Preview"
                        className="h-20 w-20 rounded-xl object-cover border-2 border-[hsl(var(--wizard-primary)/0.2)]"
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    className="rounded-xl"
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    value={details[field.key] || ""}
                    onChange={(e) => setDetail(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </WizardShell>
  );
}
