import { Sparkles, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type Protagonist,
  type SupportingCharacter,
  GENDERS_PROTO,
  GENDERS_SUPPORT,
  AGE_RANGES,
  RELATIONSHIPS,
  RELATIONSHIP_AGE,
  emptyAppearance,
} from "./types";
import {
  FieldLabel,
  CharCounter,
  GenderSelect,
  PhotoUploadZone,
  AppearanceAccordion,
} from "./FormPrimitives";
import { MiniPersonality } from "./MiniPersonality";

/* ── ProtagonistForm ─────────────────────────────────────── */

export function ProtagonistForm({ data, onChange }: { data: Protagonist; onChange: (d: Protagonist) => void }) {
  const upd = (p: Partial<Protagonist>) => onChange({ ...data, ...p });
  const displayName = data.name || "your character";

  return (
    <div className="space-y-8">

      <PhotoUploadZone photos={data.photos} onChange={(p) => upd({ photos: p })} heroName={data.name} />

      <div className="space-y-1.5">
        <FieldLabel>Name</FieldLabel>
        <Input className="rounded-xl" placeholder="e.g. Mia" value={data.name}
          onChange={(e) => upd({ name: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Age</FieldLabel>
          <Input className="rounded-xl" placeholder="e.g. 5" value={data.age}
            onChange={(e) => upd({ age: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Gender</FieldLabel>
          <GenderSelect options={GENDERS_PROTO} value={data.gender}
            onChange={(v) => upd({ gender: v })} />
        </div>
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

/* ── SupportingPathChoice ────────────────────────────────── */

export function SupportingPathChoice({ onChoose }: { onChoose: (mode: "ai" | "real") => void }) {
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

/* ── SupportingCharacterForm ─────────────────────────────── */

export function SupportingCharacterForm({ data, onChange, protagonistName }: {
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
    <div className="space-y-8">
      <button type="button" onClick={() => upd({ mode: data.mode === "ai" ? "real" : "ai", photos: [], appearance: emptyAppearance() })}
        className="text-xs font-medium underline" style={{ color: "hsl(var(--wizard-primary))" }}>
        {switchLabel}
      </button>

      {data.mode === "real" && (
        <PhotoUploadZone photos={data.photos} onChange={(p) => upd({ photos: p })} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Name</FieldLabel>
          {data.mode === "ai" && (
            <div className="flex items-center gap-2 mb-2">
              <Checkbox checked={data.surpriseName} onCheckedChange={(v) => upd({ surpriseName: !!v })} id={`surprise-${data.id}`} />
              <label htmlFor={`surprise-${data.id}`} className="text-xs text-muted-foreground cursor-pointer">Surprise me with a name</label>
            </div>
          )}
          {!data.surpriseName ? (
            <Input className="rounded-xl" placeholder="e.g. Uncle James" value={data.name}
              onChange={(e) => upd({ name: e.target.value })} />
          ) : (
            <div className="h-10 rounded-xl border border-dashed border-border flex items-center px-3 text-xs text-muted-foreground italic">
              We'll pick a name
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Relationship to Main Character</FieldLabel>
          <GenderSelect options={RELATIONSHIPS} value={data.relationship}
            onChange={(v) => upd({ relationship: v })} placeholder="Select relationship" />
        </div>
      </div>

      {data.relationship === "Other" && (
        <Input className="rounded-xl" placeholder="Describe relationship…" value={data.relationshipOther}
          onChange={(e) => upd({ relationshipOther: e.target.value })} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Age range</FieldLabel>
          <GenderSelect options={AGE_RANGES} value={data.ageRange}
            onChange={(v) => upd({ ageRange: v })} placeholder="Select age range" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Gender</FieldLabel>
          <GenderSelect options={data.mode === "ai" ? GENDERS_SUPPORT : GENDERS_PROTO}
            value={data.gender} onChange={(v) => upd({ gender: v })} />
        </div>
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
