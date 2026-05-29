/**
 * Assembles the wizard answers into a "story brief" payload sent to the
 * generate-summary / generate-cover edge functions.
 *
 * Field names here must match what each Step component actually saves to
 * WizardContext — otherwise data the user typed silently disappears from
 * the prompt. See the per-step audit in chat history.
 *
 * Pure — no React, no side effects.
 */

export interface AppearanceLike {
  hairColor?: string;
  hairStyle?: string;
  skinTone?: string;
  glasses?: boolean;
  features?: string;
}

export interface SupportingBriefChar {
  name?: string;
  relationship?: string;
  gender?: string;
  ageRange?: string;
  description?: string;
  traits?: string[];
  appearance?: AppearanceLike;
  /** Reference photo data URLs (only when mode === "real"). */
  photos?: string[];
}

export interface StoryBrief {
  child: {
    name: string;
    ageRange?: string;
    gender?: string;
    language?: string;
  };
  story: {
    genre?: string;
    mood?: string;
    lesson?: string;
    interests: string[];
    personality: string[];
  };
  protagonist: {
    name?: string;
    age?: string;
    gender?: string;
    /** Free-text "something unique about appearance". */
    special?: string;
    appearance?: AppearanceLike;
    /** All uploaded reference photos as data URLs. */
    photos: string[];
    /** First photo, kept for backwards-compatible single-image consumers. */
    photoDataUrl?: string;
  };
  supportingCharacters: SupportingBriefChar[];
  artStyle?: string;
  specialThing?: {
    category?: string;
    /** Free-form details (animal type, color, name, photo, etc.). */
    details?: Record<string, string>;
  };
  /** Buyer's relationship to the child — flavors the dedication voice. */
  buyer_relationship?: string;
  /** Occasion the book is for — light flavor, never central plot. */
  occasion?: string;
  /** Whether to include the "This book belongs to" page. */
  bookBelongsTo?: boolean;
  /** Buyer name collected at checkout — drives the Drive folder name. */
  buyer_name?: string;
  /** Buyer email collected at checkout. */
  buyer_email?: string;
}

function wordsFromList(list: any): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((e) => (typeof e === "string" ? e : e?.word))
    .map((w) => (typeof w === "string" ? w.trim() : ""))
    .filter(Boolean);
}

export function buildBrief(answers: Record<string, any>): StoryBrief {
  const proto = (answers.protagonist as any) || {};
  const supporting = (answers.supportingCharacters as any[]) || [];

  const interests = wordsFromList(answers.interestsList);
  const personality = wordsFromList(proto.traits) .length
    ? wordsFromList(proto.traits)
    : wordsFromList(answers.personalityList);

  const protoPhotos: string[] = Array.isArray(proto.photos) ? proto.photos : [];

  return {
    child: {
      name: (answers.childName || proto.name || "the child").trim(),
      ageRange: answers.ageRange,
      gender: answers.gender,
      language: answers.language,
    },
    story: {
      genre: answers.genre,
      mood: answers.mood,
      lesson: answers.lesson,
      interests,
      personality,
    },
    protagonist: {
      name: proto.name,
      age: proto.age,
      gender: proto.gender,
      special: proto.special,
      appearance: proto.appearance,
      photos: protoPhotos,
      photoDataUrl: protoPhotos[0],
    },
    supportingCharacters: supporting.map((c) => ({
      name: c.surpriseName ? undefined : c.name,
      relationship:
        c.relationship === "Other" ? c.relationshipOther : c.relationship,
      gender: c.gender,
      ageRange: c.ageRange,
      description: c.description,
      traits: Array.isArray(c.traits)
        ? c.traits.map((t: any) => t?.word).filter(Boolean)
        : undefined,
      appearance: c.appearance,
      photos:
        c.mode === "real" && Array.isArray(c.photos) ? c.photos : undefined,
    })),
    artStyle: answers.artStyle,
    specialThing: answers.specialThing
      ? {
          category: answers.specialThing.category,
          details: answers.specialThing.details,
        }
      : undefined,
    buyer_relationship: answers.buyer_relationship,
    occasion: answers.occasion,
    bookBelongsTo: answers.bookBelongsTo,
    buyer_name: answers.buyer_name,
    buyer_email: answers.buyer_email,
  };
}
