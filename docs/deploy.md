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

Local development uses `.env` (gitignored). See `.env.example`.

For the production authentication-email cutover, follow the [Loops auth-email cutover runbook](runbooks/loops-auth-email-cutover.md).

## Node version

Pinned to Node 22 via `.nvmrc` (used by CI and Vercel). Run `nvm use` locally.
