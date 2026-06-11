import { createContext, useContext } from "react";

interface DraftContextType {
  saveNow: () => Promise<void>;
  dirty: boolean;
}

export const DraftContext = createContext<DraftContextType>({
  saveNow: async () => {},
  dirty: false,
});

export function useDraft() {
  return useContext(DraftContext);
}
