// Generate a lightweight pre-purchase story concept.
// Heavy story planning happens after purchase / during full book generation.

import {
  MODELS,
  STORY_LENGTH,
  TITLE_RETRY_INSTRUCTION,
} from "../_shared/prompts.ts";
import {
  selectSummaryFramework,
  STORY_CONCEPT_SYSTEM_PROMPT,
  STORY_CONCEPT_USER_TEMPLATE,
  summaryPatternForFramework,
  titlePatternForFramework,
  SUMMARY_EXAMPLES_BY_FRAMEWORK,
  type SummaryFrameworkId,
  type SummaryPatternId,
  type TitlePatternId,
} from "../_shared/storyConceptPrompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Brief {
  child?: { name?: string; ageRange?: string; gender?: string; language?: string };
  story?: {
    genre?: string;
    mood?: string;
    lesson?: string;
    interests?: string[];
    personality?: string[];
    thingsAlreadyGoodAt?: string;
    thingsCurrentlyTricky?: string;
    recentMeaningfulMoment?: string;
  };
  protagonist?: { special?: string; [k: string]: unknown };
  supportingCharacters?: Array<{
    name?: string;
    relationship?: string;
    description?: string;
    traits?: string[];
    gender?: string;
    ageRange?: string;
  }>;
  artStyle?: string;
  specialThing?: string | { category?: string; details?: Record<string, string> };
  buyer_relationship?: string;
  buyerRelationship?: string;
  occasion?: string;
}

interface StoryConceptResult {
  title?: string;
  user_visible_summary?: string;
  summary?: string;
  framework_id?: SummaryFrameworkId;
  summary_pattern?: SummaryPatternId;
  title_pattern?: TitlePatternId;
}

const TRAIT_ACTION_MAP: Record<string, string> = {
  brave: "steady choices when something feels hard, uncertain, or a little scary",
  caring: "noticing needs, gentle help, or small acts of comfort",
  clever: "spotting patterns, testing ideas, or solving a problem in an unexpected way",
  confident: "standing tall, speaking clearly, or trusting a practiced skill",
  creative: "making something new, trying an unusual idea, or finding another way",
  curious: "asking questions, investigating clues, or leaning closer to understand",
  determined: "trying again, staying focused, or refusing to quit after a setback",
  energetic: "motion, quick decisions, eager movement, or restless tinkering",
  funny: "playful timing, goofy observations, or making others laugh kindly",
  gentle: "careful touch, soft words, or protecting something small",
  goofy: "playful mistakes, funny faces, or surprising choices",
  helpful: "pitching in, offering a tool, or looking for what someone needs",
  joyful: "delighted reactions, happy movement, or contagious excitement",
  kind: "thoughtful choices, including others, or helping without being asked",
  playful: "games, teasing ideas, or turning a problem into fun",
  quiet: "careful watching, thoughtful pauses, or noticing details others miss",
  resilient: "recovering after disappointment, trying again, or adapting the plan",
  sensitive: "noticing small emotional changes, caring deeply, or responding tenderly",
  shy: "hesitating at first, watching closely, or finding a small way to join in",
  silly: "playful choices, surprising ideas, or physical comedy",
  smart: "asking sharp questions, connecting clues, or planning the next step",
  thoughtful: "pausing to consider others, remembering details, or choosing carefully",
  warm: "noticing feelings, gentle encouragement, or welcoming gestures",
};

const EXTRA_BANNED_DESCRIPTORS = [
  "unstoppable", "joyful", "goofy", "warm", "gentle", "creative", "silly", "energetic",
  "brave", "kind", "clever", "curious", "playful", "whimsical", "magical",
];

const GENERIC_SUMMARY_TERMS = [
  "bigger, stranger, or funnier",
  "invisible structure",
  "works for about three seconds",
];

const GENERIC_TITLE_TERMS = [
  "adventure", "journey", "magical", "wonderful", "special", "confidence", "friendship", "kindness",
];

function describeSpecialThing(s: Brief["specialThing"]): string | undefined {
  if (!s) return undefined;
  if (typeof s === "string") return s;
  const cat = s.category?.replace(/-/g, " ");
  const d = s.details || {};
  const bits = Object.entries(d)
    .filter(([k, v]) => v && typeof v === "string" && k !== "photo" && !v.startsWith("data:"))
    .map(([k, v]) => k === "name" ? `named "${v}"` : k === "color" ? `${v} colored` : v);
  return [cat, bits.join(", ")].filter(Boolean).join(" — ") || undefined;
}

function cleanTrait(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const clean = t.trim().toLowerCase();
  if (!clean) return null;
  return clean.replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, " ");
}

function uniqueTraits(traits: unknown[]): string[] {
  return Array.from(new Set((traits || []).map(cleanTrait).filter(Boolean) as string[]));
}

function traitActionPhrase(trait: string): string {
  return TRAIT_ACTION_MAP[trait] || "specific actions, choices, gestures, or responses";
}

function buildHeroBehaviorNotes(traits: string[]): string | undefined {
  if (!traits.length) return undefined;
  return [
    "Hero behavior notes:",
    "Use these only to decide actions. Do not repeat these words in the visible summary:",
    ...traits.map((trait) => `- ${trait} should appear as ${traitActionPhrase(trait)}.`),
  ].join("\n");
}

function buildSupportingBehaviorNotes(characters: Brief["supportingCharacters"]): string | undefined {
  const lines = (characters || [])
    .map((c) => {
      const name = c.name?.trim() || c.relationship?.trim();
      const traits = uniqueTraits(c.traits || []);
      if (!name || !traits.length) return "";
      const actionHints = traits.map(traitActionPhrase).join("; ");
      return `${name}'s traits are private direction only. Show them through what ${name} notices, offers, fixes, asks, chooses, or how ${name} responds. Useful behavior cues: ${actionHints}. Do not describe ${name} with trait adjectives.`;
    })
    .filter(Boolean);
  return lines.length ? ["Supporting character behavior notes:", ...lines].join("\n") : undefined;
}

function collectForbiddenTraitWords(brief: Brief): string[] {
  const heroTraits = uniqueTraits(brief.story?.personality || []);
  const castTraits = (brief.supportingCharacters || []).flatMap((c) => uniqueTraits(c.traits || []));
  return Array.from(new Set([...heroTraits, ...castTraits, ...EXTRA_BANNED_DESCRIPTORS]));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function containsWord(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
}

function countInterestsUsed(text: string, interests: string[]): number {
  const lower = text.toLowerCase();
  return interests.filter((interest) => {
    const clean = String(interest || "").trim().toLowerCase();
    if (!clean || clean.length < 3) return false;
    const aliases: Record<string, string[]> = {
      robots: ["robot", "robots", "bot", "machine", "invention"],
      robot: ["robot", "robots", "bot", "machine", "invention"],
      fishing: ["fishing", "fish", "river", "pond", "rod", "line"],
      skateboarding: ["skateboarding", "skateboard", "skate", "skatepark"],
      soccer: ["soccer", "goal", "ball"],
      basketball: ["basketball", "hoop", "ball"],
      guitar: ["guitar", "song", "strum", "music", "tune"],
      music: ["music", "song", "tune", "guitar", "singing"],
    };
    const terms = aliases[clean] || [clean];
    return terms.some((term) => lower.includes(term));
  }).length;
}

function titleIssues(title: string, forbiddenTraits: string[], childName: string, interests: string[]): string[] {
  const issues: string[] = [];
  const firstName = childName.trim().split(/\s+/)[0];
  if (!title.trim()) issues.push("empty title");
  if (firstName && containsWord(title, firstName)) issues.push("title contains child name");
  if (title.includes(",")) issues.push("title is a list");
  if (words(title).length > 9) issues.push("title too long");
  for (const trait of forbiddenTraits) if (containsWord(title, trait)) issues.push(`title uses trait word: ${trait}`);
  for (const term of GENERIC_TITLE_TERMS) if (containsWord(title, term)) issues.push(`generic title word: ${term}`);
  if (countInterestsUsed(title, interests) > 1) issues.push("title uses multiple interests");
  if (/\b(and|&)\b/i.test(title) && countInterestsUsed(title, interests) >= 1) issues.push("title may be an ingredient list");
  return Array.from(new Set(issues));
}

function summaryIssues(summary: string, forbiddenTraits: string[], childName: string, interests: string[], frameworkId: SummaryFrameworkId): string[] {
  const issues: string[] = [];
  const lower = summary.toLowerCase();
  for (const term of GENERIC_SUMMARY_TERMS) if (lower.includes(term)) issues.push(`formula phrase: ${term}`);
  for (const term of SUMMARY_EXAMPLES_BY_FRAMEWORK[frameworkId].badPhrases) if (lower.includes(term.toLowerCase())) issues.push(`framework bad phrase: ${term}`);
  for (const trait of forbiddenTraits) if (containsWord(summary, trait)) issues.push(`visible trait word: ${trait}`);
  if (countInterestsUsed(summary, interests) > 2) issues.push("summary uses more than two interests");
  if (words(summary).length > STORY_LENGTH.max + 12) issues.push("summary too long");

  const firstName = childName.trim().split(/\s+/)[0];
  if (firstName) {
    const directDescriptor = new RegExp(`\\b${escapeRegExp(firstName)}\\s+(?:is|was)\\s+(?:an?\\s+)?[^.]{0,45}\\b(?:kid|child|boy|girl|person)\\b`, "i");
    if (directDescriptor.test(summary)) issues.push("direct hero descriptor pattern");
  }
  if (/\b(PAUSE|HYPER|DO NOT|MORE|STOP|START|ON|OFF|MESS)\b/.test(summary)) issues.push("contains likely in-illustration label/button text");
  
  return Array.from(new Set(issues));
}

function lightConceptToolSchema(firstName: string) {
  return {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: `Short kid-friendly title following the requested title_pattern. Do not include ${firstName || "the child's first name"}.`,
      },
      user_visible_summary: {
        type: "string",
        description: `Full beginning-to-end synopsis of the picture book, one flowing paragraph, ${STORY_LENGTH.min}-${STORY_LENGTH.max} words (target ~${STORY_LENGTH.target}). Cover setup, inciting moment, escalations, climactic choice, and resolution. Include the ending — this is NOT a teaser.`,
      },
      framework_id: {
        type: "string",
        enum: ["curiosity_journey", "bedtime_wind_down", "brave_choice", "generous_heart", "silly_escalation"],
      },
      summary_pattern: {
        type: "string",
        enum: ["discovery_trail", "softening_ritual", "hard_but_safe_test", "need_noticed", "escalating_absurd_rule"],
      },
      title_pattern: {
        type: "string",
        enum: ["wonder_object_place", "soft_ritual_goodnight_object", "hard_thing_brave_object", "shared_thing_room_making", "absurd_rule_funny_problem"],
      },
    },
    required: ["title", "user_visible_summary", "framework_id", "summary_pattern", "title_pattern"],
    additionalProperties: false,
  };
}

function cleanTitleFallback(title: string, firstName: string, frameworkId: SummaryFrameworkId): string {
  let clean = title.slice(0, 80).trim();
  if (firstName) {
    const stripRe = new RegExp(`\\b${escapeRegExp(firstName)}(?:'s|s')?\\b`, "gi");
    clean = clean
      .replace(stripRe, "")
      .replace(/\s+(and|&)\s+the\b/i, " The")
      .replace(/^\s*(and|&|the)\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();
  }
  return clean || titlePatternForFramework(frameworkId).examples[0] || "The Little Spark";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const brief: Brief = body.brief || {};
    const previousSummary: string | undefined = body.previousSummary;
    const devMode = body.dev === true || new URL(req.url).searchParams.get("dev") === "1";

    const childName = brief.child?.name || "the child";
    const ageBand = brief.child?.ageRange || "young";
    const heroTraits = uniqueTraits(brief.story?.personality || []);
    const forbiddenTraitWords = collectForbiddenTraitWords(brief);
    const interests = (brief.story?.interests || []).filter(Boolean).map(String);

    const supporting = (brief.supportingCharacters || [])
      .map((c: any) => {
        const rel = c.relationship?.trim();
        const nm = c.name?.trim();
        const desc = c.description?.trim() ? `. ${c.description.trim()}` : "";
        const base = nm && rel ? `${nm} (${rel})` : nm || rel;
        return base ? `${base}${desc}` : "";
      })
      .filter(Boolean)
      .join("; ");

    const conceptCtx = {
      childName,
      ageBand,
      gender: brief.child?.gender,
      language: brief.child?.language,
      genre: brief.story?.genre,
      mood: brief.story?.mood,
      lesson: brief.story?.lesson,
      interestsLine: interests.join(", "),
      personalityLine: heroTraits.join(", "),
      heroBehaviorNotes: buildHeroBehaviorNotes(heroTraits),
      supportingLine: supporting,
      supportingBehaviorNotes: buildSupportingBehaviorNotes(brief.supportingCharacters || []),
      forbiddenTraitWords: forbiddenTraitWords.join(", "),
      specialThing: describeSpecialThing(brief.specialThing),
      heroQuirk: brief.protagonist?.special as string | undefined,
      thingsAlreadyGoodAt: brief.story?.thingsAlreadyGoodAt,
      thingsCurrentlyTricky: brief.story?.thingsCurrentlyTricky,
      recentMeaningfulMoment: brief.story?.recentMeaningfulMoment,
      buyerRelationship: brief.buyer_relationship || brief.buyerRelationship,
      occasion: brief.occasion,
      previousSummary,
    };

    const selectedFrameworkId = selectSummaryFramework(conceptCtx);
    const expectedSummaryPattern = summaryPatternForFramework(selectedFrameworkId).id;
    const expectedTitlePattern = titlePatternForFramework(selectedFrameworkId).id;
    const userPrompt = STORY_CONCEPT_USER_TEMPLATE({ ...conceptCtx, frameworkId: selectedFrameworkId });
    const firstName = String(childName).trim().split(/\s+/)[0];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS.summary,
        messages: [
          { role: "system", content: STORY_CONCEPT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_story_concept",
              description: "Return a lightweight pre-purchase story concept.",
              parameters: lightConceptToolSchema(firstName),
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_story_concept" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      const message = devMode ? `AI gateway ${aiResp.status}: ${t.slice(0, 500)}` : "AI gateway error";
      return new Response(JSON.stringify({ error: message }), { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const argsStr = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      return new Response(JSON.stringify({ error: "Model did not return a structured story concept." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = JSON.parse(argsStr) as StoryConceptResult;
    const rawTitle = String(parsed.title || "").slice(0, 80).trim();
    const cleanTitle = cleanTitleFallback(rawTitle, firstName, selectedFrameworkId);
    const userVisibleSummary = String(parsed.user_visible_summary || parsed.summary || "").trim();

    const issues = Array.from(new Set([
      ...titleIssues(cleanTitle, forbiddenTraitWords, childName, interests),
      ...summaryIssues(userVisibleSummary, forbiddenTraitWords, childName, interests, selectedFrameworkId),
      (parsed.framework_id || selectedFrameworkId) !== selectedFrameworkId ? "framework changed from selected framework" : "",
      (parsed.summary_pattern || expectedSummaryPattern) !== expectedSummaryPattern ? "wrong summary pattern" : "",
      (parsed.title_pattern || expectedTitlePattern) !== expectedTitlePattern ? "wrong title pattern" : "",
    ].filter(Boolean)));

    if (issues.length) console.warn(`Lightweight summary quality warnings: ${issues.join("; ")}`);

    return new Response(JSON.stringify({
      title: cleanTitle,
      summary: userVisibleSummary,
      user_visible_summary: userVisibleSummary,
      framework_id: selectedFrameworkId,
      summary_pattern: expectedSummaryPattern,
      title_pattern: expectedTitlePattern,
      // The heavy fields below are intentionally deferred until after payment / full book generation.
      framework_reason: "Selected from lightweight wizard context.",
      story_seed: null,
      personalization_notes: null,
      full_book_instruction: null,
      ...(devMode ? { _debug: { model: MODELS.summary, quality_warnings: issues } } : {}),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-summary error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
