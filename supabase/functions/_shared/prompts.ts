// =============================================================================
//  PROMPT CONFIG — single source of truth for every AI prompt in the app.
// =============================================================================
//
//  Tweak any string in here to change the behavior for ALL users on the next
//  deploy. Both edge functions (generate-summary, generate-cover) import from
//  this file. Nothing else in the project should hardcode prompt text.
//
//  Tips:
//   - Keep instructions short and imperative ("Do X", "Never Y").
//   - Don't remove the rules marked "DON'T BREAK" — they prevent regressions
//     (the title-name retry, the no-text-on-cover rules, etc.).
//   - Art-style fragments are duplicated in src/lib/artStyles.ts because the
//     frontend picker needs them too. Keep them in sync by hand.
// =============================================================================

// ---- Models -----------------------------------------------------------------
// Swap to upgrade/downgrade. Keep cover on a multimodal image model.
export const MODELS = {
  summary: "openai/gpt-5-mini",
  cover: "google/gemini-3-pro-image-preview",
  // Full-book engine. Long context + strong reasoning. Swappable to
  // "anthropic/claude-sonnet-4-5" once an Anthropic key is wired in.
  book: "google/gemini-2.5-pro",
} as const;

// ---- Summary length knobs (Step 9 summary ONLY — not the full book) --------
// The full-book engine has its own length config (STORY_LENGTH_BOOK + the
// perPageWordBounds helper, both lower in this file). Don't conflate them.
export const STORY_LENGTH = {
  min: 80,
  target: 100,
  max: 130,
} as const;


// ---- Art style fragments ----------------------------------------------------
// Verbatim style descriptors fed to the cover image model. The frontend
// picker (src/lib/artStyles.ts) carries the same strings so the preview the
// user sees matches the cover they get. Edit both places when changing.
export const ART_STYLE_PROMPTS: Record<string, string> = {
  watercolor:
    "soft watercolor children's book illustration, hand-painted texture, gentle washes, warm muted palette, paper grain visible, classic storybook feel",
  "cozy-sketch":
    "charming hand-drawn children's book illustration, visible pencil and ink linework, light watercolor wash fill, warm earthy tones, sketchbook feel",
  "bold-bright":
    "modern vibrant children's book illustration, bold black outlines, flat saturated colors, playful punchy palette, contemporary cartoon style",
  "dreamy-pastel":
    "dreamy pastel children's book illustration, soft glowing light, gentle pinks lavenders and creams, ethereal and calm, bedtime story feel",
};

export function getArtStylePrompt(value: string | undefined): string {
  return (
    (value && ART_STYLE_PROMPTS[value]) || ART_STYLE_PROMPTS.watercolor
  );
}

// =============================================================================
//  STORY SUMMARY — generate-summary edge function
// =============================================================================

// System message for the summary model. Must keep the "always call the tool"
// instruction or structured output breaks.
export const STORY_SYSTEM_PROMPT =
  "You write personalized children's book summaries. Always call the provided tool to return your output — never reply in plain text.";

export interface StoryPromptCtx {
  childName: string;
  ageBand: string;
  gender?: string;
  /** Story output language (e.g. "english", "español"). */
  language?: string;
  genre?: string;
  mood?: string;
  lesson?: string;
  /** Pre-joined "interest1, interest2, …". */
  interestsLine?: string;
  /** Pre-joined "trait1, trait2, …" describing the hero's personality. */
  personalityLine?: string;
  /** Pre-joined "Name (relationship) — trait, trait. Description." */
  supportingLine?: string;
  /** Pre-joined detailed special-thing line, e.g.
   *  "stuffed-animal — bear named Floppy, purple with a pink belly". */
  specialThing?: string;
  /** Free-text appearance quirk for the hero (e.g. "lost a front tooth"). */
  heroQuirk?: string;
  /** Previous summary text when user asked for a refresh. */
  previousSummary?: string;
}

// Builds the user prompt for the summary model.
// DON'T BREAK: the "NEVER include the child's name in the title" rule — the
// retry loop in generate-summary depends on the model trying to obey it.
export function STORY_USER_TEMPLATE(ctx: StoryPromptCtx): string {
  const {
    childName,
    ageBand,
    gender,
    language,
    genre,
    mood,
    lesson,
    interestsLine,
    personalityLine,
    supportingLine,
    specialThing,
    heroQuirk,
    previousSummary,
  } = ctx;

  const langLabel = (language || "").trim().toLowerCase();
  const langLine =
    langLabel && langLabel !== "english"
      ? `Write the title AND the summary in ${language}. Do not include any English.`
      : "";

  return [
    `Write a single, complete story summary for a personalized children's book.`,
    ``,
    `Hero: ${childName} (age band: ${ageBand})${gender ? `, gender: ${gender}` : ""}`,
    personalityLine ? `Hero's personality: ${personalityLine}` : "",
    heroQuirk ? `Hero's signature detail: ${heroQuirk}` : "",
    genre ? `Genre: ${genre}` : "",
    mood ? `Mood: ${mood}` : "",
    lesson ? `Lesson / theme: ${lesson}` : "",
    interestsLine ? `Interests woven in: ${interestsLine}` : "",
    supportingLine ? `Supporting characters: ${supportingLine}` : "",
    specialThing ? `Special object/companion to feature: ${specialThing}` : "",
    ``,
    `Requirements:`,
    `- Title: short, warm, kid-appropriate (≤ 60 chars). NEVER include the child's name (${childName}) or any first name in the title — focus on the adventure, object, place, or theme instead.`,
    `- Summary: ONE paragraph, target ~${STORY_LENGTH.target} words (hard min ${STORY_LENGTH.min}, hard max ${STORY_LENGTH.max}).`,
    `- Use ${childName}'s name as the hero IN THE SUMMARY ONLY. Mention supporting characters by name where natural.`,
    `- Reflect the hero's personality traits in their actions and choices.`,
    `- Weave at least one of the listed interests naturally into the plot.`,
    specialThing ? `- Give the special object/companion a meaningful cameo.` : "",
    `- Voice: warm, gentle, magical — like a parent reading aloud.`,
    `- Hint at the lesson; do NOT spoil the ending.`,
    `- No headings, no bullet lists, no quotation marks around the summary.`,
    langLine,
    previousSummary
      ? `\nThe previous attempt is below — write something distinctly DIFFERENT (different setting, twist, or framing). Do not repeat its opening line.\nPrevious:\n${previousSummary}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}


// Re-prompt nudge when the model returns a title containing the child's name.
// DON'T BREAK: the function loops up to 3 times with this feedback.
export function TITLE_RETRY_INSTRUCTION(
  badTitle: string,
  firstName: string,
): string {
  return `Your previous title was: "${badTitle}". It violated the rule because it contains the child's first name${firstName ? ` "${firstName}"` : ""}. Generate a NEW title that does NOT contain any first names — focus on the adventure, object, place, theme, or feeling instead. Keep the same summary style.`;
}

// =============================================================================
//  COVER ART — generate-cover edge function
// =============================================================================

export interface CoverPromptCtx {
  title: string;
  summary: string;
  childName: string;
  /** Pre-joined "hair: brown, skin: medium, …". May be empty. */
  protoDesc: string;
  /** Style fragment from ART_STYLE_PROMPTS. */
  styleHint: string;
  /** True if a style reference image is attached. */
  hasStyleReference: boolean;
  /** True if a previously-rendered character portrait is attached as the
   *  canonical likeness anchor (preferred over raw photos). */
  hasCharacterPortrait?: boolean;
  /** Number of hero likeness photos attached (0 if none). */
  heroPhotoCount: number;
}

// Builds the cover image prompt.
// DON'T BREAK:
//  - The "no visible name on the cover" and "no author byline" rules
//    (Step 11 renders "written for: <child>" client-side instead).
//  - HERO ONLY: the cover features just the hero child in a scene from the
//    story. Supporting characters NEVER appear on the cover.
//
// Image order MUST match: [styleRef?] [characterPortrait?] [heroPhotos…]
export function COVER_PROMPT_TEMPLATE(ctx: CoverPromptCtx): string {
  const {
    title, summary, childName, protoDesc, styleHint,
    hasStyleReference, hasCharacterPortrait, heroPhotoCount,
  } = ctx;

  const refParts: string[] = [];
  let pos = 0;
  if (hasStyleReference) {
    pos++;
    refParts.push(
      `Image #${pos} is a STYLE REFERENCE — match its illustration technique, line quality, color palette, and finish. Do NOT copy its subject, pose, or composition; only mimic its style.`,
    );
  }
  if (hasCharacterPortrait) {
    pos++;
    refParts.push(
      `Image #${pos} is the CANONICAL CHARACTER REFERENCE — a prior rendition of the hero in this exact art style. Match this rendition of ${childName} faithfully (face, hair, skin tone, body shape, outfit). This is the PRIMARY likeness source; any photos below are only supplemental cues.`,
    );
  }
  if (heroPhotoCount > 0) {
    const start = pos + 1;
    const end = pos + heroPhotoCount;
    const role = hasCharacterPortrait ? "SUPPLEMENTAL likeness cues" : "LIKENESS REFERENCES";
    refParts.push(
      heroPhotoCount === 1
        ? `Image #${start} contains ${role} for the hero child (face shape, hair, skin tone). Render them in the chosen art style — not photo-realistically. Keep it kind, warm, and age-appropriate.`
        : `Images #${start}–#${end} contain ${role} for the hero child from different angles. Render in the chosen art style — not photo-realistically.`,
    );
  }

  return [
    `Children's book cover illustration in ${styleHint}.`,
    ...refParts,
    `Title to display on the cover: "${title}". Render this title text exactly as given — do NOT add the child's name or any first name to the title.`,
    `Subject: ONLY the hero child — ${childName} — alone in a single evocative scene drawn from the story. Do NOT depict any other people, friends, family members, pets, or supporting characters; the cover features the hero solo.${protoDesc ? ` Character details — ${protoDesc}.` : ""}`,
    `Scene inspired by: ${summary.slice(0, 600)}`,
    `Composition: square format (1:1), the title clearly readable across the upper third or centered, with comfortable margin on all four sides, no extra text, no author byline, no watermarks. Do NOT include "${childName}" or any name as visible text on the cover.`,
    `Tone: magical, hopeful, suitable for young children.`,
  ].filter(Boolean).join(" ");
}

// =============================================================================
//  CHARACTER PORTRAIT — generate-character-portrait edge function
// =============================================================================
//
// Renders a single canonical full-body portrait of the protagonist in the
// chosen art style. Fired in the background as soon as the user uploads
// their first photo on the character step. Result is shown above the story
// summary AND passed to generate-cover as the primary likeness anchor so
// the cover matches the rendition the user has already accepted.

export type PortraitPose = "front" | "side" | "action";

export interface CharacterPortraitCtx {
  childName: string;
  protoDesc: string;
  styleHint: string;
  heroPhotoCount: number;
  pose?: PortraitPose;
  /** Optional: short interest phrase to flavor the "action" pose. */
  interestPhrase?: string;
  /** Whether an anchor portrait (Image #1) is attached as the canonical
   *  appearance reference. When true, alt photos are treated as
   *  supplemental likeness cues only. */
  hasAnchorPortrait?: boolean;
}

export function CHARACTER_PORTRAIT_PROMPT_TEMPLATE(
  ctx: CharacterPortraitCtx,
): string {
  const {
    childName,
    protoDesc,
    styleHint,
    heroPhotoCount,
    pose = "front",
    interestPhrase,
    hasAnchorPortrait,
  } = ctx;

  const poseLine = pose === "side"
    ? `Pose: a relaxed 3/4 side turn, full body visible head to toe, weight on one leg, looking gently toward the camera. Keep the same outfit, hair, and proportions as the anchor reference.`
    : pose === "action"
      ? `Pose: a mid-motion expressive action pose${interestPhrase ? ` inspired by ${interestPhrase}` : ""} — full body visible, dynamic but grounded, joyful expression. Keep the same outfit, hair, and proportions as the anchor reference.`
      : `Pose: standing, facing the viewer in a relaxed neutral pose, full body visible head to toe.`;

  const anchorLine = hasAnchorPortrait
    ? `Image #1 is the CANONICAL CHARACTER REFERENCE — match the exact face, hair, body, and outfit shown there. Any other attached photos are only supplemental likeness cues.`
    : "";

  // HARD likeness rules — placed BEFORE the style hint so style cannot
  // override them. Cartoon defaults (brown hair, generic skin) routinely
  // win over soft "reference" wording, so we make this a non-negotiable
  // constraint with explicit do-nots.
  const likenessLine = hasAnchorPortrait
    ? ""
    : heroPhotoCount === 0
      ? ""
      : heroPhotoCount === 1
        ? `CRITICAL — the attached photo is the CANONICAL LIKENESS for the hero child. You MUST preserve, exactly as shown in the photo: hair color, hair length and shape, skin tone, eye color, eyebrow color, face shape, and any distinguishing features (freckles, dimples, gap teeth, etc.). Stylize ONLY the rendering. Do NOT change hair color (e.g. do not default to brown if the child is blonde). Do NOT change skin tone. Do NOT add or remove glasses unless shown in the photo. Do NOT invent traits that are not in the photo.`
        : `CRITICAL — the attached photos are the CANONICAL LIKENESS for the hero child from multiple angles. You MUST preserve, exactly as shown in the photos: hair color, hair length and shape, skin tone, eye color, eyebrow color, face shape, and any distinguishing features. Stylize ONLY the rendering. Do NOT change hair color, skin tone, or eye color. Do NOT add or remove glasses unless shown. Do NOT invent traits that are not in the photos.`;

  const outfitLine = hasAnchorPortrait
    ? `Outfit: REUSE the exact outfit from the anchor reference (Image #1).`
    : heroPhotoCount >= 1
      ? `Outfit: recreate the outfit visible in the photo (jacket, shirt, pants, shoes — match colors and silhouette) in the chosen art style. This outfit becomes iconic and will be reused on the cover and inside the book.`
      : `Choose a single charming outfit appropriate for the child's age and personality — this outfit should feel iconic and could be reused on the cover and inside the book.`;

  return [
    // Likeness rules FIRST so they outrank the style hint that follows.
    anchorLine,
    likenessLine,
    `Subject: ONLY the hero child — ${childName} — alone.${protoDesc ? ` Confirmed character details — ${protoDesc}. These details MUST match what's rendered.` : ""}`,
    `Full-body character portrait rendered in ${styleHint}.`,
    poseLine,
    outfitLine,
    `Background: plain soft cream/neutral background, no scenery, no props, no other characters.`,
    `Composition: portrait orientation (2:3), the child centered with comfortable margin on all sides.`,
    `No text, no title, no captions, no watermarks, no borders, no name labels.`,
    `Tone: kind, warm, age-appropriate.`,
  ].filter(Boolean).join(" ");
}

// =============================================================================
//  STORY ENGINE — generate-book edge function (full hardcover-book generation)
// =============================================================================
//
//  The KERNEL + 5 FRAMEWORK blocks below are ported VERBATIM (with light
//  TypeScript-template adaptations) from the Thistlebook Story Generation
//  Template authored by the product owner. Do not paraphrase — these
//  instructions encode hard-won quality rules. To tweak prompt behavior,
//  edit the strings in this file.
//
//  Adaptation note vs original brief:
//   - Brief expected Anthropic Claude Sonnet 4.5; we run on Lovable AI Gateway.
//     `MODELS.book` is the single swap point.
//   - Brief stored the template as a `.md` file; we embed it as TS so it
//     deploys atomically and is type-checked alongside the engine code.
//   - Brief specified Stage 3 validation + 2 retries; v1 ships with a stub
//     validator (`validateBook`) that always returns valid. Add real rules
//     when we see real failure modes in production.

// ---- Engine input shape -----------------------------------------------------
// This is the brief's `Order` shape, mapped from our wizard. Optional fields
// follow the brief; absent fields are skipped in the prompt.

export type FrameworkId =
  | "curiosity_journey"
  | "bedtime_wind_down"
  | "brave_choice"
  | "generous_heart"
  | "silly_escalation";

export interface SupportingCharacterIn {
  name: string;
  role: "character" | "companion";
  relationship?: string;
  age?: number;
  description?: string;
  personality_traits?: string[];
}

export interface BookEngineInput {
  // Identifiers (optional for v1 — no orders table)
  order_id?: string;

  // Recipient
  child_name: string;
  child_age: number;
  child_pronouns: "he" | "she" | "they";
  child_appearance_notes?: string | null;
  child_special?: string | null;
  personality_traits?: string[];

  // Buyer + occasion
  buyer_relationship?: "parent" | "grandparent" | "teacher" | "friend" | "other";
  occasion?:
    | "birthday" | "christmas" | "easter" | "new_sibling" | "first_day"
    | "graduation" | "baptism" | "just_because" | "other"
    | null;
  include_belongs_to_page: boolean;

  // Story spec
  genre:
    | "adventure" | "fantasy" | "sci_fi" | "mystery" | "everyday"
    | "bedtime" | "sports" | "fairy_tale" | "animals" | "superhero";
  mood_tags: string[];
  value:
    | "courage" | "kindness" | "resilience" | "friendship" | "curiosity"
    | "self_confidence" | "sharing" | "nature" | "empathy" | "just_for_fun";

  // World
  interests: string[];
  cameo_type?: string | null;
  cameo_detail?: string | null;

  // Cast
  supporting_cast?: SupportingCharacterIn[];

  // Style (passed through; not used by the text engine)
  art_style?: string;

  // Gap fields (template-supported, wizard does not yet collect)
  things_already_good_at?: string | null;
  things_currently_tricky?: string | null;
  recent_meaningful_moment?: string | null;

  // Forward-compat: refine loop hook (not used in v1)
  revision_note?: string | null;
}

// ---- Lookup tables (verbatim from the brief) -------------------------------

export type AgeBand = "0-2" | "3-4" | "5-6" | "7-8" | "9-10" | "11+";

export const WORD_COUNT_BY_AGE: Record<AgeBand, [number, number]> = {
  "0-2":  [50, 150],
  "3-4":  [150, 300],
  "5-6":  [300, 500],
  "7-8":  [400, 700],
  "9-10": [500, 800],
  "11+":  [600, 900],
};

export const VOCAB_TIER_BY_AGE: Record<AgeBand, "basic" | "simple" | "moderate" | "rich"> = {
  "0-2":  "basic",
  "3-4":  "simple",
  "5-6":  "moderate",
  "7-8":  "rich",
  "9-10": "rich",
  "11+":  "rich",
};

export const SPREAD_COUNT_BY_AGE_AND_FRAMEWORK: Record<AgeBand, Record<FrameworkId, number>> = {
  "0-2":  { curiosity_journey: 8,  bedtime_wind_down: 10, brave_choice: 8,  generous_heart: 8,  silly_escalation: 8  },
  "3-4":  { curiosity_journey: 10, bedtime_wind_down: 10, brave_choice: 10, generous_heart: 10, silly_escalation: 10 },
  "5-6":  { curiosity_journey: 12, bedtime_wind_down: 12, brave_choice: 12, generous_heart: 12, silly_escalation: 12 },
  "7-8":  { curiosity_journey: 12, bedtime_wind_down: 12, brave_choice: 12, generous_heart: 12, silly_escalation: 12 },
  "9-10": { curiosity_journey: 14, bedtime_wind_down: 12, brave_choice: 14, generous_heart: 14, silly_escalation: 12 },
  "11+":  { curiosity_journey: 14, bedtime_wind_down: 12, brave_choice: 14, generous_heart: 14, silly_escalation: 12 },
};

export function ageToBand(age: number): AgeBand {
  if (age <= 2) return "0-2";
  if (age <= 4) return "3-4";
  if (age <= 6) return "5-6";
  if (age <= 8) return "7-8";
  if (age <= 10) return "9-10";
  return "11+";
}

// ---- Framework selection (verbatim — value wins; bedtime is a setting modifier)

export function selectFramework(input: {
  value: BookEngineInput["value"];
  genre: BookEngineInput["genre"];
  mood_tags: string[];
}): FrameworkId {
  const { value, genre, mood_tags } = input;
  if (["courage", "resilience", "self_confidence"].includes(value)) return "brave_choice";
  if (["kindness", "sharing", "friendship", "empathy", "nature"].includes(value)) return "generous_heart";
  if (value === "just_for_fun" && mood_tags.includes("funny")) return "silly_escalation";
  if (genre === "bedtime") return "bedtime_wind_down";
  return "curiosity_journey";
}

// ---- Pronoun helpers (subject/object/possessive/Subject_capitalized) -------

export interface Pronouns {
  subject: string;            // she / he / they
  object: string;             // her / him / them
  possessive: string;         // her / his / their
  subject_capitalized: string; // She / He / They
}

export function pronounsFor(p: BookEngineInput["child_pronouns"]): Pronouns {
  if (p === "she") return { subject: "she", object: "her", possessive: "her", subject_capitalized: "She" };
  if (p === "he")  return { subject: "he",  object: "him", possessive: "his", subject_capitalized: "He"  };
  return            { subject: "they", object: "them", possessive: "their", subject_capitalized: "They" };
}

// ---- Small formatting helpers ----------------------------------------------

export function grammaticalJoin(items: string[]): string {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

export function formatCastSummary(cast: SupportingCharacterIn[] | undefined): string {
  if (!cast || cast.length === 0) return "";
  return cast
    .map((c) => {
      const name = c.name?.trim();
      const rel = c.relationship?.trim();
      const desc = c.description?.trim();
      const traits = (c.personality_traits || []).filter(Boolean).join(", ");
      const head = name && rel ? `${name} (${rel})` : name || rel || "";
      const tail = [desc, traits ? `personality: ${traits}` : ""].filter(Boolean).join(" — ");
      return head + (tail ? `: ${tail}` : "");
    })
    .filter(Boolean)
    .join("; ");
}

// ---- Variable bag (everything the templates substitute) --------------------

export interface KernelVars {
  child_name: string;
  child_age: number;
  child_pronouns: string;
  child_pronouns_subject: string;
  child_pronouns_object: string;
  child_pronouns_possessive: string;
  child_pronouns_subject_capitalized: string;
  buyer_relationship: string;
  personality_traits?: string;        // comma-joined
  child_special?: string;
  child_appearance_notes?: string;
  interest_phrase: string;
  cameo_detail?: string;
  cameo_type?: string;
  things_already_good_at?: string;
  things_currently_tricky?: string;
  recent_meaningful_moment?: string;
  cast_summary?: string;
  framework_id: FrameworkId;
  value: string;
  mood_tags: string;                  // comma-joined
  occasion: string;                   // human label, or "none specified"
  bedtime_setting_modifier: boolean;
  word_count_target: string;          // "X-Y"
  spread_count: number;
  vocab_tier: string;
  age_band: AgeBand;
  include_belongs_to_page: boolean;
}

// ---- The KERNEL (32-page V2 — page-based, no legacy text format) -----------

const ifBlock = (cond: unknown, body: string) => (cond ? body : "");

export function STORY_KERNEL(v: KernelVars): string {
  return `You are writing a personalized hardcover children's picture book for ${v.child_name}, age ${v.child_age}, who uses ${v.child_pronouns} pronouns. The book is being made by ${v.child_name}'s ${v.buyer_relationship} as a one-of-a-kind keepsake. ${v.child_name} is the hero of this story.

# Who ${v.child_name} is

- Name: ${v.child_name}
- Age: ${v.child_age}
- Pronouns: ${v.child_pronouns}
${ifBlock(v.personality_traits, `- Personality (must be shown through actions, never stated as adjectives): ${v.personality_traits}`)}
${ifBlock(v.child_special, `- What makes ${v.child_pronouns_subject} special: ${v.child_special}`)}
${ifBlock(v.child_appearance_notes, `- Appearance notes (use sparingly in prose; mostly handled in illustrations): ${v.child_appearance_notes}`)}
- Things ${v.child_pronouns_subject} loves: ${v.interest_phrase}
${ifBlock(v.cameo_detail, `- A specific detail to weave in meaningfully: ${v.cameo_detail}${v.cameo_type ? ` (${v.cameo_type})` : ""}`)}
${ifBlock(v.things_already_good_at, `- Things ${v.child_pronouns_subject} is ALREADY good at (do NOT make these the obstacle, brave moment, or new discovery — they would feel inauthentic): ${v.things_already_good_at}`)}
${ifBlock(v.things_currently_tricky, `- Things ${v.child_pronouns_subject} finds tricky right now (use this as the seed for the growth/brave/discovery moment if it fits the framework): ${v.things_currently_tricky}`)}
${ifBlock(v.recent_meaningful_moment, `- A recent meaningful moment to weave in if natural: ${v.recent_meaningful_moment}`)}

# Supporting cast

${v.cast_summary
  ? `${v.cast_summary}\n\nEach supporting character should appear in 2–6 pages across the book (more for primary co-stars, fewer for cameos). Pets, stuffed animals, and non-human companions don't speak in dialogue but can be present, react, and have personality through behavior. Human supporting characters can speak, but dialogue should be sparing — at most one short line per appearance.`
  : `This is a solo-protagonist story. No named supporting characters.`}

# Story spec

- Framework: ${v.framework_id}
- Emotional value to land on the final page: ${v.value}
- Mood: ${v.mood_tags}
- Occasion (use as light flavor only, never as central plot): ${v.occasion}
${ifBlock(v.bedtime_setting_modifier, `- BEDTIME SETTING MODIFIER: This story should be set at evening or night and end with ${v.child_name} going to sleep. The framework's structural beats remain unchanged — only the time-of-day setting and final scene are adjusted. The dedication's emotional value still lands.`)}
- Total word count target across the story pages: ${v.word_count_target} words (±10% tolerance)
- Story-page count: exactly ${v.spread_count} pages (the book also has a title page and a dedication page handled separately; you do not write those here)
- Vocabulary tier: ${v.vocab_tier}

# How to write ${v.child_name}

Personality is shown through ACTIONS, not adjectives. If ${v.child_name} is "fiery," do not write "${v.child_name} was fiery." Write what ${v.child_name} does that reveals fire — "${v.child_pronouns_subject} didn't hesitate. That wasn't ${v.child_pronouns_possessive} style." If ${v.child_name} is "curious," show ${v.child_pronouns_object} cataloging what ${v.child_pronouns_subject} sees, asking questions, looking closer. The reader should know who ${v.child_name} is from the way ${v.child_pronouns_subject} moves through the story, not from labels.

The growth/brave/discovery moment must be authentic to who ${v.child_name} actually is. If ${v.child_name} already rides horses, the brave moment cannot be "scared of a horse." If ${v.child_name} loves the dark, the brave moment cannot be "afraid of bedtime." Use the personality traits and the things-tricky/things-good-at fields to find a brave moment that's actually hard for THIS child specifically.

# Voice and prose rules

- Mandatory contractions throughout (it's, don't, wasn't). Uncontracted speech sounds robotic when read aloud.
- Never rhyme unless the framework specifically calls for it. Forced rhyme is the #1 quality killer in AI-generated children's books.
- Sentence length variation: mix short punchy sentences (3–6 words) with longer flowing ones (12–18 words). Never exceed 20 words in a sentence.
- Most pages end with a small hook — a question, a sound, an image — that drives the page turn. Quiet pages may settle and breathe; the final page lands, it does not hook.
- Vary page openings: don't start every page with "${v.child_name} did X." Use sensory hooks, sounds, dialogue, atmosphere.
- Use ${v.child_name}'s name with restraint at this length (30 story pages) — roughly once every 1–2 pages on average, and never twice in a single sentence. Pronouns carry most references.
- Use italics sparingly for emphasis (rendered in the final book as italic text).
- Use em dashes for narrative rhythm.
- Sprinkle a few ALL-CAPS words for emphasis in dialogue or thoughts only when it feels natural.

# Banned words

Never use any of these — they are dead words in AI-generated children's content and signal cheapness immediately:
- magical
- adventure (the word; adventure stories are fine, but never the word itself)
- wonderful
- journey
- special

# Authenticity rules

- Do NOT specify the child's geographic location, neighborhood, climate, or biome unless the customer provided it. Don't write "the field behind their house" when you don't know they have a field. Don't specify cottonwood trees, pine trees, palm trees, etc. unless told.
- Do NOT invent family members, pets, or details not provided by the customer.
- Do NOT assume the child is anything (rural, urban, only child, has siblings) unless the inputs say so.
- The story should work for any family — specific only where the inputs make it specific.

# Repeating phrase rules

A repeating phrase is the verbal "chorus" of the book — the line a kid will memorize and join in on. Every story must have one.

Rules:
- 5–8 words long
- Must contain a specific noun related to ${v.child_name}'s interests, the cameo, or the central question of the story
- Must be a question OR an exclamation, with a sensory word (sound, sight, smell, touch)
- Must sound natural for a ${v.child_age}-year-old to say or hear
- Across 30 story pages, appears 4–6 times, distributed across the arc (early, middle, near-end). It must NOT appear on every page.
- Should evolve or resolve on its final appearance — slight variation, or a payoff that answers the question

# Age calibration (${v.age_band}, ${v.vocab_tier})

Match ${v.child_age}-year-old vocabulary and sentence complexity. Refer to this table:

| Age | Total story words | Sentence length | Vocabulary |
|---|---|---|---|
| 0–2 | 50–150 | 1–4 words | Basic — sound words, names, simple actions; many image-only or 1–3 word pages |
| 3–4 | 150–300 | 4–8 words | Simple — rhyme, repetition, concrete nouns |
| 5–6 | 300–500 | 6–12 words | Moderate — adjectives, some dialogue, 1–2 new words |
| 7–8 | 400–700 | 8–15 words | Rich — compound sentences, emotional vocabulary, metaphor |
| 9–10 | 500–800 | up to 18 words | Rich — nuance, subtlety, more complex emotional terrain |
| 11+ | 600–900 | up to 20 words | Rich — coming-of-age tone okay, more sophisticated themes |

For ${v.child_age}: aim for ${v.word_count_target} TOTAL words across all ${v.spread_count} story pages. Per-page word bounds and per-page word targets are specified in the user message.

# What this book is FOR

This is a keepsake from ${v.buyer_relationship}. The dedication will be the line a parent reads to their child a hundred times. The final page is what the kid will remember years from now. Write toward that — every page earning the final emotional payload of ${v.value}.

# Output

Do NOT write a text-format response. You will be given a tool (\`return_book\`) in the user message; call it with the complete structured payload. The framework below tells you how to allocate beats across the ${v.spread_count} story pages.

Start planning the page-by-page beat allocation now.`;
}

// ---- Beat-spec system (page-count-agnostic framework structure) ------------
//
// Each framework declares its beats with a `weight` (relative share of the
// story). `allocateBeats` distributes the configured page count across beats
// using largest-remainder rounding, guaranteeing the totals match. The
// framework prose then renders the resulting page ranges inline so the model
// gets concrete "BEAT X: pages Y–Z" guidance regardless of total page count.

export interface BeatSpec {
  id: StoryBeat;
  label: string;
  weight: number;
  body: (v: KernelVars) => string;
}

export interface BeatAllocation {
  spec: BeatSpec;
  startPage: number;
  endPage: number;
  pageCount: number;
}

export function allocateBeats(
  beats: BeatSpec[],
  storyPageCount: number,
  firstStoryPage: number,
): BeatAllocation[] {
  const totalWeight = beats.reduce((s, b) => s + b.weight, 0);
  // Floor allocation + fractional remainder.
  const floors = beats.map((b) => {
    const raw = (b.weight / totalWeight) * storyPageCount;
    return { floor: Math.max(1, Math.floor(raw)), frac: raw - Math.floor(raw) };
  });
  let allocated = floors.reduce((s, f) => s + f.floor, 0);
  // Distribute leftover pages to the largest fractional remainders.
  const order = floors
    .map((f, i) => ({ i, frac: f.frac }))
    .sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (allocated < storyPageCount) {
    floors[order[idx % order.length].i].floor++;
    allocated++;
    idx++;
  }
  // If we over-allocated due to the min-1 floor, trim from the smallest weight.
  while (allocated > storyPageCount) {
    const smallest = beats
      .map((b, i) => ({ i, w: b.weight, count: floors[i].floor }))
      .filter((x) => x.count > 1)
      .sort((a, b) => a.w - b.w)[0];
    if (!smallest) break;
    floors[smallest.i].floor--;
    allocated--;
  }

  let cursor = firstStoryPage;
  return beats.map((spec, i) => {
    const count = floors[i].floor;
    const startPage = cursor;
    const endPage = cursor + count - 1;
    cursor = endPage + 1;
    return { spec, startPage, endPage, pageCount: count };
  });
}

function renderAllocationTable(alloc: BeatAllocation[]): string {
  const rows = alloc.map((a) => {
    const range = a.pageCount === 1 ? `page ${a.startPage}` : `pages ${a.startPage}–${a.endPage}`;
    return `- **${a.spec.label}** — ${range} (${a.pageCount} ${a.pageCount === 1 ? "page" : "pages"})`;
  });
  return rows.join("\n");
}

function renderFramework(
  title: string,
  intro: string,
  source: string,
  toneBlock: string,
  avoidBlock: string,
  beats: BeatSpec[],
  v: KernelVars,
): string {
  const storyPages = v.spread_count;
  const firstStoryPage = 3; // pages 1 = title, 2 = dedication
  const alloc = allocateBeats(beats, storyPages, firstStoryPage);

  return `# Framework: ${title}

${intro}

Source pattern: ${source}.

# Beat allocation (RIGID — these page ranges are your plan)

${renderAllocationTable(alloc)}

# Beats in detail

${alloc
  .map(
    (a, i) =>
      `${i + 1}. **${a.spec.label.toUpperCase()} — ${a.pageCount} ${a.pageCount === 1 ? "page" : "pages"} (pages ${a.startPage}–${a.endPage})**\n\n${a.spec.body(v)}`,
  )
  .join("\n\n")}

# Tone

${toneBlock}

# What to avoid

${avoidBlock}`;
}

// ---- The 5 frameworks (rewritten as beat-spec lists) -----------------------

const BEATS_CURIOSITY: BeatSpec[] = [
  {
    id: "opening",
    label: "The Spark",
    weight: 1,
    body: (v) => `Establish ${v.child_name} in a familiar setting. Something catches ${v.child_pronouns_possessive} attention: a sound, a color, a creature, a trail, a question. The thing that pulls ${v.child_pronouns_object} forward.`,
  },
  {
    id: "rising",
    label: "The First Discovery",
    weight: 1,
    body: (v) => `Following the spark leads to a new thing. Name it. Render it with sensory detail. ${v.child_name} is delighted.`,
  },
  {
    id: "rising",
    label: "The Chain (the engine of the story)",
    weight: 5,
    body: (v) => `Each discovery leads to the next, escalating in wonder, scale, or strangeness. Use a repeating structure or repeating phrase to anchor the chain. This is where the personalization shines: the chain should be built from ${v.child_name}'s specific interests (${v.interest_phrase}). Each link in the chain should reveal something — a fact, a feeling, a new question. Pace the chain — every 3–4 pages a "breath" page (quieter, fewer words, a still image).`,
  },
  {
    id: "turn",
    label: "The Overwhelm",
    weight: 1,
    body: (v) => `The discoveries reach a peak. Briefly: too much, too many, too fast. A small moment of pause or pull-back. NOT a real obstacle — a wonder-overload, a comma in the sentence.`,
  },
  {
    id: "resolution",
    label: "The Transformation",
    weight: 2,
    body: (v) => `Rest, reflection, or return. ${v.child_name} integrates what ${v.child_pronouns_subject} learned. ${v.child_pronouns_subject_capitalized} is bigger than ${v.child_pronouns_subject} was. The world is bigger too. The dedication's value of ${v.value} lands here, earned by everything that came before.`,
  },
];

const BEATS_BEDTIME: BeatSpec[] = [
  {
    id: "opening",
    label: "The World Awake",
    weight: 1.5,
    body: (v) => `Establish ${v.child_name}'s world while it's still active. Show the things ${v.child_pronouns_subject} loves in motion — toys, pets, favorite spaces, the day's energy.`,
  },
  {
    id: "rising",
    label: "The Signal",
    weight: 1,
    body: (v) => `Something signals it's time to slow down. The sun sets. The stars appear. A parent's voice. The quiet starts to settle in.`,
  },
  {
    id: "rising",
    label: "The Naming Ritual (the engine of the story)",
    weight: 5,
    body: (v) => `One by one, say goodnight to (or express love for) each element of ${v.child_name}'s world. This is a litany — each beat follows the same structure but with a different subject: a toy, a pet, a sibling, an interest, a place. The repeating phrase anchors several of these — not all, or it gets monotonous. Personalization is everything: name the actual things ${v.child_name} loves from the wizard inputs. Aim for 1–2 named elements per page.`,
  },
  {
    id: "resolution",
    label: "The Soft Close",
    weight: 1.5,
    body: (v) => `The world grows quieter. Colors dim. Sounds hush. The rhythm of the prose slows — shorter sentences, softer images, lower energy.`,
  },
  {
    id: "closing",
    label: "The Love Seal",
    weight: 1,
    body: (v) => `A final whispered declaration. The dedication's value of ${v.value} lands here, expressed as warmth, safety, or belonging. The last image is still and warm.`,
  },
];

const BEATS_BRAVE: BeatSpec[] = [
  {
    id: "opening",
    label: "The Safe World",
    weight: 1.5,
    body: (v) => `${v.child_name} in ${v.child_pronouns_possessive} familiar world. Comfortable. Known. But something inside ${v.child_pronouns_object} wants more — or a moment is approaching ${v.child_pronouns_subject} can't avoid.`,
  },
  {
    id: "rising",
    label: "The Threshold",
    weight: 1,
    body: (v) => `An invitation, a dare, a door, a path. ${v.child_name} crosses into the unknown.`,
  },
  {
    id: "rising",
    label: "The Wild Space (the engine of the story)",
    weight: 4,
    body: (v) => `Things in the new space escalate. Each beat raises the emotional stakes. ${v.child_name} has to respond with growing courage or cleverness. The "wild space" should be tailored to what's actually hard for THIS child — pulled from the things-tricky field if available, otherwise inferred from age, personality, and the value of ${v.value}.

Important: the brave moment must NOT be something ${v.child_name} has already mastered. Don't make the obstacle horses if ${v.child_pronouns_subject} rides; don't make it the dark if ${v.child_pronouns_subject} sleeps with the lights off; don't make it speaking up if ${v.child_pronouns_subject} is naturally outgoing. The brave moment must be authentic.`,
  },
  {
    id: "turn",
    label: "The Turning Point",
    weight: 1.5,
    body: (v) => `A moment of choice. ${v.child_name} could retreat or stay. ${v.child_pronouns_subject_capitalized} chooses bravely — but the brave choice may be quieter than expected. Sometimes brave is staying still. Sometimes brave is taking a breath. Sometimes brave is asking for help. The choice should match ${v.child_name}'s personality.`,
  },
  {
    id: "climax",
    label: "The Brave Act",
    weight: 1,
    body: (v) => `The choice becomes action. Show ${v.child_pronouns_object} doing the hard thing — no narration about how brave it is. The act itself carries it.`,
  },
  {
    id: "resolution",
    label: "The Return",
    weight: 1,
    body: (v) => `${v.child_name} comes back to ${v.child_pronouns_possessive} world. Same place. Different ${v.child_pronouns_subject}. The dedication's value of ${v.value} lands here — earned by the brave choice, integrated into who ${v.child_pronouns_subject} now is.`,
  },
];

const BEATS_GENEROUS: BeatSpec[] = [
  {
    id: "opening",
    label: "The Treasure",
    weight: 1.5,
    body: (v) => `${v.child_name} has something special. A talent, a possession, a quality. ${v.child_pronouns_subject_capitalized} is proud of it. Show the thing through ${v.child_name}'s pride and care for it.`,
  },
  {
    id: "rising",
    label: "The Isolation",
    weight: 1,
    body: (v) => `Holding too tightly, or noticing that someone else needs help, creates a small wrong-feeling. Something is off. ${v.child_name} feels it.`,
  },
  {
    id: "rising",
    label: "The Ask",
    weight: 1,
    body: (v) => `Someone needs help — or ${v.child_name} notices someone else's need on ${v.child_pronouns_possessive} own. Internal conflict: keep what's mine, or share?`,
  },
  {
    id: "rising",
    label: "The Gift (the engine of the story)",
    weight: 4,
    body: (v) => `${v.child_name} gives, helps, or shares. Tentatively at first, then with growing joy. Each act of generosity is rewarded NOT with material return but with connection — friendship, belonging, warmth, recognition. Multiple beats of giving, each one a little easier than the last.`,
  },
  {
    id: "resolution",
    label: "The Fullness",
    weight: 2,
    body: (v) => `${v.child_name} has "less" than ${v.child_pronouns_subject} started with. ${v.child_pronouns_subject_capitalized} feels richer. Final image: ${v.child_pronouns_object} surrounded by friends, warmth, or love. The dedication's value of ${v.value} lands — earned by the generosity, not stated.`,
  },
];

const BEATS_SILLY: BeatSpec[] = [
  {
    id: "opening",
    label: "The Premise",
    weight: 1.5,
    body: (v) => `A simple, slightly absurd setup. Something is asked, proposed, or set in motion that shouldn't quite work but does. The premise should be built from ${v.child_name}'s interests or interests-twisted: what if ${v.interest_phrase} did the thing they shouldn't?${v.cameo_detail ? ` What if ${v.child_pronouns_possessive} ${v.cameo_detail} could do something it shouldn't?` : ""}`,
  },
  {
    id: "rising",
    label: "The Escalation (the engine of the story)",
    weight: 6,
    body: (v) => `Each beat adds a new layer of absurdity, building on the last. The rhythm is predictable; each new addition is a surprise. Text accelerates. Energy climbs. Each beat is funnier than the last because the previous beats are stacking. Use sound words and rhythm.`,
  },
  {
    id: "climax",
    label: "The Peak of Chaos",
    weight: 1,
    body: (v) => `Maximum absurdity. The scene is at its most ridiculous. The reader laughs because everything has piled up just so.`,
  },
  {
    id: "resolution",
    label: "The Snap",
    weight: 1,
    body: (v) => `Sudden, satisfying resolution. Either circular ("we're back where we started, but..."), reversal ("turns out..."), or a character finally giving in. The tension breaks with a laugh.`,
  },
  {
    id: "closing",
    label: "The Wink",
    weight: 0.5,
    body: (v) => `A final tiny beat that hints the whole thing might start again. This is what drives re-reading.`,
  },
];

export const STORY_FRAMEWORKS: Record<FrameworkId, (v: KernelVars) => string> = {
  curiosity_journey: (v) =>
    renderFramework(
      "Curiosity Journey",
      `This is a wonder/discovery story. ${v.child_name} follows a thread of curiosity into something new and arrives at a satisfying expansion of ${v.child_pronouns_possessive} world.`,
      "The Very Hungry Caterpillar, Brown Bear Brown Bear, The Poky Little Puppy, Corduroy, If You Give a Mouse a Cookie",
      `Bright, lit, alive. The sun is up. The world is bigger than ${v.child_name} thought it was.`,
      `- Don't introduce conflict or fear — this is a wonder story, not a brave story. The "overwhelm" is not threat, just a pull-back.\n- Don't moralize. The lesson lands through experience, not statement.\n- Don't have ${v.child_name} return home unchanged. Something inside ${v.child_pronouns_object} grew.`,
      BEATS_CURIOSITY,
      v,
    ),
  bedtime_wind_down: (v) =>
    renderFramework(
      "Bedtime Wind-Down",
      `This is a ritual story. The world is winding down toward sleep, and the rhythm of the prose carries the child toward rest.`,
      "Goodnight Moon, Goodnight Goodnight Construction Site, Love You Forever, Guess How Much I Love You",
      `Hushed. Honey-light. A voice that's already half a whisper. Sentence lengths shorten across the arc — by the final page, prose is at its quietest.`,
      `- Don't introduce conflict, threat, or any beat that quickens the energy. The whole arc is a slow exhale.\n- Don't make it didactic. No lessons. Just love and rest.\n- Don't end on a question or cliffhanger — the final page ends on stillness.`,
      BEATS_BEDTIME,
      v,
    ),
  brave_choice: (v) =>
    renderFramework(
      "Brave Choice",
      `This is a courage story. ${v.child_name} faces something hard, makes a brave choice, and grows.`,
      "Where the Wild Things Are, The Tale of Peter Rabbit, The Cat in the Hat, Don't Let the Pigeon Drive the Bus, Oh the Places You'll Go",
      `Real. Stakes are present but never crushing. The world stays beautiful even when it's hard — visible weather can be sunny, tension comes from inside ${v.child_name}'s experience, not from darkness in the world.`,
      `- Don't make the wild space genuinely scary or traumatic. This is courage, not horror.\n- Don't have an adult solve the problem. ${v.child_name} chooses bravely — others can support, but ${v.child_pronouns_subject} is the agent.\n- Don't moralize the brave choice. Show what ${v.child_pronouns_subject} did. Let the reader feel the courage.\n- Don't make the brave moment about a thing the child has already mastered.`,
      BEATS_BRAVE,
      v,
    ),
  generous_heart: (v) =>
    renderFramework(
      "Generous Heart",
      `This is a connection story. ${v.child_name} has something — a quality, a possession, a skill — and discovers that giving creates belonging.`,
      "The Rainbow Fish, The Giving Tree, The Little Engine That Could, Guess How Much I Love You",
      `Warm, growing-warmer. The story should feel like a slow widening — ${v.child_name}'s world expands as ${v.child_pronouns_subject} gives.`,
      `- Don't reward generosity with stuff. The reward is connection, never a bigger pile of toys.\n- Don't shame the initial holding-tight. ${v.child_name} loving what ${v.child_pronouns_subject} has is fine. Growth is in the discovery that giving makes more.\n- Don't have an adult instruct ${v.child_name} to share. ${v.child_pronouns_subject_capitalized} arrives at it.`,
      BEATS_GENEROUS,
      v,
    ),
  silly_escalation: (v) =>
    renderFramework(
      "Silly Escalation",
      `This is a comedy story. A tiny absurd premise compounds beat after beat into beautiful nonsense, then snaps back to warmth.`,
      "Green Eggs and Ham, The Cat in the Hat, Don't Let the Pigeon Drive the Bus, Chicka Chicka Boom Boom, If You Give a Mouse a Cookie",
      `Mischievous. Light. The voice is having as much fun as the story is. Use sound words, capitalized words for emphasis, em dashes for comic timing.`,
      `- Don't moralize. There is no lesson here other than "the world is funny and ${v.child_name} is part of the funny."\n- Don't slow down for emotional beats. This framework is energy from the premise to the snap.\n- Don't end on a wholesome moral. End on the WINK — the suggestion of the whole thing about to happen again.`,
      BEATS_SILLY,
      v,
    ),
};

// User message is fixed by the brief.
export const STORY_BOOK_USER_MESSAGE =
  "Write the book according to the framework above. Output in the exact format specified.";

// ---- Output type + parser ---------------------------------------------------

export interface GeneratedBook {
  framework_id: FrameworkId;
  cover_text: string;
  outfit_description: string;
  dedication_text: string;
  repeating_phrase: string;
  belongs_to_page_text: string | null;
  spreads: Array<{
    spread_number: number;
    beat_label: string;
    text: string;
  }>;
  generated_at: string;
  model: string;
  prompt_version: string;
  generation_time_ms: number;
}

function extractField(raw: string, marker: string): string {
  // matches "[MARKER]: value" up to next [SECTION] or end
  const re = new RegExp(
    `\\[${marker.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\]\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*\\[[A-Z][A-Z \\d:]*\\]|$)`,
    "i",
  );
  const m = raw.match(re);
  return (m?.[1] ?? "").trim();
}

export function parseBookOutput(raw: string, framework_id: FrameworkId): Omit<
  GeneratedBook,
  "generated_at" | "model" | "prompt_version" | "generation_time_ms"
> {
  const cover_text = extractField(raw, "COVER TEXT");
  const outfit_description = extractField(raw, "OUTFIT");
  const dedication_text = extractField(raw, "DEDICATION");
  const repeating_phrase = extractField(raw, "REPEATING PHRASE");
  const belongsRaw = extractField(raw, "BELONGS TO PAGE");
  const belongs_to_page_text = belongsRaw ? belongsRaw : null;

  // Spreads: "[SPREAD N] [BEAT: ...]\n<prose>"
  const spreadRe =
    /\[SPREAD\s+(\d+)\]\s*\[BEAT:\s*([^\]]+)\]\s*([\s\S]*?)(?=\[SPREAD\s+\d+\]|$)/gi;
  const spreads: GeneratedBook["spreads"] = [];
  let m: RegExpExecArray | null;
  while ((m = spreadRe.exec(raw)) !== null) {
    spreads.push({
      spread_number: parseInt(m[1], 10),
      beat_label: m[2].trim(),
      text: m[3].trim(),
    });
  }
  spreads.sort((a, b) => a.spread_number - b.spread_number);

  return {
    framework_id,
    cover_text,
    outfit_description,
    dedication_text,
    repeating_phrase,
    belongs_to_page_text,
    spreads,
  };
}

// ---- Stage 3 validator (STUBBED — see plan §2; wire real rules later) ------
export function validateBook(_book: unknown, _input: unknown): {
  valid: boolean;
  issues: string[];
} {
  return { valid: true, issues: [] };
}

// ---- Display labels for the optional buyer/occasion fields -----------------

export const BUYER_RELATIONSHIP_LABEL: Record<string, string> = {
  parent: "parent",
  grandparent: "grandparent",
  teacher: "teacher",
  friend: "friend",
  other: "loved one",
};

export const OCCASION_LABEL: Record<string, string> = {
  birthday: "birthday",
  christmas: "Christmas",
  easter: "Easter",
  new_sibling: "new sibling",
  first_day: "first day",
  graduation: "graduation",
  baptism: "baptism",
  just_because: "just because",
  other: "other",
};

// =============================================================================
//  STORY ENGINE V2 — fixed-page-count book with paired image prompts.
// =============================================================================
//
//  Output shape: 32 interior pages (title + dedication + 30 story pages) plus
//  the cover. Every story page carries both narrative text AND a structured
//  image prompt. Total word count scales by reader age.
//
//  Per the project plan, this lives alongside the legacy V1 spread parser so
//  older rows in `generated_books` still render. New generations call V2.
// =============================================================================

import {
  allLayoutIds,
  getLayout,
  PAGE_LAYOUTS,
  PageRole,
  serializeLayoutRegistryForPrompt,
  StoryBeat,
} from "./layouts.ts";

// ---- Story length knobs (V2) -----------------------------------------------
// Single page-count knob. Per-page word bounds are DERIVED from the age band's
// total — see perPageWordBounds(). Don't add a separate per-page constant.
export const STORY_LENGTH_BOOK = {
  pageCount: 30 as const,           // story pages (pages 3–32)
  totalPageCount: 32 as const,      // includes title (p.1) + dedication (p.2)
  totalByAgeBand: {
    "0-2": 100,    // very young — pictures dominate, many image-only pages
    "3-4": 250,
    "5-6": 500,
    "7-8": 650,
    "9-10": 800,
    "11+":  900,
  } as Record<AgeBand, number>,
  /** ±10% wiggle on total. */
  totalTolerance: 0.10,
} as const;

export function bookWordTotalRange(age_band: AgeBand): { min: number; target: number; max: number } {
  const target = STORY_LENGTH_BOOK.totalByAgeBand[age_band] ?? 500;
  const tol = STORY_LENGTH_BOOK.totalTolerance;
  return {
    target,
    min: Math.round(target * (1 - tol)),
    max: Math.round(target * (1 + tol)),
  };
}

/**
 * Derives per-page word bounds from the age band's total. Always proportional
 * to STORY_LENGTH_BOOK.pageCount so the engine stays consistent if we change
 * page count later.
 *
 *   - target  ≈ total / pageCount
 *   - min     ≈ 35% of target, floored at 0 (image-only pages allowed)
 *   - max     ≈ 220% of target — climax pages can be roughly 2× a normal page
 *   - softMin: a "comfortable" floor for non-quiet pages; below this the page
 *              should be deliberately quiet (silent or near-silent).
 */
export function perPageWordBounds(age_band: AgeBand): {
  target: number;
  min: number;
  max: number;
  softMin: number;
} {
  const total = STORY_LENGTH_BOOK.totalByAgeBand[age_band] ?? 500;
  const raw = total / STORY_LENGTH_BOOK.pageCount;
  const target = Math.max(1, Math.round(raw));
  const min = age_band === "0-2" ? 0 : Math.max(1, Math.round(raw * 0.35));
  const max = Math.max(target + 2, Math.round(raw * 2.2));
  const softMin = Math.max(min, Math.round(raw * 0.5));
  return { target, min, max, softMin };
}


// ---- Per-page output schema -------------------------------------------------

export interface BookPageRaw {
  page_number: number;
  role: PageRole;
  beat?: StoryBeat | null;
  text: string;
  /** Short, factual scene description — the model writes this. The server
   *  bakes the final image_prompt by adding style + appearance + layout cue. */
  image_scene?: string | null;
  /** Named characters in this page's illustration (subset of hero+cast). */
  characters_present?: string[];
  /** Where/when the scene takes place. */
  setting?: string | null;
  /** One-word mood for this page's illustration. */
  mood?: string | null;
  /** Short reminder of outfit/time/setting carried from previous page. */
  continuity_notes?: string | null;
  layout_id: string;
}

export interface BookPage extends BookPageRaw {
  /** Server-assembled final illustration prompt. Null for the title page. */
  image_prompt: string | null;
}

export interface BookOutputV2 {
  schema_version: "v2";
  meta: {
    title: string;
    framework_id: FrameworkId;
    word_count_total: number;
    page_count: number;
    age_band: AgeBand;
    art_style: string | null;
    repeating_phrase: string | null;
    /** Locked hero outfit description used on every page's image prompt. */
    book_outfit: string | null;
    generated_at: string;
    model: string;
    prompt_version: string;
    generation_time_ms: number;
  };
  cover: {
    title: string;
    subtitle: string | null;
    image_prompt: string;
  };
  pages: BookPage[];
}


// ---- Appearance blocks (one source of character truth per book) ------------

export interface AppearanceBlocks {
  hero: { name: string; description: string };
  supporting: Array<{ name: string; description: string }>;
}

function joinAppearanceParts(parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(", ");
}

/**
 * Builds the single, canonical appearance string for the hero and each named
 * supporting character. Reused VERBATIM on every page they appear in, which is
 * the single biggest lever for character consistency across 30 illustrations.
 */
export function buildAppearanceBlocks(brief: any): AppearanceBlocks {
  const child = brief?.child || {};
  const proto = brief?.protagonist || {};
  const appearance = proto.appearance || {};
  const heroName = (child.name || "the child").trim();
  const ageBand = child.ageRange || "young";
  const heroParts = [
    `${heroName}, a ${ageBand} ${child.gender || "child"}`,
    appearance.hairColor && `${appearance.hairColor} ${appearance.hairStyle || "hair"}`,
    appearance.skinTone && `${appearance.skinTone} skin`,
    appearance.glasses && "wearing round glasses",
    appearance.features,
    proto.special,
  ];

  const supporting = (Array.isArray(brief?.supportingCharacters) ? brief.supportingCharacters : [])
    .filter((c: any) => c && c.name)
    .map((c: any) => {
      const a = c.appearance || {};
      const desc = joinAppearanceParts([
        `${c.name}, ${c.relationship || "friend"}${c.ageRange ? `, ${c.ageRange}` : ""}`,
        c.gender,
        a.hairColor && `${a.hairColor} ${a.hairStyle || "hair"}`,
        a.skinTone && `${a.skinTone} skin`,
        a.glasses && "wearing glasses",
        a.features,
        c.description,
      ]);
      return { name: c.name, description: desc };
    });

  return {
    hero: { name: heroName, description: joinAppearanceParts(heroParts) },
    supporting,
  };
}

/**
 * Builds the per-page illustration prompt by composing:
 *   art style + scene + appearance blocks for characters in scene + setting
 *   + mood + layout composition cue + the universal "no text" rule.
 *
 * The model only writes `image_scene`/`characters_present`/`setting`/`mood`.
 * The server owns the rest — so style and likeness stay locked across pages.
 */
export function buildPageImagePrompt(
  page: BookPageRaw,
  blocks: AppearanceBlocks,
  artStyleFragment: string,
  bookOutfit?: string | null,
): string | null {
  const layout = getLayout(page.layout_id);
  if (!layout) return null;
  if (layout.illustrationCoverage === "none") return null;

  const present = (page.characters_present || []).map((n) => n.trim().toLowerCase());
  const heroIn = present.length === 0 || present.includes(blocks.hero.name.trim().toLowerCase());

  const characterBlocks: string[] = [];
  if (heroIn) {
    // Lock the hero outfit on every page for visual continuity.
    const heroDesc = bookOutfit && bookOutfit.trim()
      ? `${blocks.hero.description}, wearing ${bookOutfit.trim()} (same outfit on every page)`
      : blocks.hero.description;
    characterBlocks.push(heroDesc);
  }
  for (const s of blocks.supporting) {
    if (present.includes(s.name.trim().toLowerCase())) {
      characterBlocks.push(s.description);
    }
  }

  const charactersLine = characterBlocks.length
    ? `Characters in this illustration: ${characterBlocks.join("; ")}.`
    : `No characters in this illustration — environmental shot only.`;

  return [
    `${artStyleFragment}.`,
    page.image_scene ? `Scene: ${page.image_scene}.` : "",
    charactersLine,
    page.setting ? `Setting: ${page.setting}.` : "",
    page.mood ? `Mood: ${page.mood}.` : "",
    page.continuity_notes ? `Continuity from previous page: ${page.continuity_notes}.` : "",
    `Composition: ${layout.compositionCue}.`,
    `IMPORTANT: do not render any text, letters, words, numbers, signs, captions, watermarks, or logos in the illustration.`,
  ]
    .filter(Boolean)
    .join(" ");
}


// ---- JSON Schema for tool-calling structured output -------------------------

/**
 * JSON Schema describing the per-page book output. Provided to the model via
 * the gateway's tools API so the response is guaranteed-shape JSON.
 * Layout enum is derived from the registry — adding a layout updates this.
 */
export function buildBookJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["meta", "cover", "pages"],
    properties: {
      meta: {
        type: "object",
        additionalProperties: false,
        required: ["title", "repeating_phrase", "book_outfit"],
        properties: {
          title: { type: "string", description: "Book title, max 8 words, no child's first name." },
          repeating_phrase: {
            type: "string",
            description: "5–8 word repeating phrase (chorus) appearing 4–6 times across the book.",
          },
          book_outfit: {
            type: "string",
            description: "≤10 words. One distinctive visible outfit (shirt + bottoms + shoes + optional accessory) the hero wears on EVERY illustrated page. Locked across all 30 pages for visual continuity.",
          },
        },
      },

      cover: {
        type: "object",
        additionalProperties: false,
        required: ["title", "image_scene", "setting", "mood"],
        properties: {
          title: { type: "string" },
          subtitle: { type: ["string", "null"] },
          image_scene: { type: "string", description: "Hero-only cover scene description, no supporting characters." },
          setting: { type: "string" },
          mood: { type: "string" },
        },
      },
      pages: {
        // 32-page count is enforced by the prompt + a server-side guard
        // after JSON.parse. We deliberately omit minItems/maxItems and
        // numeric integer bounds because Gemini's constrained decoder
        // rejects schemas with too many states.
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["page_number", "role", "text", "layout_id"],
          properties: {
            page_number: { type: "integer" },
            role: { type: "string", enum: ["title", "dedication", "story"] },
            beat: {
              type: "string",
              enum: ["opening", "rising", "turn", "climax", "resolution", "closing"],
            },
            text: { type: "string" },
            image_scene: { type: "string" },
            characters_present: { type: "array", items: { type: "string" } },
            setting: { type: "string" },
            mood: { type: "string" },
            continuity_notes: { type: "string" },
            layout_id: { type: "string", enum: allLayoutIds() },
          },
        },
      },
    },
  };
}

// ---- V2 user prompt builder -------------------------------------------------

export function buildBookUserMessageV2(opts: {
  age_band: AgeBand;
  include_belongs_to_page: boolean;
  buyer_relationship_label: string;
  occasion_label: string;
  child_name: string;
}): string {

  const { age_band, include_belongs_to_page, buyer_relationship_label, occasion_label, child_name } = opts;
  const { min, target, max } = bookWordTotalRange(age_band);
  const pp = perPageWordBounds(age_band);
  const layoutsTable = serializeLayoutRegistryForPrompt();
  const storyPages = STORY_LENGTH_BOOK.pageCount; // 30
  const firstStoryPage = 3;
  const lastStoryPage = STORY_LENGTH_BOOK.totalPageCount;

  const quietPagesGuidance = age_band === "0-2"
    ? `Because this is the 0–2 age band, many pages SHOULD be image-only (0 words) or 1–3 words (a sound, a name, a label). The total stays under ${max} words — text is a garnish, not the meal.`
    : `Roughly 4–6 pages should be deliberately quiet (under ${pp.softMin} words) to give the pacing room to breathe. The climax and emotional turn can run up to ${pp.max} words.`;

  return `You are now writing the FINAL printed book.

# Book structure (RIGID — do not deviate)

The book has exactly **${STORY_LENGTH_BOOK.totalPageCount} interior pages**:

- **Page 1 — Title page** (role: "title", layout_id: "title").
  - text: The book title on its own line, followed on a second line by "A story for ${child_name}".
  - image_scene: null. image_prompt is reused from the cover.
- **Page 2 — Dedication page** (role: "dedication", layout_id: "dedication-spot").
  - text: A warm 1–2 sentence dedication. Tone matches the buyer (${buyer_relationship_label}) and the occasion (${occasion_label}).${include_belongs_to_page ? ` On a new line, append: "This book belongs to ${child_name}."` : ""}
- **Pages ${firstStoryPage}–${lastStoryPage} — Story pages** (role: "story"). Exactly ${storyPages} pages.
  - Each page has its own short narrative text AND its own illustration scene.
  - The story arc plays out across these ${storyPages} pages, following the beat allocation table from the system prompt. Tag each page's beat: opening / rising / turn / climax / resolution / closing.

# Word counts (HARD)

- Total story-page text (pages ${firstStoryPage}–${lastStoryPage}) must land between **${min} and ${max} words**, target ~${target}.
- Each individual story page: **${pp.min}–${pp.max} words**. Target ~${pp.target} per page.
- ${quietPagesGuidance}
- Page text length should follow the emotional shape, not a uniform line count.

# Hero outfit (locked)

Pick ONE distinctive visible outfit the hero wears on every illustrated page (shirt + bottoms + shoes + optional accessory, ≤10 words). Return it in \`meta.book_outfit\`. The server stitches this outfit into every page's image prompt automatically — do NOT repeat outfit details inside per-page \`image_scene\` text.

# Per-page illustration prompts

For every story page, also provide:
- \`image_scene\`: 1 sentence, what is physically happening on this page (action, posture, key props). Do NOT describe the outfit — that's handled by \`book_outfit\`.
- \`characters_present\`: array of character names appearing on this page. Use the hero's exact name and any supporting character's exact name. Omit the hero only if the page is intentionally environmental.
- \`setting\`: where + time of day + weather, in a short phrase.
- \`mood\`: a single emotional word (e.g. "wonder", "tender", "playful").
- \`continuity_notes\`: short reminder of what carries from the previous page (time of day, location, prop, weather). Critical at 30 pages — without it, locations and time-of-day drift visibly.

DO NOT write style instructions, art direction, lighting, color, or composition. The server bakes those in from the chosen art style, character appearance blocks, the locked outfit, and the chosen layout. Just describe WHAT IS HAPPENING and WHO IS THERE.

# Layout selection (one per story page)

Vary layouts across the book — never use the same layout on three back-to-back pages. Bias by beat:

- **opening / rising** → \`text-left-half\`, \`text-bottom-third\`, \`text-top-third\` (room to establish + read).
- **turn / climax** → \`full-bleed\` (image carries the emotional weight; minimal or no text on that page).
- **resolution / closing** → \`text-right-half\`, \`text-bottom-third\` (warm, settled mid-shots).

The dedication page must use \`dedication-spot\`. The title page must use \`title\`.

${layoutsTable}

# Repeating phrase placement

The repeating phrase (returned in \`meta.repeating_phrase\`) must appear verbatim, or with a small, intentional variation, on 4–6 of the story pages — distributed across the arc (one early, one or two in the middle, one near the end). Do NOT use it on every page.

# Output

Call the provided tool \`return_book\` with the exact structured payload. No prose outside the tool call.`;
}


// ---- V2 parser / normaliser -------------------------------------------------

export function parseBookPagesOutput(raw: unknown): {
  meta: { title: string; repeating_phrase: string | null; book_outfit: string | null };
  cover: { title: string; subtitle: string | null; image_scene: string; setting: string; mood: string };
  pages: BookPageRaw[];
} {
  const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as any;
  if (!obj || typeof obj !== "object") throw new Error("Book payload was not a JSON object.");
  if (!Array.isArray(obj.pages)) throw new Error("Book payload missing pages[].");

  const pages: BookPageRaw[] = obj.pages.map((p: any, idx: number) => ({
    page_number: Number(p.page_number ?? idx + 1),
    role: (p.role || (idx === 0 ? "title" : idx === 1 ? "dedication" : "story")) as PageRole,
    beat: p.beat ?? null,
    text: String(p.text ?? "").trim(),
    image_scene: p.image_scene ?? null,
    characters_present: Array.isArray(p.characters_present) ? p.characters_present : [],
    setting: p.setting ?? null,
    mood: p.mood ?? null,
    continuity_notes: p.continuity_notes ?? null,
    layout_id: String(p.layout_id || (idx === 0 ? "title" : idx === 1 ? "dedication-spot" : "text-bottom-third")),
  }));

  return {
    meta: {
      title: String(obj.meta?.title || "Untitled").trim(),
      repeating_phrase: obj.meta?.repeating_phrase ? String(obj.meta.repeating_phrase) : null,
      book_outfit: obj.meta?.book_outfit ? String(obj.meta.book_outfit).trim() : null,
    },
    cover: {
      title: String(obj.cover?.title || obj.meta?.title || "Untitled").trim(),
      subtitle: obj.cover?.subtitle ?? null,
      image_scene: String(obj.cover?.image_scene || "").trim(),
      setting: String(obj.cover?.setting || "").trim(),
      mood: String(obj.cover?.mood || "warm").trim(),
    },
    pages,
  };
}


export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}


