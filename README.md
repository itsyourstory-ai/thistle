# Thistle

Vite + React SPA. Backend: Supabase (database, auth, edge functions). Hosting: Vercel.

---

## Working on a feature

**1. Start from a fresh main**
```bash
git checkout main
git pull
```

**2. Create a branch**
```bash
git checkout -b feature/your-description
# or: fix/your-description
```

**3. Work, then push and open a PR**
```bash
git add .
git commit -m "feature: describe what you did"
git push origin feature/your-description
gh pr create
```

**4. Wait for CI** — lint, tests, and build run automatically. Merge is blocked until they pass.

**5. Merge the PR on GitHub**, then delete the branch (GitHub offers this immediately after merge).

**6. Clean up locally**
```bash
git checkout main
git pull
git branch -d feature/your-description
```

---

## Shipping to production

Merging to `main` auto-deploys to **staging**. When you're ready to go live:

1. Open [Vercel dashboard](https://vercel.com/dashboard) → Thistle → Deployments
2. Find the latest `main` deployment
3. Click `⋯` → **Promote to Production**

---

## Local setup

```bash
cp .env.example .env   # fill in your Supabase values
nvm use                # switches to Node 22
npm install
npm run dev
```

Env vars needed (get from Supabase dashboard):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
