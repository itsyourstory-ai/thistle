> Ticket: THI-20
> Branch: feature/thi-20-customer-facing-book-preview-route

# Plan: Customer-facing book view (`/book/:id`)

## Status

| Task | Description | Done |
| ---- | ----------- | ---- |
| 1 | Deno tests, then `_shared/bookImage.ts`: owner-only lookup of one page image | ✅ |
| 2 | New `get-book-image` edge function (thin wrapper) + `config.toml` entry | ✅ |
| 3 | Client: `fetchBookImage` helper, `EdgeFnName`, test-mode fixture, request-shape test | ✅ |
| 4 | Tests, then `BookView` page (not found / still making / failed / ready) and `BookReader` | ✅ |
| 5 | Add the `/book/:id` route under `ProtectedRoute` | ✅ |
| 6 | Tests, then dashboard: `BookCard` links to `/book/:id` and shows status; dashboard query shows every book | ✅ |
| 7 | Tests, then "book ready" email `previewUrl` → `/book/:id` | ✅ |
| 8 | Docs (`AGENTS.md`), then `lint`, `test`, `build`, Deno tests, `deno check` | ✅ |

## Background

Buyers have no way to see a finished book. `BookCard` links to
`/dev/story-preview/:id`, which is left out of production builds (a 404), and the
"your book is ready" email points at `/dashboard`. Two facts shape the design:

- **Images are not readable from the browser.** `book_images` is service-role only,
  and each image is a base64 data URL (a full book is tens of MB). Decision on the
  ticket (Nov 12): an edge function checks the signed-in user owns the book and
  returns its images. No change to `book_images` access.
- **The cover image is not stored anywhere.** The pipeline never writes a `cover`
  row to `book_images`, and the approved cover (a data URL from the wizard) is blanked
  out of the brief by `stripDataUrls` in `generate-book` before the brief is saved.
  So the viewer **cannot show a cover image** and opens on the title page instead.
  Saving the cover is a separate change (it touches checkout and the pipeline).

## Approach

**One image per request.** `get-book-image` takes `{ book_id, slot }` (slot = page number) and
returns `{ image_data_url }`. The reader shows one page at a time and loads only
that page's image (plus the next one in the background), so no single response is
huge. Rejected: one call returning every image (tens of MB, slow, big memory use).

**Ownership.** The function finds the book with `id = book_id AND user_id = <caller>`.
Anything else (not yours, doesn't exist) returns the same 404, so the function
doesn't reveal whether someone else's book exists. The page itself relies on the
existing `Users read own generated_books` RLS policy: a book that isn't yours comes
back as no row, and the page shows the existing Not Found screen.

**Pure helper, thin handler.** The lookup lives in `_shared/bookImage.ts` so Deno
can unit-test it (the handler itself can't be tested, per `docs/test-suite.md`).

**Only `data:image/` values are returned**, so a stray URL or script in the column
can't reach the browser.

**What the page selects from `generated_books`.** `id`, `pipeline_status`,
`pipeline_progress`, `pipeline_error`, `parsed` (story text and layouts) and
`brief->child` (name only). Never the whole `brief` (it holds the buyer's email).

**States of `/book/:id`:**

| State | What the buyer sees |
| ----- | ------------------- |
| No row, or invalid id (Postgres error `22P02`) | Existing `NotFound` screen |
| Other query error | `AsyncError` with Try again |
| `pipeline_status` not `done` / `failed` | "Still being made" with progress; re-checks every 5 s; link to dashboard |
| `failed` | Friendly message + support email link |
| `done` | The reader |
| `done` but `parsed` is not the current (V2) shape | "This book can't be shown here yet" message |

**Reader layout (needs Jordan's eye).** One square page at a time, starting
at the title page. Previous / Next buttons and left/right arrow keys; "Page 3 of 32"
announced politely. Per page: image (if the page has an `image_prompt`) and text.
Text goes above the image when the layout's `textPlacement` is `top`, otherwise
below. A page with no image is text only; a page with no text is image only.
This is a simple, readable layout, not a pixel match of the print layouts.

**Dashboard.** `BookCard` links to `/book/:id` and shows a status label
(Ready / Being made / Something went wrong). The books query drops the
`status = 'ok'` filter, which currently hides books still generating and books
flagged `needs_review`, and also selects `pipeline_status`.

**Email.** `previewUrl` becomes `${APP_BASE_URL}/book/${book.id}`.

**Not changed:** migrations, RLS, GRANTs, `book_images` access, the image pipeline,
`DevStoryPreview`, Step 9 (generating) copy.

## Needs a person after merge

- The new function deploys automatically when this merges (no migration, no new
  secret). Confirm the **Deploy edge functions** run succeeded.
- No Human-labelled steps.

## Done when

- A signed-in buyer opening `/book/:id` for their own finished book sees every page with its illustration (no cover image: see Background).
- Someone else's id, or a made-up id, shows the Not Found screen.
- A book still being made, or failed, shows a clear message instead of a broken page.
- The dashboard "View" button works in production and each book shows its status.
- The "ready" email links to `/book/:id`.
- `npm run lint && npm test && npm run build` and the Deno tests pass.

## Found while researching (not in the ticket)

- The dashboard reads the child's name from `brief->childName`, but briefs store it
  at `brief.child.name`, so every card says "Unknown". Fixed in task 6 because that
  query is being rewritten anyway.
- Login doesn't remember where a signed-out visitor was headed, so someone who clicks the
  email link while signed out lands on `/dashboard` after signing in, one click from the book.
  Not changed here; it affects every protected page.
- Old (V1) books have no `pages`; the reader doesn't support them (see states).
- Images are not print resolution (THI-45) and base64 in Postgres stays slow-ish;
  moving them to Storage is a later ticket, as the ticket says.
- No rate limit on `get-book-image`: it's read-only, owner-only and makes no AI call.
