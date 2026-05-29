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

function joinAppearance(a: any): string | null {
  if (!a) return null;
  const bits = [
    a.hairColor && `hair ${a.hairColor}`,
    a.hairStyle && `${a.hairStyle} hair`,
    a.skinTone && `${a.skinTone} skin`,
    a.glasses && `wears glasses`,
    a.features,
  ].filter(Boolean);
  return bits.length ? bits.join(", ") : null;
}

function ageRangeMidpoint(band?: string): number {
  if (!band) return 5;
  return AGE_BAND_TO_INT[band] ?? 5;
}

function mapBriefToEngineInput(brief: any): BookEngineInput {
  const child = brief.child || {};
  const story = brief.story || {};
  const proto = brief.protagonist || {};
  const cast: any[] = Array.isArray(brief.supportingCharacters)
    ? brief.supportingCharacters
    : [];
  const special = flattenSpecialThing(brief.specialThing);

  const moodTags: string[] = Array.isArray(story.mood)
    ? story.mood
    : story.mood
      ? [story.mood]
      : [];

  const childAge = Number.isFinite(brief.child_age_int)
    ? brief.child_age_int
    : ageRangeMidpoint(child.ageRange);

  return {
    child_name: (child.name || "the child").toString().trim(),
    child_age: childAge,
    child_pronouns: GENDER_TO_PRONOUN[(child.gender || "").toLowerCase()] ?? "they",
    child_appearance_notes: joinAppearance(proto.appearance),
    child_special: proto.special || null,
    personality_traits: Array.isArray(story.personality) ? story.personality.slice(0, 3) : [],

    buyer_relationship: (brief.buyer_relationship || undefined) as BookEngineInput["buyer_relationship"],
    occasion: (brief.occasion || null) as BookEngineInput["occasion"],
    include_belongs_to_page: brief.bookBelongsTo !== false,

    genre: mapGenre(story.genre),
    mood_tags: moodTags,
    value: mapValue(story.lesson),

    interests: Array.isArray(story.interests) ? story.interests : [],
    cameo_type: special.type ?? null,
    cameo_detail: special.detail ?? null,

    supporting_cast: cast.map((c) => ({
      name: c.name || "Friend",
      role: inferRole(c.relationship, c.category),
      relationship: c.relationship,
      age: typeof c.age === "number" ? c.age : undefined,
      description: c.description,
      personality_traits: Array.isArray(c.traits) ? c.traits.slice(0, 2) : [],
    })),

    art_style: brief.artStyle,

    things_already_good_at: brief.things_already_good_at ?? null,
    things_currently_tricky: brief.things_currently_tricky ?? null,
    recent_meaningful_moment: brief.recent_meaningful_moment ?? null,
  };
}

// ---------- Variable bag from engine input ----------------------------------

function buildKernelVars(input: BookEngineInput, framework_id: FrameworkId): KernelVars {
  const age_band = ageToBand(input.child_age);
  const vocab_tier = VOCAB_TIER_BY_AGE[age_band];
  const p = pronounsFor(input.child_pronouns);
  const cast_summary = formatCastSummary(input.supporting_cast);

  return {
    child_name: input.child_name,
    child_age: input.child_age,
    child_pronouns: input.child_pronouns,
    child_pronouns_subject: p.subject,
    child_pronouns_object: p.object,
    child_pronouns_possessive: p.possessive,
    child_pronouns_subject_capitalized: p.subject_capitalized,
    buyer_relationship: BUYER_RELATIONSHIP_LABEL[input.buyer_relationship || "other"] || "loved one",
    personality_traits: (input.personality_traits || []).join(", ") || undefined,
    child_special: input.child_special || undefined,
    child_appearance_notes: input.child_appearance_notes || undefined,
    interest_phrase: grammaticalJoin(input.interests),
    cameo_detail: input.cameo_detail || undefined,
    cameo_type: input.cameo_type || undefined,
    things_already_good_at: input.things_already_good_at || undefined,
    things_currently_tricky: input.things_currently_tricky || undefined,
    recent_meaningful_moment: input.recent_meaningful_moment || undefined,
    cast_summary: cast_summary || undefined,
    framework_id,
    value: input.value,
    mood_tags: (input.mood_tags || []).join(", ") || "warm",
    occasion: input.occasion ? (OCCASION_LABEL[input.occasion] || "none specified") : "none specified",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const rawBrief = body.brief || {};
    const buyer_name: string | undefined = body.buyer_name || rawBrief.buyer_name;
    const buyer_email: string | undefined = body.buyer_email || rawBrief.buyer_email;
    const brief = { ...rawBrief, buyer_name, buyer_email };
    const revision_note: string | undefined = body.revision_note || undefined;
    const model: string = body.modelOverride || MODELS.book;
    const seed_portrait_data_url: string | null = body.seed_portrait_data_url || null;

    const engineInput = mapBriefToEngineInput(brief);
    const framework_id = selectFramework({
      value: engineInput.value,
      genre: engineInput.genre,
      mood_tags: engineInput.mood_tags,
    });
    const vars = buildKernelVars(engineInput, framework_id);
    const age_band = vars.age_band;

    const systemPrompt =
      STORY_KERNEL(vars) + "\n\n---\n\n" + STORY_FRAMEWORKS[framework_id](vars);
    const promptHash = await shortHash(systemPrompt);

    const userMessage = buildBookUserMessageV2({
      age_band,
      include_belongs_to_page: engineInput.include_belongs_to_page,
      buyer_relationship_label: vars.buyer_relationship,
      occasion_label: vars.occasion,
      child_name: engineInput.child_name,
    }) + (revision_note ? `\n\nRevision note: ${revision_note}` : "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon);

    // Insert stub row immediately so the client has an id to poll.
    const { data: stubRow, error: stubErr } = await supabase
      .from("generated_books")
      .insert({
        framework_id,
        brief: { ...brief, _engine_input: engineInput },
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
            temperature: 0.8,
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

