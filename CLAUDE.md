# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Thistle is a personalized children's book creator. Users walk through a 10-step wizard that collects the child's name, age, interests, personality, art style preference, and uploaded photos. That data is assembled into a `StoryBrief` and sent to Supabase Edge Functions that call AI models to generate the story, cover image, character portraits, and page illustrations.

## Commands

```bash
npm run dev        # dev server at http://localhost:8080
npm run build      # production build
npm run lint       # ESLint
npm test           # run tests once (vitest run)
npm run test:watch # vitest in watch mode
```

Run a single test file: `npx vitest run src/test/example.test.ts`

## Local setup

```bash
cp .env.example .env   # fill in Supabase values
nvm use                # Node 22 (pinned in .nvmrc)
npm install
npm run dev
```

Required env vars (get from Supabase dashboard):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## Architecture

### Tech stack

- **Vite + React 18 + TypeScript** SPA — `@` alias resolves to `src/`
- **Tailwind CSS + shadcn/ui** (Radix UI primitives) — component config in `components.json`
- **TanStack Query** for server state, **React Router v6** for routing
- **Supabase**: Postgres database, Row Level Security, and Deno Edge Functions
- **Vercel** hosting: `main` auto-deploys to staging; promote to production manually via the Vercel dashboard

### Wizard flow

The core user experience is a linear wizard. Steps are defined in `src/lib/wizardSteps.ts` and routed individually in `src/App.tsx`:

| Route | Step |
|---|---|
| `/step/1-name` | Child's name, age, gender |
| `/step/2-buyer` | Buyer relationship + occasion |
| `/step/3-genre` | Story genre/mood |
| `/step/4-lesson` | Life lesson |
| `/step/5-interests` | Interests (editable chip picker) |
| `/step/6-art-style` | Art style selection |
| `/step/7-character` | Protagonist + supporting characters + personality |
| `/step/8-summary` | AI generates story concept + cover; user approves |
| `/step/9-preview` | Preview the final book (Step10Preview.tsx) |
| `/step/10-generating` | Full book generation (Step9Generating.tsx) |

Note: route slugs and filenames are intentionally offset by one between steps 9 and 10.

### State management

`WizardContext` (`src/contexts/WizardContext.tsx`) is the single source of truth for all wizard answers. It lives at the root and persists in-memory for the session. Key fields on `answers`:

- `childName`, `ageRange`, `gender` — child identity
- `protagonist` — object: `{ name, age, gender, photos[], appearance, traits[] }`
- `supportingCharacters` — array of supporting character objects
- `interestsList` — array of `{ word }` objects
- `artStyle` — selected art style string
- `selectedConcept` — approved story concept from `generate-summary` (includes `title`, `summary`, `story_seed`, `framework_id`, `coverImage`)
- `characterPortrait` — `{ status, dataUrl, sourceHash }` — the protagonist portrait
- `bookId` — set after full book generation completes

### Brief assembly

`src/lib/buildBrief.ts` exports `buildBrief(answers)` which maps `WizardContext.answers` into a typed `StoryBrief`. This is the payload sent to every edge function. Field names in `answers` must match what `buildBrief` reads — if you add a new wizard field, update `buildBrief` and `StoryBrief`.

### Background portrait generation

`src/hooks/useCharacterPortrait.ts` auto-fires the `generate-character-portrait` edge function as soon as the user has a protagonist photo or enough descriptive fields. It:

1. Calls `extract-appearance-traits` to autofill appearance fields from the uploaded photo
2. Calls `generate-character-portrait` to produce the portrait
3. Stores the result in `answers.characterPortrait` so it persists across step navigation

The hook uses a `sourceHash` to avoid re-firing on unrelated state changes. `useSupportingPortraits.ts` does the same for supporting characters.

### Supabase Edge Functions

All AI work runs in `supabase/functions/`. Each function receives the `StoryBrief` (or a subset) in the request body.

| Function | Purpose |
|---|---|
| `generate-summary` | Generates 1–3 story concepts (title + summary) from the brief |
| `generate-cover` | Generates the book cover image |
| `generate-character-portrait` | Generates a portrait for one character |
| `extract-appearance-traits` | Vision pre-pass: extracts hair/skin/features from an uploaded photo |
| `generate-book` | Orchestrates full book generation (story text + all page images) |
| `generate-book-images` | Generates individual page illustrations |
| `export-book-to-drive` / `export-book-images-to-drive` | Exports completed book to Google Drive |
| `_shared/` | Shared Deno modules: layouts, layout sequences, image reference prompting |

The client calls edge functions via `supabase.functions.invoke(name, { body })`. Edge functions write to the database using `service_role` which bypasses RLS — the client (anon/authenticated) only has SELECT on `generated_books` for progress polling.

### Database

Key tables (migrations in `supabase/migrations/`):
- `generated_books` — one row per book; stores `brief` (jsonb), `status`, `parsed` story output, `framework_id`
- `book_images` — generated page images; only service_role can read/write
- `book_image_upload_attempts` — upload tracking; only service_role

### Page layout system

`src/lib/pageLayouts.ts` is the **client-side mirror** of `supabase/functions/_shared/layouts.ts`. Both must be kept in sync by hand. Layout IDs like `text-bottom-third`, `full-bleed`, `text-center-card` are used both in image prompt assembly (server) and the dev preview renderer (client).

### Dev-only route

`/dev/story-preview/:id` (`src/pages/DevStoryPreview.tsx`) renders a full book preview by `generated_books.id`. No auth required; not linked from the main app.

## Git workflow

**Direct pushes to `main` are blocked.** Branch protection requires the "Lint & Test" CI check to pass. Always work on a feature branch and open a PR.

```bash
git checkout main && git pull
git checkout -b feature/your-description   # or fix/your-description
# ... make changes ...
git add <files>
git commit -m "feature: describe what you did"
git push -u origin feature/your-description
gh pr create
```

Merge the PR on GitHub after CI passes. Then clean up locally:

```bash
git checkout main && git pull
git branch -d feature/your-description
```

## CI/CD

GitHub Actions runs lint, test, and build on every PR. All three must pass before merge is allowed. Merging to `main` auto-deploys to Vercel **staging** — not production.

**To ship to production:** open the [Vercel deployments dashboard](https://vercel.com/its-your-story/thistle/deployments) → find the latest `main` deployment → hover the row → click `⋯` → **Promote to Production**.
