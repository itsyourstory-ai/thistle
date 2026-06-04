// Re-export shared types from the central types file
export type { Appearance, Protagonist, SupportingCharacter, ActiveTab } from "@/lib/wizardTypes";
export { emptyAppearance, makeId } from "@/lib/wizardTypes";

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
