/**
 * Central type definitions for wizard answers and related shapes.
 *
 * No React imports — safe to import from contexts, hooks, and lib files
 * without creating circular dependencies.
 */

// ── Character appearance ──────────────────────────────────

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

// ── Character shapes ──────────────────────────────────────

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

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Portrait state ────────────────────────────────────────

export type PortraitStatus = "idle" | "loading" | "ready" | "error";

export interface CharacterPortraitState {
  status: PortraitStatus;
  dataUrl?: string;
  error?: string;
  sourceHash?: string;
}

export type SupportingPortraitsState = Record<string, CharacterPortraitState>;

// ── Story concept ─────────────────────────────────────────

export type StoryConcept = {
  title?: string;
  summary?: string;
  user_visible_summary?: string;
  framework_id?: string;
  framework_reason?: string;
  story_seed?: Record<string, unknown>;
  personalization_notes?: Record<string, unknown>;
  full_book_instruction?: string;
  coverImage?: string;
  user_edited?: boolean;
};

// ── All wizard answer fields ──────────────────────────────

export interface WizardAnswers {
  // Step 1
  childName?: string;
  ageRange?: string;
  gender?: string;
  language?: string;

  // Step 2
  buyer_relationship?: string;
  buyer_name?: string;
  buyer_email?: string;
  occasion?: string;
  bookBelongsTo?: boolean;

  // Step 3
  genre?: string;
  mood?: string;

  // Step 4
  lesson?: string;

  // Step 5
  interestsList?: Array<{ word: string }>;

  // Secret ingredient
  specialThing?: { category: string; details: Record<string, string> } | null;

  // Step 6
  artStyle?: string;

  // Step 7
  protagonist?: Protagonist;
  personalityList?: Array<{ word: string; emoji?: string }>;
  supportingCharacters?: SupportingCharacter[];

  // Portrait generation (set by hooks)
  characterPortrait?: CharacterPortraitState;
  appearanceAutofillHash?: string;
  supportingPortraits?: SupportingPortraitsState;

  // Step 8
  selectedConcept?: StoryConcept;
  summaryBriefHash?: string;

  // Generating / post-generation
  bookId?: string;
  selectedPlan?: string;
  bookTitle?: string;

  // Legacy/misc buildBrief fields
  thingsAlreadyGoodAt?: string;
  thingsCurrentlyTricky?: string;
  recentMeaningfulMoment?: string;
}
