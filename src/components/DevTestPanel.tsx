/**
 * Dev-only test mode control panel.
 *
 * Rendered next to the "⚙ dev: skip step" button in WizardHeader.
 * Opens a popover with controls for toggling mock-AI mode, selecting a seed
 * profile, adjusting fake latency, forcing errors, and running specific
 * functions live instead of mocked.
 *
 * AIDEV-NOTE: This component is only rendered when import.meta.env.DEV is
 * true. Never import this in production paths.
 */

import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useTestMode } from "@/lib/testMode";
import type { ProfileId, CacheMode } from "@/lib/testMode";
import { cacheClear } from "@/lib/edgeCache";
import { SEED_PROFILES, getSeedProfile } from "@/lib/devSeeds";
import { pathForStep } from "@/lib/wizardSteps";
import { useWizard } from "@/contexts/WizardContext";

const FN_NAMES = [
  "generate-summary",
  "generate-cover",
  "generate-character-portrait",
  "extract-appearance-traits",
  "generate-book",
  "generate-book-images",
] as const;

type FnName = (typeof FN_NAMES)[number];

export default function DevTestPanel() {
  const [mode, update] = useTestMode();
  const { seedAnswers, setDraftId } = useWizard();
  const navigate = useNavigate();

  const handleLoad = () => {
    const profile = getSeedProfile(mode.profileId as ProfileId);
    if (!profile) return;
    seedAnswers(profile.answers);
    navigate(pathForStep(1));
  };

  const handleJumpToCheckout = () => {
    const profile = getSeedProfile(mode.profileId as ProfileId);
    if (!profile) return;
    seedAnswers(profile.answers);
    if (mode.checkoutDraftId.trim()) setDraftId(mode.checkoutDraftId.trim());
    navigate(pathForStep(11));
  };

  // forceErrorFns is ["*"] for all, [fnName] for one, or [] for none.
  const forceErrorValue = mode.forceErrorFns.includes("*")
    ? "*"
    : (mode.forceErrorFns[0] ?? "");

  const setForceError = (val: string) => {
    update({ forceErrorFns: val ? [val] : [] });
  };

  const togglePerFnLive = (fn: FnName, checked: boolean) => {
    const live = checked
      ? [...mode.perFnLive, fn]
      : mode.perFnLive.filter((f) => f !== fn);
    update({ perFnLive: live });
  };

  const activeProfile = SEED_PROFILES.find((p) => p.id === mode.profileId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Dev test mode — returns fake AI responses instead of calling Supabase"
          className={[
            "text-[11px] font-mono uppercase tracking-wider px-3 py-1 rounded-full border border-dashed transition-colors",
            mode.enabled
              ? "border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100"
              : "border-muted-foreground/40 text-muted-foreground/70 hover:text-muted-foreground hover:border-muted-foreground/70",
          ].join(" ")}
        >
          🧪 {mode.enabled ? "test: on" : "test: off"}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 p-4 space-y-4">
        {/* ── Master toggle ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold leading-none">Test mode</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {mode.enabled ? "Returning fake AI responses" : "Using real Supabase functions"}
            </p>
          </div>
          <Switch
            checked={mode.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </div>

        {/* ── Bypass checkout ───────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold leading-none">Bypass checkout</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Skip Stripe payment and jump to generation
            </p>
          </div>
          <Switch
            checked={mode.bypassCheckout}
            onCheckedChange={(v) => update({ bypassCheckout: v })}
          />
        </div>

        {mode.enabled && (
          <>
            <hr className="border-black/10" />

            {/* ── Seed profile ──────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Seed profile
              </label>
              <select
                className="w-full text-xs rounded-lg border border-input px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                value={mode.profileId}
                onChange={(e) => update({ profileId: e.target.value as ProfileId })}
              >
                {SEED_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {activeProfile && (
                <p className="text-[10px] text-muted-foreground italic">
                  {activeProfile.description}
                </p>
              )}
            </div>

            {/* ── Load / Jump ───────────────────────────────── */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLoad}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Load → Step 1
              </button>
              <button
                type="button"
                onClick={handleJumpToCheckout}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Jump → Checkout
              </button>
            </div>

            {/* ── Draft ID for Stripe ───────────────────────── */}
            <div className="space-y-1.5">
              <div>
                <p className="text-xs font-medium">Draft ID for Stripe</p>
                <p className="text-[10px] text-muted-foreground">
                  Paste a Supabase draft ID so the payment form loads at checkout. Get one by completing steps 1–8 once.
                </p>
              </div>
              <input
                type="text"
                value={mode.checkoutDraftId}
                onChange={(e) => update({ checkoutDraftId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full font-mono text-[10px] rounded border border-input px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <hr className="border-black/10" />

            {/* ── Fake delay ────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">Fake delay</p>
                <p className="text-[10px] text-muted-foreground">
                  Added to every mocked call so loading states are visible
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={5000}
                  step={100}
                  value={mode.delayMs}
                  onChange={(e) => update({ delayMs: Math.max(0, Number(e.target.value)) })}
                  className="w-16 text-xs rounded border border-input px-1.5 py-1 text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </div>

            {/* ── Force error ───────────────────────────────────── */}
            <div className="space-y-1.5">
              <div>
                <p className="text-xs font-medium">Force error on</p>
                <p className="text-[10px] text-muted-foreground">
                  Returns an error instead of a fixture to test error UI
                </p>
              </div>
              <select
                className="w-full text-xs rounded-lg border border-input px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                value={forceErrorValue}
                onChange={(e) => setForceError(e.target.value)}
              >
                <option value="">(none — normal mock)</option>
                <option value="*">All functions</option>
                {FN_NAMES.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Per-function live overrides ───────────────────── */}
            <div className="space-y-1.5">
              <div>
                <p className="text-xs font-medium">Run live (overrides mock)</p>
                <p className="text-[10px] text-muted-foreground">
                  Calls real Supabase for these functions even in test mode
                </p>
              </div>
              <div className="grid grid-cols-1 gap-1 pl-1">
                {FN_NAMES.map((fn) => (
                  <label key={fn} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mode.perFnLive.includes(fn)}
                      onChange={(e) => togglePerFnLive(fn, e.target.checked)}
                      className="rounded border-input"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">{fn}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Response cache (Phase E) ──────────────────────── */}
            <div className="space-y-1.5">
              <div>
                <p className="text-xs font-medium">Response cache</p>
                <p className="text-[10px] text-muted-foreground">
                  Record snapshots of real responses; replay them later for free
                </p>
              </div>
              <select
                className="w-full text-xs rounded-lg border border-input px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                value={mode.cacheMode}
                onChange={(e) => update({ cacheMode: e.target.value as CacheMode })}
              >
                <option value="off">Off</option>
                <option value="record">Record real responses</option>
                <option value="replay">Replay cached responses</option>
              </select>
              {mode.cacheMode !== "off" && (
                <button
                  type="button"
                  onClick={() => void cacheClear()}
                  className="text-[10px] text-muted-foreground underline hover:text-destructive transition-colors"
                >
                  Clear cache
                </button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
