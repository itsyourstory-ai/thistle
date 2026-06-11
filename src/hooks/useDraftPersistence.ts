import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWizard } from "@/contexts/WizardContext";
import { supabase } from "@/integrations/supabase/client";
import { serializeAnswers } from "@/lib/draftPhotos";

/**
 * Persists wizard answers to book_drafts on every answers change (debounced).
 * - Skips saves when user is not logged in or childName is empty.
 * - First save INSERTs a new draft row, captures the id, calls setDraftId.
 * - Subsequent saves UPDATE the existing row.
 * - saveNow() bypasses the debounce and saves immediately.
 */
export function useDraftPersistence(): { saveNow: () => Promise<void>; dirty: boolean } {
  const { user } = useAuth();
  const { answers, draftId, setDraftId } = useWizard();
  const { pathname } = useLocation();

  const [dirty, setDirty] = useState(false);

  // Keep refs so the save callback always reads the latest values without
  // being recreated on every render (avoids stale closure issues).
  const answersRef = useRef(answers);
  const draftIdRef = useRef(draftId);
  const pathnameRef = useRef(pathname);
  const userRef = useRef(user);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { draftIdRef.current = draftId; }, [draftId]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Mark dirty whenever answers change.
  useEffect(() => {
    setDirty(true);
  }, [answers]);

  const save = useCallback(async () => {
    const currentUser = userRef.current;
    const currentAnswers = answersRef.current;
    const currentPathname = pathnameRef.current;
    const currentDraftId = draftIdRef.current;

    if (!currentUser) return;
    if (!currentAnswers.childName) return;

    try {
      if (!currentDraftId) {
        // First save — INSERT then UPDATE with serialized content.
        const { data, error } = await supabase
          .from("book_drafts")
          .insert({
            user_id: currentUser.id,
            answers: {},
            current_step: currentPathname,
            child_name: currentAnswers.childName,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error || !data) {
          console.error("Failed to insert draft:", error);
          return;
        }

        const newId: string = data.id;
        // Notify wizard context so subsequent saves use UPDATE.
        setDraftId(newId);
        // Also update the ref immediately so a rapid second call uses the new id.
        draftIdRef.current = newId;

        const serialized = await serializeAnswers(currentUser.id, newId, currentAnswers);

        await supabase
          .from("book_drafts")
          .update({
            answers: serialized,
            current_step: currentPathname,
            child_name: currentAnswers.childName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", newId);
      } else {
        // Subsequent save — UPDATE existing row.
        const serialized = await serializeAnswers(currentUser.id, currentDraftId, currentAnswers);

        await supabase
          .from("book_drafts")
          .update({
            answers: serialized,
            current_step: currentPathname,
            child_name: currentAnswers.childName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentDraftId);
      }

      setDirty(false);
    } catch (err) {
      console.error("Draft persistence error:", err);
    }
  }, [setDraftId]);

  // Debounced auto-save — fires 1500 ms after the last answers change.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!answers.childName) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void save();
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  // AIDEV-NOTE: Only re-run when answers change; user/save are stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await save();
  }, [save]);

  return { saveNow, dirty };
}
