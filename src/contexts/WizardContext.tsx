import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { WizardAnswers } from "@/lib/wizardTypes";

interface WizardContextType {
  answers: WizardAnswers;
  setAnswer: <K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => void;
  /** Bulk-load a partial set of answers (used by dev seed profiles). */
  seedAnswers: (partial: Partial<WizardAnswers>) => void;
  canContinue: boolean;
  setCanContinue: (v: boolean) => void;
  /** True while a long-running generation (e.g. the cover) is in flight.
   *  When true, the global progress bar disables step-jumping so users
   *  can't skip past the in-progress step. */
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  draftId: string | null;
  setDraftId: (id: string | null) => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<WizardAnswers>({});
  const [canContinue, setCanContinue] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const setAnswer = useCallback(<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const seedAnswers = useCallback((partial: Partial<WizardAnswers>) => {
    setAnswers((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetWizard = useCallback(() => {
    setAnswers({});
    setDraftId(null);
  }, []);

  const value = useMemo(
    () => ({
      answers,
      setAnswer,
      seedAnswers,
      canContinue,
      setCanContinue,
      isGenerating,
      setIsGenerating,
      draftId,
      setDraftId,
      resetWizard,
    }),
    [answers, canContinue, isGenerating, draftId, setAnswer, seedAnswers, resetWizard, setCanContinue, setIsGenerating, setDraftId],
  );

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
