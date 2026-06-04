import { X } from "lucide-react";
import {
  PILL_SELECTED,
  PILL_SUGGESTION,
  PILL_REMOVE_BTN,
} from "@/components/pillStyles";
import { FieldLabel } from "./FormPrimitives";

/* ── constants ───────────────────────────────────────────── */

export const SUPPORT_TRAIT_POOL: Array<{ emoji: string; word: string }> = [
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

export const MAX_SUPPORT_TRAITS = 2;

/* ── MiniPersonality ─────────────────────────────────────── */

export function MiniPersonality({
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

  return (
    <div className="space-y-2">
      <FieldLabel>Personality</FieldLabel>
      <p className="text-sm text-muted-foreground">
        Pick up to {MAX_SUPPORT_TRAITS} traits for {name || "this character"}
      </p>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((t, idx) => (
            <span key={`${t.word}-${idx}`} className={PILL_SELECTED}>
              {t.emoji && <span aria-hidden>{t.emoji}</span>}
              <span>{t.word}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label={`Remove ${t.word}`}
                className={PILL_REMOVE_BTN}
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!atCap && (
        <div className="flex flex-wrap gap-2">
          {visible.map((t) => (
            <button
              key={t.word}
              type="button"
              onClick={() => add(t.word, t.emoji)}
              className={PILL_SUGGESTION}
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
