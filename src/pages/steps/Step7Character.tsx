import { useEffect, useState, useCallback, useRef } from "react";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Star, Plus, X, Camera, Sparkles, User, Upload, ChevronDown, ChevronUp,
} from "lucide-react";
import { useCharacterPortrait } from "@/hooks/useCharacterPortrait";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";


/* ── constants ───────────────────────────────────────────── */

const RELATIONSHIPS = [
  "Mom", "Dad", "Sister", "Brother", "Grandma", "Grandpa",
  "Friend", "Aunt", "Uncle", "Cousin", "Teacher", "Other",
] as const;

const GENDERS_PROTO = ["Boy", "Girl", "Gender neutral"] as const;
const GENDERS_SUPPORT = ["Boy/Man", "Girl/Woman", "Gender neutral", "Any"] as const;

const AGE_RANGES = ["Child", "Teen", "Adult", "Elderly"] as const;
const RELATIONSHIP_AGE: Record<string, string> = {
  Mom: "Adult", Dad: "Adult", Grandma: "Elderly", Grandpa: "Elderly",
  Sister: "Child", Brother: "Child", Friend: "Child", Aunt: "Adult",
  Uncle: "Adult", Cousin: "Child", Teacher: "Adult",
};

const HAIR_COLORS = ["Blonde", "Brown", "Black", "Red", "Gray", "White", "Other"] as const;
const HAIR_STYLES = ["Short", "Long", "Curly", "Straight", "Braids", "Bald"] as const;

const SKIN_TONES = [
  "#FDEBD0", "#F5CBA7", "#E0B88A", "#C68E5B", "#A0724A",
  "#7D5A3C", "#5C3D2E", "#3E2723",
];


/* ── interfaces ──────────────────────────────────────────── */

interface Appearance {
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  glasses: boolean;
  features: string;
}

function emptyAppearance(): Appearance {
  return { hairColor: "", hairStyle: "", skinTone: "", glasses: false, features: "" };
}

interface Protagonist {
  photos: string[];
  name: string;
  age: string;
  gender: string;
  special: string;
  appearance: Appearance;
  traits: Array<{ word: string; emoji?: string }>;
}

interface SupportingCharacter {
  id: string;
  mode: "" | "ai" | "real";
  name: string;
  surpriseName: boolean;
  relationship: string;
  relationshipOther: string;
  gender: string;
  ageRange: string;
  photos: string[];
  appearance: Appearance;
  traits: Array<{ word: string; emoji?: string }>;
}

type ActiveTab = { kind: "protagonist" } | { kind: "supporting"; id: string };

function makeId() { return Math.random().toString(36).slice(2, 9); }

/* ── small reusable bits ─────────────────────────────────── */

function PillSelector({ options, value, onChange }: {
  options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
            value === opt
              ? "border-transparent shadow-sm text-white"
              : "border-border bg-background text-muted-foreground hover:border-primary/40"
          }`}
          style={value === opt ? { backgroundColor: "hsl(var(--wizard-primary))" } : undefined}
        >{opt}</button>
      ))}
    </div>
  );
}

function SkinTonePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {SKIN_TONES.map((tone) => (
        <button key={tone} type="button" onClick={() => onChange(value === tone ? "" : tone)}
          className={`w-8 h-8 rounded-full border-2 transition-all ${
            value === tone ? "scale-110 shadow-md" : "border-transparent hover:scale-105"
          }`}
          style={{
            backgroundColor: tone,
            borderColor: value === tone ? "hsl(var(--wizard-primary))" : undefined,
          }}
          aria-label={`Skin tone ${tone}`}
        />
      ))}
    </div>
  );
}

function CharCounter({ current, max }: { current: number; max: number }) {
  return <p className="text-xs text-muted-foreground text-right">{current}/{max}</p>;
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-muted-foreground text-xl font-bold">
      {children}{optional && <span className="ml-1 text-xs opacity-60">(optional)</span>}
    </label>
  );
}

/* ── photo upload ────────────────────────────────────────── */

function PhotoUploadZone({ photos, onChange, heroName, max = 3 }: {
  photos: string[]; onChange: (p: string[]) => void; heroName?: string; max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = max - photos.length;
    if (remaining <= 0) { toast.error(`Maximum ${max} photos`); return; }
    const toProcess = Array.from(files).slice(0, remaining);
    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        onChange([...photos, reader.result as string].slice(0, max));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (i: number) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {/* thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {photos.map((src, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* upload zone */}
      {photos.length < max && (
        <button type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          className="w-full py-8 rounded-2xl border-2 border-dashed border-border flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 transition-colors"
        >
          <Upload className="w-8 h-8" />
          <span className="text-sm font-medium">Tap or drag to upload photos</span>
          <span className="text-xs opacity-70">
            Upload 2–{max} photos{heroName ? ` of ${heroName}` : ""} from different angles for best results
          </span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

/* ── appearance accordion ────────────────────────────────── */

function AppearanceAccordion({ appearance, onChange, name, defaultExpanded, featuresSlot }: {
  appearance: Appearance; onChange: (a: Appearance) => void; name: string; defaultExpanded: boolean;
  featuresSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const upd = (p: Partial<Appearance>) => onChange({ ...appearance, ...p });

  return (
    <div className="rounded-2xl border overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
        <span>Manually adjust appearance</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          <p className="text-xs text-muted-foreground">
            These details help the AI illustrate {name} — especially useful if you didn't upload a photo.
          </p>
          <div className="space-y-1.5">
            <FieldLabel>Hair color</FieldLabel>
            <PillSelector options={HAIR_COLORS} value={appearance.hairColor} onChange={(v) => upd({ hairColor: v })} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Hair style</FieldLabel>
            <PillSelector options={HAIR_STYLES} value={appearance.hairStyle} onChange={(v) => upd({ hairStyle: v })} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Skin tone</FieldLabel>
            <SkinTonePicker value={appearance.skinTone} onChange={(v) => upd({ skinTone: v })} />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox checked={appearance.glasses} onCheckedChange={(v) => upd({ glasses: !!v })} id="glasses" />
            <label htmlFor="glasses" className="text-sm text-muted-foreground cursor-pointer">Wears glasses</label>
          </div>
          {featuresSlot !== undefined ? featuresSlot : (
            <div className="space-y-1.5">
              <FieldLabel optional>Other distinguishing features</FieldLabel>
              <Input className="rounded-xl" placeholder="Freckles, hearing aid, uses a wheelchair…"
                maxLength={100} value={appearance.features}
                onChange={(e) => upd({ features: e.target.value })} />
              <CharCounter current={appearance.features.length} max={100} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── protagonist form ────────────────────────────────────── */

function ProtagonistForm({ data, onChange }: { data: Protagonist; onChange: (d: Protagonist) => void }) {
  const upd = (p: Partial<Protagonist>) => onChange({ ...data, ...p });
  const displayName = data.name || "your character";

  return (
    <div className="space-y-5">
      <PhotoUploadZone photos={data.photos} onChange={(p) => upd({ photos: p })} heroName={data.name} />

      <div className="space-y-1.5">
        <FieldLabel>Name</FieldLabel>
        <Input className="rounded-xl" placeholder="e.g. Mia" value={data.name}
          onChange={(e) => upd({ name: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Age</FieldLabel>
        <Input className="rounded-xl w-24" placeholder="e.g. 5" value={data.age}
          onChange={(e) => upd({ age: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Gender</FieldLabel>
        <PillSelector options={GENDERS_PROTO} value={data.gender} onChange={(v) => upd({ gender: v })} />
      </div>

      <MiniPersonality
        value={data.traits || []}
        onChange={(t) => upd({ traits: t })}
        name={data.name}
      />

      <AppearanceAccordion
        appearance={data.appearance}
        onChange={(a) => upd({ appearance: a })}
        name={displayName}
        defaultExpanded={false}
        featuresSlot={
          <div className="space-y-1.5">
            <FieldLabel optional>Tell us something unique about the appearance of this character</FieldLabel>
            <Textarea className="rounded-xl resize-none" rows={3} maxLength={200}
              placeholder="Just lost a front tooth, always carries a blue blanket, always wears pink…"
              value={data.special} onChange={(e) => upd({ special: e.target.value })} />
            <CharCounter current={data.special.length} max={200} />
          </div>
        }
      />
    </div>
  );
}

/* ── supporting character form ───────────────────────────── */

function SupportingPathChoice({ onChoose }: { onChoose: (mode: "ai" | "real") => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button type="button" onClick={() => onChoose("ai")}
        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary/40 hover:shadow-md transition-all text-center">
        <Sparkles className="w-10 h-10" style={{ color: "hsl(var(--wizard-primary))" }} />
        <span className="font-semibold text-sm">Let AI create this character</span>
        <span className="text-xs text-muted-foreground">We'll design their appearance — you just tell us who they are.</span>
      </button>
      <button type="button" onClick={() => onChoose("real")}
        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:border-primary/40 hover:shadow-md transition-all text-center">
        <Camera className="w-10 h-10" style={{ color: "hsl(var(--wizard-primary))" }} />
        <span className="font-semibold text-sm">Based on a real person</span>
        <span className="text-xs text-muted-foreground">Upload photos and details so they look just right.</span>
      </button>
    </div>
  );
}

/* ── mini personality (supporting characters only) ───────── */

const SUPPORT_TRAIT_POOL: Array<{ emoji: string; word: string }> = [
  { emoji: "🤗", word: "warm" },
  { emoji: "🤪", word: "silly" },
  { emoji: "🧘", word: "calm" },
  { emoji: "⚡", word: "energetic" },
  { emoji: "🦁", word: "brave" },
  { emoji: "🤓", word: "curious" },
  { emoji: "🎨", word: "creative" },
  { emoji: "🤫", word: "quiet" },
  { emoji: "😄", word: "joyful" },
  { emoji: "🧩", word: "clever" },
  { emoji: "🎤", word: "confident" },
  { emoji: "💭", word: "thoughtful" },
];

const MAX_SUPPORT_TRAITS = 2;

function MiniPersonality({
  value,
  onChange,
  name,
}: {
  value: Array<{ word: string; emoji?: string }>;
  onChange: (v: Array<{ word: string; emoji?: string }>) => void;
  name: string;
}) {
  const entered = new Set(value.map((e) => e.word.trim().toLowerCase()).filter(Boolean));
  const visible = SUPPORT_TRAIT_POOL.filter((t) => !entered.has(t.word.toLowerCase())).slice(0, 8);
  const atCap = value.length >= MAX_SUPPORT_TRAITS;

  const add = (word: string, emoji?: string) => {
    if (atCap || !word || entered.has(word.toLowerCase())) return;
    onChange([...value, { word, emoji }]);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const filledStyle = {
    backgroundColor: "hsl(var(--wizard-primary) / 0.10)",
    color: "hsl(var(--wizard-primary))",
  } as const;

  return (
    <div className="space-y-2">
      <FieldLabel>
        Personality{" "}
        <span className="font-normal text-muted-foreground">
          — pick up to {MAX_SUPPORT_TRAITS} traits for {name || "this character"}
        </span>
      </FieldLabel>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t, idx) => (
            <span
              key={`${t.word}-${idx}`}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
              style={filledStyle}
            >
              {t.emoji && <span aria-hidden>{t.emoji}</span>}
              <span>{t.word}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label={`Remove ${t.word}`}
                className="ml-0.5 opacity-50 hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!atCap && (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((t) => (
            <button
              key={t.word}
              type="button"
              onClick={() => add(t.word, t.emoji)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border border-dashed transition-all hover:bg-[hsl(var(--wizard-primary)/0.05)]"
              style={{
                borderColor: "hsl(var(--wizard-primary) / 0.35)",
                color: "hsl(var(--wizard-primary))",
              }}
            >
              <span aria-hidden>{t.emoji}</span>
              <span>{t.word}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportingCharacterForm({ data, onChange, protagonistName }: {
  data: SupportingCharacter; onChange: (d: SupportingCharacter) => void; protagonistName: string;
}) {
  const upd = (p: Partial<SupportingCharacter>) => {
    const next = { ...data, ...p };
    // auto-suggest age from relationship
    if (p.relationship && p.relationship !== "Other") {
      const suggested = RELATIONSHIP_AGE[p.relationship];
      if (suggested) next.ageRange = suggested;
    }
    onChange(next);
  };

  if (!data.mode) {
    return <SupportingPathChoice onChoose={(m) => upd({ mode: m })} />;
  }

  const switchLabel = data.mode === "ai" ? "Switch to real person" : "Switch to AI-created";

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => upd({ mode: data.mode === "ai" ? "real" : "ai", photos: [], appearance: emptyAppearance() })}
        className="text-xs font-medium underline" style={{ color: "hsl(var(--wizard-primary))" }}>
        {switchLabel}
      </button>

      {data.mode === "real" && (
        <PhotoUploadZone photos={data.photos} onChange={(p) => upd({ photos: p })} />
      )}

      <div className="space-y-1.5">
        <FieldLabel>Name</FieldLabel>
        {data.mode === "ai" && (
          <div className="flex items-center gap-2 mb-2">
            <Checkbox checked={data.surpriseName} onCheckedChange={(v) => upd({ surpriseName: !!v })} id={`surprise-${data.id}`} />
            <label htmlFor={`surprise-${data.id}`} className="text-xs text-muted-foreground cursor-pointer">Surprise me with a name</label>
          </div>
        )}
        {!data.surpriseName && (
          <Input className="rounded-xl" placeholder="e.g. Uncle James" value={data.name}
            onChange={(e) => upd({ name: e.target.value })} />
        )}
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Relationship to {protagonistName || "the hero"}</FieldLabel>
        <PillSelector options={RELATIONSHIPS} value={data.relationship} onChange={(v) => upd({ relationship: v })} />
        {data.relationship === "Other" && (
          <Input className="rounded-xl mt-2" placeholder="Describe relationship…" value={data.relationshipOther}
            onChange={(e) => upd({ relationshipOther: e.target.value })} />
        )}
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Gender</FieldLabel>
        <PillSelector options={data.mode === "ai" ? GENDERS_SUPPORT : GENDERS_PROTO} value={data.gender} onChange={(v) => upd({ gender: v })} />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Age range</FieldLabel>
        <PillSelector options={AGE_RANGES} value={data.ageRange} onChange={(v) => upd({ ageRange: v })} />
      </div>

      <MiniPersonality
        value={data.traits || []}
        onChange={(t) => upd({ traits: t })}
        name={data.name}
      />

      {data.mode === "real" && (
        <AppearanceAccordion appearance={data.appearance} onChange={(a) => upd({ appearance: a })}
          name={data.name || "this character"} defaultExpanded={false} />
      )}
    </div>
  );
}

/* ── companion form removed ──────────────────────────────── */

/* ── pill bar ────────────────────────────────────────────── */

interface PillProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  onRemove?: () => void;
  hasWarning?: boolean;
}

function Pill({ active, icon, label, onClick, onRemove, hasWarning }: PillProps) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
        active ? "border-transparent shadow-sm text-white" : "border-border bg-background text-muted-foreground hover:border-primary/40"
      }`}
      style={active ? { backgroundColor: "hsl(var(--wizard-primary))" } : undefined}
    >
      {icon}
      <span className="max-w-[120px] truncate">{label}</span>
      {onRemove && (
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-1 w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
          <X className="w-3 h-3" />
        </span>
      )}
      {hasWarning && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive" />
      )}
    </button>
  );
}

function AddPill({ label, icon, onClick, disabled, tooltip }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; tooltip?: string;
}) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} title={tooltip}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border border-dashed shrink-0 transition-all ${
        disabled ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── main component ──────────────────────────────────────── */

export default function Step6() {
  const { answers, setAnswer, setCanContinue } = useWizard();

  // Pull data from context (or defaults)
  const storedProtagonist = answers.protagonist as Protagonist | undefined;
  const protagonist: Protagonist = storedProtagonist
    ? { traits: [], ...storedProtagonist }
    : {
        photos: [],
        name: (answers.childName as string) || "",
        age: (answers.childAge as string) || "",
        gender: (answers.childGender as string) || "",
        special: "",
        appearance: emptyAppearance(),
        traits: (answers.personalityList as Array<{ word: string; emoji?: string }>) || [],
      };

  const supportingCharacters: SupportingCharacter[] =
    (answers.supportingCharacters as SupportingCharacter[]) || [];


  const [activeTab, setActiveTab] = useState<ActiveTab>({ kind: "protagonist" });
  const [warnings, setWarnings] = useState<Set<string>>(new Set());
  const [showRemoveDialog, setShowRemoveDialog] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showNoCharsDialog, setShowNoCharsDialog] = useState(false);
  const noCharsResolver = useRef<((ok: boolean) => void) | null>(null);

  // Enable continue always (validation happens on click via WizardShell)
  useEffect(() => { setCanContinue(true); }, [setCanContinue]);

  // Kick off the background portrait the moment the first protagonist photo
  // is uploaded. No visible UI on this step — result is shown on Step 8.
  useCharacterPortrait();

  // Intercept Continue: if no supporting characters, ask "are you sure?"
  const handleBeforeContinue = useCallback(() => {
    if (supportingCharacters.length > 0) return true;
    return new Promise<boolean>((resolve) => {
      noCharsResolver.current = resolve;
      setShowNoCharsDialog(true);
    });
  }, [supportingCharacters.length]);

  const resolveNoChars = (ok: boolean) => {
    setShowNoCharsDialog(false);
    noCharsResolver.current?.(ok);
    noCharsResolver.current = null;
  };

  const setProtagonist = useCallback((p: Protagonist) => setAnswer("protagonist", p), [setAnswer]);
  const setSupportingCharacters = useCallback((s: SupportingCharacter[]) => setAnswer("supportingCharacters", s), [setAnswer]);

  const addSupporting = () => {
    if (supportingCharacters.length >= 2) {
      // 3rd character = upsell
      setShowUpsell(true);
      return;
    }
    const sc: SupportingCharacter = {
      id: makeId(), mode: "", name: "", surpriseName: false,
      relationship: "", relationshipOther: "", gender: "", ageRange: "",
      photos: [], appearance: emptyAppearance(), traits: [],
    };
    setSupportingCharacters([...supportingCharacters, sc]);
    setActiveTab({ kind: "supporting", id: sc.id });
  };

  const addPaidCharacter = () => {
    setShowUpsell(false);
    const sc: SupportingCharacter = {
      id: makeId(), mode: "", name: "", surpriseName: false,
      relationship: "", relationshipOther: "", gender: "", ageRange: "",
      photos: [], appearance: emptyAppearance(), traits: [],
    };
    setSupportingCharacters([...supportingCharacters, sc]);
    setActiveTab({ kind: "supporting", id: sc.id });
    toast.success("Extra character unlocked!", { description: "$3.00 charged (simulated)" });
  };

  const confirmRemove = (id: string) => setShowRemoveDialog(id);

  const doRemove = () => {
    if (!showRemoveDialog) return;
    const filtered = supportingCharacters.filter((c) => c.id !== showRemoveDialog);
    setSupportingCharacters(filtered);
    setActiveTab({ kind: "protagonist" });
    setShowRemoveDialog(null);
  };

  const updateSupporting = (id: string, data: SupportingCharacter) => {
    setSupportingCharacters(supportingCharacters.map((c) => (c.id === id ? data : c)));
  };

  const protoName = protagonist.name || "Main Character";

  /* ── pill avatar helper ── */
  const avatarCircle = (photos: string[]) =>
    photos.length > 0
      ? <img src={photos[0]} alt="" className="w-6 h-6 rounded-full object-cover" />
      : <User className="w-4 h-4" />;

  return (
    <WizardShell onBeforeContinue={handleBeforeContinue}>
      <div className="space-y-6">
        {/* heading */}
        <div className="text-center space-y-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold" style={{ color: "hsl(var(--wizard-primary))" }}>
            Let's bring the characters to life
          </h1>
          <p className="text-muted-foreground text-lg">
            Build your cast — start with the star of the story, then add anyone else you'd like to include.
          </p>
        </div>

        {/* pill bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Pill active={activeTab.kind === "protagonist"}
            icon={<Star className="w-4 h-4" />}
            label={protoName}
            onClick={() => setActiveTab({ kind: "protagonist" })}
            hasWarning={warnings.has("protagonist")}
          />

          {supportingCharacters.map((sc) => (
            <Pill key={sc.id}
              active={activeTab.kind === "supporting" && activeTab.id === sc.id}
              icon={avatarCircle(sc.photos)}
              label={sc.name || "New Character"}
              onClick={() => setActiveTab({ kind: "supporting", id: sc.id })}
              onRemove={() => confirmRemove(sc.id)}
              hasWarning={warnings.has(sc.id)}
            />
          ))}

          {supportingCharacters.length < 3 && (
            <AddPill label="Character" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={addSupporting}
              disabled={supportingCharacters.length >= 3}
              tooltip={supportingCharacters.length >= 3 ? "3 character max" : undefined}
            />
          )}
        </div>

        {/* form area */}
        {(() => {
          const activeSupporting = activeTab.kind === "supporting"
            ? supportingCharacters.find((c) => c.id === activeTab.id)
            : null;

          return (
            <div className="rounded-2xl border p-5 sm:p-6" style={{ backgroundColor: "hsl(var(--wizard-bg))" }}>
              {activeTab.kind === "protagonist" && (
                <ProtagonistForm data={protagonist} onChange={setProtagonist} />
              )}

              {activeTab.kind === "supporting" && activeSupporting && (
                <SupportingCharacterForm data={activeSupporting}
                  onChange={(d) => updateSupporting(activeSupporting.id, d)}
                  protagonistName={protagonist.name}
                />
              )}
            </div>
          );
        })()}

      </div>

      {/* Remove confirmation dialog */}
      <Dialog open={!!showRemoveDialog} onOpenChange={() => setShowRemoveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this character?</DialogTitle>
            <DialogDescription>This can't be undone. You can always add a new one.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button type="button" onClick={() => setShowRemoveDialog(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="button" onClick={doRemove}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upsell dialog */}
      <Dialog open={showUpsell} onOpenChange={setShowUpsell}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add an extra character</DialogTitle>
            <DialogDescription>
              Your plan includes 2 supporting characters. Add one more for just $3.00.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button type="button" onClick={() => setShowUpsell(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
              No thanks
            </button>
            <button type="button" onClick={addPaidCharacter}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "hsl(var(--wizard-primary))" }}>
              Add for $3.00
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "Are you sure?" when continuing without any supporting characters */}
      <Dialog open={showNoCharsDialog} onOpenChange={(open) => { if (!open) resolveNoChars(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Continue without any extra characters?</DialogTitle>
            <DialogDescription>
              Stories feel extra magical with friends, family, or favorite people
              alongside {protoName}. You can always add a sibling, grandparent,
              or best friend now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button type="button" onClick={() => resolveNoChars(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors">
              Continue anyway
            </button>
            <button type="button"
              onClick={() => { resolveNoChars(false); addSupporting(); }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "hsl(var(--wizard-primary))" }}>
              Add a character
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WizardShell>
  );
}
