import { useEffect, useState } from "react";
import { RefreshCw, User } from "lucide-react";

export interface PreviewSnapshot {
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  glasses: boolean;
  features: string;
  gender: string;
  photo: string; // first photo if any
  name: string;
}

const HAIR_COLOR_HEX: Record<string, string> = {
  Blonde: "#E6C97A",
  Brown: "#5C3A21",
  Black: "#1F1B17",
  Red: "#B6411A",
  Gray: "#9A9A9A",
  White: "#EDEDED",
  Other: "#7A5A3A",
};

const DEFAULT_SKIN = "#F5CBA7";

function HairShape({ style, color }: { style: string; color: string }) {
  // All hair shapes are positioned to sit on top of a face circle centered at (100, 110) r=58.
  switch (style) {
    case "Bald":
      return null;
    case "Short":
      return (
        <path
          d="M42 108 C42 70 60 48 100 48 C140 48 158 70 158 108 C158 96 140 84 100 84 C60 84 42 96 42 108 Z"
          fill={color}
        />
      );
    case "Long":
      return (
        <>
          <path d="M40 110 C40 68 62 46 100 46 C138 46 160 68 160 110 L160 178 L140 178 L138 116 C138 116 122 100 100 100 C78 100 62 116 62 116 L60 178 L40 178 Z" fill={color} />
        </>
      );
    case "Curly":
      return (
        <g fill={color}>
          <circle cx="60" cy="80" r="20" />
          <circle cx="80" cy="60" r="22" />
          <circle cx="100" cy="54" r="22" />
          <circle cx="120" cy="60" r="22" />
          <circle cx="140" cy="80" r="20" />
          <circle cx="55" cy="100" r="16" />
          <circle cx="145" cy="100" r="16" />
        </g>
      );
    case "Straight":
      return (
        <path
          d="M44 110 C44 68 64 48 100 48 C136 48 156 68 156 110 L156 150 L142 150 L140 116 C140 116 124 102 100 102 C76 102 60 116 60 116 L58 150 L44 150 Z"
          fill={color}
        />
      );
    case "Braids":
      return (
        <g fill={color}>
          <path d="M44 108 C44 70 64 50 100 50 C136 50 156 70 156 108 C156 96 136 86 100 86 C64 86 44 96 44 108 Z" />
          <rect x="38" y="106" width="14" height="80" rx="7" />
          <rect x="148" y="106" width="14" height="80" rx="7" />
        </g>
      );
    default:
      return (
        <path
          d="M42 108 C42 70 60 48 100 48 C140 48 158 70 158 108 C158 96 140 84 100 84 C60 84 42 96 42 108 Z"
          fill={color}
        />
      );
  }
}

function HeadSVG({ snap }: { snap: PreviewSnapshot }) {
  const skin = snap.skinTone || DEFAULT_SKIN;
  const hairColorKey = snap.hairColor || "Brown";
  const hairColor = HAIR_COLOR_HEX[hairColorKey] || HAIR_COLOR_HEX.Brown;
  const hairStyle = snap.hairStyle || "Short";

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Neck */}
      <rect x="86" y="160" width="28" height="24" rx="6" fill={skin} />
      {/* Face */}
      <circle cx="100" cy="110" r="58" fill={skin} />
      {/* Ears */}
      <ellipse cx="42" cy="115" rx="8" ry="12" fill={skin} />
      <ellipse cx="158" cy="115" rx="8" ry="12" fill={skin} />
      {/* Hair */}
      <HairShape style={hairStyle} color={hairColor} />
      {/* Eyes */}
      <ellipse cx="80" cy="115" rx="4" ry="5" fill="#2b2b2b" />
      <ellipse cx="120" cy="115" rx="4" ry="5" fill="#2b2b2b" />
      {/* Eyebrows */}
      <rect x="70" y="100" width="20" height="3" rx="1.5" fill={hairColor} />
      <rect x="110" y="100" width="20" height="3" rx="1.5" fill={hairColor} />
      {/* Nose */}
      <path d="M100 122 L96 138 L104 138 Z" fill="rgba(0,0,0,0.08)" />
      {/* Mouth */}
      <path d="M88 148 Q100 156 112 148" stroke="#7a3a3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Glasses */}
      {snap.glasses && (
        <g stroke="#222" strokeWidth="2.5" fill="none">
          <circle cx="80" cy="116" r="11" />
          <circle cx="120" cy="116" r="11" />
          <line x1="91" y1="116" x2="109" y2="116" />
        </g>
      )}
    </svg>
  );
}

export default function CharacterHeadPreview({
  current,
  characterKey,
}: {
  current: PreviewSnapshot;
  characterKey: string;
}) {
  // Snapshot updates only when the user clicks the refresh button.
  const [snap, setSnap] = useState<PreviewSnapshot>(current);
  const [pulse, setPulse] = useState(false);

  // Reset snapshot when switching to a different character.
  useEffect(() => {
    setSnap(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterKey]);

  const isStale = JSON.stringify(snap) !== JSON.stringify(current);

  const update = () => {
    setSnap(current);
    setPulse(true);
    setTimeout(() => setPulse(false), 350);
  };

  const displayName = snap.name?.trim() || "Your character";
  const hasPhoto = !!snap.photo;

  return (
    <div className="rounded-2xl border p-5 sm:p-6 flex flex-col items-center gap-3"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Live preview
      </div>

      <div
        className={`relative w-40 h-40 rounded-full overflow-hidden border-4 transition-transform ${
          pulse ? "scale-105" : "scale-100"
        }`}
        style={{
          borderColor: "hsl(var(--wizard-primary))",
          backgroundColor: "hsl(var(--wizard-primary) / 0.06)",
        }}
      >
        {hasPhoto ? (
          <img src={snap.photo} alt={displayName} className="w-full h-full object-cover" />
        ) : snap.skinTone || snap.hairColor || snap.hairStyle || snap.glasses ? (
          <HeadSVG snap={snap} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <User className="w-16 h-16" />
          </div>
        )}
      </div>

      <div className="text-sm font-semibold text-center" style={{ color: "hsl(var(--wizard-primary))" }}>
        {displayName}
      </div>

      <button
        type="button"
        onClick={update}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 bg-transparent"
        style={{
          borderColor: "hsl(var(--wizard-primary))",
          color: "hsl(var(--wizard-primary))",
        }}
      >
        <RefreshCw className={`w-4 h-4 ${pulse ? "animate-spin" : ""}`} />
        {isStale ? "Update preview" : "Up to date"}
      </button>

      <p className="text-[11px] text-muted-foreground text-center italic max-w-[200px]">
        A rough sketch — your final illustrations will be much more detailed.
      </p>
    </div>
  );
}
