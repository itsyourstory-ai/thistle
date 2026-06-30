import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import { useWizard } from "@/contexts/WizardContext";
import { resumeDraftById } from "@/lib/resumeDraft";

export default function ResumeDraft() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const { seedAnswers, setDraftId } = useWizard();

  useEffect(() => {
    let cancelled = false;

    async function resume() {
      if (!draftId) {
        navigate("/dashboard", { replace: true });
        return;
      }

      const resumed = await resumeDraftById(draftId, {
        seedAnswers,
        setDraftId,
        navigate,
      });

      if (!resumed && !cancelled) {
        navigate("/dashboard", { replace: true });
      }
    }

    void resume();

    return () => {
      cancelled = true;
    };
  }, [draftId, navigate, seedAnswers, setDraftId]);

  return <LoadingScreen />;
}
