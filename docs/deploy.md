# Deployment & CI/CD

This app is a Vite + React SPA hosted on **Vercel**, backed by **Supabase**
(database, auth, edge functions).

## Branch → environment mapping

| Git branch  | Vercel environment       | URL                          |
| ----------- | ------------------------ | ---------------------------- |
| `main`      | Staging (auto-deploy)    | stable preview / staging URL |
| `feature/*` | Preview (per-PR)         | unique `*.vercel.app` URL    |
| —           | Production (manual gate) | production domain            |

## Flow

```
feature/* ──PR──▶ CI (lint, test, build) + preview URL per PR
   │ merge
   ▼
 main ──────────▶ auto-deploy to Staging
                        │
              Vercel dashboard: "Promote to Production"
                        │
                        ▼
                   Production
```

**To ship to production:** open the Vercel dashboard → find the latest `main`
deployment → click **"Promote to Production"**. That's it — no git branch needed.

## Deploying Supabase changes

Vercel only deploys the website. **Edge functions and migrations don't deploy on merge.** Until someone deploys them, the live backend runs the old code, even though `main` has the new code.

**Rule:** if a PR changes anything in `supabase/`, the PR author deploys it right after merging and leaves a comment on the PR saying what was deployed. The PR template has a checkbox for this.

Steps (from an up-to-date `main`):

1. **Check the CLI is linked to Thistle** (project ref `uglsyitjasajubfvbiry`):

   ```bash
   supabase projects list
   ```

   The linked project is marked. If it's `coiobrdbqledpzvcttto`, stop: that's a different app.

2. **Apply new migrations first**, one file at a time, oldest first. Don't use `supabase db push` (it's unreliable for this project):

   ```bash
   supabase db query --linked --file supabase/migrations/<file>.sql
   ```

   Or paste the file into the Supabase SQL editor. Migrations go before functions so new code never runs against an old database.

3. **Deploy the changed edge functions:**

   ```bash
   supabase functions deploy <function-name>
   ```

   A change to `supabase/functions/_shared/` affects every function that imports it. Deploy all of those (or deploy everything with `supabase functions deploy`).

4. **Set any new secrets** in the Supabase dashboard (Functions → Secrets) before or along with the deploy. New secrets are listed in AGENTS.md.

5. **Comment on the PR:** e.g. "Deployed: migration `20261112_add_x.sql`, functions `generate-book`, `stripe-webhook`."

Staging and production share this one Supabase project, so a Supabase deploy is live for **both** at once. There's no staging-only backend (see THI-34).

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs `lint`, `test`, and `build` on every PR to
`main` and on direct pushes to `main`. Configured as a **required status check**
via branch protection — a failing run blocks the merge.

## Environment variables (set in Vercel)

Vercel → Project → Settings → Environment Variables.
Same Supabase project is used for both staging and production.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`

Edge function secrets are set in Supabase, not Vercel; see AGENTS.md → "Required env vars".

Local development uses `.env` (gitignored). See `.env.example`.

For the production authentication-email cutover, follow the [Loops auth-email cutover runbook](runbooks/loops-auth-email-cutover.md).

## Node version

Pinned to Node 24 via `.nvmrc` and `engines` in `package.json` (used by CI and Vercel). Run `nvm use` locally.
