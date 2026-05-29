// Generate a canonical full-body portrait of the protagonist in the chosen
// art style. Fired in the background from Step 6 (character page) as soon as
// the first photo is uploaded. The resulting image is:
//   1. shown above the story summary on Step 8, and
//   2. passed back into generate-cover as the primary likeness anchor.
//
// Prompt copy lives in ../_shared/prompts.ts (CHARACTER_PORTRAIT_PROMPT_TEMPLATE).

import {
  CHARACTER_PORTRAIT_PROMPT_TEMPLATE,
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
      pose = "front",
      photoDataUrl,
      anchorPortraitDataUrl,
    }: {
      brief?: any;
      pose?: "front" | "side" | "action";
      photoDataUrl?: string;
      anchorPortraitDataUrl?: string;
    } = body;

    const childName = brief.child?.name || "the child";
    const proto = brief.protagonist || {};

    // Source photos for likeness. If a specific photoDataUrl was passed
    // (portraits 2/3 use only one alt photo), use just that. Otherwise
    // fall back to the protagonist's full photo array (portrait 1 default).
    const heroPhotos: string[] = photoDataUrl
      ? [photoDataUrl]
      : Array.isArray(proto.photos)
        ? proto.photos.filter(
            (p: unknown) => typeof p === "string" && p.startsWith("data:"),
          )
        : proto.photoDataUrl
          ? [proto.photoDataUrl]
          : [];

    const hasAnchorPortrait =
      typeof anchorPortraitDataUrl === "string" &&
      anchorPortraitDataUrl.startsWith("data:");

    const styleHint = getArtStylePrompt(brief.artStyle);

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

    const interests: string[] = Array.isArray(brief.story?.interests)
      ? brief.story.interests
      : [];
    const interestPhrase = interests.slice(0, 2).join(" and ") || undefined;

    const promptText = CHARACTER_PORTRAIT_PROMPT_TEMPLATE({
      childName,
      protoDesc,
      styleHint,
      heroPhotoCount: heroPhotos.length,
      pose,
      interestPhrase,
      hasAnchorPortrait,
    });

    // Image order MUST match the prompt's "Image #N" references:
    //   [anchorPortrait?] [heroPhotos…]
    const userContent: any[] = [{ type: "text", text: promptText }];
    if (hasAnchorPortrait) {
      userContent.push({
        type: "image_url",
        image_url: { url: anchorPortraitDataUrl },
      });
    }
    for (const url of heroPhotos) {
      userContent.push({ type: "image_url", image_url: { url } });
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
          model: MODELS.cover,
          messages: [{ role: "user", content: userContent }],
          modalities: ["image"],
          image_config: { aspect_ratio: "2:3", image_size: "2K" },
        }),
      },
    );

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
      console.error("AI gateway error (portrait)", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const imageDataUrl: string | undefined =
      data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl) {
      console.error("No image in AI response", JSON.stringify(data).slice(0, 800));
      return new Response(
        JSON.stringify({ error: "Model did not return an image." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ imageDataUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-character-portrait error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
