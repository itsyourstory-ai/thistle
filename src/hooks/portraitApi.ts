// Shared helper for invoking the generate-character-portrait edge function.
// Used by useCharacterPortrait and useSupportingPortraits.

import { supabase } from "@/integrations/supabase/client";
import type { StoryBrief } from "@/lib/buildBrief";

/**
 * Invokes the `generate-character-portrait` edge function and returns the
 * image data URL on success. Throws on network/function errors, missing
 * payload, or an already-aborted signal.
 */
export async function invokePortrait(
  brief: StoryBrief,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const { data, error: fnError } = await supabase.functions.invoke(
    "generate-character-portrait",
    { body: { brief } },
  );

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (fnError) throw fnError;
  if (data?.error) throw new Error(data.error);
  const imageDataUrl = data?.imageDataUrl as string | undefined;
  if (!imageDataUrl) throw new Error("No portrait image returned.");

  return imageDataUrl;
}
