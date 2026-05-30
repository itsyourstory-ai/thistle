// =============================================================================
//  IMAGE REFERENCE PROMPTING HELPERS
// =============================================================================
//
// These helpers keep reference-image ordering and language consistent across
// portrait, cover, and page generation. The important production rule is that
// the model gets a hierarchy, not a pile of images:
//
// 1. Portrait #1 = canonical character lock.
// 2. Portraits #2–#3 = alternate pose/body references only.
// 3. Prior page images = continuity references only.
// 4. Raw uploaded photos = used during portrait creation; one may be marked as
//    the outfit source so the model does not blend clothing across photos.
// =============================================================================

export function normalizeOutfitSourceIndex(
  raw: unknown,
  photoCount: number,
): number {
  if (photoCount <= 0) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  // Accept either 0-based or 1-based indexes from future wizard/UI versions.
  if (n >= 0 && n < photoCount) return Math.floor(n);
  if (n >= 1 && n <= photoCount) return Math.floor(n - 1);
  return 0;
}

export function orderPhotosWithOutfitSourceFirst(
  photos: string[],
  outfitSourceIndex: number,
): string[] {
  if (!photos.length) return [];
  const safeIndex = normalizeOutfitSourceIndex(outfitSourceIndex, photos.length);
  return [
    photos[safeIndex],
    ...photos.filter((_, i) => i !== safeIndex),
  ];
}

export function outfitSourceInstruction(photoCount: number): string {
  if (photoCount <= 0) return "";
  if (photoCount === 1) {
    return "Image #1 is the OUTFIT SOURCE and primary likeness reference. Recreate the outfit from Image #1 exactly in the chosen illustration style. This outfit becomes the locked outfit for the whole book.";
  }
  return "Image #1 is the OUTFIT SOURCE and primary likeness reference. Recreate the outfit from Image #1 exactly: top, bottoms, shoes, accessories, main colors, and silhouette. Images #2 onward are supplemental likeness references only. Use them for face, hair, skin tone, body proportions, and distinguishing features. Ignore their outfits. Do not blend clothing from multiple photos.";
}

export function buildPageReferencePreamble(args: {
  characterReferenceCount: number;
  priorSceneReferenceCount: number;
}): string {
  const { characterReferenceCount, priorSceneReferenceCount } = args;
  const parts: string[] = [];

  if (characterReferenceCount <= 0) return "";

  if (characterReferenceCount === 1) {
    parts.push(
      "Image #1 is the CANONICAL CHARACTER REFERENCE. Match the exact face, hair, skin tone, body shape, outfit, color palette, and proportions.",
    );
  } else {
    parts.push(
      `Images #1–#${characterReferenceCount} are CHARACTER REFERENCES. Image #1 is canonical: match exact face, hair, skin tone, body shape, outfit, color palette, and proportions. Images #2–#${characterReferenceCount} are alternate poses of the SAME character; use them only for pose variety and body proportions.`,
    );
  }

  if (priorSceneReferenceCount > 0) {
    const start = characterReferenceCount + 1;
    const end = characterReferenceCount + priorSceneReferenceCount;
    parts.push(
      priorSceneReferenceCount === 1
        ? `Image #${start} is the PRIOR PAGE REFERENCE. Use it only for illustration style, palette, lighting, environment continuity, and page-to-page consistency. Do not copy its exact pose, action, or composition unless the prompt explicitly asks for it.`
        : `Images #${start}–#${end} are PRIOR PAGE REFERENCES. Use them only for illustration style, palette, lighting, environment continuity, and page-to-page consistency. Do not copy their exact poses, actions, or compositions unless the prompt explicitly asks for it.`,
    );
  }

  parts.push(
    "Do not generate readable text, letters, captions, signs, labels, logos, borders, or watermarks inside the illustration.",
  );

  return parts.join("\n");
}
