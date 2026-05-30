// generate-book — full hardcover-book story generation engine (V2).
//
// V2 = fixed 32-page structure (title + dedication + 30 story pages), word
// total scaled by reader age (~500 default), and a per-page illustration
// prompt baked in server-side from the chosen layout + canonical character
// appearance blocks. Persisted to public.generated_books (parsed jsonb).
//
// Layout types live in ../_shared/layouts.ts. Adding a new layout = pushing
// one entry there; the prompt table, JSON schema enum, image-prompt
// composition cue, and dev preview renderer all pick it up automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  ageToBand,
  BookEngineInput,
  BookOutputV2,
  bookWordTotalRange,
  buildAppearanceBlocks,
  buildBookJsonSchema,
  buildBookUserMessageV2,
  buildPageImagePrompt,
  BUYER_RELATIONSHIP_LABEL,
  countWords,
  formatCastSummary,
  FrameworkId,
  getArtStylePrompt,
  grammaticalJoin,
  KernelVars,
  MODELS,
  OCCASION_LABEL,
  parseBookPagesOutput,
  pronounsFor,
  selectFramework,
  STORY_FRAMEWORKS,
  STORY_KERNEL,
  STORY_LENGTH_BOOK,
  validateBook,
  VOCAB_TIER_BY_AGE,
} from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- Wizard brief -> engine input mapping ----------------------------

type ApprovedConcept = {
  title?: string;
  summary?: string;
  user_visible_summary?: string;
  framework_id?: string;
  framework_reason?: string;
  story_seed?: {
    core_conflict?: string;
    emotional_arc?: string;
    visual_world?: string;
    recurring_motif?: string;
    ending_feeling?: string;
    image_opportunities?: string[];
  };
  personalization_notes?: {
    personality_through_action?: string;
    interests_used?: string;
    cast_and_companion_use?: string;
    avoid_as_obstacle?: string;
  };
  full_book_instruction?: string;
  user_edited?: boolean;
};

const FRAMEWORK_IDS: FrameworkId[] = [
  "curiosity_journey",
  "bedtime_wind_down",
  "brave_choice",
  "generous_heart",
  "silly_escalation",
];

const AGE_BAND_TO_INT: Record<string, number> = {
  "0-2": 2,
  "3-5": 4,
  "6-8": 7,
  "9-12": 10,
};

const GENDER_TO_PRONOUN: Record<string, "he" | "she" | "they"> = {
  girl: "she",
  boy: "he",
  "non-binary": "they",
  "gender-neutral": "they",
  surprise: "they",
};

const LESSON_TO_VALUE: Record<string, BookEngineInput["value"]> = {
  courage: "courage",
  kindness: "kindness",
  resilience: "resilience",
  friendship: "friendship",
  curiosity: "curiosity",
  "self-confidence": "self_confidence",
  self_confidence: "self_confidence",
  "sharing-generosity": "sharing",
  sharing: "sharing",
  "caring-for-nature": "nature",
  nature: "nature",
  empathy: "empathy",
  "just-for-fun": "just_for_fun",
  just_for_fun: "just_for_fun",
};

const GENRE_PASSTHROUGH = new Set([
  "adventure", "fantasy", "sci_fi", "mystery", "everyday",
  "bedtime", "sports", "fairy_tale", "animals", "superhero",
]);

const COMPANION_CATEGORIES = new Set([
  "pet", "stuffed-animal", "stuffed_animal", "toy", "doll", "toy_vehicle",
]);

function isFrameworkId(value: unknown): value is FrameworkId {
  return typeof value === "string" && FRAMEWORK_IDS.includes(value as FrameworkId);
}

function mapGenre(g?: string): BookEngineInput["genre"] {
  if (!g) return "everyday";
  const k = g.toLowerCase().replace(/-/g, "_");
  return (GENRE_PASSTHROUGH.has(k) ? k : "everyday") as BookEngineInput["genre"];
}

function mapValue(lesson?: string): BookEngineInput["value"] {
  if (!lesson) return "curiosity";
  return LESSON_TO_VALUE[lesson] ?? "curiosity";
}

function flattenSpecialThing(s: any): { type?: string; detail?: string } {
  if (!s) return {};
  const cat = (s.category || "").toString().replace(/-/g, " ").trim();
  const d = s.details || {};
  const bits = Object.entries(d)
    .filter(([k, v]) => v && typeof v === "string" && k !== "photo" && !(v as string).startsWith("data:"))
    .map(([k, v]) => {
      if (k === "name") return `named "${v}"`;
      if (k === "color") return `${v} colored`;
      return v as string;
    });
  return {
    type: cat || undefined,
    detail: [cat, bits.join(", ")].filter(Boolean).join(" — ") || undefined,
  };
}

function inferRole(rel?: string, category?: string): "character" | "companion" {
  const r = (rel || "").toLowerCase();
  const c = (category || "").toLowerCase();
  if (COMPANION_CATEGORIES.has(c)) return "companion";
  if (/dog|cat|pet|fish|bird|hamster|rabbit/.test(r)) return "companion";
  if (/stuffed|toy|teddy|doll/.test(r)) return "companion";
  return "character";
}

function parseAgeInt(ageRange?: string): number | undefined {
  if (!ageRange) return undefined;
  if (AGE_BAND_TO_INT[ageRange]) return AGE_BAND_TO_INT[ageRange];
  const n = parseInt(ageRange, 10);
  return Number.isFinite(n) ? n : undefined;
}

function pronounFromGender(gender?: string): "he" | "she" | "they" {
  if (!gender) return "they";
  const k = gender.toLowerCase().replace(/_/g, "-");
  return GENDER_TO_PRONOUN[k] || "they";
}

function mapBriefToEngineInput(brief: any): BookEngineInput {
  const child = brief.child || {};
  const story = brief.story || {};
  const protagonist = brief.protagonist || {};
  const special = flattenSpecialThing(brief.specialThing);
  const artStyle = brief.artStyle || "storybook-soft";

  const age = parseAgeInt(child.ageRange) ?? 6;
  const gender = pronounFromGender(child.gender);
  const hero_pronouns = pronounsFor(gender);

  const supportingFromWizard = (brief.supportingCharacters || []).map((c: any, idx: number) => ({
    name: c.name || c.relationship || `Friend ${idx + 1}`,
    role: inferRole(c.relationship, c.category),
    description: [c.relationship, c.ageRange, c.description, (c.traits || []).join(", ")]
      .filter(Boolean)
      .join("; "),
  }));

  const specialAsCompanion = special.detail
    ? [{
        name: special.detail,
        role: COMPANION_CATEGORIES.has((brief.specialThing?.category || "").toString())
          ? "companion" as const
          : "character" as const,
        description: special.detail,
      }]
    : [];

  return {
    child_name: child.name || "the child",
    age,
    gender,
    hero_pronouns,
    appearance: protagonist.special || undefined,
    traits: story.personality || [],
    interests: story.interests || [],
    value: mapValue(story.lesson),
    genre: mapGenre(story.genre),
    mood_tags: [story.mood].filter(Boolean),
    supporting_cast: [...supportingFromWizard, ...specialAsCompanion],
    special_item: special.detail,
    art_style: artStyle,
    buyer_relationship: brief.buyer_relationship || brief.buyerRelationship,
    occasion: brief.occasion,
    include_belongs_to_page: !!brief.include_belongs_to_page,
    things_already_good_at: story.thingsAlreadyGoodAt,
    things_currently_tricky: story.thingsCurrentlyTricky,
    recent_meaningful_moment: story.recentMeaningfulMoment,
  };
}

function buildApprovedConceptInstruction(concept: ApprovedConcept | null): string {
  if (!concept) return "";

  const title = concept.title || "";
  const summary = concept.user_visible_summary || concept.summary || "";
  const seed = concept.story_seed || {};
  const notes = concept.personalization_notes || {};
  const manualEdit = concept.user_edited
    ? "The visible concept was manually edited by the user. Treat its title and summary as highest priority for tone and story direction. If hidden metadata conflicts with the edited visible summary, follow the visible summary."
    : "";

  return [
    "APPROVED STORY CONCEPT — follow this as the binding story seed.",
    title ? `Approved title: ${title}` : "",
    summary ? `Approved visible summary: ${summary}` : "",
    concept.framework_id ? `Approved framework_id: ${concept.framework_id}` : "",
    concept.framework_reason ? `Framework reason: ${concept.framework_reason}` : "",
    seed.core_conflict ? `Core conflict: ${seed.core_conflict}` : "",
    seed.emotional_arc ? `Emotional arc: ${seed.emotional_arc}` : "",
    seed.visual_world ? `Visual world: ${seed.visual_world}` : "",
    seed.recurring_motif ? `Recurring motif: ${seed.recurring_motif}` : "",
    seed.ending_feeling ? `Ending feeling: ${seed.ending_feeling}` : "",
    seed.image_opportunities?.length ? `Image opportunities: ${seed.image_opportunities.join("; ")}` : "",
    notes.personality_through_action ? `Personality through action: ${notes.personality_through_action}` : "",
    notes.interests_used ? `Interests used: ${notes.interests_used}` : "",
    notes.cast_and_companion_use ? `Cast and companion use: ${notes.cast_and_companion_use}` : "",
    notes.avoid_as_obstacle ? `Avoid as obstacle: ${notes.avoid_as_obstacle}` : "",
    concept.full_book_instruction ? `Full book instruction: ${concept.full_book_instruction}` : "",
    manualEdit,
  ].filter(Boolean).join("\n");
}

function buildKernelVars(input: BookEngineInput, framework_id: FrameworkId): KernelVars {
  const age_band = ageToBand(input.age);
  const pronouns = input.hero_pronouns || pronounsFor(input.gender);
  const vocab_tier = VOCAB_TIER_BY_AGE[age_band];
  const cast_summary = formatCastSummary(input.supporting_cast);
  const value = input.value;
  const mood_tags = input.mood_tags?.length ? input.mood_tags : ["warm", "playful"];
  const interests = input.interests?.length
    ? grammaticalJoin(input.interests)
    : "the child's favorite things";

  return {
    child_name: input.child_name,
    hero_pronouns: pronouns,
    age_band,
    vocab_tier,
    value,
    value_label: value.replace(/_/g, " "),
    genre: input.genre,
    mood_tags,
    mood_label: grammaticalJoin(mood_tags),
    interests,
    special_item: input.special_item,
    cast_summary,
    buyer_relationship: BUYER_RELATIONSHIP_LABEL[input.buyer_relationship || ""] || input.buyer_relationship || "someone who loves the child",
    occasion: OCCASION_LABEL[input.occasion || ""] || input.occasion || "just because",
    things_already_good_at: input.things_already_good_at,
    things_currently_tricky: input.things_currently_tricky,
    recent_meaningful_moment: input.recent_meaningful_moment,
    bedtime_setting_modifier: input.genre === "bedtime" && framework_id !== "bedtime_wind_down",
    // V2 book-level totals — single source of truth (see prompts.ts).
    word_count_target: (() => {
      const r = bookWordTotalRange(age_band);
      return `${r.min}-${r.max}`;
    })(),
    spread_count: STORY_LENGTH_BOOK.pageCount,
    vocab_tier,
    age_band,
    include_belongs_to_page: input.include_belongs_to_page,
  };
}

async function shortHash(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Handler ---------------------------------------------------------

// Recursively strip base64 `data:` URLs and known photo fields from the brief.
// The text engine never reads these, and dragging multi-MB strings through
// JSON.parse + multiple in-memory copies blows the edge-runtime memory ceiling
// (HTTP 546 "WORKER_LIMIT").
function stripDataUrls<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    return (value.startsWith("data:") ? null : value) as any;
  }
  if (Array.isArray(value)) {
    return value.map(stripDataUrls) as any;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "photo" || k === "photos" || k === "photoDataUrl") {
        out[k] = null;
        continue;
      }
      out[k] = stripDataUrls(v);
    }
    return out as any;
  }
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const rawBrief = stripDataUrls(body.brief || {});
    const buyer_name: string | undefined = body.buyer_name || rawBrief.buyer_name;
    const buyer_email: string | undefined = body.buyer_email || rawBrief.buyer_email;
    const brief = { ...rawBrief, buyer_name, buyer_email };
    const revision_note: string | undefined = body.revision_note || undefined;
    const model: string = body.modelOverride || MODELS.book;
    const seed_portrait_data_url: string | null = body.seed_portrait_data_url || null;

    const approvedConcept: ApprovedConcept | null = brief.approvedConcept || brief.selectedConcept || null;
    const approvedConceptInstruction = buildApprovedConceptInstruction(approvedConcept);

    const engineInput = mapBriefToEngineInput(brief);
    const framework_id = isFrameworkId(approvedConcept?.framework_id)
      ? approvedConcept.framework_id
      : selectFramework({
          value: engineInput.value,
          genre: engineInput.genre,
          mood_tags: engineInput.mood_tags,
        });
    const vars = buildKernelVars(engineInput, framework_id);
    const age_band = vars.age_band;

    const systemPrompt =
      STORY_KERNEL(vars) + "\n\n---\n\n" + STORY_FRAMEWORKS[framework_id](vars);
    const promptHash = await shortHash(systemPrompt + "\n\n" + approvedConceptInstruction);

    const userMessage = [
      buildBookUserMessageV2({
        age_band,
        include_belongs_to_page: engineInput.include_belongs_to_page,
        buyer_relationship_label: vars.buyer_relationship,
        occasion_label: vars.occasion,
        child_name: engineInput.child_name,
      }),
      approvedConceptInstruction,
      revision_note ? `Revision note: ${revision_note}` : "",
    ].filter(Boolean).join("\n\n");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert stub row immediately so the client has an id to poll.
    const { data: stubRow, error: stubErr } = await supabase
      .from("generated_books")
      .insert({
        framework_id,
        brief: { ...brief, approvedConcept },
        model,
        prompt_hash: promptHash,
        status: "pending",
        buyer_name: buyer_name || null,
        buyer_email: buyer_email || null,
        pipeline_status: "story",
        pipeline_progress: {
          stage: "story",
          current: 0,
          total: 1,
          message: "Writing the story…",
        },
      })
      .select("id")
      .single();

    if (stubErr || !stubRow?.id) {
      console.error("Stub insert failed", stubErr);
      return new Response(
        JSON.stringify({ error: stubErr?.message || "Could not create book row." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bookId = stubRow.id as string;

    // Background work — story AI call + persist + chain image pipeline.
    const work = async () => {
      const startedAt = Date.now();
      try {
        const schema = buildBookJsonSchema();
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "return_book",
                  description: "Return the complete printed book as structured JSON.",
                  parameters: schema,
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "return_book" } },
          }),
        });

        if (!aiResp.ok) {
          const t = await aiResp.text();
          throw new Error(`AI gateway ${aiResp.status}: ${t.slice(0, 300)}`);
        }

        const data = await aiResp.json();
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        const argsStr = toolCall?.function?.arguments;
        if (!argsStr) {
          throw new Error("Model did not return structured book payload.");
        }

        const rawArgs = typeof argsStr === "string" ? argsStr : JSON.stringify(argsStr);
        const parsedRaw = parseBookPagesOutput(rawArgs);

        if (parsedRaw.pages.length !== STORY_LENGTH_BOOK.totalPageCount) {
          console.error(`Expected ${STORY_LENGTH_BOOK.totalPageCount} pages, got ${parsedRaw.pages.length}`);
        }

        const appearance = buildAppearanceBlocks(brief);
        const artStyleFragment = getArtStylePrompt(engineInput.art_style);
        const bookOutfit = parsedRaw.meta.book_outfit;

        const pages = parsedRaw.pages.map((p) => ({
          ...p,
          image_prompt:
            p.role === "title"
              ? null
              : buildPageImagePrompt(p, appearance, artStyleFragment, bookOutfit),
        }));

        const heroCoverDesc = bookOutfit
          ? `${appearance.hero.description}, wearing ${bookOutfit}`
          : appearance.hero.description;

        const coverImagePrompt = [
          `${artStyleFragment}.`,
          `Children's book cover illustration.`,
          `Characters: ${heroCoverDesc}. HERO ONLY — no other people, friends, family, or supporting characters.`,
          parsedRaw.cover.image_scene ? `Scene: ${parsedRaw.cover.image_scene}.` : "",
          parsedRaw.cover.setting ? `Setting: ${parsedRaw.cover.setting}.` : "",
          parsedRaw.cover.mood ? `Mood: ${parsedRaw.cover.mood}.` : "",
          `Composition: portrait orientation (2:3), the title rendered clearly at the top or centered.`,
          `Title text to render on the cover: "${parsedRaw.cover.title}". Render ONLY this title — do not add the child's name, an author byline, or any other text.`,
        ].filter(Boolean).join(" ");

        const generation_ms = Date.now() - startedAt;
        const storyPageWords = pages
          .filter((p) => p.role === "story")
          .reduce((acc, p) => acc + countWords(p.text), 0);

        const parsed: BookOutputV2 = {
          schema_version: "v2",
          meta: {
            title: parsedRaw.meta.title,
            framework_id,
            word_count_total: storyPageWords,
            page_count: pages.length,
            age_band,
            art_style: engineInput.art_style || null,
            repeating_phrase: parsedRaw.meta.repeating_phrase,
            book_outfit: bookOutfit,
            generated_at: new Date().toISOString(),
            model,
            prompt_version: promptHash,
            generation_time_ms: generation_ms,
          },
          cover: {
            title: parsedRaw.cover.title,
            subtitle: parsedRaw.cover.subtitle,
            image_prompt: coverImagePrompt,
          },
          pages,
        };

        const validation = validateBook(parsed, engineInput);

        const { error: updateErr } = await supabase
          .from("generated_books")
          .update({
            raw_output: rawArgs,
            parsed,
            generation_ms,
            status: validation.valid ? "ok" : "needs_review",
            pipeline_status: "portraits",
            pipeline_progress: { stage: "story", current: 1, total: 1, message: "Story written." },
            // Clear any stale error from a premature generate-book-images call.
            pipeline_error: null,
          })
          .eq("id", bookId);

        if (updateErr) {
          throw new Error(`Persist failed: ${updateErr.message}`);
        }

        // Best-effort Drive export — fire and forget.
        try {
          void supabase.functions.invoke("export-book-to-drive", {
            body: { book_id: bookId },
          });
        } catch (e) {
          console.error("Drive export invoke threw:", e);
        }

        // Chain image pipeline.
        try {
          void supabase.functions.invoke("generate-book-images", {
            body: { book_id: bookId, seed_portrait_data_url },
          });
        } catch (e) {
          console.error("generate-book-images invoke threw:", e);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("generate-book background error", msg);
        await supabase
          .from("generated_books")
          .update({
            pipeline_status: "failed",
            pipeline_error: msg,
          })
          .eq("id", bookId);
      }
    };

    // @ts-ignore EdgeRuntime is a Supabase edge-runtime global.
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work());
    } else {
      // Local/dev fallback — fire-and-forget.
      void work();
    }

    return new Response(
      JSON.stringify({ id: bookId, queued: true }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-book error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
