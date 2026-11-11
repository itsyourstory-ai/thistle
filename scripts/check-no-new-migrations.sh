#!/usr/bin/env bash
# Fails if the commit range BEFORE..AFTER adds a file under supabase/migrations/.
# The workflow passes the last successfully deployed commit as BEFORE.
# Used by .github/workflows/deploy-functions.yml (THI-61): migrations must be
# applied by a person before new edge functions go live, so the automatic
# deploy stops when a merge brings a new migration.
#
# Usage: scripts/check-no-new-migrations.sh <before-sha> <after-sha>
set -euo pipefail

before="${1:-}"
after="${2:-}"

if [[ -z "$before" || -z "$after" ]]; then
  echo "Usage: $0 <before-sha> <after-sha>" >&2
  exit 2
fi

# A missing or all-zero "before" means we can't tell what this push added.
# Fail safe rather than deploy blind.
if [[ "$before" =~ ^0+$ ]] || ! git cat-file -e "${before}^{commit}" 2>/dev/null; then
  echo "::error::Can't check this push for new migrations: commit '$before' isn't available."
  echo "Stopping without deploying. Apply any new migrations by hand (docs/deploy.md), then run this workflow from the Actions tab."
  exit 1
fi

# --no-renames so a file moved into supabase/migrations/ counts as added.
added="$(git diff --no-renames --name-only --diff-filter=A "$before" "$after" -- supabase/migrations/)"

if [[ -n "$added" ]]; then
  echo "::error::A database migration was added since the last deploy, so edge functions were NOT deployed."
  echo "Migrations go first and a person applies them. Migration files added since $before:"
  while IFS= read -r file; do echo "  - $file"; done <<< "$added"
  echo
  echo "Next steps:"
  echo "  1. Apply each migration by hand, oldest first (docs/deploy.md#deploying-supabase-changes)."
  echo "  2. Run this workflow again from the Actions tab (Deploy edge functions → Run workflow, branch main)."
  exit 1
fi

echo "No new migrations in $before..$after. OK to deploy."
