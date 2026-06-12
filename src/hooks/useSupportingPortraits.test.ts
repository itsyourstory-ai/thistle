/**
 * Tests for useSupportingPortraits.
 *
 * Covers: auto-trigger per character, success/error state writes, and
 * the guard that skips a character whose portrait is already ready.
 *
 * Mocks: portraitApi (invokePortrait), WizardContext.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { SupportingPortraitsState } from "@/lib/wizardTypes";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvokePortrait = vi.fn();
vi.mock("@/hooks/portraitApi", () => ({
  invokePortrait: (...args: unknown[]) => mockInvokePortrait(...args),
}));

const mockSetAnswer = vi.fn();
let mockAnswers: Record<string, unknown> = {};

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({ answers: mockAnswers, setAnswer: mockSetAnswer }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeChar(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    relationship: "grandparent",
    relationshipOther: "",
    gender: "woman",
    ageRange: "adult",
    mode: "imagined",
    photos: [],
    appearance: {},
    traits: [],
    ...overrides,
  };
}

function makeAnswers(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    supportingCharacters: [],
    artStyle: "cozy-gouache",
    supportingPortraits: {} as SupportingPortraitsState,
    ...overrides,
  };
}

// ── Import hook after mocks ───────────────────────────────────────────────────

import { useSupportingPortraits } from "./useSupportingPortraits";

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswers = makeAnswers();
});

describe("useSupportingPortraits — no-op cases", () => {
  it("does not call invokePortrait when there are no supporting characters", async () => {
    renderHook(() => useSupportingPortraits());
    await act(async () => {});
    expect(mockInvokePortrait).not.toHaveBeenCalled();
  });

  it("does not call invokePortrait for a character with no name", async () => {
    mockAnswers = makeAnswers({
      supportingCharacters: [makeChar("c1", "")],
    });
    renderHook(() => useSupportingPortraits());
    await act(async () => {});
    expect(mockInvokePortrait).not.toHaveBeenCalled();
  });

  it("skips a character whose portrait is already ready with a matching hash", async () => {
    const char = makeChar("c1", "Grandma Rose");
    // Hash mirrors the `hashChar` function in useSupportingPortraits.ts.
    // app={} → app.hairColor/hairStyle/skinTone/features all come out as
    // `undefined` when joined (JavaScript join() coerces undefined → "undefined").
    const app = char.appearance as Record<string, unknown>;
    const hash = `i:${[
      char.name, char.relationship, char.relationshipOther, char.gender, char.ageRange,
      app.hairColor, app.hairStyle, app.skinTone, app.glasses ? "g" : "",
      app.features, "", "cozy-gouache",
    ].join("|")}`;

    mockAnswers = makeAnswers({
      supportingCharacters: [char],
      supportingPortraits: {
        c1: { status: "ready", dataUrl: "data:image/png;base64,CACHED", sourceHash: hash },
      } satisfies SupportingPortraitsState,
    });

    renderHook(() => useSupportingPortraits());
    await act(async () => {});

    expect(mockInvokePortrait).not.toHaveBeenCalled();
  });
});

describe("useSupportingPortraits — success path", () => {
  it("generates one portrait per supporting character", async () => {
    mockAnswers = makeAnswers({
      supportingCharacters: [
        makeChar("c1", "Grandma Rose"),
        makeChar("c2", "Uncle Tom"),
      ],
    });
    mockInvokePortrait.mockResolvedValue("data:image/png;base64,IMG");

    renderHook(() => useSupportingPortraits());

    await waitFor(() => expect(mockInvokePortrait).toHaveBeenCalledTimes(2));
  });

  it("stores a ready portrait for each character", async () => {
    mockAnswers = makeAnswers({
      supportingCharacters: [makeChar("c1", "Grandma Rose")],
    });
    mockInvokePortrait.mockResolvedValueOnce("data:image/png;base64,PORTRAIT_C1");

    renderHook(() => useSupportingPortraits());

    await waitFor(() => {
      const readyCall = mockSetAnswer.mock.calls.find(
        ([key, val]) => key === "supportingPortraits" && (val as any).c1?.status === "ready",
      );
      expect(readyCall).toBeDefined();
      expect(readyCall![1].c1.dataUrl).toBe("data:image/png;base64,PORTRAIT_C1");
    });
  });

  it("sets loading before the portrait resolves", async () => {
    mockAnswers = makeAnswers({
      supportingCharacters: [makeChar("c1", "Grandma Rose")],
    });
    mockInvokePortrait.mockResolvedValueOnce("data:image/png;base64,OK");

    renderHook(() => useSupportingPortraits());

    await waitFor(() => {
      const loadingCall = mockSetAnswer.mock.calls.find(
        ([key, val]) => key === "supportingPortraits" && (val as any).c1?.status === "loading",
      );
      expect(loadingCall).toBeDefined();
    });
  });
});

describe("useSupportingPortraits — error path", () => {
  it("stores an error state when invokePortrait throws", async () => {
    mockAnswers = makeAnswers({
      supportingCharacters: [makeChar("c1", "Grandma Rose")],
    });
    mockInvokePortrait.mockRejectedValueOnce(new Error("timeout"));

    renderHook(() => useSupportingPortraits());

    await waitFor(() => {
      const errCall = mockSetAnswer.mock.calls.find(
        ([key, val]) => key === "supportingPortraits" && (val as any).c1?.status === "error",
      );
      expect(errCall).toBeDefined();
      expect(errCall![1].c1.error).toContain("timeout");
    });
  });
});
