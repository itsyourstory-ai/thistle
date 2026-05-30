#!/usr/bin/env bash
# vercel-setup.sh — one-time Vercel project setup for thistle
# Run from the repo root: bash scripts/vercel-setup.sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "=== Thistle Vercel Setup ==="
echo ""

# ── 1. Load token ──────────────────────────────────────────────────────────────
if [ ! -f ".vercel.token" ]; then
  echo "❌  .vercel.token not found. Create it with:"
  echo "    echo 'your-token' > .vercel.token"
  exit 1
fi
VERCEL_TOKEN=$(cat .vercel.token | tr -d '[:space:]')
echo "✓ Token loaded"

# ── 2. Load env vars ───────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "❌  .env not found. Copy .env.example and fill in values."
  exit 1
fi
set -o allexport
source .env
set +o allexport
echo "✓ .env loaded"

# Validate required vars
for VAR in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PROJECT_ID; do
  if [ -z "${!VAR}" ]; then
    echo "❌  $VAR is not set in .env"
    exit 1
  fi
done
echo "✓ Supabase vars present"

# ── 3. Check gh CLI ────────────────────────────────────────────────────────────
if ! command -v gh &> /dev/null; then
  echo "❌  gh CLI not found. Install it: brew install gh"
  exit 1
fi

# ── 4. Create Vercel project via API ──────────────────────────────────────────
echo ""
echo "→ Creating Vercel project 'thistle' linked to GitHub..."

# Get the team/scope (lists teams, use first one or personal)
TEAMS_RESPONSE=$(curl -s "https://api.vercel.com/v2/teams" \
  -H "Authorization: Bearer $VERCEL_TOKEN")
TEAM_ID=$(echo "$TEAMS_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
teams = d.get('teams', [])
if teams:
    print(teams[0]['id'])
" 2>/dev/null)

if [ -n "$TEAM_ID" ]; then
  echo "  Using team: $TEAM_ID"
  TEAM_PARAM="?teamId=$TEAM_ID"
  TEAM_HEADER=""
else
  echo "  Using personal account"
  TEAM_PARAM=""
  TEAM_HEADER=""
fi

CREATE_RESPONSE=$(curl -s -X POST "https://api.vercel.com/v10/projects${TEAM_PARAM}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"thistle\",
    \"framework\": \"vite\",
    \"buildCommand\": \"npm run build\",
    \"installCommand\": \"npm ci\",
    \"outputDirectory\": \"dist\",
    \"gitRepository\": {
      \"type\": \"github\",
      \"repo\": \"itsyourstory-ai/thistle\"
    },
    \"publicSource\": false
  }")

PROJECT_ID=$(echo "$CREATE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'id' in d:
    print(d['id'])
else:
    import sys
    print('ERROR:', json.dumps(d), file=sys.stderr)
" 2>&1)

if [[ "$PROJECT_ID" == ERROR* ]]; then
  # Project may already exist — try to fetch it
  echo "  Project may already exist, fetching..."
  GET_RESPONSE=$(curl -s "https://api.vercel.com/v10/projects/thistle${TEAM_PARAM}" \
    -H "Authorization: Bearer $VERCEL_TOKEN")
  PROJECT_ID=$(echo "$GET_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('id',''))
")
fi

if [ -z "$PROJECT_ID" ]; then
  echo "❌  Could not create or find Vercel project. Response:"
  echo "$CREATE_RESPONSE"
  exit 1
fi
echo "✓ Project ID: $PROJECT_ID"

# ── 5. Set environment variables ──────────────────────────────────────────────
echo ""
echo "→ Setting environment variables..."

add_env_var() {
  local KEY=$1
  local VALUE=$2
  local TARGETS=$3  # JSON array string e.g. '["production","preview"]'

  curl -s -X POST "https://api.vercel.com/v10/projects/${PROJECT_ID}/env${TEAM_PARAM}" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"key\": \"${KEY}\",
      \"value\": \"${VALUE}\",
      \"type\": \"plain\",
      \"target\": ${TARGETS}
    }" > /dev/null
  echo "  ✓ $KEY (${TARGETS})"
}

# Same Supabase project for both production and staging (option 3)
add_env_var "VITE_SUPABASE_URL" "$VITE_SUPABASE_URL" '["production","preview","development"]'
add_env_var "VITE_SUPABASE_PUBLISHABLE_KEY" "$VITE_SUPABASE_PUBLISHABLE_KEY" '["production","preview","development"]'
add_env_var "VITE_SUPABASE_PROJECT_ID" "$VITE_SUPABASE_PROJECT_ID" '["production","preview","development"]'

echo "✓ Environment variables set"

# ── 6. Set production branch ───────────────────────────────────────────────────
echo ""
echo "→ Configuring production branch (main)..."
curl -s -X PATCH "https://api.vercel.com/v10/projects/${PROJECT_ID}${TEAM_PARAM}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productionBranch": "main"}' > /dev/null
echo "✓ Production branch: main"

# ── 7. Create and push staging branch ─────────────────────────────────────────
echo ""
echo "→ Creating staging branch..."
if git show-ref --verify --quiet refs/heads/staging; then
  echo "  staging branch already exists locally"
else
  git checkout -b staging
  git checkout main
  echo "  ✓ staging branch created"
fi

if git ls-remote --exit-code --heads origin staging > /dev/null 2>&1; then
  echo "  staging branch already on remote"
else
  git push origin staging
  echo "  ✓ staging branch pushed to GitHub"
fi

# ── 8. Branch protection ───────────────────────────────────────────────────────
echo ""
echo "→ Setting branch protection on main and staging..."

set_branch_protection() {
  local BRANCH=$1
  gh api repos/itsyourstory-ai/thistle/branches/${BRANCH}/protection \
    --method PUT \
    --field required_status_checks='{"strict":true,"contexts":["Lint & Test"]}' \
    --field enforce_admins=false \
    --field required_pull_request_reviews=null \
    --field restrictions=null \
    2>&1 | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'url' in d:
        print('  ✓ Protection set on ${BRANCH}')
    else:
        print('  ⚠  ${BRANCH}:', d.get('message', 'unknown response'))
except:
    pass
"
}

set_branch_protection main
set_branch_protection staging

# ── 9. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
echo "✅  Vercel setup complete!"
echo ""
echo "Project:    https://vercel.com/dashboard"
echo "Repo:       https://github.com/itsyourstory-ai/thistle"
echo ""
echo "Deploy flow:"
echo "  feature/* PR  → preview deploy + CI required"
echo "  push staging  → staging deploy"
echo "  push main     → production deploy"
echo ""
echo "Next: delete .vercel.token when you're done"
echo "  rm .vercel.token"
echo "========================================="
