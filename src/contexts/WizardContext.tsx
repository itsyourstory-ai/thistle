import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface WizardState {
  answers: Record<string, any>;
  canContinue: boolean;
}

interface WizardContextType {
  answers: Record<string, any>;
  setAnswer: (key: string, value: any) => void;
  canContinue: boolean;
  setCanContinue: (v: boolean) => void;
  /** True while a long-running generation (e.g. the cover) is in flight.
   *  When true, the global progress bar disables step-jumping so users
   *  can't skip past the in-progress step. */
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [canContinue, setCanContinue] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const setAnswer = useCallback((key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <WizardContext.Provider
      value={{
        answers,
        setAnswer,
        canContinue,
        setCanContinue,
        isGenerating,
        setIsGenerating,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
