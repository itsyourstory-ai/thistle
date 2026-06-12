# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Thistle is a personalized children's book creator. Users walk through a 10-step wizard collecting the child's name, age, interests, personality, art style, and photos. That data is assembled into a `StoryBrief` and sent to Supabase Edge Functions that call AI models to generate the story, cover image, character portraits, and page illustrations.

## Commands

```bash
npm run dev          # dev server at http://localhost:8080
npm run build        # production build
npm run lint         # ESLint
npm test             # run tests once (vitest run)
npm run test:watch   # vitest in watch mode
npm run test:coverage # run tests with v8 coverage report
npm run test:deno    # run Deno unit tests for supabase/functions/_shared/
```

Run a single test file: `npx vitest run src/test/example.test.ts`

See [docs/TESTING.md](docs/TESTING.md) for the full testing guide (layers, helpers, conventions).

## Required env vars

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Architecture

### Tech stack

- **Vite + React 18 + TypeScript** SPA — `@` alias resolves to `src/`
- **Tailwind CSS + shadcn/ui** (Radix UI primitives) — component config in `components.json`
- **TanStack Query** for server state, **React Router v6** for routing
- **Supabase**: Postgres database, Row Level Security, and Deno Edge Functions
- **Vercel** hosting: `main` auto-deploys to staging; promote to production manually via the Vercel dashboard

### Wizard flow

Steps are defined in `src/lib/wizardSteps.ts` and routed in `src/App.tsx`:

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

`WizardContext` (`src/contexts/WizardContext.tsx`) is the single source of truth for all wizard answers. Key fields on `answers`:

- `childName`, `ageRange`, `gender`
- `protagonist` — `{ name, age, gender, photos[], appearance, traits[] }`
- `supportingCharacters` — array of supporting character objects
- `interestsList` — array of `{ word }` objects
- `artStyle`
- `selectedConcept` — approved story concept from `generate-summary` (includes `title`, `summary`, `story_seed`, `framework_id`, `coverImage`)
- `characterPortrait` — `{ status, dataUrl, sourceHash }`
- `bookId` — set after full book generation completes

### Brief assembly

`src/lib/buildBrief.ts` exports `buildBrief(answers)` which maps `WizardContext.answers` into a typed `StoryBrief` — the payload sent to every edge function. If you add a new wizard field, update both `buildBrief` and `StoryBrief`.

### Supabase Edge Functions

All AI work runs in `supabase/functions/`. Each function receives the `StoryBrief` (or a subset) in the request body.

| Function | Purpose |
|---|---|
| `generate-summary` | Generates 1–3 story concepts from the brief |
| `generate-cover` | Generates the book cover image |
| `generate-character-portrait` | Generates a portrait for one character |
| `extract-appearance-traits` | Vision pre-pass: extracts appearance features from an uploaded photo |
| `generate-book` | Orchestrates full book generation (story text + all page images) |
| `generate-book-images` | Generates individual page illustrations |
| `export-book-to-drive` / `export-book-images-to-drive` | Exports completed book to Google Drive |
| `_shared/` | Shared Deno modules: layouts, layout sequences, image reference prompting |

The client calls edge functions via `supabase.functions.invoke(name, { body })`. Edge functions write using `service_role` (bypasses RLS) — the client only has SELECT on `generated_books` for progress polling.

### Database

Key tables (migrations in `supabase/migrations/`):
- `generated_books` — one row per book; stores `brief` (jsonb), `status`, `parsed` story output, `framework_id`
- `book_images` — generated page images; service_role only
- `book_image_upload_attempts` — upload tracking; service_role only

### Page layout system

`src/lib/pageLayouts.ts` is the **client-side mirror** of `supabase/functions/_shared/layouts.ts`. **Keep these in sync by hand.** Layout IDs are used in both image prompt assembly (server) and the dev preview renderer (client).

### Dev-only route

`/dev/story-preview/:id` (`src/pages/DevStoryPreview.tsx`) renders a full book preview by `generated_books.id`. No auth required; not linked from the main app.

## Git workflow

**Direct pushes to `main` are blocked.** Always work on a feature branch and open a PR.

1. **Always branch before making any changes.** Never commit directly to `main`.
2. **When the user says to push**, push the branch and create a PR with `gh pr create`, then give the user the PR URL.

## Before merging

- Run `npm run lint && npm test` — do not skip even for small changes
- After any multi-file edit, run `npm run build` to catch TypeScript errors
- After any change touching Supabase (edge functions, migrations, RLS): verify new tables/columns have correct GRANT statements and RLS policies for all roles that need them
- When using `replace_all`, check the diff for duplicate props (e.g. two `className=` on one element silently drops the first) and unintentionally dropped Tailwind classes

## CI/CD

GitHub Actions runs lint, test, and build on every PR — all must pass before merge. Merging to `main` auto-deploys to Vercel staging. To promote to production, use the [Vercel deployments dashboard](https://vercel.com/its-your-story/thistle/deployments).
