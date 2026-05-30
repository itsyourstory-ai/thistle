// =============================================================================
//  PROMPT CONFIG — shared prompt primitives for summary, cover, book, and images.
// =============================================================================
// Keep the pre-purchase summary lightweight. Full-book exports live in this same
// facade because existing edge functions import from _shared/prompts.ts.

import { allLayoutIds, getLayout, PAGE_LAYOUTS, serializeLayoutRegistryForPrompt } from "./layouts.ts";
import type { TextPlacement } from "./layouts.ts";

// ---- Models -----------------------------------------------------------------
export const MODELS = {
  summary: "openai/gpt-5-mini",
  cover: "google/gemini-3-pro-image-preview",
  book: "openai/gpt-5",
  bookPlan: "openai/gpt-5",
} as const;

// ---- Summary length knobs ---------------------------------------------------
export const STORY_LENGTH = { min: 220, target: 270, max: 320 } as const;

// ---- Art style fragments ----------------------------------------------------
// Mirror of `src/lib/artStyles.ts` ART_STYLES[].prompt. Keep in sync — frontend
// shows the same prompt text so the picker preview matches what the model
// actually paints. Legacy slugs are mapped via ART_STYLE_ALIASES so existing
// wizard state, old defaults, and the previous backend-only `storybook-soft`
// fallback all resolve to a current style.
export const ART_STYLE_ALIASES: Record<string, string> = {
  watercolor: "cozy-gouache",
  "cozy-sketch": "geometric-pop",
  "bold-bright": "papercraft-collage",
  "dreamy-pastel": "hand-drawn-charm",
  "storybook-soft": "cozy-gouache",
};

export const ART_STYLE_PROMPTS: Record<string, string> = {
  "cozy-gouache":
    "painterly children's book illustration in traditional gouache and watercolor on warm cream cold-pressed paper with visible paper grain and soft pigment bleeds; loose visible gouache and watercolor brush strokes throughout — dappled leaf dabs, painterly washes with soft expressive edges, hand-painted texture clearly visible in backgrounds, clothing, and foliage (not flat, not digitally smooth); warm gently saturated storybook palette of soft reds, mustard yellows, bright leaf greens, sky blues, terracotta, and warm browns anchored by a warm cream/butter ground — colorful and inviting, NOT sepia, NOT washed out, NOT desaturated, but also no neon or over-saturation; minimal soft brown linework only where needed for character features and a few key edges, most forms defined by painted shape and color rather than outline, no bold black ink outlines and no heavy sepia overlay; characters have rounded approachable contours with tiny widely-spaced eyes painted as fully solid dark dots with NO white highlights, NO catch-lights, and NO lighter dot inside; a clearly visible small painted nose (a soft curved shape or short painted line, not a tiny speck) sits between the eyes and the mouth; a subtle curved mouth; and very small, understated rosy cheek circles that blend softly into the skin — a gentle hint of warmth rather than a bold accent; timeless vintage rustic clothing (simple dresses, striped sweaters, overalls, small caps); nostalgic, gentle, whimsical mood",

  "geometric-pop":
    "2D digital children's book illustration in geometric textured pop style, flat gouache washes combined with crisp vector art, strictly lineless with no visible outlines, forms defined entirely by clean geometric edges and graphic silhouettes, warm vibrant retro-pop palette balancing high-saturation colors with grounded muted earthy greens and warm mustards, subtle stippled shading, light digital noise and paper grain overlay over flat color blocks, no smooth complex gradients; characters have simplified geometric proportions with slightly larger heads and stylized solid block hair, highly minimalist faces with large simple dark eyes with minimal highlights, distinct rosy stippled cheeks, and soft curved mouths; cheerful cozy wholesome energetic mood; no 3D, no CGI, no photorealism, no black outlines, no line art, no cel shading, no messy brushstrokes, no anime, no complex gradients, no muddy colors",
  "papercraft-collage":
    "authentic hand-crafted cut and torn paper collage children's book illustration, overlapping flat construction paper shapes with absolutely no ink outlines, forms defined entirely by raw fibrous torn and snipped paper edges, warm muted earth tones and soft pastels, pronounced paper grain and visible fibers, subtle natural drop shadows creating shallow tactile layered depth, highly cozy wholesome nostalgic mood; characters have simple round faces, minimalist dotted eyes, rosy circular cheeks, simple curved line smiles, hair constructed from overlapping textured paper shapes; no 3D render, no photorealism, no digital shading, no glossy finish, no neon colors, no visible ink outlines, no sharp vector graphics",
  "hand-drawn-charm":
    "hand-drawn children's book illustration made entirely with graphite pencil and colored pencils on warm cream paper; all outlines are soft pencil lines — slightly sketchy, gently uneven, with the natural feathering and varying pressure of a real pencil stroke — NEVER ink-pen lines, NEVER uniform vector contours, NEVER marker, NEVER bold; outlines are warm brown/graphite, delicate but clearly visible; color fills are made with VISIBLE colored-pencil hatching and gentle layered shading — directional strokes, soft pencil grain, small areas of cream paper showing through inside the fills, slightly loose edges that don't always perfectly meet the outline; hair is built up from many small pencil strokes that follow the direction of curls or tufts; clean warm cream paper background with NO decorative flourishes, NO floating stars, NO swirls, NO drifting marks, NO background doodles or icons — the paper around the scene stays empty and airy; medium-weight, gently saturated palette (mustard yellow, warm rust red, sage green, soft denim blue, honey brown, dusty rose) — friendly and grounded, neither neon nor washed out, never dusty sepia; cozy whimsical innocent nostalgic mood; characters have soft rounded proportions, large simple dot eyes with a small white highlight, simple curved smiles, small understated rosy cheek circles that blend softly into the skin; no 3D render, no photorealism, no vector graphics, no ink-pen outlines, no digital airbrushing, no glossy finish",

};

export function getArtStylePrompt(value: string | undefined): string {
  const resolved = (value && ART_STYLE_ALIASES[value]) || value;
  return (
    (resolved && ART_STYLE_PROMPTS[resolved]) ||
    ART_STYLE_PROMPTS["cozy-gouache"]
  );
}


// =============================================================================
//  LIGHTWEIGHT STORY SUMMARY — generate-summary edge function
// =============================================================================

export const SUMMARY_SYSTEM_PROMPT =
  "You are a children's picture-book concept writer. Return only structured output through the provided tool. Write a complete beginning-to-end synopsis of the picture book — setup, inciting moment, attempts/escalations, climactic choice, and how it resolves. Be specific and concrete; do not withhold the ending. Never list the wizard inputs back to the user. Hard rules: no profanity, no nudity or sexual content, no crude or bathroom humor; tone, vocabulary, and themes must match the child's age band; buyer relationship and occasion are internal metadata only and must not influence the plot; interests are flavor only — never the main driver of the story, and they flavor the world around the characters, not the characters' clothing or appearance.";

export function SUMMARY_USER_TEMPLATE({
  childName,
  ageBand,
  genre,
  mood,
  lesson,
  interestsLine,
  personalityLine,
  specialThing,
  supportingLine,
  heroQuirk,
  buyerRelationship,
  occasion,
  previousSummary,
}: {
  childName: string;
  ageBand: string;
  genre?: string;
  mood?: string;
  lesson?: string;
  interestsLine?: string;
  personalityLine?: string;
  specialThing?: string;
  supportingLine?: string;
  heroQuirk?: string;
  buyerRelationship?: string;
  occasion?: string;
  previousSummary?: string;
}) {
  return [
    `Write a short customer-facing picture book concept for ${childName}.`,
    `Use one concrete premise and one primary personalized detail. Do not list traits or interests.`,
    `Treat personality as private behavior direction only, not visible adjectives.`,
    `Write ${STORY_LENGTH.min}-${STORY_LENGTH.max} words, target ${STORY_LENGTH.target}.`,
    `Child: ${childName}, ${ageBand}`,
    genre ? `Genre: ${genre}` : "",
    mood ? `Mood: ${mood}` : "",
    lesson ? `Theme: ${lesson}` : "",
    interestsLine ? `Optional background interests: ${interestsLine}` : "",
    personalityLine ? `Private behavior direction only: ${personalityLine}` : "",
    specialThing ? `Optional special thing: ${specialThing}` : "",
    supportingLine ? `Optional supporting characters: ${supportingLine}` : "",
    heroQuirk ? `Appearance/signature detail: ${heroQuirk}` : "",
    buyerRelationship ? `Buyer relationship: ${buyerRelationship}` : "",
    occasion ? `Occasion: ${occasion}` : "",
    previousSummary ? `Previous summary to avoid repeating: ${previousSummary}` : "",
  ].filter(Boolean).join("\n");
}

export const TITLE_RETRY_INSTRUCTION = (badTitle: string, childFirstName: string) =>
  `The title "${badTitle}" incorrectly includes the child's name (${childFirstName}). Rewrite the title without any first name or possessive name. Use a concrete object, place, or funny problem instead.`;

// =============================================================================
//  COVER + IMAGE PROMPTS
// =============================================================================

export type PortraitPose = "front" | "side" | "action";

export function COVER_PROMPT_TEMPLATE({
  title,
  summary,
  childName,
  protoDesc,
  styleHint,
  hasCharacterPortrait,
}: {
  title: string;
  summary: string;
  childName: string;
  protoDesc: string;
  styleHint: string;
  hasCharacterPortrait?: boolean;
}) {
  return [
    `${styleHint}.`,
    `Create a polished 2:3 children's book cover illustration.`,
    `Title to render exactly: "${title}". Render no other text, no author line, no labels.`,
    `Hero: ${childName}${protoDesc ? ` — ${protoDesc}` : ""}.`,
    hasCharacterPortrait
      ? "Use the attached character portrait as the canonical likeness and outfit reference."
      : "Use attached photos, if provided, only for likeness and broad outfit direction.",
    summary ? `Story concept: ${summary}` : "",
    "Composition: single clear hero focal point, charming cover-ready staging, readable silhouette, no supporting characters unless explicitly required by the concept.",
  ].filter(Boolean).join("\n");
}

export function CHARACTER_PORTRAIT_PROMPT_TEMPLATE({
  childName,
  protoDesc,
  styleHint,
  heroPhotoCount,
  pose,
  interestPhrase,
  hasAnchorPortrait,
}: {
  childName: string;
  protoDesc: string;
  styleHint: string;
  heroPhotoCount: number;
  pose: PortraitPose;
  interestPhrase?: string;
  hasAnchorPortrait?: boolean;
}) {
  const poseCue = pose === "front"
    ? "front-facing neutral character turnaround pose"
    : pose === "side"
      ? "three-quarter side pose with clear face and body proportions"
      : "gentle action pose, expressive but still character-reference clean";
  return [
    `${styleHint}.`,
    `Create a 2:3 full-body character portrait for a children's book.`,
    `Character: ${childName}${protoDesc ? ` — ${protoDesc}` : ""}.`,
    `Pose: ${poseCue}.`,
    hasAnchorPortrait
      ? "Use Image #1 as canonical character design, face, hair, proportions, and outfit. Use the additional photo only to support likeness."
      : heroPhotoCount > 0
        ? "Use attached photos for likeness. Choose one practical, repeatable book outfit and keep it visually simple."
        : "Design a consistent, practical book outfit that can repeat across every page.",
    interestPhrase ? `Subtle interest hint only if natural: ${interestPhrase}.` : "",
    "Plain clean background. No text. No extra characters. Preserve outfit consistency.",
  ].filter(Boolean).join("\n");
}

// =============================================================================
//  FULL BOOK ENGINE TYPES + HELPERS
// =============================================================================

export type FrameworkId =
  | "curiosity_journey"
  | "bedtime_wind_down"
  | "brave_choice"
  | "generous_heart"
  | "silly_escalation";

export type AgeBand = "0-2" | "3-5" | "6-8" | "9-12";

export interface Pronouns { subject: string; object: string; possessive: string; reflexive: string }

export interface BookEngineInput {
  child_name: string;
  age: number;
  gender: "he" | "she" | "they";
  hero_pronouns: Pronouns;
  appearance?: string;
  traits: string[];
  interests: string[];
  value: "courage" | "kindness" | "resilience" | "friendship" | "curiosity" | "self_confidence" | "sharing" | "nature" | "empathy" | "just_for_fun";
  genre: string;
  mood_tags: string[];
  supporting_cast: Array<{ name: string; role: "character" | "companion"; description?: string }>;
  special_item?: string;
  art_style?: string;
  buyer_relationship?: string;
  occasion?: string;
  include_belongs_to_page?: boolean;
  things_already_good_at?: string;
  things_currently_tricky?: string;
  recent_meaningful_moment?: string;
}

export interface KernelVars {
  child_name: string;
  hero_pronouns: Pronouns;
  age_band: AgeBand;
  vocab_tier: string;
  value: BookEngineInput["value"];
  value_label: string;
  genre: string;
  mood_tags: string[];
  mood_label: string;
  interests: string;
  special_item?: string;
  cast_summary: string;
  buyer_relationship: string;
  occasion: string;
  things_already_good_at?: string;
  things_currently_tricky?: string;
  recent_meaningful_moment?: string;
  bedtime_setting_modifier?: boolean;
  word_count_target: string;
  spread_count: number;
  include_belongs_to_page?: boolean;
}

export interface RawBookPage {
  page_number: number;
  role: "title" | "dedication" | "story";
  spread_index?: number;
  story_beat?: "opening" | "rising" | "turn" | "climax" | "resolution" | "closing";
  layout_id: string;
  text: string;
  image_scene?: string;
  setting?: string;
  mood?: string;
  characters?: string[];
}

export interface BookPageV2 extends RawBookPage { image_prompt: string | null; text_placement?: TextPlacement }

export interface BookOutputV2 {
  schema_version: "v2";
  meta: {
    title: string;
    framework_id: FrameworkId;
    word_count_total: number;
    page_count: number;
    age_band: AgeBand;
    art_style: string | null;
    repeating_phrase?: string;
    book_outfit?: string;
    generated_at: string;
    model: string;
    prompt_version: string;
    generation_time_ms: number;
  };
  cover: { title: string; subtitle?: string; image_prompt: string };
  pages: BookPageV2[];
}

export const STORY_LENGTH_BOOK = { totalPageCount: 32, pageCount: 30 } as const;

export const VOCAB_TIER_BY_AGE: Record<AgeBand, string> = {
  "0-2": "very simple, rhythmic, concrete words",
  "3-5": "simple picture-book language with gentle repetition",
  "6-8": "clear early-reader sentences with vivid verbs",
  "9-12": "richer picture-book language with emotional precision, still concise",
};

export const BUYER_RELATIONSHIP_LABEL: Record<string, string> = { mom: "mom", dad: "dad", parent: "parent", grandma: "grandma", grandpa: "grandpa", aunt: "aunt", uncle: "uncle", friend: "family friend" };
export const OCCASION_LABEL: Record<string, string> = { birthday: "birthday", christmas: "Christmas", holiday: "holiday", bedtime: "bedtime", "just-because": "just because", just_because: "just because" };

export function ageToBand(age: number): AgeBand {
  if (age <= 2) return "0-2";
  if (age <= 5) return "3-5";
  if (age <= 8) return "6-8";
  return "9-12";
}

export function pronounsFor(gender: "he" | "she" | "they" | string | undefined): Pronouns {
  if (gender === "he") return { subject: "he", object: "him", possessive: "his", reflexive: "himself" };
  if (gender === "she") return { subject: "she", object: "her", possessive: "her", reflexive: "herself" };
  return { subject: "they", object: "them", possessive: "their", reflexive: "themself" };
}

export function grammaticalJoin(items: string[]): string {
  const clean = (items || []).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

export function formatCastSummary(cast: BookEngineInput["supporting_cast"] = []): string {
  if (!cast.length) return "no supporting cast required unless the story needs one";
  return cast.map((c) => `${c.name} (${c.role}${c.description ? ` — ${c.description}` : ""})`).join("; ");
}

export function bookWordTotalRange(ageBand: AgeBand): { min: number; max: number } {
  if (ageBand === "0-2") return { min: 250, max: 450 };
  if (ageBand === "3-5") return { min: 400, max: 700 };
  if (ageBand === "6-8") return { min: 650, max: 1000 };
  return { min: 850, max: 1300 };
}

export function countWords(text: string | undefined): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

export function buildAppearanceBlocks(brief: any): { hero: { description: string }; supporting: string } {
  const childName = brief.child?.name || "the child";
  const proto = brief.protagonist || {};
  const app = proto.appearance || {};
  const heroBits = [childName, proto.age && `age ${proto.age}`, proto.gender, app.hairColor && `${app.hairColor} hair`, app.hairStyle && `${app.hairStyle} hair style`, app.skinTone && `${app.skinTone} skin tone`, app.glasses && "glasses", app.features, proto.special && `signature detail: ${proto.special}`].filter(Boolean);
  const supporting = (brief.supportingCharacters || []).map((c: any) => [c.name, c.relationship, c.description].filter(Boolean).join(" — ")).filter(Boolean).join("; ");
  return { hero: { description: heroBits.join(", ") || childName }, supporting };
}

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n));
}

export function selectFramework(ctx: { value?: string; genre?: string; mood_tags?: string[]; lesson?: string; interestsLine?: string; personalityLine?: string; thingsCurrentlyTricky?: string }): FrameworkId {
  const combined = [ctx.value, ctx.genre, ctx.lesson, ctx.interestsLine, ctx.personalityLine, ctx.thingsCurrentlyTricky, ...(ctx.mood_tags || [])].filter(Boolean).join(" ").toLowerCase();
  if (includesAny(combined, ["bedtime", "sleep", "calm", "wind down", "rest"])) return "bedtime_wind_down";
  if (includesAny(combined, ["funny", "silly", "goofy", "playful", "humor", "comedy", "joke", "chaos", "ridiculous", "robot", "robots", "machine", "dinosaur", "vehicle"])) return "silly_escalation";
  if (includesAny(combined, ["confidence", "self-confidence", "self_confidence", "brave", "courage", "resilience", "anxiety", "trying", "hard", "ask for help", "asking for help", "apologizing", "apologize"])) return "brave_choice";
  if (includesAny(combined, ["kind", "kindness", "share", "sharing", "generous", "empathy", "friendship", "making friends", "helping others", "belonging"])) return "generous_heart";
  return "curiosity_journey";
}

export const STORY_FRAMEWORKS: Record<FrameworkId, (vars: KernelVars) => string> = {
  curiosity_journey: (v) => `Framework: Curiosity Journey. ${v.child_name} follows one concrete clue into linked discoveries. Keep stakes safe, wondrous, and emotionally clear. End with larger understanding, not a lecture.`,
  bedtime_wind_down: () => "Framework: Bedtime Wind-Down. The story softens scene by scene through sound, light, texture, and familiar objects. Keep conflict tiny and comforting. End with rest and love.",
  brave_choice: (v) => `Framework: Brave Choice. ${v.child_name} faces one hard-but-safe challenge. Do not make the obstacle something already listed as a strength. The brave action should be specific and child-led.`,
  generous_heart: (v) => `Framework: Generous Heart. ${v.child_name} notices a need and makes room for someone else in a concrete way. Avoid moralizing. The generous choice should cost attention, control, spotlight, comfort, or time.`,
  silly_escalation: () => "Framework: Silly Escalation. Start with one absurd premise and let it escalate through funny cause-and-effect. Keep the pace read-aloud friendly and resolve with a simple reversal or practical choice.",
};

export const STORY_WRITING_RULES = [
  "WRITING RULES (apply to every story page):",
  "1. Content safety: no profanity, no nudity or sexual content of any kind, no crude or bathroom humor, no scary imagery beyond age-appropriate mild tension, no violence beyond gentle cartoon slapstick suitable for the age band.",
  "2. Age appropriateness: vocabulary, sentence length, themes, emotional intensity, and humor must match the given age band. Romance, death-as-plot, real-world hazards, and complex moral ambiguity are off-limits for under-6 and only allowed for older bands if directly required by the chosen value.",
  "3. Gifter / occasion neutrality: buyer relationship and occasion are internal metadata only. They must NOT appear in story text, must NOT shape the plot, setting, or characters, and must NOT be referenced in the dedication beyond a single soft mention if a belongs-to page is requested.",
  "4. Interests = seasoning, present but not dominant: the chosen framework owns the plot arc; interests never drive the main conflict, resolution, or structure. Every listed interest should appear at least once across the 30 story pages as flavor (setting detail, supporting character, prop, sensory beat, background activity). Appearance is natural and uneven — not every page needs an interest, weights don't have to be equal, and an interest should be skipped on any page where it doesn't fit rather than forced in. Interests flavor the world AROUND the characters — they must NOT be painted onto the characters themselves. Do not put interests on a character's clothing, accessories, hair, jewelry, named pets, or chosen name, and do not make their bedroom decor or default outfit a themed costume of their interest (a dinosaur-loving child does not wear a dinosaur shirt by default; a space-loving child does not wear rocket pajamas as their standard outfit). Characters keep the appearance defined in their profile; interests show up through what they encounter, notice, or do, not through costume. Interests change the texture of the world, not the shape of the story or the look of the characters.",
].join("\n");

export function STORY_KERNEL(vars: KernelVars): string {
  return [
    "You are writing a personalized children's picture book as structured JSON through the required tool.",
    `Child: ${vars.child_name}. Age band: ${vars.age_band}. Vocabulary: ${vars.vocab_tier}.`,
    `Pronouns: ${vars.hero_pronouns.subject}/${vars.hero_pronouns.object}/${vars.hero_pronouns.possessive}.`,
    `Theme/value: ${vars.value_label}. Genre: ${vars.genre}. Mood: ${vars.mood_label}.`,
    `Interests are seasoning — present somewhere across the 30 pages but never plot drivers. See writing rules. Interests: ${vars.interests}.`,
    vars.special_item ? `Special item/companion: ${vars.special_item}.` : "",
    `Supporting cast: ${vars.cast_summary}.`,
    vars.things_already_good_at ? `Already good at: ${vars.things_already_good_at}. Do not make this the weakness.` : "",
    vars.things_currently_tricky ? `Currently tricky: ${vars.things_currently_tricky}. This can inform the emotional choice.` : "",
    vars.recent_meaningful_moment ? `Recent meaningful moment: ${vars.recent_meaningful_moment}.` : "",
    `Write exactly ${STORY_LENGTH_BOOK.totalPageCount} pages: page 1 title, page 2 dedication, pages 3-32 story.`,
    `Story text total should be around ${vars.word_count_target} words across the 30 story pages.`,
    "Do not explain the moral. Show growth through action. Do not list wizard inputs. Keep character agency with the child.",
    STORY_WRITING_RULES,
  ].filter(Boolean).join("\n");
}

export function buildBookJsonSchema(): any {
  return {
    type: "object",
    additionalProperties: false,
    required: ["meta", "cover", "pages"],
    properties: {
      meta: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: {
          title: { type: "string" },
          repeating_phrase: { type: "string" },
          book_outfit: { type: "string" },
        },
      },
      cover: {
        type: "object",
        additionalProperties: false,
        required: ["title", "image_scene"],
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          image_scene: { type: "string" },
          setting: { type: "string" },
          mood: { type: "string" },
        },
      },
      pages: {
        type: "array",
        minItems: STORY_LENGTH_BOOK.totalPageCount,
        maxItems: STORY_LENGTH_BOOK.totalPageCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["page_number", "role", "layout_id", "text"],
          properties: {
            page_number: { type: "integer", minimum: 1, maximum: STORY_LENGTH_BOOK.totalPageCount },
            role: { type: "string", enum: ["title", "dedication", "story"] },
            spread_index: { type: "integer" },
            story_beat: { type: "string", enum: ["opening", "rising", "turn", "climax", "resolution", "closing"] },
            layout_id: { type: "string", enum: allLayoutIds() },
            text: { type: "string" },
            image_scene: { type: "string" },
            setting: { type: "string" },
            mood: { type: "string" },
            characters: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };
}

export function buildBookUserMessageV2({ age_band, include_belongs_to_page, buyer_relationship_label, occasion_label, child_name }: { age_band: AgeBand; include_belongs_to_page?: boolean; buyer_relationship_label: string; occasion_label: string; child_name: string }) {
  return [
    "Return the complete book JSON using the tool schema.",
    `Child name: ${child_name}. Age band: ${age_band}.`,
    `Dedication/keepsake context: from ${buyer_relationship_label}; occasion ${occasion_label}.`,
    "Buyer relationship and occasion are for the dedication only — they must not influence story pages 3–32 in any way.",
    include_belongs_to_page ? "Include a gentle belongs-to style dedication on page 2." : "Use page 2 as a short dedication/intro page.",
    "Layout registry for story pages:",
    serializeLayoutRegistryForPrompt(),
    "Use varied layouts from the registry. Page text must be short enough for picture-book overlay. Do not write text inside image_scene.",
  ].join("\n");
}

export function parseBookPagesOutput(rawArgs: string): { meta: { title: string; repeating_phrase?: string; book_outfit?: string }; cover: { title: string; subtitle?: string; image_scene?: string; setting?: string; mood?: string }; pages: RawBookPage[] } {
  const parsed = JSON.parse(rawArgs);
  if (!parsed || typeof parsed !== "object") throw new Error("Book payload was not an object.");
  if (!parsed.meta || !parsed.cover || !Array.isArray(parsed.pages)) throw new Error("Book payload missing meta, cover, or pages.");
  return parsed;
}

export function buildPageImagePrompt(page: RawBookPage, appearance: { hero: { description: string }; supporting: string }, artStyleFragment: string, bookOutfit?: string): string {
  const layout = getLayout(page.layout_id) || PAGE_LAYOUTS.find((l) => l.id === "text-bottom-third") || PAGE_LAYOUTS[0];
  const heroDesc = bookOutfit ? `${appearance.hero.description}, wearing ${bookOutfit}` : appearance.hero.description;
  return [
    `${artStyleFragment}.`,
    `Interior illustration for page ${page.page_number} of a personalized children's picture book.`,
    `Character consistency: main child must match this description on every page: ${heroDesc}.`,
    appearance.supporting ? `Supporting character reference descriptions: ${appearance.supporting}.` : "",
    page.characters?.length ? `Characters in scene: ${page.characters.join(", ")}.` : "",
    page.image_scene ? `Scene: ${page.image_scene}.` : "",
    page.setting ? `Setting: ${page.setting}.` : "",
    page.mood ? `Mood: ${page.mood}.` : "",
    `Composition/layout: ${layout.compositionCue}`,
    "Square 1:1 canvas, 2K. Leave the reserved text-safe area genuinely open and uncluttered. No letters, captions, signs, labels, or readable text anywhere in the artwork.",
  ].filter(Boolean).join("\n");
}

export function validateBook(book: BookOutputV2, input: BookEngineInput): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!book.pages || book.pages.length !== STORY_LENGTH_BOOK.totalPageCount) warnings.push(`Expected ${STORY_LENGTH_BOOK.totalPageCount} pages, got ${book.pages?.length || 0}.`);
  const storyPages = (book.pages || []).filter((p) => p.role === "story");
  if (storyPages.length !== STORY_LENGTH_BOOK.pageCount) warnings.push(`Expected ${STORY_LENGTH_BOOK.pageCount} story pages, got ${storyPages.length}.`);
  if (!book.meta?.title) warnings.push("Missing title.");
  if (input.child_name && book.meta?.title?.toLowerCase().includes(input.child_name.toLowerCase())) warnings.push("Title includes child name; consider revising.");
  for (const p of book.pages || []) {
    if (!p.layout_id || !allLayoutIds().includes(p.layout_id)) warnings.push(`Page ${p.page_number} uses unknown layout_id ${p.layout_id}.`);
    if (p.role === "story" && !p.text?.trim()) warnings.push(`Page ${p.page_number} story text is empty.`);
  }
  return { valid: warnings.length === 0, warnings };
}
