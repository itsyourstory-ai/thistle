/**
 * Wizard-flow smoke tests.
 *
 * Verifies that WizardContext initialises correctly, that seedAnswers()
 * loads each profile, and that buildBrief() on the loaded answers always
 * produces a structurally valid StoryBrief. Catches the common failure
 * mode where a step renames a context field and the brief silently loses
 * that data.
 *
 * callEdge is mocked so no Supabase calls are made.
 */

import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { WizardProvider, useWizard } from "@/contexts/WizardContext";
import { buildBrief } from "@/lib/buildBrief";
import { SEED_PROFILES } from "@/lib/devSeeds";
import type { StoryBrief } from "@/lib/buildBrief";

// ── Mock edge functions ───────────────────────────────────────────────────────

vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

type WizardApi = ReturnType<typeof useWizard>;

function makeContextSpy() {
  let api: WizardApi | null = null;
  const Spy = () => {
    api = useWizard();
    return null;
  };
  const get = () => api!;
  return { Spy, get };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <WizardProvider>{children}</WizardProvider>
    </MemoryRouter>
  );
}

// ── WizardContext initialisation ──────────────────────────────────────────────

describe("WizardContext — initialisation", () => {
  it("starts with empty answers", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });
    expect(get().answers).toEqual({});
  });

  it("starts with canContinue = false", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });
    expect(get().canContinue).toBe(false);
  });

  it("setAnswer updates a single field without clobbering others", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });

    act(() => get().setAnswer("childName", "Rosie"));
    act(() => get().setAnswer("ageRange", "5-7"));

    expect(get().answers.childName).toBe("Rosie");
    expect(get().answers.ageRange).toBe("5-7");
  });

  it("setCanContinue updates the flag", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });

    act(() => get().setCanContinue(true));
    expect(get().canContinue).toBe(true);

    act(() => get().setCanContinue(false));
    expect(get().canContinue).toBe(false);
  });
});

// ── seedAnswers ───────────────────────────────────────────────────────────────

describe("WizardContext — seedAnswers", () => {
  it("loads the Classic profile", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });
    const profile = SEED_PROFILES.find((p) => p.id === "classic")!;

    act(() => get().seedAnswers(profile.answers));

    expect(get().answers.childName).toBe("Leo");
    expect(get().answers.artStyle).toBe("cozy-gouache");
    expect(get().answers.supportingCharacters).toHaveLength(2);
    expect(get().answers.protagonist?.name).toBe("Leo");
  });

  it("loads the Minimal profile (no photo, no supporting cast)", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });
    const profile = SEED_PROFILES.find((p) => p.id === "minimal")!;

    act(() => get().seedAnswers(profile.answers));

    expect(get().answers.childName).toBe("Priya");
    expect(get().answers.supportingCharacters).toHaveLength(0);
    expect(get().answers.protagonist?.photos).toHaveLength(0);
  });

  it("merges seed on top of existing answers without losing prior data", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });

    act(() => get().setAnswer("buyer_name", "Jordan"));
    act(() => get().seedAnswers({ childName: "Leo" }));

    expect(get().answers.buyer_name).toBe("Jordan");
    expect(get().answers.childName).toBe("Leo");
  });
});

// ── buildBrief integration — all 4 seed profiles ─────────────────────────────

describe("buildBrief — valid brief produced from every seed profile", () => {
  function assertValidBrief(brief: StoryBrief) {
    // Structural shape
    expect(typeof brief.child.name).toBe("string");
    expect(brief.child.name.length).toBeGreaterThan(0);
    expect(Array.isArray(brief.story.interests)).toBe(true);
    expect(Array.isArray(brief.story.personality)).toBe(true);
    expect(Array.isArray(brief.supportingCharacters)).toBe(true);
    expect(Array.isArray(brief.protagonist.photos)).toBe(true);
    // photos[0] is always the same as photoDataUrl when set
    if (brief.protagonist.photos.length > 0) {
      expect(brief.protagonist.photoDataUrl).toBe(brief.protagonist.photos[0]);
    }
  }

  SEED_PROFILES.forEach((profile) => {
    it(`"${profile.id}" — brief is structurally valid`, () => {
      const { Spy, get } = makeContextSpy();
      render(<Spy />, { wrapper: Wrapper });
      act(() => get().seedAnswers(profile.answers));
      assertValidBrief(buildBrief(get().answers));
    });
  });

  it("no interest or personality item is an empty string", () => {
    const { Spy, get } = makeContextSpy();
    render(<Spy />, { wrapper: Wrapper });
    const profile = SEED_PROFILES.find((p) => p.id === "classic")!;
    act(() => get().seedAnswers(profile.answers));

    const brief = buildBrief(get().answers);
    brief.story.interests.forEach((w) => expect(w.trim().length).toBeGreaterThan(0));
    brief.story.personality.forEach((w) => expect(w.trim().length).toBeGreaterThan(0));
  });
});
