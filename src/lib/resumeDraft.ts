import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deserializeAnswers } from "@/lib/draftPhotos";
import type { WizardAnswers } from "@/lib/wizardTypes";

interface ResumeDraftDeps {
  seedAnswers: (partial: Partial<WizardAnswers>) => void;
  setDraftId: (id: string | null) => void;
  navigate: NavigateFunction;
}

export async function resumeDraftById(
  draftId: string,
  { seedAnswers, setDraftId, navigate }: ResumeDraftDeps,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("book_drafts")
    .select("answers, current_step")
    .eq("id", draftId)
    .single();

  if (error || !data) {
    console.error("Resume draft fetch error:", error);
    return false;
  }

  const deserialized = await deserializeAnswers(data.answers as Record<string, unknown>);
  seedAnswers(deserialized);
  setDraftId(draftId);
  navigate(data.current_step);
  return true;
}
