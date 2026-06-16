import { useEffect, useState, useCallback, useRef } from "react";
import { Star, Plus } from "lucide-react";
import { toast } from "sonner";
import WizardShell from "@/components/WizardShell";
import { useWizard } from "@/contexts/WizardContext";
import { useCharacterPortrait } from "@/hooks/useCharacterPortrait";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  type Protagonist,
  type SupportingCharacter,
  type ActiveTab,
  makeId,
  emptyAppearance,
} from "./types";
import { ProtagonistForm, SupportingCharacterForm } from "./CharacterForms";
import { Pill, AddPill, avatarCircle } from "./CastPillBar";

/* ── main component ──────────────────────────────────────── */

export default function Step7() {
  const { answers, setAnswer, setCanContinue } = useWizard();

  // Auto-fill protagonist name and gender from Step 1 answers.
  // Age is NOT auto-filled — Step 1 stores an age range, not a specific age.
  // Step 1 gender values are lowercase (girl / boy / non-binary); map to the
  // Title-cased options the protagonist form uses.
  const step1Name = (answers.childName as string) || "";
  const step1GenderRaw = (answers.gender as string) || "";
  const step1Gender =
    step1GenderRaw === "girl" ? "Girl"
    : step1GenderRaw === "boy" ? "Boy"
    : step1GenderRaw === "non-binary" ? "Gender neutral"
    : "";

  // Pull data from context (or defaults), backfilling empty fields from Step 1.
  const storedProtagonist = answers.protagonist as Protagonist | undefined;
  const protagonist: Protagonist = storedProtagonist
    ? {
        traits: [],
        ...storedProtagonist,
        name: storedProtagonist.name || step1Name,
        gender: storedProtagonist.gender || step1Gender,
      }
    : {
        photos: [],
        name: step1Name,
        age: "",
        gender: step1Gender,
        special: "",
        appearance: emptyAppearance(),
        traits: (answers.personalityList as Array<{ word: string; emoji?: string }>) || [],
      };

  const supportingCharacters: SupportingCharacter[] =
    (answers.supportingCharacters as SupportingCharacter[]) || [];


  const [activeTab, setActiveTab] = useState<ActiveTab>({ kind: "protagonist" });
  const [warnings, setWarnings] = useState<Set<string>>(new Set());
  const [showRemoveDialog, setShowRemoveDialog] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showNoCharsDialog, setShowNoCharsDialog] = useState(false);
  const noCharsResolver = useRef<((ok: boolean) => void) | null>(null);

  // Persist auto-filled values so downstream steps see them even if the user
  // never edits the protagonist form.
  useEffect(() => {
    if (
      !storedProtagonist ||
      storedProtagonist.name !== protagonist.name ||
      storedProtagonist.gender !== protagonist.gender
    ) {
      setAnswer("protagonist", protagonist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1Name, step1Gender]);


  // Require protagonist name, age, and gender before continuing.
  // Name and gender backfill from Step 1 so they're usually pre-set; age always needs input.
  useEffect(() => {
    setCanContinue(
      protagonist.name.trim() !== "" &&
      protagonist.age.trim() !== "" &&
      protagonist.gender !== ""
    );
  }, [protagonist.name, protagonist.age, protagonist.gender, setCanContinue]);

  const missingHint =
    !protagonist.name.trim() ? "Add the protagonist's name to continue." :
    !protagonist.age.trim() ? "Add their age to continue." :
    !protagonist.gender ? "Choose their gender to continue." :
    undefined;

  // Kick off the background portrait the moment the first protagonist photo
  // is uploaded. No visible UI on this step — result is shown on Step 8.
  useCharacterPortrait();

  // Intercept Continue: if no supporting characters, ask "are you sure?"
  const handleBeforeContinue = useCallback(() => {
    if (supportingCharacters.length > 0) return true;
    return new Promise<boolean>((resolve) => {
      noCharsResolver.current = resolve;
      setShowNoCharsDialog(true);
    });
  }, [supportingCharacters.length]);

  const resolveNoChars = (ok: boolean) => {
    setShowNoCharsDialog(false);
    noCharsResolver.current?.(ok);
    noCharsResolver.current = null;
  };

  const setProtagonist = useCallback((p: Protagonist) => setAnswer("protagonist", p), [setAnswer]);
  const setSupportingCharacters = useCallback((s: SupportingCharacter[]) => setAnswer("supportingCharacters", s), [setAnswer]);

  const addSupporting = () => {
    if (supportingCharacters.length >= 2) {
      // 3rd character = upsell
      setShowUpsell(true);
      return;
    }
    const sc: SupportingCharacter = {
      id: makeId(), mode: "", name: "", surpriseName: false,
      relationship: "", relationshipOther: "", gender: "", ageRange: "",
      photos: [], appearance: emptyAppearance(), traits: [],
    };
    setSupportingCharacters([...supportingCharacters, sc]);
    setActiveTab({ kind: "supporting", id: sc.id });
  };

  const addPaidCharacter = () => {
    setShowUpsell(false);
    const sc: SupportingCharacter = {
      id: makeId(), mode: "", name: "", surpriseName: false,
      relationship: "", relationshipOther: "", gender: "", ageRange: "",
      photos: [], appearance: emptyAppearance(), traits: [],
    };
    setSupportingCharacters([...supportingCharacters, sc]);
    setActiveTab({ kind: "supporting", id: sc.id });
    toast.success("Extra character unlocked!", { description: "$3.00 charged (simulated)" });
  };

  const confirmRemove = (id: string) => setShowRemoveDialog(id);

  const doRemove = () => {
    if (!showRemoveDialog) return;
    const filtered = supportingCharacters.filter((c) => c.id !== showRemoveDialog);
    setSupportingCharacters(filtered);
    setActiveTab({ kind: "protagonist" });
    setShowRemoveDialog(null);
  };

  const updateSupporting = (id: string, data: SupportingCharacter) => {
    setSupportingCharacters(supportingCharacters.map((c) => (c.id === id ? data : c)));
  };

  const protoName = protagonist.name || "Main Character";

  return (
    <WizardShell onBeforeContinue={handleBeforeContinue} missingHint={missingHint}>
      <div className="space-y-6">
        {/* heading */}
        <div className="space-y-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-wizard">
            Let's bring the characters to life
          </h1>
          <p className="text-muted-foreground text-lg">
            Build your cast — start with the star of the story, then add anyone else you'd like to include.
          </p>
        </div>

        {/* pill bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <Pill active={activeTab.kind === "protagonist"}
            icon={<Star className="w-4 h-4" />}
            label={protoName}
            onClick={() => setActiveTab({ kind: "protagonist" })}
            hasWarning={warnings.has("protagonist")}
          />

          {supportingCharacters.map((sc) => (
            <Pill key={sc.id}
              active={activeTab.kind === "supporting" && activeTab.id === sc.id}
              icon={avatarCircle(sc.photos)}
              label={sc.name || "New Character"}
              onClick={() => setActiveTab({ kind: "supporting", id: sc.id })}
              onRemove={() => confirmRemove(sc.id)}
              hasWarning={warnings.has(sc.id)}
            />
          ))}

          {supportingCharacters.length < 3 && (
            <AddPill label="Character" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={addSupporting}
              disabled={supportingCharacters.length >= 3}
              tooltip={supportingCharacters.length >= 3 ? "3 character max" : undefined}
            />
          )}
        </div>

        {/* form area */}
        {(() => {
          const activeSupporting = activeTab.kind === "supporting"
            ? supportingCharacters.find((c) => c.id === activeTab.id)
            : null;

          return (
            <div className="rounded-2xl border p-5 sm:p-6" style={{ backgroundColor: "hsl(var(--wizard-bg))" }}>
              {activeTab.kind === "protagonist" && (
                <ProtagonistForm data={protagonist} onChange={setProtagonist} />
              )}

              {activeTab.kind === "supporting" && activeSupporting && (
                <SupportingCharacterForm data={activeSupporting}
                  onChange={(d) => updateSupporting(activeSupporting.id, d)}
                  protagonistName={protagonist.name}
                />
              )}
            </div>
          );
        })()}

      </div>

      {/* Remove confirmation dialog */}
      <Dialog open={!!showRemoveDialog} onOpenChange={() => setShowRemoveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this character?</DialogTitle>
            <DialogDescription>This can't be undone. You can always add a new one.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowRemoveDialog(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={doRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upsell dialog */}
      <Dialog open={showUpsell} onOpenChange={setShowUpsell}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add an extra character</DialogTitle>
            <DialogDescription>
              Your plan includes 2 supporting characters. Add one more for just $3.00.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowUpsell(false)}>
              No thanks
            </Button>
            <Button type="button" variant="wizard" size="sm" onClick={addPaidCharacter}>
              Add for $3.00
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "Are you sure?" when continuing without any supporting characters */}
      <Dialog open={showNoCharsDialog} onOpenChange={(open) => { if (!open) resolveNoChars(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Continue without any extra characters?</DialogTitle>
            <DialogDescription>
              Stories feel extra magical with friends, family, or favorite people
              alongside {protoName}. You can always add a sibling, grandparent,
              or best friend now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="wizardOutline" size="sm"
              onClick={() => { resolveNoChars(false); addSupporting(); }}>
              Add a character
            </Button>
            <Button type="button" variant="wizard" size="sm" onClick={() => resolveNoChars(true)}>
              Continue anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WizardShell>
  );
}
