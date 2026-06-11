import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { DraftContext } from "@/contexts/DraftContext";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";

export default function WizardLayout() {
  const { saveNow, dirty } = useDraftPersistence();

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return (
    <DraftContext.Provider value={{ saveNow, dirty }}>
      <Outlet />
    </DraftContext.Provider>
  );
}
