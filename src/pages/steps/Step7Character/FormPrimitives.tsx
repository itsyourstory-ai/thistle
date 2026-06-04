import { useRef, useState } from "react";
import { Upload, X, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SelectableTile } from "@/components/SelectableTile";
import { toast } from "sonner";
import {
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  type Appearance,
} from "./types";

/* ── PillSelector ────────────────────────────────────────── */

export function PillSelector({ options, value, onChange }: {
  options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <SelectableTile
          key={opt}
          shape="pill"
          selected={value === opt}
          onClick={() => onChange(value === opt ? "" : opt)}
        >
          <span style={{ color: "hsl(var(--wizard-primary))" }}>{opt}</span>
        </SelectableTile>
      ))}
    </div>
  );
}

/* ── GenderSelect ────────────────────────────────────────── */

export function GenderSelect({
  options, value, onChange, placeholder = "Select gender",
}: { options: readonly string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="rounded-xl bg-white h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ── SkinTonePicker ──────────────────────────────────────── */

export function SkinTonePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {SKIN_TONES.map((tone) => (
        <SelectableTile
          key={tone}
          shape="swatch"
          selected={value === tone}
          onClick={() => onChange(value === tone ? "" : tone)}
          style={{ backgroundColor: tone }}
          aria-label={`Skin tone ${tone}`}
        />
      ))}
    </div>
  );
}

/* ── CharCounter ─────────────────────────────────────────── */

export function CharCounter({ current, max }: { current: number; max: number }) {
  return <p className="text-xs text-muted-foreground text-right">{current}/{max}</p>;
}

/* ── FieldLabel ──────────────────────────────────────────── */

export function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block font-heading text-xl sm:text-2xl font-semibold text-left text-[hsl(var(--wizard-primary))]">
      {children}{optional && <span className="ml-1 text-xs opacity-60">(optional)</span>}
    </label>
  );
}

/* ── PhotoUploadZone ─────────────────────────────────────── */

export function PhotoUploadZone({ photos, onChange, heroName, max = 3 }: {
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

/* ── AppearanceAccordion ─────────────────────────────────── */

export function AppearanceAccordion({ appearance, onChange, name, defaultExpanded, featuresSlot }: {
  appearance: Appearance; onChange: (a: Appearance) => void; name: string; defaultExpanded: boolean;
  featuresSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const upd = (p: Partial<Appearance>) => onChange({ ...appearance, ...p });

  return (
    <div className="rounded-2xl border overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
        <span>Or describe {name} instead</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
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
