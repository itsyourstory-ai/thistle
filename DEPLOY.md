# Deployment & CI/CD

This app is a Vite + React SPA hosted on **Vercel**, backed by **Supabase**
(database, auth, edge functions).

## Branch → environment mapping

| Git branch    | Vercel environment | Supabase project | URL                         |
| ------------- | ------------------ | ---------------- | --------------------------- |
| `main`        | Production         | prod project     | production domain           |
| `staging`     | Staging (preview)  | staging project  | staging domain / preview    |
| `feature/*`   | Preview (per-PR)   | staging project  | unique `*.vercel.app` URL   |

Flow:

```
feature/* ──PR──▶ preview deploy + CI (lint, test, build)
   │ merge
   ▼
 staging ──────▶ auto-deploy to Staging
   │ merge
   ▼
  main ────────▶ auto-deploy to Production
```

## CI (GitHub Actions)

`.github/workflows/ci.yml` runs `lint`, `test`, and `build` on every PR and on
pushes to `main`/`staging`. These are configured as **required status checks**
via branch protection, so a failing run blocks the merge — and therefore blocks
the deploy.

## Environment variables (set in Vercel, per environment)

Set these in Vercel → Project → Settings → Environment Variables. Scope the
staging values to the **Preview** environment and the production values to
**Production**.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Local development uses `.env` (gitignored). See `.env.example`.

## Node version

Pinned to Node 22 via `.nvmrc` (used by CI and Vercel). Run `nvm use` locally.

## Supabase environments

Staging and production are **separate Supabase projects**. When the schema or
edge functions change, apply them to both:

```sh
# link to a project, then:
supabase db push                 # apply migrations
supabase functions deploy        # deploy all edge functions
# set edge-function secrets (AI/Drive/service-role keys) per project:
supabase secrets set KEY=value
```
