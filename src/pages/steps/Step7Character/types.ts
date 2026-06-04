/* ── constants ───────────────────────────────────────────── */

export const RELATIONSHIPS = [
  "Mom", "Dad", "Sister", "Brother", "Grandma", "Grandpa",
  "Friend", "Aunt", "Uncle", "Cousin", "Teacher", "Other",
] as const;

export const GENDERS_PROTO = ["Boy", "Girl", "Gender neutral"] as const;
export const GENDERS_SUPPORT = ["Boy/Man", "Girl/Woman", "Gender neutral", "Any"] as const;

export const AGE_RANGES = ["Child", "Teen", "Adult", "Elderly"] as const;
export const RELATIONSHIP_AGE: Record<string, string> = {
  Mom: "Adult", Dad: "Adult", Grandma: "Elderly", Grandpa: "Elderly",
  Sister: "Child", Brother: "Child", Friend: "Child", Aunt: "Adult",
  Uncle: "Adult", Cousin: "Child", Teacher: "Adult",
};

export const HAIR_COLORS = ["Blonde", "Brown", "Black", "Red", "Gray", "White", "Other"] as const;
export const HAIR_STYLES = ["Short", "Long", "Curly", "Straight", "Braids", "Bald"] as const;

export const SKIN_TONES = [
  "#FDEBD0", "#F5CBA7", "#E0B88A", "#C68E5B", "#A0724A",
  "#7D5A3C", "#5C3D2E", "#3E2723",
];

/* ── interfaces ──────────────────────────────────────────── */

export interface Appearance {
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  glasses: boolean;
  features: string;
}

export function emptyAppearance(): Appearance {
  return { hairColor: "", hairStyle: "", skinTone: "", glasses: false, features: "" };
}

export interface Protagonist {
  photos: string[];
  name: string;
  age: string;
  gender: string;
  special: string;
  appearance: Appearance;
  traits: Array<{ word: string; emoji?: string }>;
}

export interface SupportingCharacter {
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

export type ActiveTab = { kind: "protagonist" } | { kind: "supporting"; id: string };

export function makeId() { return Math.random().toString(36).slice(2, 9); }
