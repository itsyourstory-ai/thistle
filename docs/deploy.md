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

Vercel only deploys the website. Supabase changes go out like this:

| Change | How it goes live |
| --- | --- |
| Edge functions (`supabase/functions/`) | **Automatically** when the PR merges to `main` |
| Migrations (`supabase/migrations/`) | **By hand**, by the PR author, right after merge |
| Edge-function secrets | **By hand**, in the Supabase dashboard (Functions → Secrets) |

Staging and production share this one Supabase project, so a Supabase deploy is live for **both** at once. There's no staging-only backend (see THI-34).

### Edge functions: automatic

The **Deploy edge functions** workflow (`.github/workflows/deploy-functions.yml`) runs when a merge to `main` changes anything under `supabase/functions/`. It:

1. Checks `supabase/config.toml` still points at Thistle (`uglsyitjasajubfvbiry`).
2. Stops if the merge adds a migration (see below).
3. Deploys **every** function with `supabase functions deploy --project-ref uglsyitjasajubfvbiry`. The project is hard-wired; the workflow can't target another one. `verify_jwt` settings come from `config.toml`.
4. Lists the deployed functions in the run's summary.

**After merging,** open GitHub → Actions → **Deploy edge functions** and check the run for your merge commit passed. Merges that only change app code or docs don't start it.

**Start it by hand:** Actions → **Deploy edge functions** → **Run workflow** (branch `main`). Do this after applying a migration, or to redeploy. Manual runs skip the migration check.

It uses the `SUPABASE_ACCESS_TOKEN` secret in the `production` GitHub environment (limited to `main`). The token expires; if a run fails with an auth or permission error, create a new token in Supabase (Account → Access tokens) and update the secret.

### Migrations: by hand, first

If a merge adds a file in `supabase/migrations/`, the deploy workflow **fails on purpose without deploying**, and the run lists the new migration files. Migrations go before functions so new code never runs against an old database.

From an up-to-date `main`:

1. **Check the CLI is linked to Thistle** (project ref `uglsyitjasajubfvbiry`):

   ```bash
   supabase projects list
   ```

   The linked project is marked. If it's `coiobrdbqledpzvcttto`, stop: that's a different app.

2. **Apply each new migration**, one file at a time, oldest first. Don't use `supabase db push` (it's unreliable for this project):

   ```bash
   supabase db query --linked --file supabase/migrations/<file>.sql
   ```

   Or paste the file into the Supabase SQL editor.

3. **Set any new secrets** in the Supabase dashboard (Functions → Secrets). New secrets are listed in AGENTS.md.

4. **Deploy the functions:** start **Deploy edge functions** by hand (above).

5. **Comment on the PR:** e.g. "Applied migration `20261112_add_x.sql`; deploy run passed: <link>."

### Deploying from your machine (fallback)

If GitHub Actions is down, you can still deploy by hand: `supabase functions deploy --project-ref uglsyitjasajubfvbiry`. A change to `_shared/` affects every function that imports it, so deploy everything. If it fails with `auth.hook.send_email.secrets must be formatted as "v1,whsec_…"`, export the placeholder `SEND_EMAIL_HOOK_SECRET` from the workflow file first (the deploy only validates it).

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs `lint`, `test`, and `build` on every PR to
`main` and on direct pushes to `main`. Configured as a **required status check**
via branch protection — a failing run blocks the merge.

`.github/workflows/deploy-functions.yml` deploys edge functions after a merge
(see [Edge functions: automatic](#edge-functions-automatic)). It never runs on PRs.

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
