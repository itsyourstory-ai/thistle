# Thistle Book

Personalized children's book creator. Vite + React + TypeScript single-page app. Backend: Supabase (database, auth, storage, edge functions). Hosting: Vercel.

**Read [AGENTS.md](AGENTS.md) before working in this repo.** It's the shared rulebook for people and AI tools: how the app is built, how we use Linear, commands, deploys, and known gotchas. All planned work lives in Linear (team **THI**).

---

## Working on a ticket

**1. Pick a ticket in Linear.** Check its "blocked by" list first, and assign it to yourself so nobody else starts it.

**2. Start from a fresh `main`**
```bash
git checkout main
git pull
```

**3. Create a branch with the ticket id in it** (lowercase). That's what links the branch and PR to the Linear ticket.
```bash
git checkout -b feature/thi-20-book-viewer
# or: fix/thi-35-checkout-buyer-email, chore/short-description
```

**4. Work, then push and open a PR**
```bash
git add .
git commit -m "feature: describe what you did"
git push -u origin feature/thi-20-book-viewer
gh pr create
```
Fill in the PR template (ticket, testing, Supabase deploy, Human steps).

**5. Wait for CI.** Lint, tests, build and the Deno tests run automatically. Merge is blocked until they pass. No approval is required, but ask the other person to look at anything risky.

**6. Merge the PR on GitHub.** GitHub deletes the branch on GitHub automatically.

**7. If the PR changed anything in `supabase/`, check the deploy.** Edge functions deploy automatically on merge (Actions → **Deploy edge functions**). Migrations and new secrets don't: apply them by hand, then start the deploy workflow if it stopped. Steps: [docs/deploy.md → Deploying Supabase changes](docs/deploy.md#deploying-supabase-changes).

**8. Clean up locally**
```bash
git checkout main
git pull
git fetch --prune
git branch -D feature/thi-20-book-viewer
```
Use `-D` (capital): PRs are squash-merged, so git can't tell the branch was merged and `-d` refuses to delete it. Only run this after the PR shows **Merged**.

---

## Shipping to production

Merging to `main` auto-deploys the website to **staging**. When you're ready to go live:

1. Open [Vercel deployment dashboard](https://vercel.com/its-your-story/thistle/deployments)
2. Find the top `main` deployment (status: **Ready · Preview**)
3. **Hover** the row — a `⋯` button appears on the right
4. Click `⋯` → **Promote to Production**

Staging and production share one Supabase project, so backend changes are live for both as soon as they're deployed (see AGENTS.md).

---

## Local setup

```bash
cp .env.example .env   # fill in the values below
nvm use                # switches to Node 24 (from .nvmrc)
npm install
npm run dev            # http://localhost:8080
```

Env vars needed:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase dashboard → Project Settings → API)
- `VITE_STRIPE_PUBLISHABLE_KEY` (Stripe dashboard → Developers → API keys; use the **test** key locally)

Other tools:
- **Deno** (for edge-function tests) comes from [mise](https://mise.jdx.dev): `mise install`, then `mise exec -- npm run test:deno`.
- **Supabase CLI** (for deploying functions and migrations): `supabase login`, then `supabase link --project-ref uglsyitjasajubfvbiry`. Check with `supabase projects list` that you're linked to Thistle, not another project.
- **GitHub CLI** (`gh`) for opening PRs.

To test the wizard without calling the real backend or spending AI credits, use test mode: see [docs/manual-testing.md](docs/manual-testing.md), including the rules for testing on the shared backend.
