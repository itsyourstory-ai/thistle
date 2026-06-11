import { supabase } from "@/integrations/supabase/client";
import type { WizardAnswers } from "@/lib/wizardTypes";

/**
 * Upload a single base64 data URL to draft-photos/{userId}/{draftId}/{filename}.
 * If the value is already a storage path (starts with "draft-photos/"), returns it as-is.
 * Returns the storage path.
 */
export async function uploadPhoto(
  userId: string,
  draftId: string,
  filename: string,
  dataUrl: string
): Promise<string> {
  const path = `draft-photos/${userId}/${draftId}/${filename}`;

  // Extract base64 payload after the comma
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from("draft-photos")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(`Failed to upload photo: ${error.message}`);

  return path;
}

/**
 * Create a signed URL for a storage path and fetch it as a base64 data URL.
 * Uses 1-hour expiry (3600 seconds).
 */
export async function downloadPhoto(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("draft-photos")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  const response = await fetch(data.signedUrl);
  const arrayBuffer = await response.arrayBuffer();

  // Convert ArrayBuffer → base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Upload all photos in an array.
 * Skips entries that already start with "draft-photos/" (already a storage path).
 * Returns storage paths.
 */
export async function uploadPhotos(
  userId: string,
  draftId: string,
  photos: string[]
): Promise<string[]> {
  return Promise.all(
    photos.map((photo, index) => {
      if (photo.startsWith("draft-photos/")) {
        return Promise.resolve(photo);
      }
      return uploadPhoto(userId, draftId, `photo-${index}.jpg`, photo);
    })
  );
}

/**
 * Download photos for an array of storage paths.
 * Returns data URLs.
 */
export async function downloadPhotos(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => downloadPhoto(path)));
}

/**
 * Serialize answers for jsonb storage.
 * - Uploads protagonist.photos → replaces with storage paths
 * - Uploads each supportingCharacter.photos → replaces with storage paths
 * - Strips: characterPortrait, supportingPortraits, appearanceAutofillHash
 * - Strips: selectedConcept.coverImage (but keeps all text fields)
 * Returns a plain object safe for jsonb.
 */
export async function serializeAnswers(
  userId: string,
  draftId: string,
  answers: WizardAnswers
): Promise<Record<string, unknown>> {
  // Deep clone to avoid mutating the original
  const clone = JSON.parse(JSON.stringify(answers)) as WizardAnswers;

  // Upload protagonist photos
  if (clone.protagonist?.photos?.length) {
    clone.protagonist.photos = await uploadPhotos(
      userId,
      draftId,
      clone.protagonist.photos
    );
  }

  // Upload supporting character photos
  if (clone.supportingCharacters?.length) {
    clone.supportingCharacters = await Promise.all(
      clone.supportingCharacters.map(async (char) => {
        if (char.photos?.length) {
          char.photos = await uploadPhotos(userId, draftId, char.photos);
        }
        return char;
      })
    );
  }

  // Strip runtime-only fields
  delete clone.characterPortrait;
  delete clone.supportingPortraits;
  delete clone.appearanceAutofillHash;

  // Strip selectedConcept.coverImage but keep text fields
  if (clone.selectedConcept) {
    delete clone.selectedConcept.coverImage;
  }

  return clone as Record<string, unknown>;
}

/**
 * Deserialize answers from jsonb storage.
 * - Downloads protagonist.photos from storage paths → data URLs
 * - Downloads each supportingCharacter.photos from storage paths → data URLs
 * Returns Partial<WizardAnswers>.
 */
export async function deserializeAnswers(
  persisted: Record<string, unknown>
): Promise<Partial<WizardAnswers>> {
  // Deep clone to avoid mutating the input
  const clone = JSON.parse(JSON.stringify(persisted)) as Partial<WizardAnswers>;

  // Download protagonist photos
  if (clone.protagonist?.photos?.length) {
    clone.protagonist.photos = await downloadPhotos(clone.protagonist.photos);
  }

  // Download supporting character photos
  if (clone.supportingCharacters?.length) {
    clone.supportingCharacters = await Promise.all(
      clone.supportingCharacters.map(async (char) => {
        if (char.photos?.length) {
          char.photos = await downloadPhotos(char.photos);
        }
        return char;
      })
    );
  }

  return clone;
}
