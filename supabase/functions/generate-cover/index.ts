// Generate a single book-cover illustration.
// Uses the uploaded protagonist photo (if provided) for likeness reference.
// Returns { imageDataUrl } as a base64 data URL.
//
// Prompt copy lives in ../_shared/prompts.ts — edit there to tweak for all users.

import {
  COVER_PROMPT_TEMPLATE,
  getArtStylePrompt,
  MODELS,
} from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      brief = {},
      title = "",
      summary = "",
      styleReferenceImage,
      characterPortraitDataUrl,
    }: {
      brief?: any;
      title?: string;
      summary?: string;
      styleReferenceImage?: string;
      characterPortraitDataUrl?: string;
    } = body;

    const childName = brief.child?.name || "the child";
    const proto = brief.protagonist || {};

    // Collect hero photos (new field is `photos[]`; fall back to legacy single).
    const heroPhotos: string[] = Array.isArray(proto.photos)
      ? proto.photos.filter((p: unknown) => typeof p === "string" && p.startsWith("data:"))
      : proto.photoDataUrl
        ? [proto.photoDataUrl]
        : [];

    // NOTE: Supporting characters are intentionally EXCLUDED from the cover.

    const styleHint = getArtStylePrompt(brief.artStyle);

    // Hero appearance — read the field names that Step6 actually saves.
    const app = proto.appearance || {};
    const protoDescBits = [
      proto.age && `age: ${proto.age}`,
      proto.gender && `gender: ${proto.gender}`,
      app.hairColor && `hair color: ${app.hairColor}`,
      app.hairStyle && `hair style: ${app.hairStyle}`,
      app.skinTone && `skin tone: ${app.skinTone}`,
      app.glasses && `wears glasses`,
      app.features && `other: ${app.features}`,
      proto.special && `signature detail: ${proto.special}`,
    ].filter(Boolean);
    const protoDesc = protoDescBits.join(", ");

    const hasCharacterPortrait =
      typeof characterPortraitDataUrl === "string" &&
      characterPortraitDataUrl.startsWith("data:");

    const promptText = COVER_PROMPT_TEMPLATE({
      title,
      summary,
      childName,
      protoDesc,
      styleHint,
      hasStyleReference: !!styleReferenceImage,
      hasCharacterPortrait,
      heroPhotoCount: heroPhotos.length,
    });

    const userContent: any[] = [{ type: "text", text: promptText }];
    // Image order MUST match the prompt's "Image #N" references:
    //   [styleRef?] [characterPortrait?] [heroPhotos…]
    if (styleReferenceImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: styleReferenceImage },
      });
    }
    if (hasCharacterPortrait) {
      userContent.push({
        type: "image_url",
        image_url: { url: characterPortraitDataUrl },
      });
    }
    for (const url of heroPhotos) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    const callGateway = () =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELS.cover,
          messages: [{ role: "user", content: userContent }],
          modalities: ["image", "text"],
          image_config: { aspect_ratio: "1:1", image_size: "1K" },
        }),
      });

    let aiResp = await callGateway();
    // Retry once on empty/5xx — gateway occasionally drops the body.
    if (!aiResp.ok && aiResp.status >= 500 && aiResp.status !== 502) {
      aiResp = await callGateway();
    }

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({
            error: "We're a bit busy — please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Out of AI credits. Please add credits in Settings → Workspace → Usage.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error (cover)", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawText = await aiResp.text();
    // Retry once if body came back empty or unparseable — the gateway occasionally truncates.
    const looksBad = (t: string) => {
      if (!t) return true;
      try { JSON.parse(t); return false; } catch { return true; }
    };
    if (looksBad(rawText)) {
      console.warn("Empty/malformed body from AI gateway (cover); retrying once. len=", rawText.length);
      const retry = await callGateway();
      if (retry.ok) rawText = await retry.text();
    }
    if (!rawText) {
      console.error("Empty body from AI gateway (cover) after retry");
      return new Response(
        JSON.stringify({ error: "Image model returned an empty response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Failed to parse AI response (cover) after retry", parseErr, rawText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Image model returned a malformed response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const imageDataUrl: string | undefined =
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl) {
      console.error("No image in AI response", JSON.stringify(data).slice(0, 800));
      return new Response(
        JSON.stringify({ error: "Model did not return an image." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ imageDataUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-cover error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
