# Testing Guide

## Three layers

| Layer | What goes here | Runner | Command |
|---|---|---|---|
| **Vitest unit** | Pure utility functions, React components, custom hooks | Vitest + jsdom | `npm test` |
| **Vitest with coverage** | Same as above, produces an HTML report | Vitest | `npm run test:coverage` |
| **Deno unit** | Pure modules in `supabase/functions/_shared/` | Deno | `npm run test:deno` |

CI runs both Vitest (with coverage) and Deno tests on every PR. Both must pass before merge.

## Where test files live

- **Utility/lib functions** — colocated next to the module: `src/lib/artStyles.test.ts`
- **Hooks** — colocated: `src/hooks/useCharacterPortrait.test.ts`
- **Components and integration tests** — `src/test/*.test.tsx`
- **Deno shared modules** — colocated in `supabase/functions/_shared/`

Naming: `*.test.ts` or `*.test.tsx` (vitest picks up everything under `src/`; Deno picks up everything under `supabase/functions/_shared/`).

## Shared helper: `renderWithProviders`

Import from `@/test/utils` (not directly from `@testing-library/react`) in component and integration tests:

```ts
import { renderWithProviders, screen, userEvent } from "@/test/utils";

it("shows the dashboard", async () => {
  renderWithProviders(<Dashboard />, { route: "/dashboard" });
  expect(screen.getByText("Your books")).toBeInTheDocument();
});
```

`renderWithProviders` wraps the UI in a `QueryClientProvider` (retries disabled, gcTime 0) and a `MemoryRouter`. It also re-exports everything from `@testing-library/react` and `@testing-library/user-event`.

Use `userEvent` over `fireEvent` for interactions (it more accurately simulates real browser behaviour).

## Fixtures

`src/test/fixtures/` contains:

- `index.ts` — `getFixture(fnName, profileId)` returns mock `{ data, error }` shapes for every edge function, keyed by seed profile (`classic`, `minimal`, `edge-text`, `special-pet`). Use these in tests rather than hand-rolling payloads.
- `images.ts` — tiny inline SVG data-URLs for cover images, portraits, and an uploaded photo (`FAKE_PHOTO`). Use instead of reading real files in tests.

## Mocking conventions

### WizardContext

```ts
const mockSetAnswer = vi.fn();
let mockAnswers = { ... };

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({ answers: mockAnswers, setAnswer: mockSetAnswer }),
}));
```

### Auth

```ts
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@test.com" }, session: { user: {} } }),
}));
```

### Edge functions

```ts
const mockCallEdge = vi.fn();
vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: (...args) => mockCallEdge(...args),
}));
mockCallEdge.mockResolvedValue({ data: { ... }, error: null });
```

## Coverage

Coverage is measured and reported, but there is no failing threshold yet. To view the HTML report:

```bash
npm run test:coverage
open coverage/index.html
```

Coverage is excluded for: `src/components/ui/**` (shadcn primitives), test files themselves, and `src/main.tsx`.

## Deno tests

Deno tests use `https://deno.land/std@0.208.0/assert/mod.ts` for assertions (same version as the existing `_shared` tests). Only the `_shared/` subdirectory is tested — the rest of `supabase/functions/` pulls Supabase/AI runtime imports that don't make sense to exercise as unit tests.

If you don't have Deno installed locally, CI will catch failures. To install: `brew install deno` or `curl -fsSL https://deno.land/install.sh | sh`.

## TDD expectations

Per the project rules: write the test first, then implement. Every feature, bug fix, or behavior change needs a corresponding test. The CI build will catch test failures before merge.
