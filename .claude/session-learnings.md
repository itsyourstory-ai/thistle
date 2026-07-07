# Session Learnings

## Catchup 2026-07-07 17:04

### Friction
- `npm run test:deno` fails out of the box with `deno: command not found` — deno
  lives at the mise install path `/Users/jordan/.local/share/mise/installs/deno/2.8.3/bin/deno`,
  not on PATH. Had to discover and prepend it. Worth a note in AGENTS.md or a
  wrapper so the documented command works as-is.
- The JS vitest suite is slow and flaky under load (runs ~110s, `environment` phase
  350s+, intermittent 8s test timeouts) especially when other builds run in parallel.
  Re-running a single file in isolation is the reliable way to distinguish a real
  failure from a load flake.

### Mistakes
- Ran `npm run build`, `npm test`, and `npm run test:deno` in parallel, which
  starved the machine and produced misleading vitest timeout failures. Should
  serialize heavy commands (or run them one at a time in background) to get clean
  signal.

### Observations
- The review-changes skill is Rails-flavored (`bin/rails test`, rubocop) but this
  is a Vite/React/TS + Deno project; adapted the gate to lint/vitest/deno/build.
- Good hardening pattern: when several call sites funnel through one private
  helper (`maybeSendBookEmail`), fix defensive concerns at that choke point once
  rather than wrapping every call site.
- `sendTransactional` in `_shared/loops.ts` swallows network/non-2xx failures but
  DOES throw on missing `LOOPS_API_KEY` in live mode (getApiKey is outside its
  try) — relevant whenever a Loops send runs inline in a user-facing request path.
