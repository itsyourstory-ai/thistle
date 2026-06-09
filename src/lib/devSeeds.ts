/**
 * Four deliberately-divergent seed profiles for dev test mode.
 *
 * Each profile is a complete WizardAnswers object (including a selectedConcept
 * with a fake cover so you can jump straight to the preview step). Load one
 * by calling seedAnswers() from WizardContext, or via the DevTestPanel UI.
 *
 * AIDEV-NOTE: Only imported in DEV (guarded in DevTestPanel). Never included
 * in production bundles via tree-shaking since nothing else imports this.
 */

import type { WizardAnswers, SupportingCharacter } from "./wizardTypes";
import { emptyAppearance } from "./wizardTypes";
import {
  COVER_CLASSIC,
  COVER_MINIMAL,
  COVER_EDGE,
  COVER_SPECIAL,
  FAKE_PHOTO,
} from "@/test/fixtures/images";

// Shared selectedConcept shapes matching the SUMMARY_DATA fixtures.
// Including the cover image lets you jump straight to /step/10-preview.

const CONCEPT_CLASSIC = {
  title: "Leo and the Dragon's Secret",
  summary:
    "Brave six-year-old Leo stumbles upon a shy purple dragon hiding behind the waterfall near his house. Together they discover that the dragon is scared of his own fire, and Leo helps him see that what makes you different can also be your greatest strength.",
  user_visible_summary:
    "Brave Leo discovers a shy dragon who's afraid of his own fire — and learns that being different is actually a superpower.",
  framework_id: "coming_of_age",
  coverImage: COVER_CLASSIC,
};

const CONCEPT_MINIMAL = {
  title: "Priya's Rainy Day Magic",
  summary:
    "When a rainy afternoon cancels Priya's outdoor plans, she discovers that puddles are actually portals to a world where clouds are made of cotton candy and warm chocolate rain falls upward.",
  user_visible_summary:
    "Priya discovers that puddles are portals to a magical upside-down candy world.",
  framework_id: "discovery",
  coverImage: COVER_MINIMAL,
};

const CONCEPT_EDGE = {
  title: "Bartholomew-James and the Talking Map",
  summary:
    "Bartholomew-James receives a mysterious folded map from a travelling merchant. The map talks back — and sends him on a journey across three kingdoms to reunite a scattered family of clever foxes with unusually long names.",
  user_visible_summary:
    "A talking map sends Bartholomew-James on an epic quest across three kingdoms.",
  framework_id: "quest",
  coverImage: COVER_EDGE,
};

const CONCEPT_SPECIAL = {
  title: "River and Mochi Save the Garden",
  summary:
    "River's cat Mochi has always seemed a bit magical — but nobody believed River until Mochi led them to the centre of the garden, where a lonely little cloud was putting all the flowers to sleep.",
  user_visible_summary:
    "River and their magical cat Mochi befriend a lonely cloud to save the garden.",
  framework_id: "friendship",
  coverImage: COVER_SPECIAL,
};

// ── Helper ────────────────────────────────────────────────────────────────────

function makeSupportingChar(overrides: Partial<SupportingCharacter> & { id: string }): SupportingCharacter {
  return {
    mode: "ai",
    name: "",
    surpriseName: false,
    relationship: "",
    relationshipOther: "",
    gender: "",
    ageRange: "",
    photos: [],
    appearance: emptyAppearance(),
    traits: [],
    ...overrides,
  };
}

// ── Profile 1: Classic ────────────────────────────────────────────────────────
// Boy, 6, has an uploaded photo, 2 supporting characters (Mom + dog), full
// traits, specific lesson + interests. Exercises the photo/appearance-autofill
// and supporting-portraits code paths.

const PROFILE_CLASSIC: WizardAnswers = {
  // Step 1
  childName: "Leo",
  ageRange: "6-8",
  gender: "boy",
  language: "english",

  // Step 2
  buyer_relationship: "parent",
  buyer_name: "Sarah",
  buyer_email: "sarah@example.com",
  occasion: "birthday",
  bookBelongsTo: true,

  // Step 3
  genre: "adventure",
  mood: "brave",

  // Step 4
  lesson: "courage",

  // Step 5
  interestsList: [
    { word: "dragons" },
    { word: "climbing trees" },
    { word: "dinosaurs" },
  ],

  // Step 6
  artStyle: "cozy-gouache",

  // Step 7
  protagonist: {
    photos: [FAKE_PHOTO],
    name: "Leo",
    age: "6",
    gender: "Boy",
    special: "Big gap-toothed grin, always in his favourite red dinosaur t-shirt",
    appearance: {
      hairColor: "Brown",
      hairStyle: "Short",
      skinTone: "#F5CBA7",
      glasses: false,
      features: "Hazel eyes, gap-toothed smile",
    },
    traits: [
      { word: "brave", emoji: "🦁" },
      { word: "curious", emoji: "🔍" },
    ],
  },
  supportingCharacters: [
    makeSupportingChar({
      id: "sc-classic-1",
      mode: "ai",
      name: "Mom",
      relationship: "Mom",
      gender: "Girl/Woman",
      ageRange: "Adult",
      traits: [{ word: "warm" }, { word: "funny" }],
    }),
    makeSupportingChar({
      id: "sc-classic-2",
      mode: "ai",
      name: "Buddy",
      relationship: "Other",
      relationshipOther: "pet dog",
      gender: "Any",
      ageRange: "Adult",
      traits: [{ word: "loyal" }, { word: "goofy" }],
    }),
  ],

  // Pre-filled concept + cover so you can jump to preview
  selectedConcept: CONCEPT_CLASSIC,
  selectedPlan: "digital",

  // Extra buildBrief fields
  thingsAlreadyGoodAt: "Making up elaborate stories",
  thingsCurrentlyTricky: "Sitting still",
};

// ── Profile 2: Minimal ────────────────────────────────────────────────────────
// Girl, 4, no photo, no supporting cast. Exercises the no-photo imagined-hero
// code path.

const PROFILE_MINIMAL: WizardAnswers = {
  childName: "Priya",
  ageRange: "3-5",
  gender: "girl",
  language: "english",

  buyer_relationship: "grandparent",
  buyer_name: "Raj",
  buyer_email: "raj@example.com",
  occasion: "first_day",
  bookBelongsTo: true,

  genre: "fantasy",
  mood: "whimsical",

  lesson: "curiosity",

  interestsList: [{ word: "dancing" }, { word: "butterflies" }],

  artStyle: "geometric-pop",

  protagonist: {
    photos: [],
    name: "Priya",
    age: "4",
    gender: "Girl",
    special: "Missing a front tooth, always wearing something with butterflies on it",
    appearance: {
      hairColor: "Black",
      hairStyle: "Long",
      skinTone: "#E0B88A",
      glasses: false,
      features: "Big dark eyes, very bright smile",
    },
    traits: [{ word: "creative" }, { word: "dreamy" }],
  },
  supportingCharacters: [],

  selectedConcept: CONCEPT_MINIMAL,
  selectedPlan: "digital",
};

// ── Profile 3: Edge text ──────────────────────────────────────────────────────
// Long/unusual name, 3 interests, special-thing pet, a surprise-name
// supporting character. Stress-tests text overflow and unusual values.

const PROFILE_EDGE: WizardAnswers = {
  childName: "Bartholomew-James",
  ageRange: "9-12",
  gender: "boy",
  language: "english",

  buyer_relationship: "other",
  buyer_name: "Priscilla-Anne",
  buyer_email: "priscilla.anne@example.com",
  occasion: "graduation",
  bookBelongsTo: false,

  genre: "adventure",
  mood: "mysterious",

  lesson: "resilience",

  interestsList: [
    { word: "maps" },
    { word: "foxes" },
    { word: "origami" },
  ],

  // Secret ingredient
  specialThing: {
    category: "pet",
    details: { type: "fox", name: "Rusty", color: "orange with white paws" },
  },

  artStyle: "hand-drawn-charm",

  protagonist: {
    photos: [],
    name: "Bartholomew-James",
    age: "8",
    gender: "Boy",
    special: "Always wearing round tortoiseshell glasses, usually carrying a well-worn leather satchel",
    appearance: {
      hairColor: "Red",
      hairStyle: "Curly",
      skinTone: "#FDEBD0",
      glasses: true,
      features: "Round spectacles, very serious expression",
    },
    traits: [
      { word: "methodical" },
      { word: "loyal" },
    ],
  },
  supportingCharacters: [
    makeSupportingChar({
      id: "sc-edge-1",
      mode: "ai",
      name: "",
      surpriseName: true, // tests the surpriseName branch in buildBrief
      relationship: "Friend",
      gender: "Girl/Woman",
      ageRange: "Child",
      traits: [{ word: "clever" }, { word: "fast runner" }],
    }),
  ],

  selectedConcept: CONCEPT_EDGE,
  selectedPlan: "digital",
};

// ── Profile 4: Special pet ────────────────────────────────────────────────────
// Non-binary child, specialThing cat, AI-mode supporting character (grandma).
// Exercises the non-binary gender path, specialThing, and real-mode support char.

const PROFILE_SPECIAL: WizardAnswers = {
  childName: "River",
  ageRange: "3-5",
  gender: "non-binary",
  language: "english",

  buyer_relationship: "parent",
  buyer_name: "Alex",
  buyer_email: "alex@example.com",
  occasion: "just_because",
  bookBelongsTo: true,

  genre: "fantasy",
  mood: "heartwarming",

  lesson: "friendship",

  interestsList: [
    { word: "cats" },
    { word: "gardening" },
    { word: "painting" },
  ],

  specialThing: {
    category: "pet",
    details: { type: "cat", name: "Mochi", color: "black and white" },
  },

  artStyle: "cozy-gouache",

  protagonist: {
    photos: [],
    name: "River",
    age: "5",
    gender: "Gender neutral",
    special: "Usually in paint-speckled overalls with a daisy tucked behind one ear",
    appearance: {
      hairColor: "Black",
      hairStyle: "Braids",
      skinTone: "#C68E5B",
      glasses: false,
      features: "Very expressive dark eyes",
    },
    traits: [{ word: "gentle" }, { word: "imaginative" }],
  },
  supportingCharacters: [
    makeSupportingChar({
      id: "sc-special-1",
      mode: "ai",
      name: "Grandma Yuki",
      relationship: "Grandma",
      gender: "Girl/Woman",
      ageRange: "Elderly",
      traits: [{ word: "wise" }, { word: "mischievous" }],
    }),
  ],

  selectedConcept: CONCEPT_SPECIAL,
  selectedPlan: "digital",
};

// ── Exports ───────────────────────────────────────────────────────────────────

export type SeedProfileId = "classic" | "minimal" | "edge-text" | "special-pet";

export interface SeedProfile {
  id: SeedProfileId;
  label: string;
  description: string;
  answers: WizardAnswers;
}

export const SEED_PROFILES: SeedProfile[] = [
  {
    id: "classic",
    label: "Classic — Leo",
    description: "Boy, 6, photo uploaded, 2 supporting chars, full traits",
    answers: PROFILE_CLASSIC,
  },
  {
    id: "minimal",
    label: "Minimal — Priya",
    description: "Girl, 4, no photo, no supporting cast, sparse fields",
    answers: PROFILE_MINIMAL,
  },
  {
    id: "edge-text",
    label: "Edge text — Bartholomew-James",
    description: "Long names, many interests, surprise-name char, special pet",
    answers: PROFILE_EDGE,
  },
  {
    id: "special-pet",
    label: "Special pet — River",
    description: "Non-binary, magic cat, grandma supporting char",
    answers: PROFILE_SPECIAL,
  },
];

export function getSeedProfile(id: SeedProfileId): SeedProfile | undefined {
  return SEED_PROFILES.find((p) => p.id === id);
}
