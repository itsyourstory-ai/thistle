/**
 * Central test-mode store for the Thistle dev test harness.
 *
 * Persists state to localStorage so it survives dev-server refresh.
 * Every exported function is a no-op / safe default in production builds
 * (guarded by import.meta.env.DEV).
 *
 * React components use useTestMode(). Non-React code (e.g. callEdge) calls
 * getTestMode() directly.
 */

import { useSyncExternalStore } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProfileId = "classic" | "minimal" | "edge-text" | "special-pet";
export type CacheMode = "off" | "record" | "replay";

export interface TestModeState {
  /** Master on/off switch. */
  enabled: boolean;
  /** Which of the 4 seed profiles is active. */
  profileId: ProfileId;
  /** Fake latency added to every mocked call (ms). 0 = instant. */
  delayMs: number;
  /**
   * Edge function names that should return a fake error instead of a fixture.
   * Use ["*"] to force errors on all functions.
   */
  forceErrorFns: string[];
  /**
   * Edge function names that should call Supabase live even when test mode is
   * on (overrides forceErrorFns too). Enables testing one real function while
   * the rest are mocked.
   */
  perFnLive: string[];
  /** Whether to record real responses to cache, replay from cache, or skip. */
  cacheMode: CacheMode;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_STATE: TestModeState = {
  enabled: false,
  profileId: "classic",
  delayMs: 800,
  forceErrorFns: [],
  perFnLive: [],
  cacheMode: "off",
};

// ── Module-level store (not React state, so callEdge can read it) ─────────────

const STORAGE_KEY = "thistle_test_mode";

function readFromStorage(): TestModeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

// Initialise from localStorage in DEV; always-disabled default in prod.
let _state: TestModeState = import.meta.env.DEV ? readFromStorage() : { ...DEFAULT_STATE };
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Read current state. Safe to call from anywhere (no React required). */
export function getTestMode(): TestModeState {
  return _state;
}

/** Merge a partial update into state. No-op in production. */
export function setTestMode(patch: Partial<TestModeState>): void {
  if (!import.meta.env.DEV) return;
  _state = { ..._state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore.
  }
  _notify();
}

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribeTestMode(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** Snapshot getter for useSyncExternalStore. */
function _getSnapshot(): TestModeState {
  return _state;
}

/** Server snapshot for useSyncExternalStore (always disabled; no SSR in this app). */
function _getServerSnapshot(): TestModeState {
  return { ...DEFAULT_STATE };
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Hook for components that render test-mode controls or react to its state.
 * Returns [state, setTestMode].
 */
export function useTestMode(): [TestModeState, (patch: Partial<TestModeState>) => void] {
  const s = useSyncExternalStore(
    subscribeTestMode,
    _getSnapshot,
    _getServerSnapshot,
  );
  return [s, setTestMode];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the given function should be forced to error in test mode. */
export function isForcedError(fnName: string): boolean {
  const { forceErrorFns } = _state;
  return forceErrorFns.includes("*") || forceErrorFns.includes(fnName);
}

/** Returns true if the given function should run live even in test mode. */
export function isPerFnLive(fnName: string): boolean {
  return _state.perFnLive.includes(fnName);
}
