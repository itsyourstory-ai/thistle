// Background portrait generation for the protagonist.
//
// Fires `generate-character-portrait` as soon as the user has uploaded at
// least one photo of the hero. The result becomes:
//   1. the preview shown above the story summary on Step 8, and
//   2. the canonical likeness anchor passed to generate-cover (and later
//      generate-book).
//
// Re-fires only when the FIRST photo or the selected art style changes
// (tracked via a small sourceHash). Status lives in WizardContext so the
// hook can be mounted on multiple steps without double-firing.

import { useCallback, useEffect, useRef } from "react";
import { useWizard } from "@/contexts/WizardContext";
import { buildBrief } from "@/lib/buildBrief";
import { supabase } from "@/integrations/supabase/client";

export type PortraitStatus = "idle" | "loading" | "ready" | "error";

export interface CharacterPortraitState {
  status: PortraitStatus;
  dataUrl?: string;
  error?: string;
  sourceHash?: string;
}

function computeSourceHash(
  firstPhoto: string | undefined,
  artStyle: string | undefined,
  proto?: any,
): string {
  if (firstPhoto) {
    const head = firstPhoto.slice(0, 96);
    const tail = firstPhoto.slice(-32);
    return `p:${head.length}|${firstPhoto.length}|${tail}|${artStyle || ""}`;
  }
  // No photo: hash based on the descriptive fields we'll send to the model.
  if (!proto?.name) return "";
  const app = proto?.appearance || {};
  const traits = Array.isArray(proto?.traits)
    ? proto.traits.map((t: any) => t?.word).filter(Boolean).join(",")
    : "";
  const sig = [
    proto?.name, proto?.age, proto?.gender, proto?.special,
    app.hairColor, app.hairStyle, app.skinTone, app.glasses ? "g" : "",
    app.features, traits, artStyle || "",
  ].join("|");
  return `i:${sig}`;
}

export function useCharacterPortrait() {
  const { answers, setAnswer } = useWizard();
  const latestAnswersRef = useRef(answers);

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  const portrait: CharacterPortraitState =
    (answers.characterPortrait as CharacterPortraitState | undefined) ?? { status: "idle" };

  const proto = (answers.protagonist as any) || {};
  const photos: string[] = Array.isArray(proto.photos) ? proto.photos : [];
  const firstPhoto = photos[0];
  const artStyle: string | undefined = answers.artStyle;
  const sourceHash = computeSourceHash(firstPhoto, artStyle, proto);

  const abortRef = useRef<AbortController | null>(null);
  const inflightHashRef = useRef<string | null>(null);

  const run = useCallback(
    async (forceHash: string) => {
      const answersNow = latestAnswersRef.current;
      const protoNowAtStart = (answersNow.protagonist as any) || {};
      const photosNowAtStart: string[] = Array.isArray(protoNowAtStart.photos)
        ? protoNowAtStart.photos
        : [];
      const firstPhotoAtStart = photosNowAtStart[0];
      const hasPhotoAtStart =
        !!firstPhotoAtStart && String(firstPhotoAtStart).startsWith("data:image/");

      // We allow firing without a photo (imagined hero), but we still need
      // at least a name to anchor the portrait. If the wizard is still empty,
      // bail and let the auto-trigger re-fire once state arrives.
      if (!hasPhotoAtStart && !protoNowAtStart?.name) return;

      // Cancel any in-flight call.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      inflightHashRef.current = forceHash;

      const latestPortrait =
        (answersNow.characterPortrait as CharacterPortraitState | undefined) ?? { status: "idle" };

      setAnswer("characterPortrait", {
        status: "loading",
        sourceHash: forceHash,
        dataUrl: latestPortrait.dataUrl, // keep previous image visible while refreshing
      } satisfies CharacterPortraitState);

      try {
        const currentAnswers = latestAnswersRef.current;

        // ---- Step 1: vision pre-pass to extract appearance traits ----
        // Only fills blanks; never overwrites traits the user manually set.
        // Cached per source hash so we don't re-call on portrait regenerate.
        // Skipped entirely when no photo was uploaded.
        const protoNow = (currentAnswers.protagonist as any) || {};
        const photosNow: string[] = Array.isArray(protoNow.photos) ? protoNow.photos : [];
        const firstPhotoNow = photosNow[0];
        const hasPhotoNow =
          !!firstPhotoNow && String(firstPhotoNow).startsWith("data:image/");

        let mergedAppearance: Record<string, any> =
          (protoNow.appearance as Record<string, any>) || {};

        if (hasPhotoNow) {
          const cachedHash: string | undefined = currentAnswers.appearanceAutofillHash;
          const baseHash = forceHash.split("|r")[0];

          if (cachedHash !== baseHash) {
            try {
              const { data: traitData } = await supabase.functions.invoke(
                "extract-appearance-traits",
                { body: { photoDataUrl: firstPhotoNow } },
              );
              if (ctrl.signal.aborted) return;
              const t = (traitData?.traits ?? {}) as Record<string, any>;
              const current = mergedAppearance;
              const onlyIfBlank = (cur: any, val: any) =>
                cur && String(cur).trim() ? cur : val || "";
              const featuresExtra = [
                t.distinguishing,
                t.eye_color ? `${t.eye_color} eyes` : "",
              ].filter(Boolean).join(", ");
              const next = {
                hairColor: onlyIfBlank(current.hairColor, t.hair_color),
                hairStyle: onlyIfBlank(
                  current.hairStyle,
                  t.hair_length || t.hair_style,
                ),
                skinTone: onlyIfBlank(current.skinTone, t.skin_tone),
                glasses:
                  typeof current.glasses === "boolean" && current.glasses
                    ? true
                    : !!t.glasses,
                features:
                  current.features && String(current.features).trim()
                    ? current.features
                    : featuresExtra,
              };
              mergedAppearance = next;
              const nextAnswers = latestAnswersRef.current;
              latestAnswersRef.current = {
                ...nextAnswers,
                protagonist: { ...protoNow, appearance: next },
                appearanceAutofillHash: baseHash,
              };
              setAnswer("protagonist", { ...protoNow, appearance: next });
              setAnswer("appearanceAutofillHash", baseHash);
            } catch (traitErr) {
              console.warn("appearance trait extraction failed", traitErr);
            }
          }
        }


        // ---- Step 2: portrait generation ----
        // Build brief from a snapshot that includes the freshest answers and
        // the merged appearance (React state may not have flushed yet).
        const latestForBrief = latestAnswersRef.current;
        const protoForBrief = (latestForBrief.protagonist as any) || protoNow;
        const briefSeed = {
          ...latestForBrief,
          protagonist: { ...protoForBrief, appearance: mergedAppearance },
        };
        const brief = buildBrief(briefSeed);
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-character-portrait",
          { body: { brief } },
        );
        if (ctrl.signal.aborted) return;
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        const imageDataUrl = data?.imageDataUrl as string | undefined;
        if (!imageDataUrl) throw new Error("No portrait image returned.");

        setAnswer("characterPortrait", {
          status: "ready",
          dataUrl: imageDataUrl,
          sourceHash: forceHash,
        } satisfies CharacterPortraitState);
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        const msg = e?.message || "Portrait generation failed.";
        setAnswer("characterPortrait", {
          status: "error",
          error: msg,
          sourceHash: forceHash,
        } satisfies CharacterPortraitState);
      } finally {
        if (inflightHashRef.current === forceHash) inflightHashRef.current = null;
      }
    },
    // Intentionally omit answers to avoid retrigger loops; run() reads from
    // latestAnswersRef so it does not generate from stale wizard state.
    [setAnswer],
  );

  // Auto-trigger on hero info / art-style / photo change.
  useEffect(() => {
    if (!sourceHash) return;
    if (portrait.sourceHash === sourceHash && portrait.status !== "idle") return;
    if (inflightHashRef.current === sourceHash) return;
    void run(sourceHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceHash]);

  const regenerate = useCallback(() => {
    const latest = latestAnswersRef.current;
    const latestProto = (latest.protagonist as any) || {};
    const latestPhotos: string[] = Array.isArray(latestProto.photos) ? latestProto.photos : [];
    const latestFirstPhoto = latestPhotos[0];
    const latestSourceHash = computeSourceHash(latestFirstPhoto, latest.artStyle, latestProto);
    if (!latestSourceHash) return;
    void run(latestSourceHash + "|r" + Date.now());
  }, [run]);

  return {
    status: portrait.status,
    dataUrl: portrait.dataUrl,
    error: portrait.error,
    regenerate,
    hasPhoto: !!firstPhoto && String(firstPhoto).startsWith("data:image/"),
  };
}
