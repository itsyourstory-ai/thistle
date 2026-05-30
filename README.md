# Thistle

A Vite + React SPA backed by Supabase (database, auth, edge functions). Hosted on Vercel.

## Deployment

### How it works

| Trigger | What happens |
|---|---|
| Open a PR targeting `main` | CI runs (lint, test, build) + Vercel preview URL generated |
| Merge to `main` | Auto-deploys to **staging** |
| Click "Promote to Production" in Vercel | Promotes current staging build to **production** |

CI is a required check — merges are blocked if lint, tests, or build fail.

### Promote to production

1. Open [Vercel dashboard](https://vercel.com/dashboard) → Thistle → Deployments
2. Find the latest `main` deployment
3. Click `⋯` → **Promote to Production**

No git branch push needed. Production is always a promoted staging build.

### Environment variables

Set in **Vercel → Project → Settings → Environment Variables** (already configured):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

For local development, copy `.env.example` → `.env` and fill in the values.

### Setup notes

- **Supabase:** single project shared across staging and production
- **Node version:** pinned to 22 via `.nvmrc` — run `nvm use` locally; Vercel and CI pick it up automatically
- **Branch protection:** direct pushes to `main` are blocked; all changes go through PRs
- **Lockfile:** uses `package-lock.json` (`npm ci`). Do not use Bun to install — it generates an incompatible lockfile

