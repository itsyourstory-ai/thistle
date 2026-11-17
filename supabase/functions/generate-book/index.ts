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
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { isValidEmail, sanitizeUserText, stripDataUrls } from "../_shared/sanitize.ts";
import { isServiceRoleRequest, rateLimitExceeded } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { isCheckoutBypassAllowed } from "../_shared/checkoutBypass.ts";
import { maybeSendCreating, maybeSendFailed } from "../_shared/bookEmails.ts";
import {
  type BookDecision,
  claimOrderBook,
  decideBookForOrder,
  linkBookToOrder,
  orderPaymentState,
} from "../_shared/orderBook.ts";
import { CAN_BECOME_PAID_FROM } from "../_shared/orderStatus.ts";
import {
  type InputsReadDb,
  loadRetryInputs,
  loadServerStartInputs,
  type ServerStartInputs,
} from "../_shared/serverStart.ts";
import {
  ageToBand,
  applyDedication,
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
    supporting_cast: supportingFromWizard,
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

  // Title and summary can be user-edited free text — sanitize before they
  // are interpolated into the prompt. Summary gets a generous cap.
  const title = sanitizeUserText(concept.title || "", 300);
  const summary = sanitizeUserText(
    concept.user_visible_summary || concept.summary || "",
    4000,
  );
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

/** The order already has a book in progress or done: hand back its id. */
function existingBookResponse(bookId: string): Response {
  return new Response(
    JSON.stringify({ id: bookId, queued: false, existing: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Two kinds of caller:
    //  - The buyer's browser: a user JWT, with the brief in the body. Login is required.
    //  - stripe-webhook (THI-38): the service-role key and just an order_id. It
    //    starts the book after payment even if the buyer closed the tab. The brief,
    //    portrait and buyer details come from the order; the book is created for
    //    the order's owner.
    // Everything after this point is shared, including the paid-order gate and
    // the one-order-one-book logic.
    // deno-lint-ignore no-explicit-any
    let body: any;
    let userId: string;
    let serverStart: Extract<ServerStartInputs, { ok: true }> | null = null;
    if (isServiceRoleRequest(req)) {
      body = await req.json();
      const loaded = await loadServerStartInputs(supabase as unknown as InputsReadDb, body.order_id);
      if (!loaded.ok) {
        return new Response(
          JSON.stringify({ error: loaded.error }),
          { status: loaded.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      serverStart = loaded;
      userId = loaded.userId;
    } else {
      // SUPABASE_ANON_KEY is deprecated in newer projects; fall back to parsing
      // SUPABASE_PUBLISHABLE_KEYS (a JSON dict) if the legacy key is absent.
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ||
        (JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? "");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = user.id;

      // Per-user rate limit. The service-role path (stripe-webhook) is trusted
      // server-to-server and is not rate limited.
      const allowed = await checkRateLimit(supabase, userId, "generate-book", 5, 60);
      if (!allowed) return rateLimitExceeded(corsHeaders);

      body = await req.json();

      // A retry from the book page (THI-10) sends only `retry_book_id`: after a
      // reload the browser has no brief. Load the saved inputs from the caller's
      // own order. The caller stays the user, and the paid-order gate below still
      // runs for them.
      if (body.retry_book_id !== undefined) {
        const loaded = await loadRetryInputs(supabase as unknown as InputsReadDb, userId, body.retry_book_id);
        if (!loaded.ok) {
          return new Response(
            JSON.stringify({ error: loaded.error }),
            { status: loaded.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        serverStart = loaded;
      }
    }

    // Where the request's inputs come from: the body for a browser call, the
    // saved order for a server start or a retry (neither honors the dev bypass).
    const input = serverStart
      ? {
        brief: serverStart.brief,
        buyer_name: serverStart.buyerName ?? undefined,
        buyer_email: serverStart.buyerEmail ?? "",
        seed_portrait_data_url: serverStart.seedPortraitDataUrl,
        order_id: serverStart.orderId,
        bypass_checkout: false,
      }
      : body;
    const rawBrief = stripDataUrls(input.brief || {});
    const buyer_name: string | undefined = input.buyer_name || rawBrief.buyer_name;
    // Validate buyer_email; drop (store empty string) if malformed.
    const rawBuyerEmail = input.buyer_email || rawBrief.buyer_email;
    const buyer_email: string = isValidEmail(rawBuyerEmail) ? rawBuyerEmail : "";
    const brief = { ...rawBrief, buyer_name, buyer_email };
    // A server start or a retry is made from the saved order, so the request
    // body can't steer the prompt or pick the model.
    const revision_note: string | undefined = !serverStart && body.revision_note
      ? sanitizeUserText(body.revision_note, 4000)
      : undefined;
    const model: string = (!serverStart && body.modelOverride) || MODELS.book;
    const seed_portrait_data_url: string | null = input.seed_portrait_data_url || null;
    const order_id: string | null = input.order_id ?? null;
    // Dev bypass is only honored when the ALLOW_CHECKOUT_BYPASS secret is "true"
    // (never set in the shared project) and the Stripe key isn't live. See THI-37.
    const bypassCheckout = isCheckoutBypassAllowed(input.bypass_checkout === true, {
      ALLOW_CHECKOUT_BYPASS: Deno.env.get("ALLOW_CHECKOUT_BYPASS"),
      STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY"),
    });

    // ── Paid-order gate ────────────────────────────────────────────────────────
    // All generation requires a paid order. If the webhook hasn't landed yet,
    // fall back to retrieving the PaymentIntent from Stripe directly.
    // The dev bypass (above) skips the gate entirely.
    //
    // One paid order = one book (THI-36). `bookDecision` says whether to create
    // a book, return the order's existing one, or restart it after a failure.
    let bookDecision: BookDecision = { action: "create", claimFrom: null };
    let previousStoryStartedAt: string | null = null;
    let existingBookStamps = {
      creating_email_sent_at: null as string | null,
      ready_email_sent_at: null as string | null,
      failed_email_sent_at: null as string | null,
    };
    if (!bypassCheckout) {
      if (!order_id) {
        return new Response(
          JSON.stringify({ error: "order_id is required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, status, stripe_payment_intent_id, book_id")
        .eq("id", order_id)
        .eq("user_id", userId)
        .maybeSingle();

      // A database error is not "no such order": answer 500 so callers (the
      // payment webhook) retry instead of giving up.
      if (orderErr) throw new Error(`Order lookup failed: ${orderErr.message}`);
      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const paymentState = orderPaymentState(order);
      if (paymentState === "refunded") {
        // Checked before the Stripe fallback: a refunded PaymentIntent stays "succeeded".
        return new Response(
          JSON.stringify({ error: "This order was refunded, so it can't be used to make a book." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (paymentState === "check_stripe") {
        // Webhook may not have landed yet — check Stripe directly as a fallback.
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
          // @ts-ignore — Deno requires the fetch http client
          apiVersion: "2024-04-10",
          httpClient: Stripe.createFetchHttpClient(),
        });
        const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
        if (pi.status !== "succeeded") {
          return new Response(
            JSON.stringify({ error: "Payment not completed." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Mark the order paid so future calls and the webhook are idempotent.
        await supabase
          .from("orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          // Never move a refunded order back to paid, even if a refund landed
          // since we read the status above (THI-68).
          .in("status", [...CAN_BECOME_PAID_FROM]);
      }

      // Does this order already have a book?
      let existingBook: {
        id: string;
        pipeline_status: string | null;
        pipeline_progress: { started_at?: string } | null;
        created_at: string | null;
        story_meta: unknown;
        creating_email_sent_at: string | null;
        ready_email_sent_at: string | null;
        failed_email_sent_at: string | null;
      } | null = null;
      if (order.book_id) {
        const { data: bookRow, error: bookErr } = await supabase
          .from("generated_books")
          .select(
            "id, pipeline_status, pipeline_progress, created_at, story_meta:parsed->meta, creating_email_sent_at, ready_email_sent_at, failed_email_sent_at",
          )
          .eq("id", order.book_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (bookErr) throw new Error(`Book lookup failed: ${bookErr.message}`);
        existingBook = bookRow;
      }
      bookDecision = decideBookForOrder(
        order.book_id ?? null,
        existingBook && {
          id: existingBook.id,
          pipeline_status: existingBook.pipeline_status,
          has_story: existingBook.story_meta != null,
          story_started_at: existingBook.pipeline_progress?.started_at ?? existingBook.created_at,
        },
      );
      if (existingBook) {
        existingBookStamps = {
          creating_email_sent_at: existingBook.creating_email_sent_at,
          ready_email_sent_at: existingBook.ready_email_sent_at,
          // A restart clears the failed stamp (below), so a second failure emails again.
          failed_email_sent_at: null,
        };
        previousStoryStartedAt = existingBook.pipeline_progress?.started_at ?? null;
      }

      if (bookDecision.action === "existing") {
        return existingBookResponse(bookDecision.bookId);
      }

      if (bookDecision.action === "restart" && bookDecision.from === "images") {
        // The story is written; only the pictures failed. Resume the image
        // pipeline, which reuses every image it already made.
        const { data: claimed, error: claimErr } = await supabase
          .from("generated_books")
          .update({
            pipeline_status: "portraits",
            pipeline_error: null,
            pipeline_progress: { stage: "portraits", current: 0, total: 1, message: "Picking up where we left off…" },
            failed_email_sent_at: null,
          })
          .eq("id", bookDecision.bookId)
          .eq("pipeline_status", "failed")
          .select("id");
        if (claimErr) throw new Error(`Book restart failed: ${claimErr.message}`);
        // Another call restarted it first: just return the book.
        if (!claimed?.length) return existingBookResponse(bookDecision.bookId);
        try {
          void supabase.functions.invoke("generate-book-images", {
            body: { book_id: bookDecision.bookId, seed_portrait_data_url },
          });
        } catch (e) {
          console.error("generate-book-images invoke threw:", e);
        }
        return new Response(
          JSON.stringify({ id: bookDecision.bookId, queued: true, restarted: true }),
          { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    // ── End paid-order gate ────────────────────────────────────────────────────

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
        child_name: engineInput.child_name,
      }),
      approvedConceptInstruction,
      revision_note ? `Revision note: ${revision_note}` : "",
    ].filter(Boolean).join("\n\n");

    const storyRowFields = {
      framework_id,
      brief: { ...brief, approvedConcept },
      model,
      prompt_hash: promptHash,
      status: "pending",
      buyer_name: buyer_name || null,
      buyer_email: buyer_email || null,
      pipeline_status: "story",
      pipeline_error: null,
      pipeline_progress: {
        stage: "story",
        current: 0,
        total: 1,
        message: "Writing the story…",
        // Lets a later call spot a story run whose worker died (THI-36).
        started_at: new Date().toISOString(),
      },
    };

    let bookId: string;
    if (bookDecision.action === "restart") {
      // The book failed (or its story run died) before its story was saved:
      // rewrite it in the same row. Only reset it if it's still in the state we
      // read, so two retries can't both run.
      let restartQuery = supabase
        .from("generated_books")
        .update({ ...storyRowFields, failed_email_sent_at: null })
        .eq("id", bookDecision.bookId);
      if (bookDecision.reason === "failed") {
        restartQuery = restartQuery.eq("pipeline_status", "failed");
      } else {
        restartQuery = restartQuery.eq("pipeline_status", "story");
        restartQuery = previousStoryStartedAt
          ? restartQuery.eq("pipeline_progress->>started_at", previousStoryStartedAt)
          : restartQuery.is("pipeline_progress->>started_at", null);
      }
      const { data: claimed, error: claimErr } = await restartQuery.select("id");
      if (claimErr) throw new Error(`Book restart failed: ${claimErr.message}`);
      if (!claimed?.length) return existingBookResponse(bookDecision.bookId);
      bookId = bookDecision.bookId;
    } else {
      // Insert stub row immediately so the client has an id to poll.
      const { data: stubRow, error: stubErr } = await supabase
        .from("generated_books")
        .insert({ ...storyRowFields, user_id: userId })
        .select("id")
        .single();

      if (stubErr || !stubRow?.id) {
        console.error("Stub insert failed", stubErr);
        return new Response(
          JSON.stringify({ error: stubErr?.message || "Could not create book row." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      bookId = stubRow.id as string;

      if (!bypassCheckout && order_id) {
        // Link the book to the order, but only if no other call linked one
        // first. If we lose that race, drop our stub and return the winner.
        const won = await claimOrderBook(supabase, {
          orderId: order_id,
          userId,
          bookId,
          claimFrom: bookDecision.claimFrom,
        });
        if (!won) {
          await supabase.from("generated_books").delete().eq("id", bookId);
          const { data: latest } = await supabase
            .from("orders")
            .select("book_id")
            .eq("id", order_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (latest?.book_id) return existingBookResponse(latest.book_id);
          return new Response(
            JSON.stringify({ error: "Could not link the book to this order. Please try again." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else if (order_id) {
        // Dev bypass: no paid-order check ran, so only link an order the
        // caller owns (THI-59).
        let linked = false;
        try {
          linked = await linkBookToOrder(supabase, {
            orderId: order_id,
            userId,
            bookId,
          });
        } catch (e) {
          // Don't leave a stub row stuck at "story" with no order and no worker.
          await supabase.from("generated_books").delete().eq("id", bookId);
          throw e;
        }
        if (!linked) {
          console.warn("generate-book: bypass order not linked (not owned by caller)", { order_id });
        }
      }
    }

    // A server-started book has no browser to delete the finished draft (the
    // browser path does it in Step9Generating), so do it here. Best effort.
    if (serverStart?.draftId) {
      const { error: draftErr } = await supabase
        .from("book_drafts")
        .delete()
        .eq("id", serverStart.draftId)
        .eq("user_id", userId);
      if (draftErr) console.error("generate-book: draft cleanup failed:", draftErr);
    }

    const book = {
      id: bookId,
      buyer_email: buyer_email || null,
      brief: { ...brief, approvedConcept },
      ...existingBookStamps,
    };

    await maybeSendCreating(supabase, book);

    // Background work — story AI call + persist + chain image pipeline.
    const work = async () => {
      const startedAt = Date.now();
      try {
        const schema = buildBookJsonSchema();
        const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
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

        const pagesWithDedication = applyDedication(parsedRaw.pages, brief.dedicationText);
        const pages = pagesWithDedication.map((p) => ({
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
        await maybeSendFailed(supabase, book);
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
