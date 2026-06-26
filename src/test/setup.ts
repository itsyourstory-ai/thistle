import "@testing-library/jest-dom";

// Prevent .env.local dev flags from short-circuiting auth code paths in tests.
import.meta.env.VITE_DEV_AUTH_BYPASS = "";
import.meta.env.LOOPS_TRANSPORT = "mock";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
