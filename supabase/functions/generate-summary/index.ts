// Generate a single ~100-word kid-friendly story summary.
// Returns { title, summary } via structured tool-call output.
//
// Prompt copy lives in ../_shared/prompts.ts — edit there to tweak for all users.

import {
  MODELS,
  STORY_LENGTH,
  STORY_SYSTEM_PROMPT,
  STORY_USER_TEMPLATE,
  TITLE_RETRY_INSTRUCTION,
} from "../_shared/prompts.ts";

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
  specialThing?:
    | string
    | { category?: string; details?: Record<string, string> };
}

function describeSpecialThing(
  s: Brief["specialThing"],
): string | undefined {
  if (!s) return undefined;
  if (typeof s === "string") return s;
  const cat = s.category?.replace(/-/g, " ");
  const d = s.details || {};
  // Drop photo data URLs and empty values; keep readable detail bits.
  const bits = Object.entries(d)
    .filter(([k, v]) =>
      v && typeof v === "string" && k !== "photo" && !v.startsWith("data:"),
    )
    .map(([k, v]) => {
      if (k === "name") return `named "${v}"`;
      if (k === "color") return `${v} colored`;
      return v;
    });
  if (!cat && !bits.length) return undefined;
  return [cat, bits.join(", ")].filter(Boolean).join(" — ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const brief: Brief = body.brief || {};
    const previousSummary: string | undefined = body.previousSummary;

    const childName = brief.child?.name || "the child";
    const ageBand = brief.child?.ageRange || "young";

    const supporting = (brief.supportingCharacters || [])
      .map((c: any) => {
        const rel = c.relationship?.trim();
        const nm = c.name?.trim();
        const traits = Array.isArray(c.traits) && c.traits.length
          ? ` — ${c.traits.join(", ")}`
          : "";
        const desc = c.description?.trim()
          ? `. ${c.description.trim()}`
          : "";
        const base = nm && rel ? `${nm} (${rel})` : nm || rel;
        return base ? `${base}${traits}${desc}` : "";
      })
      .filter(Boolean)
      .join("; ");

    const interestsLine = (brief.story?.interests || [])
      .filter(Boolean)
      .join(", ");

    const personalityLine = (brief.story?.personality || [])
      .filter(Boolean)
      .join(", ");

    const userPrompt = STORY_USER_TEMPLATE({
      childName,
      ageBand,
      gender: brief.child?.gender,
      language: brief.child?.language,
      genre: brief.story?.genre,
      mood: brief.story?.mood,
      lesson: brief.story?.lesson,
      interestsLine,
      personalityLine,
      supportingLine: supporting,
      specialThing: describeSpecialThing(brief.specialThing),
      heroQuirk: brief.protagonist?.special as string | undefined,
      previousSummary,
    });

    const firstName = String(childName).trim().split(/\s+/)[0];
    const nameRe = firstName
      ? new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:'s|s')?\\b`, "i")
      : null;
    const titleHasName = (t: string) => !!(nameRe && nameRe.test(t));

    const callModel = async (extraInstruction?: string) => {
      const messages = [
        { role: "system", content: STORY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ];
      if (extraInstruction) {
        messages.push({ role: "user", content: extraInstruction });
      }

      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELS.summary,
          messages,
          tools: [
            {
              type: "function",
              function: {
                name: "return_story_summary",
                description: "Return a single working title and a ~100-word summary.",
                parameters: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: `Short, kid-friendly working title (max 60 chars). MUST NOT contain the child's first name${firstName ? ` "${firstName}"` : ""}.`,
                    },
                    summary: {
                      type: "string",
                      description: `Single paragraph, ~${STORY_LENGTH.target} words (${STORY_LENGTH.min}–${STORY_LENGTH.max}), narrative summary.`,
                    },
                  },
                  required: ["title", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_story_summary" },
          },
        }),
      });
      return r;
    };

    // Try up to 3 times — if the title contains the child's name, re-prompt with feedback.
    let parsed: { title?: string; summary?: string } | null = null;
    let lastBadTitle: string | null = null;
    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const feedback = lastBadTitle
        ? TITLE_RETRY_INSTRUCTION(lastBadTitle, firstName)
        : undefined;

      const aiResp = await callModel(feedback);

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          return new Response(
            JSON.stringify({ error: "We're a bit busy — please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (aiResp.status === 402) {
          return new Response(
            JSON.stringify({
              error: "Out of AI credits. Please add credits in Settings → Workspace → Usage.",
            }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const t = await aiResp.text();
        console.error("AI gateway error", aiResp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = toolCall?.function?.arguments;
      if (!argsStr) {
        console.error("No tool call in AI response", JSON.stringify(data));
        return new Response(
          JSON.stringify({ error: "Model did not return a structured summary." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const candidate = JSON.parse(argsStr);
      const candidateTitle = String(candidate.title || "").slice(0, 80).trim();

      if (!titleHasName(candidateTitle)) {
        parsed = { title: candidateTitle, summary: candidate.summary };
        console.log(`Title validated on attempt ${attempt}: "${candidateTitle}"`);
        break;
      }

      console.warn(`Attempt ${attempt}: title "${candidateTitle}" contains "${firstName}" — re-prompting.`);
      lastBadTitle = candidateTitle;
      parsed = { title: candidateTitle, summary: candidate.summary }; // keep latest as fallback
    }

    // Final safety net: if all attempts produced a name-containing title, scrub it.
    let cleanTitle = String(parsed?.title || "").slice(0, 80);
    if (nameRe && titleHasName(cleanTitle)) {
      console.warn(`All ${MAX_ATTEMPTS} attempts violated rule. Scrubbing "${cleanTitle}".`);
      const stripRe = new RegExp(`\\b${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:'s|s')?\\b`, "gi");
      cleanTitle = cleanTitle
        .replace(stripRe, "")
        .replace(/\s+(and|&)\s+the\b/i, " The")
        .replace(/^\s*(and|&|the)\s+/i, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .trim();
      if (!cleanTitle) cleanTitle = "An Amazing Adventure";
    }

    return new Response(
      JSON.stringify({
        title: cleanTitle,
        summary: String(parsed?.summary || ""),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-summary error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
