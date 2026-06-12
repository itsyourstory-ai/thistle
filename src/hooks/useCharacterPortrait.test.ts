/**
 * Tests for useCharacterPortrait.
 *
 * Covers: source-hash computation (photo path vs. descriptive-fields path),
 * auto-trigger, success/error state writes to WizardContext.
 *
 * Mocks: portraitApi (invokePortrait), edgeFunctions (callEdge), WizardContext.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { CharacterPortraitState } from "@/lib/wizardTypes";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvokePortrait = vi.fn();
vi.mock("@/hooks/portraitApi", () => ({
  invokePortrait: (...args: unknown[]) => mockInvokePortrait(...args),
}));

const mockCallEdge = vi.fn();
vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: (...args: unknown[]) => mockCallEdge(...args),
}));

const mockSetAnswer = vi.fn();
let mockAnswers: Record<string, unknown> = {};

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({ answers: mockAnswers, setAnswer: mockSetAnswer }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Valid data-URL prefix recognised by the `startsWith("data:image/")` checks. */
const FAKE_PHOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/FAKEDATA_PADDED_TO_REASONABLE_LENGTH_FOR_HASH";

function makeAnswers(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protagonist: {
      name: "Leo",
      age: "6",
      gender: "boy",
      photos: [],
      appearance: {},
      traits: [],
    },
    artStyle: "cozy-gouache",
    characterPortrait: { status: "idle" } satisfies CharacterPortraitState,
    ...overrides,
  };
}

// ── Import hook after mocks ───────────────────────────────────────────────────

// Imported after vi.mock calls so mocks are in place (vi.mock is hoisted).
import { useCharacterPortrait } from "./useCharacterPortrait";

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswers = makeAnswers();
  mockCallEdge.mockResolvedValue({ data: { traits: {} }, error: null });
});

describe("useCharacterPortrait — does not fire", () => {
  it("does not call invokePortrait when protagonist has no name and no photo", async () => {
    mockAnswers = makeAnswers({
      protagonist: { name: "", age: "", gender: "", photos: [], appearance: {}, traits: [] },
    });

    renderHook(() => useCharacterPortrait());

    await act(async () => {});
    expect(mockInvokePortrait).not.toHaveBeenCalled();
  });

  it("calls invokePortrait only once when the portrait succeeds (no double-fire)", async () => {
    // Verifies the in-flight guard: the hook should not fire again while a
    // request is already running, so it is called at most once per mount.
    mockInvokePortrait.mockResolvedValueOnce("data:image/png;base64,OK");

    renderHook(() => useCharacterPortrait());
    await waitFor(() => expect(mockInvokePortrait).toHaveBeenCalledTimes(1));

    // No second call after the portrait resolves.
    expect(mockInvokePortrait).toHaveBeenCalledTimes(1);
  });
});

describe("useCharacterPortrait — success path", () => {
  it("sets loading then ready and stores the data URL", async () => {
    const imageUrl = "data:image/png;base64,PORTRAIT_OK";
    mockInvokePortrait.mockResolvedValueOnce(imageUrl);

    renderHook(() => useCharacterPortrait());

    await waitFor(() => {
      const readyCall = mockSetAnswer.mock.calls.find(
        ([key, val]) => key === "characterPortrait" && (val as any).status === "ready",
      );
      expect(readyCall).toBeDefined();
      expect(readyCall![1].dataUrl).toBe(imageUrl);
    });

    // There must also have been a loading call first.
    const loadingCall = mockSetAnswer.mock.calls.find(
      ([key, val]) => key === "characterPortrait" && (val as any).status === "loading",
    );
    expect(loadingCall).toBeDefined();
  });

  it("does not run appearance extraction when no photo is present", async () => {
    mockInvokePortrait.mockResolvedValueOnce("data:image/png;base64,OK");

    renderHook(() => useCharacterPortrait());
    await waitFor(() => expect(mockInvokePortrait).toHaveBeenCalledTimes(1));

    expect(mockCallEdge).not.toHaveBeenCalledWith("extract-appearance-traits", expect.anything());
  });

  it("runs appearance extraction before portrait generation when a photo is present", async () => {
    mockAnswers = makeAnswers({
      protagonist: {
        name: "Leo",
        age: "6",
        gender: "boy",
        photos: [FAKE_PHOTO],
        appearance: {},
        traits: [],
      },
    });
    mockInvokePortrait.mockResolvedValueOnce("data:image/png;base64,OK");
    mockCallEdge.mockResolvedValueOnce({
      data: { traits: { hair_color: "brown", skin_tone: "medium" } },
      error: null,
    });

    renderHook(() => useCharacterPortrait());

    await waitFor(() => expect(mockInvokePortrait).toHaveBeenCalledTimes(1));

    // Appearance extraction called before portrait generation.
    expect(mockCallEdge).toHaveBeenCalledWith(
      "extract-appearance-traits",
      expect.objectContaining({ photoDataUrl: FAKE_PHOTO }),
    );
    const callOrder = mockCallEdge.mock.invocationCallOrder[0];
    const portraitOrder = mockInvokePortrait.mock.invocationCallOrder[0];
    expect(callOrder).toBeLessThan(portraitOrder);
  });
});

describe("useCharacterPortrait — error path", () => {
  it("writes error state with the error message when invokePortrait throws", async () => {
    mockInvokePortrait.mockRejectedValueOnce(new Error("GPU quota exceeded"));

    renderHook(() => useCharacterPortrait());

    await waitFor(() => {
      const errCall = mockSetAnswer.mock.calls.find(
        ([key, val]) => key === "characterPortrait" && (val as any).status === "error",
      );
      expect(errCall).toBeDefined();
      expect(errCall![1].error).toContain("GPU quota exceeded");
    });
  });

  it("writes a fallback error message when the thrown value is not an Error", async () => {
    mockInvokePortrait.mockRejectedValueOnce("raw string rejection");

    renderHook(() => useCharacterPortrait());

    await waitFor(() => {
      const errCall = mockSetAnswer.mock.calls.find(
        ([key, val]) => key === "characterPortrait" && (val as any).status === "error",
      );
      expect(errCall).toBeDefined();
      expect(typeof errCall![1].error).toBe("string");
    });
  });
});
