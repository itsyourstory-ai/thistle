/**
 * Hand-authored fixture responses for every edge function, keyed by seed
 * profile. These are returned by callEdge() when test mode is on, so the
 * full wizard can be walked for $0.
 *
 * Shapes mirror exactly what each call site reads from { data, error }.
 * If a real edge function changes its response shape, update the matching
 * fixture here so test mode stays realistic.
 */

import type { ProfileId } from "@/lib/testMode";
import {
  COVER_CLASSIC,
  COVER_MINIMAL,
  COVER_EDGE,
  COVER_SPECIAL,
  PORTRAIT_HERO,
} from "./images";

export interface MockResponse {
  data: Record<string, unknown> | null;
  error: null;
}

// ── generate-summary ──────────────────────────────────────────────────────────

const SUMMARY_DATA: Record<ProfileId, Record<string, unknown>> = {
  classic: {
    title: "Leo and the Dragon's Secret",
    summary:
      "Brave six-year-old Leo stumbles upon a shy purple dragon hiding behind the waterfall near his house. Together they discover that the dragon is scared of his own fire, and Leo helps him see that what makes you different can also be your greatest strength.",
    user_visible_summary:
      "Brave Leo discovers a shy dragon who's afraid of his own fire — and learns that being different is actually a superpower.",
    framework_id: "coming_of_age",
    framework_reason: "Seed fixture",
    story_seed: { beats: ["hook", "rising", "climax", "resolution"] },
    personalization_notes: {},
  },
  minimal: {
    title: "Priya's Rainy Day Magic",
    summary:
      "When a rainy afternoon cancels Priya's outdoor plans, she discovers that puddles are actually portals to a world where clouds are made of cotton candy and warm chocolate rain falls upward.",
    user_visible_summary:
      "Priya discovers that puddles are portals to a magical upside-down candy world.",
    framework_id: "discovery",
    framework_reason: "Seed fixture",
    story_seed: { beats: ["hook", "wonder", "resolution"] },
    personalization_notes: {},
  },
  "edge-text": {
    title: "Bartholomew-James and the Talking Map",
    summary:
      "Bartholomew-James receives a mysterious folded map from a travelling merchant. The map talks back — and sends him on a journey across three kingdoms to reunite a scattered family of clever foxes with unusually long names.",
    user_visible_summary:
      "A talking map sends Bartholomew-James on an epic quest across three kingdoms.",
    framework_id: "quest",
    framework_reason: "Seed fixture",
    story_seed: { beats: ["departure", "trial_1", "trial_2", "return"] },
    personalization_notes: {},
  },
  "special-pet": {
    title: "River and Mochi Save the Garden",
    summary:
      "River's cat Mochi has always seemed a bit magical — but nobody believed River until Mochi led them to the centre of the garden, where a lonely little cloud was putting all the flowers to sleep.",
    user_visible_summary:
      "River and their magical cat Mochi befriend a lonely cloud to save the garden.",
    framework_id: "friendship",
    framework_reason: "Seed fixture",
    story_seed: { beats: ["mystery", "discovery", "connection", "resolution"] },
    personalization_notes: {},
  },
};

// ── generate-cover ────────────────────────────────────────────────────────────

const COVER_URLS: Record<ProfileId, string> = {
  classic: COVER_CLASSIC,
  minimal: COVER_MINIMAL,
  "edge-text": COVER_EDGE,
  "special-pet": COVER_SPECIAL,
};

// ── extract-appearance-traits ─────────────────────────────────────────────────
// Same shape for all profiles — the seed profiles already have manual
// appearance fields set, so these values only fill in blanks.

const APPEARANCE_TRAITS: Record<string, unknown> = {
  hair_color: "brown",
  hair_style: "short",
  hair_length: "short",
  skin_tone: "medium",
  glasses: false,
  distinguishing: "bright smile",
  eye_color: "hazel",
};

// ── Main lookup ───────────────────────────────────────────────────────────────

/**
 * Returns a mock { data, error } response for the given edge function and
 * active seed profile, or null if no fixture is defined (falls through to live).
 */
export function getFixture(
  fnName: string,
  profileId: ProfileId,
): MockResponse | null {
  switch (fnName) {
    case "generate-summary":
      return { data: SUMMARY_DATA[profileId], error: null };

    case "generate-cover":
      return { data: { imageDataUrl: COVER_URLS[profileId] }, error: null };

    case "generate-character-portrait":
      return { data: { imageDataUrl: PORTRAIT_HERO }, error: null };

    case "extract-appearance-traits":
      return { data: { traits: APPEARANCE_TRAITS }, error: null };

    case "generate-book":
      // Returns just an id — Step9Generating then polls the DB.
      // Phase D's bookStatus helper intercepts that poll.
      return { data: { id: `mock-book-${profileId}` }, error: null };

    case "generate-book-images":
      // Fire-and-forget; return value is ignored by the call site.
      return { data: {}, error: null };

    default:
      return null;
  }
}
