import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import type { WizardAnswers } from "@/lib/wizardTypes";

// ── Mutable state shared across mock factories ────────────────────────────────

let mockDraftId: string | null = null;
const mockSetDraftId = vi.fn((id: string | null) => {
  mockDraftId = id;
});

let mockAnswers: WizardAnswers = { childName: "Max" };

const mockWizardContext = () => ({
  answers: mockAnswers,
  draftId: mockDraftId,
  setDraftId: mockSetDraftId,
  setAnswer: vi.fn(),
  seedAnswers: vi.fn(),
  canContinue: false,
  setCanContinue: vi.fn(),
  isGenerating: false,
  setIsGenerating: vi.fn(),
  resetWizard: vi.fn(),
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: {}, loading: false }),
}));

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => mockWizardContext(),
}));

const mockSingle = vi.fn().mockResolvedValue({ data: { id: "draft-id-1" }, error: null });
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert, update: mockUpdate });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    get from() {
      return mockFrom;
    },
  },
}));

const mockSerializeAnswers = vi.fn().mockResolvedValue({ childName: "Max" });

vi.mock("@/lib/draftPhotos", () => ({
  serializeAnswers: (...args: unknown[]) => mockSerializeAnswers(...args),
}));

// ── Import after mocks are in place ──────────────────────────────────────────

import { useDraftPersistence } from "@/hooks/useDraftPersistence";

// ── Wrapper ───────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useDraftPersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDraftId = null;
    mockAnswers = { childName: "Max" };
    mockSetDraftId.mockClear();
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockSelect.mockClear();
    mockSingle.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockSerializeAnswers.mockClear();
    // Reset mocked return values to defaults
    mockSingle.mockResolvedValue({ data: { id: "draft-id-1" }, error: null });
    mockEq.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT fire when answers.childName is empty", async () => {
    mockAnswers = {};

    renderHook(() => useDraftPersistence(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("fires INSERT on first save (no draftId), captures id, calls setDraftId", async () => {
    mockDraftId = null;
    mockAnswers = { childName: "Max" };

    renderHook(() => useDraftPersistence(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    // Allow async chain to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        child_name: "Max",
        answers: {},
      })
    );
    expect(mockSetDraftId).toHaveBeenCalledWith("draft-id-1");
    expect(mockSerializeAnswers).toHaveBeenCalledWith("user-1", "draft-id-1", mockAnswers);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("fires UPDATE on subsequent saves (when draftId is set)", async () => {
    mockDraftId = "existing-draft-id";
    mockAnswers = { childName: "Max" };

    renderHook(() => useDraftPersistence(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSerializeAnswers).toHaveBeenCalledWith("user-1", "existing-draft-id", mockAnswers);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "existing-draft-id");
  });

  it("dirty is true after answers change, false after successful save", async () => {
    mockDraftId = "existing-draft-id";
    mockAnswers = { childName: "Max" };

    const { result } = renderHook(() => useDraftPersistence(), { wrapper });

    // dirty starts true because the useEffect that sets it fires on mount
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    // After a successful save, dirty should be false
    expect(result.current.dirty).toBe(false);
  });

  it("saveNow saves immediately without waiting for debounce", async () => {
    mockDraftId = "existing-draft-id";
    mockAnswers = { childName: "Max" };

    const { result } = renderHook(() => useDraftPersistence(), { wrapper });

    // Call saveNow without advancing timers
    await act(async () => {
      await result.current.saveNow();
    });

    expect(mockSerializeAnswers).toHaveBeenCalledWith("user-1", "existing-draft-id", mockAnswers);
    expect(mockUpdate).toHaveBeenCalled();
    expect(result.current.dirty).toBe(false);
  });
});
