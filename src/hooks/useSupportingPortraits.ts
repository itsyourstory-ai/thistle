// Background portrait generation for supporting characters.
//
// Mirrors useCharacterPortrait, but iterates over every supporting cast
// member in answers.supportingCharacters and stores results in
// answers.supportingPortraits keyed by character id.
//
// Always generates a portrait — even when no reference photo is uploaded
// (the "imagined" / AI-built mode) — so the Summary step can show a full
// cast lineup.

import { useCallback, useEffect, useRef } from "react";
import { useWizard } from "@/contexts/WizardContext";
import { buildBrief } from "@/lib/buildBrief";
import { supabase } from "@/integrations/supabase/client";
import type { CharacterPortraitState } from "./useCharacterPortrait";

export type SupportingPortraitsState = Record<string, CharacterPortraitState>;

function hashChar(c: any, artStyle: string | undefined): string {
  if (!c?.id) return "";
  const firstPhoto: string | undefined =
    c.mode === "real" && Array.isArray(c.photos) ? c.photos[0] : undefined;
  if (firstPhoto && String(firstPhoto).startsWith("data:image/")) {
    return `p:${firstPhoto.length}|${firstPhoto.slice(-32)}|${artStyle || ""}`;
  }
  const app = c.appearance || {};
  const traits = Array.isArray(c.traits)
    ? c.traits.map((t: any) => t?.word).filter(Boolean).join(",")
    : "";
  return `i:${[
    c.name, c.relationship, c.relationshipOther, c.gender, c.ageRange,
    app.hairColor, app.hairStyle, app.skinTone, app.glasses ? "g" : "",
    app.features, traits, artStyle || "",
  ].join("|")}`;
}

export function useSupportingPortraits() {
  const { answers, setAnswer } = useWizard();
  const latestAnswersRef = useRef(answers);
  useEffect(() => { latestAnswersRef.current = answers; }, [answers]);

  const supporting: any[] = Array.isArray(answers.supportingCharacters)
    ? answers.supportingCharacters
    : [];
  const portraits: SupportingPortraitsState =
    (answers.supportingPortraits as SupportingPortraitsState) || {};
  const artStyle: string | undefined = answers.artStyle;

  const inflightRef = useRef<Record<string, string>>({});

  const runOne = useCallback(
    async (charId: string, forceHash: string) => {
      const answersNow = latestAnswersRef.current;
      const list: any[] = Array.isArray(answersNow.supportingCharacters)
        ? answersNow.supportingCharacters
        : [];
      const c = list.find((x) => x?.id === charId);
      if (!c || !c.name) return;

      inflightRef.current[charId] = forceHash;
      const prev: SupportingPortraitsState =
        (answersNow.supportingPortraits as SupportingPortraitsState) || {};
      setAnswer("supportingPortraits", {
        ...prev,
        [charId]: { status: "loading", sourceHash: forceHash, dataUrl: prev[charId]?.dataUrl },
      } satisfies SupportingPortraitsState);

      try {
        // Build a brief with this supporting character swapped into the
        // protagonist slot so the existing edge function prompt works.
        const photos: string[] =
          c.mode === "real" && Array.isArray(c.photos) ? c.photos : [];
        const seed = {
          ...answersNow,
          protagonist: {
            name: c.name,
            age: c.ageRange,
            gender: c.gender,
            special: "",
            appearance: c.appearance,
            traits: c.traits,
            photos,
          },
          supportingCharacters: [],
          childName: c.name,
        };
        const brief = buildBrief(seed);
        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-character-portrait",
          { body: { brief } },
        );
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        const imageDataUrl = data?.imageDataUrl as string | undefined;
        if (!imageDataUrl) throw new Error("No portrait image returned.");

        const after: SupportingPortraitsState =
          (latestAnswersRef.current.supportingPortraits as SupportingPortraitsState) || {};
        setAnswer("supportingPortraits", {
          ...after,
          [charId]: { status: "ready", dataUrl: imageDataUrl, sourceHash: forceHash },
        });
      } catch (e: any) {
        const msg = e?.message || "Portrait generation failed.";
        const after: SupportingPortraitsState =
          (latestAnswersRef.current.supportingPortraits as SupportingPortraitsState) || {};
        setAnswer("supportingPortraits", {
          ...after,
          [charId]: { status: "error", error: msg, sourceHash: forceHash },
        });
      } finally {
        if (inflightRef.current[charId] === forceHash) delete inflightRef.current[charId];
      }
    },
    [setAnswer],
  );

  // Auto-trigger for each character when its hash changes.
  useEffect(() => {
    for (const c of supporting) {
      if (!c?.id || !c?.name) continue;
      const h = hashChar(c, artStyle);
      if (!h) continue;
      const cur = portraits[c.id];
      if (inflightRef.current[c.id] === h) continue;
      // Skip only when we have a finished result for this exact hash.
      // (Previously "loading" without an inflight ref would block retries
      // after a page reload — leaving supporting portraits stuck.)
      if (cur?.sourceHash === h && (cur.status === "ready" || cur.status === "error")) continue;
      void runOne(c.id, h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supporting.map((c) => `${c?.id}:${hashChar(c, artStyle)}`).join("|")]);

  const regenerate = useCallback(
    (charId: string) => {
      const answersNow = latestAnswersRef.current;
      const list: any[] = Array.isArray(answersNow.supportingCharacters)
        ? answersNow.supportingCharacters
        : [];
      const c = list.find((x) => x?.id === charId);
      if (!c) return;
      const h = hashChar(c, answersNow.artStyle);
      if (!h) return;
      void runOne(charId, h + "|r" + Date.now());
    },
    [runOne],
  );

  return { portraits, regenerate };
}
