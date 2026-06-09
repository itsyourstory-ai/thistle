/**
 * Tiny inline SVG data-URL generators for test-mode placeholder images.
 *
 * No binary assets — all pure SVG so they're small, version-controlled, and
 * render visibly in the UI without any real AI calls.
 *
 * All exports start with "data:image/" so existing code that checks for that
 * prefix (e.g. useCharacterPortrait's photo detection) treats them correctly.
 */

function encodeSvg(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function makePlaceholderImage(
  label: string,
  bgColor: string,
  textColor = "#fff",
  width = 400,
  height = 400,
): string {
  const fontSize = Math.round(width * 0.07);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${bgColor}" rx="8"/>
    <text x="${width / 2}" y="${height / 2 - fontSize * 0.8}"
      font-family="sans-serif" font-size="${fontSize * 1.8}"
      text-anchor="middle" dominant-baseline="middle">${label}</text>
    <text x="${width / 2}" y="${height / 2 + fontSize * 1.2}"
      font-family="sans-serif" font-size="${Math.round(fontSize * 0.85)}" font-weight="bold"
      fill="${textColor}" text-anchor="middle" dominant-baseline="middle">TEST MODE</text>
  </svg>`;
  return encodeSvg(svg);
}

// ── Cover images (one per seed profile) ──────────────────────────────────────
export const COVER_CLASSIC = makePlaceholderImage("📚", "#7c5cad", "#fff", 512, 512);
export const COVER_MINIMAL = makePlaceholderImage("📚", "#4a8c6b", "#fff", 512, 512);
export const COVER_EDGE = makePlaceholderImage("📚", "#c06a2a", "#fff", 512, 512);
export const COVER_SPECIAL = makePlaceholderImage("📚", "#b03060", "#fff", 512, 512);

// ── Portrait images ───────────────────────────────────────────────────────────
export const PORTRAIT_HERO = makePlaceholderImage("🧒", "#5b8fd4", "#fff", 256, 384);
export const PORTRAIT_SUPPORT_A = makePlaceholderImage("👩", "#d47a5b", "#fff", 256, 384);
export const PORTRAIT_SUPPORT_B = makePlaceholderImage("🐕", "#8a6b3a", "#fff", 256, 384);
export const PORTRAIT_GRANDMA = makePlaceholderImage("👵", "#c4845c", "#fff", 256, 384);

/**
 * A tiny face-shaped SVG that starts with "data:image/" so portrait hooks
 * treat it as a real uploaded photo and exercise the photo code path.
 */
export const FAKE_PHOTO = makePlaceholderImage("📷", "#999", "#fff", 200, 200);
