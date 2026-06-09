/**
 * Unit tests for buildBrief() — the pure answers → StoryBrief mapping.
 *
 * AIDEV-NOTE: This file is the primary guard against the documented
 * "field names must match steps" footgun. If a step renames a WizardAnswers
 * key, buildBrief silently produces a wrong brief. These tests catch that.
 */

import { describe, it, expect } from "vitest";
import { buildBrief } from "./buildBrief";
import { SEED_PROFILES } from "./devSeeds";

// ── Helpers ───────────────────────────────────────────────────────────────────

const seedFor = (id: string) => SEED_PROFILES.find((p) => p.id === id)!.answers;

// ── Empty answers ─────────────────────────────────────────────────────────────

describe("buildBrief — empty answers", () => {
  const brief = buildBrief({});

  it("falls back to 'the child' when no name is set", () => {
    expect(brief.child.name).toBe("the child");
  });

  it("produces empty arrays for lists", () => {
    expect(brief.story.interests).toEqual([]);
    expect(brief.story.personality).toEqual([]);
    expect(brief.protagonist.photos).toEqual([]);
    expect(brief.supportingCharacters).toEqual([]);
  });

  it("produces undefined for optional scalar fields", () => {
    expect(brief.child.ageRange).toBeUndefined();
    expect(brief.child.gender).toBeUndefined();
    expect(brief.story.genre).toBeUndefined();
    expect(brief.artStyle).toBeUndefined();
    expect(brief.specialThing).toBeUndefined();
  });
});

// ── Classic seed (Leo) — full-featured ───────────────────────────────────────

describe("buildBrief — Classic seed (Leo)", () => {
  const brief = buildBrief(seedFor("classic"));

  it("maps child.name from answers.childName", () => {
    expect(brief.child.name).toBe("Leo");
  });

  it("maps child.ageRange and child.gender", () => {
    expect(brief.child.ageRange).toBe("6-8");
    expect(brief.child.gender).toBe("boy");
  });

  it("maps story.genre and story.lesson", () => {
    expect(brief.story.genre).toBe("adventure");
    expect(brief.story.lesson).toBe("courage");
  });

  it("maps story.interests from interestsList[].word", () => {
    expect(brief.story.interests).toContain("dragons");
    expect(brief.story.interests).toContain("climbing trees");
    expect(brief.story.interests).toContain("dinosaurs");
  });

  it("maps story.personality from protagonist.traits[].word", () => {
    expect(brief.story.personality).toContain("brave");
    expect(brief.story.personality).toContain("curious");
    expect(brief.story.personality).toContain("kind");
  });

  it("maps protagonist.name and protagonist.age", () => {
    expect(brief.protagonist.name).toBe("Leo");
    expect(brief.protagonist.age).toBe("6");
  });

  it("includes the protagonist photo", () => {
    expect(brief.protagonist.photos).toHaveLength(1);
    expect(brief.protagonist.photoDataUrl).toEqual(brief.protagonist.photos[0]);
  });

  it("maps two supporting characters", () => {
    expect(brief.supportingCharacters).toHaveLength(2);
  });

  it("maps Mom's relationship directly", () => {
    const mom = brief.supportingCharacters.find((c) => c.name === "Mom");
    expect(mom).toBeDefined();
    expect(mom?.relationship).toBe("Mom");
    expect(mom?.gender).toBe("woman");
  });

  it("resolves Buddy's 'Other' relationship via relationshipOther", () => {
    const buddy = brief.supportingCharacters.find((c) => c.name === "Buddy");
    expect(buddy).toBeDefined();
    // relationship is "Other" in the seed, so buildBrief should use relationshipOther
    expect(buddy?.relationship).toBe("pet dog");
  });

  it("maps buyer_relationship and occasion", () => {
    expect(brief.buyer_relationship).toBe("parent");
    expect(brief.occasion).toBe("birthday");
  });

  it("maps artStyle", () => {
    expect(brief.artStyle).toBe("cozy-gouache");
  });
});

// ── Minimal seed (Priya) ──────────────────────────────────────────────────────

describe("buildBrief — Minimal seed (Priya)", () => {
  const brief = buildBrief(seedFor("minimal"));

  it("maps the child name", () => {
    expect(brief.child.name).toBe("Priya");
  });

  it("has no supporting characters", () => {
    expect(brief.supportingCharacters).toHaveLength(0);
  });

  it("has no protagonist photos (no-photo path)", () => {
    expect(brief.protagonist.photos).toHaveLength(0);
    expect(brief.protagonist.photoDataUrl).toBeUndefined();
  });

  it("has no specialThing", () => {
    expect(brief.specialThing).toBeUndefined();
  });
});

// ── Edge-text seed (Bartholomew-James) ───────────────────────────────────────

describe("buildBrief — Edge-text seed (Bartholomew-James)", () => {
  const brief = buildBrief(seedFor("edge-text"));

  it("preserves the hyphenated long name", () => {
    expect(brief.child.name).toBe("Bartholomew-James");
    expect(brief.protagonist.name).toBe("Bartholomew-James");
  });

  it("maps all 8 interests", () => {
    expect(brief.story.interests).toHaveLength(8);
    expect(brief.story.interests).toContain("maps");
    expect(brief.story.interests).toContain("long words");
  });

  it("passes specialThing with category and details", () => {
    expect(brief.specialThing?.category).toBe("pet");
    expect(brief.specialThing?.details?.type).toBe("fox");
    expect(brief.specialThing?.details?.name).toBe("Rusty");
  });

  it("hides the name of a surpriseName supporting character", () => {
    // surpriseName: true → buildBrief must omit the name
    expect(brief.supportingCharacters).toHaveLength(1);
    expect(brief.supportingCharacters[0].name).toBeUndefined();
  });
});

// ── Special-pet seed (River) ──────────────────────────────────────────────────

describe("buildBrief — Special-pet seed (River)", () => {
  const brief = buildBrief(seedFor("special-pet"));

  it("maps non-binary gender through correctly", () => {
    expect(brief.child.gender).toBe("non-binary");
    expect(brief.protagonist.gender).toBe("non-binary");
  });

  it("passes the cat specialThing", () => {
    expect(brief.specialThing?.category).toBe("pet");
    expect(brief.specialThing?.details?.name).toBe("Mochi");
    expect(brief.specialThing?.details?.type).toBe("cat");
  });

  it("maps grandma as a supporting character", () => {
    expect(brief.supportingCharacters).toHaveLength(1);
    expect(brief.supportingCharacters[0].name).toBe("Grandma Yuki");
    expect(brief.supportingCharacters[0].relationship).toBe("grandparent");
  });
});

// ── selectedConcept passthrough ───────────────────────────────────────────────

describe("buildBrief — selectedConcept passthrough", () => {
  it("sets approvedConcept from selectedConcept", () => {
    const brief = buildBrief({
      ...seedFor("classic"),
      selectedConcept: { title: "Test Title", summary: "Test summary" },
    });
    expect((brief.approvedConcept as any)?.title).toBe("Test Title");
  });

  it("approvedConcept is undefined when no concept is set", () => {
    const { selectedConcept: _omit, ...noConceptSeed } = seedFor("minimal") as any;
    const brief = buildBrief(noConceptSeed);
    expect(brief.approvedConcept).toBeUndefined();
  });
});
