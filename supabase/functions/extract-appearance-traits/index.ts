// Vision pre-pass that looks at the hero child's first uploaded photo and
// extracts a small JSON blob of appearance traits (hair color, skin tone,
// eye color, glasses, etc.). The portrait pipeline runs this BEFORE
// generate-character-portrait so the prompt has explicit, hard text like
// "hair color: Blonde" reinforcing the photo. Without this, the model
// frequently drifts to default cartoon brown hair.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

const EXTRACT_PROMPT = `You are looking at a photograph of a real child. Extract the child's visible appearance traits as STRICT JSON. Do not guess — only fill fields you can clearly see.

Return ONLY a JSON object (no markdown, no commentary) with these fields:
{
  "hair_color": "Blonde" | "Brown" | "Black" | "Red" | "Gray" | "White" | "Other" | "",
  "hair_length": "Short" | "Medium" | "Long" | "",
  "hair_style": "Straight" | "Curly" | "Wavy" | "Braids" | "Bald" | "",
  "skin_tone": "very fair" | "fair" | "light" | "medium" | "tan" | "brown" | "dark" | "",
  "eye_color": "Blue" | "Green" | "Brown" | "Hazel" | "Gray" | "",
  "glasses": true | false,
  "distinguishing": "freckles, dimples, gap teeth, etc. — short phrase, or empty string"
}

If a trait is not clearly visible, use an empty string (or false for glasses). Do NOT invent.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { photoDataUrl } = await req.json();
    if (typeof photoDataUrl !== "string" || !photoDataUrl.startsWith("data:")) {
      return new Response(
        JSON.stringify({ error: "photoDataUrl (data URL) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: EXTRACT_PROMPT },
                { type: "image_url", image_url: { url: photoDataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error (traits)", aiResp.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error", status: aiResp.status }),
        { status: aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const raw: string | undefined = data.choices?.[0]?.message?.content;
    let traits: Record<string, unknown> = {};
    if (raw) {
      try {
        traits = JSON.parse(raw);
      } catch {
        // Try to recover JSON from a fenced block
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          try { traits = JSON.parse(m[0]); } catch { /* ignore */ }
        }
      }
    }

    return new Response(JSON.stringify({ traits }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-appearance-traits error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
