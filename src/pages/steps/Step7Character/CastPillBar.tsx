import { X, Plus, User } from "lucide-react";

/* ── PillProps ───────────────────────────────────────────── */

export interface PillProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  onRemove?: () => void;
  hasWarning?: boolean;
}

/* ── Pill ────────────────────────────────────────────────── */

export function Pill({ active, icon, label, onClick, onRemove, hasWarning }: PillProps) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all shrink-0 ${
        active ? "border-transparent shadow-sm text-white" : "border-border bg-background text-muted-foreground hover:border-primary/40"
      }`}
      style={active ? { backgroundColor: "hsl(var(--wizard-primary))" } : undefined}
    >
      {icon}
      <span className="max-w-[120px] truncate">{label}</span>
      {onRemove && (
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-1 w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
          <X className="w-3 h-3" />
        </span>
      )}
      {hasWarning && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive" />
      )}
    </button>
  );
}

/* ── AddPill ─────────────────────────────────────────────── */

export function AddPill({ label, icon, onClick, disabled, tooltip }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; tooltip?: string;
}) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} title={tooltip}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border border-dashed shrink-0 transition-all ${
        disabled ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── avatarCircle helper (exported for use in index.tsx) ─── */

export function avatarCircle(photos: string[]) {
  return photos.length > 0
    ? <img src={photos[0]} alt="" className="w-6 h-6 rounded-full object-cover" />
    : <User className="w-4 h-4" />;
}
