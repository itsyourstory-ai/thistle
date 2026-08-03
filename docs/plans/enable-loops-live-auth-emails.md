> Ticket: THI-9
> Branch: feature/thi-9-cut-over

# Plan: Cut over auth emails to Loops (live)

## Status

| Task | Phase | Checkpoint | Description | Assign | Done |
| ---- | ----- | ---------- | ----------- | ------ | ---- |
| 1 | 1 | 1 | Harden `authEmailHook.ts` (waitUntil + catch) + `config.toml` `secrets` key | Master | ✅ |
| 2 | 1 | 1 | Cutover runbook doc + signed pre-flight script | Clone | ✅ |
| 3 | 2 | 2 | Deploy function, set secret, run signed pre-flight, enable hook | Master | |
| 4 | 2 | 2 | End-to-end verification (signup, reset, delete) + record open-question answers | Master | |
| 5 | 3 | 3 | Audit Part A — DB stamp-gap counts | Master | |
| 6 | 3 | 3 | Audit Parts B + C (Loops delivery, free-plan caps) + findings doc & backfill decision | Master | |

## Prerequisites

- Design: [`docs/designs/enable-loops-live-auth-emails.md`](../designs/enable-loops-live-auth-emails.md)
- Prototype: None (backend/ops change, no UI).
- Feature branch `feature/thi-9-cut-over` exists and is checked out.
- Supabase CLI authenticated against project `uglsyitjasajubfvbiry`.
- Loops CLI available; **`--team thistle` is required** on every invocation (the CLI
  defaults to the `cove-production` profile, which is a different account).
- Deno is on PATH via mise (`~/.local/share/mise/installs/deno/2.8.3`) but **not** on the
  bare shell PATH. Run it via `npm run test:deno` or `mise exec -- deno …`.

**Verification note that affects every task:** ESLint ignores `supabase/functions`
(`eslint.config.js:8`) and `tsconfig.app.json` includes only `src`. **`npm run lint` and
`npm run build` do not check edge-function code.** The only real check on Task 1 is
`npm run test:deno`.

---

## Human-in-the-loop protocol

Parts of this plan cannot be done by an agent. Enabling a Supabase auth hook and setting a
function secret are dashboard-only actions, and the Loops analytics review is a dashboard
read. Those steps belong to Jordan.

**The rule for every such step: the AI leads, Jordan clicks.** The AI must never say
"now go enable the hook" and wait. For each human action it must, in one message:

1. **State the goal** of the step in one sentence, and what breaks if it's done out of order.
2. **Give the exact click path** — e.g. `Supabase dashboard → Project uglsyitjasajubfvbiry
   → Authentication → Hooks → Send Email hook`. Name the button, not the concept.
3. **Give the exact value** to type or paste, in a copy-paste block.
4. **Say explicitly what NOT to do yet** — most of this cutover's safety comes from
   ordering, and the highest-risk moment is clicking Save one step early.
5. **State what Jordan should see** when it worked, and **what to paste back** to the AI.
6. **Stop and wait.** One human step per message. Do not batch two dashboard actions into
   one instruction, and do not proceed on an assumption that a step was done.

After Jordan reports back, the AI verifies independently where it can (CLI, function logs,
the pre-flight script) rather than taking "done" at face value — a mistyped secret looks
identical to a correct one from the outside.

**If any step fails or looks wrong, the AI's first instruction is the rollback**
(`Authentication → Hooks → Send Email hook → disable`), *then* debugging. Signup is on the
line; there is no fallback to built-in SMTP while the hook is enabled.

Tasks 3, 4, and 6 contain their human steps written out in this format. Follow them as
written rather than improvising a shorter version.

---

## Phase 1 — Ship the hardening (merged + deployed before any cutover)

### Task 1 [Master]: Harden the hook against Loops latency + fix the config key

**Skills:** write-tests
**Reference:** Read `supabase/functions/_shared/authEmailHook.ts` (lines 57–63 are what
changes) and `supabase/functions/_shared/authEmailHook.test.ts` for the env save/restore
test pattern.

**In scope:**

- `supabase/functions/_shared/authEmailHook.ts`: replace the awaited `sendTransactional`
  at line 58 with the background-task form from the design's "Screens / Flows §1" —
  the `.then` non-send log, the `.catch`, the `EdgeRuntime.waitUntil` / `else await`
  branch, and the `AIDEV-NOTE` comment verbatim.
- Add a module-level `declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };`
  so the `typeof` guard typechecks.
- `supabase/functions/_shared/authEmailHook.test.ts`: one new test — a throwing
  `sendTransactional` must still yield 200.
- `supabase/config.toml:39`: `secret = "env(SEND_EMAIL_HOOK_SECRET)"` →
  `secrets = "env(SEND_EMAIL_HOOK_SECRET)"`.

**NOT in scope:**

- Any change to `loops.ts`, its error handling, or `LOOPS_TEMPLATES`.
- Retry / queue / dead-letter handling for failed sends.
- Mapping `password_changed_notification` or `email_change` (explicitly deferred).
- Changing `enabled` or `uri` in `config.toml` — the hosted dashboard is authoritative and
  Task 3 owns it.

**Build order:**

1. **Test (first):** In `authEmailHook.test.ts`, add
   `Deno.test("sendTransactional throws → 200, no send")`. Use the same save/restore
   harness as the existing tests, plus: save and `Deno.env.set("LOOPS_TRANSPORT", "live")`
   and `Deno.env.delete("LOOPS_API_KEY")` — this makes `getApiKey()` throw at
   `loops.ts:46` **before** any `fetch`, so the test stays offline and deterministic.
   Assert `res.status === 200` and `mockSentEmails.length === 0`. Restore both env vars in
   `finally`. Confirm it fails against current code (the throw escapes the handler today).
2. **Implement:** Edit `authEmailHook.ts` and `config.toml` as above.
3. **Verify:** `npm run test:deno` — all six tests in `authEmailHook.test.ts` green. The
   five existing ones must pass **unchanged**: they await the handler, and the `else`
   branch awaits the send, so `mockSentEmails` is populated by assertion time. Then
   `npm run lint && npm test && npm run build` for the repo-wide gate, understanding they
   don't cover this file.
4. `git diff` and confirm exactly three files changed.

---

### Task 2 [Clone]: Cutover runbook + signed pre-flight script

**Reference:** Read `docs/designs/enable-loops-live-auth-emails.md` §3 (runbook),
§"Rollback", and §"Edge cases" — the runbook doc distills those, it does not rewrite them.
Read `scripts/vercel-setup.sh` for the existing scripts-dir convention.

**In scope:**

- New `docs/runbooks/loops-auth-email-cutover.md` containing:
  - The 7-step cutover ordering from design §3, written so a human can follow it while
    clicking — exact dashboard paths and button names, one action per numbered step,
    per the Human-in-the-loop protocol above. Include the "Generate Secret may activate
    the hook immediately" fallback ordering.
  - **Rollback:** disable the Send Email hook in the dashboard; nothing else to undo.
    Include the caveat that Supabase's built-in SMTP is rate-limited and documented as
    not for production — rollback restores function, not parity.
  - **A prominent "Do NOT set `LOOPS_TRANSPORT=mock`" warning.** THI-9's own text
    recommends it as an extra rollback step and that advice is now actively harmful:
    `loops.ts:80-83` returns `true` and silently discards, which would kill the nine
    working emails with no error, no bounce, and no visible symptom.
  - **Secret rotation is an auth-outage risk:** once the hook is authoritative, a
    signature mismatch is a 401 that fails signup and reset themselves. Use the
    comma-separated `secrets` form for gapless rotation. Documented, not built.
- New `scripts/preflight-auth-email-hook.ts` — a Deno script that POSTs a
  Standard-Webhooks-signed `signup` payload to a given function URL. Args: target URL,
  secret (`v1,whsec_…`, stripped the same way `authEmailHook.ts:16-18` strips it), and
  recipient email. Use `npm:standardwebhooks@1`'s `Webhook#sign`, matching the header
  construction in `authEmailHook.test.ts:25-36`. Print response status and body. Add a
  header comment stating the link in the resulting email will be dead (fabricated
  `token_hash`) — the script tests delivery, not verification.
- One-line pointer to the runbook added to `docs/deploy.md`.

**NOT in scope:**

- Running the script against production, or any dashboard action (Task 3).
- Hardcoding any secret — both are required CLI args, never defaults, never committed.
- Editing `AGENTS.md` or the Loops template table.

**Build order:**

1. **Test:** No runner for ops scripts here. Verify-by-inspection: the script must produce
   a signature the existing `Webhook#verify` path accepts — cross-check header names and
   timestamp format against `authEmailHook.test.ts:29-35` line by line.
2. **Implement:** Write the two new files and the `docs/deploy.md` pointer.
3. **Verify:** `mise exec -- deno check scripts/preflight-auth-email-hook.ts`. Run the
   script against a bogus localhost URL to confirm it fails on connection, not on a
   TypeScript or signing error. Do **not** point it at production.
4. **Checkpoint 1 review:** this is the last task of checkpoint 1 (Tasks 1–2). Run
   review-changes-mini covering both tasks. If Tasks 1–2 were dispatched as a parallel
   batch, the master runs this once after the whole batch returns rather than the task
   running it itself — either way, exactly once per checkpoint.

**After checkpoint 1 — human step.** The AI opens the PR and tells Jordan:
> "Phase 1 is ready: `<PR URL>`. Review and merge when you're happy. Phase 2 can't start
> until this is on `main` and deployed — enabling the hook while the function still awaits
> Loops inside the 5-second budget is exactly the outage this ticket exists to prevent.
> Tell me once it's merged."

Then stop. Do not begin Phase 2 on an unmerged branch.

---

## Phase 2 — Execute the cutover

Phase 2 contains **no code changes**. Every dashboard action is Jordan's; the AI runs CLI
commands and the pre-flight script, verifies results, and guides each step using the
Human-in-the-loop protocol.

### Task 3 [Master]: Deploy, set the secret, pre-flight, enable

**Reference:** `docs/runbooks/loops-auth-email-cutover.md` (from Task 2) is the operative
document — this task is its first execution.

**In scope:**

- `supabase functions deploy auth-email-hook` from merged `main`.
- Jordan: set the hook URI and generate the signing secret (do not save).
- Jordan: set `SEND_EMAIL_HOOK_SECRET` in Functions → Secrets.
- AI: confirm propagation and run the signed pre-flight **while the hook is still disabled**.
- Jordan: save/enable the hook, only after a green pre-flight.

**NOT in scope:**

- Clicking the link in the pre-flight email — its `token_hash` is fabricated and dead.
  Expected, not a failure.
- End-to-end signup/reset verification (Task 4).
- Any change to `LOOPS_TRANSPORT`. It is already `live` and must stay `live`.

**Build order:**

1. **AI, first:** confirm you are on merged `main` (`git log --oneline -1`), then run
   `supabase functions deploy auth-email-hook`. Report the deploy output before continuing.

2. **Human step — set the URI and generate the secret.** Send Jordan, in one message:

   > **Goal:** put the hook's address and signing secret in the form *without turning the
   > hook on*. The whole zero-downtime ordering depends on the secret existing in Functions
   > → Secrets before the hook goes live.
   >
   > **Where:** Supabase dashboard → project `uglsyitjasajubfvbiry` → **Authentication** →
   > **Hooks** → **Send Email hook**.
   >
   > **Do:** set the URI to
   > ```
   > https://uglsyitjasajubfvbiry.supabase.co/functions/v1/auth-email-hook
   > ```
   > then click **Generate Secret** and copy the `v1,whsec_…` value.
   >
   > **Do NOT click Save or enable the hook yet.** Saving now, before the next step,
   > opens a window where signup and password reset both fail outright.
   >
   > **You should see:** a `v1,whsec_…` string in the secret field.
   > **Paste back:** just confirm you have it — don't paste the secret into this chat.
   >
   > **Watch for:** if clicking Generate Secret appears to enable the hook on its own,
   > stop and tell me — we switch to the fallback ordering.

   Then wait.

3. **Human step — set the function secret.** After Jordan confirms:

   > **Goal:** make the deployed function able to verify the signatures Supabase will send.
   >
   > **Where:** same dashboard → **Functions** → **Secrets**.
   >
   > **Do:** add or update `SEND_EMAIL_HOOK_SECRET` with the full `v1,whsec_…` value you
   > just copied, prefix included — the function strips the `v1,` itself
   > (`authEmailHook.ts:16-18`).
   >
   > **Do NOT** go back to the Hooks page yet.
   >
   > **Paste back:** "done" once it's saved.

   Then wait.

4. **AI verification — the real test.** Run
   `supabase secrets list --project-ref uglsyitjasajubfvbiry` and confirm the name appears
   (values are SHA-256 digests, not plaintext). Then ask Jordan for a throwaway recipient
   address and run `scripts/preflight-auth-email-hook.ts` against the deployed URL, with
   the hook still disabled.
   - **200 + email arrives** → the secret propagated *and* the Loops leg works, at zero
     blast radius. Proceed.
   - **401** → the secret has not propagated. Wait and retry. **Do not proceed** — a 401
     after enabling is a hard signup outage.
   - Remind Jordan the link in that email is dead by design.

5. **Human step — enable.** Only after a green pre-flight:

   > **Goal:** make the hook authoritative. From this point, confirm and reset emails come
   > from Loops, and a hook failure fails the auth request itself.
   >
   > **Where:** **Authentication** → **Hooks** → **Send Email hook**.
   >
   > **Do:** enable it and **Save**.
   >
   > **You should see:** the hook listed as enabled, pointing at the function URL.
   > **Paste back:** "enabled" — I'll verify end to end immediately in Task 4.
   >
   > **Rollback if anything looks wrong:** come straight back here and disable it.
   > Confirm and reset revert to built-in SMTP instantly.

6. **Fallback ordering.** If Generate Secret turns out to activate the hook on click
   rather than on save, exposure is a copy-paste window. Guide Jordan to do steps 2–3 back
   to back at a low-traffic hour with Functions → Secrets already open in a second tab, and
   run the pre-flight *after* enabling instead of before. Record which case actually
   occurred — it answers an Open Question.

---

### Task 4 [Master]: End-to-end verification and cleanup

**In scope:**

- Sign up a throwaway account end to end; confirm the Loops "Confirm your email" arrives
  and the link **verifies the account**.
- Request a password reset for that account; confirm the Loops template arrives and the
  link works.
- Delete the test user — which also exercises the `accountDeletion` email; confirm it arrives.
- Check `auth-email-hook` function logs for any `sendTransactional failed` / `threw` lines.
- Record answers to the design's Open Questions: (a) did Generate Secret activate on click
  or on save; (b) Supabase's current built-in SMTP rate limit — look it up now, since it
  determines how good the rollback actually is. Append both to the runbook doc.

**NOT in scope:**

- The audit (Phase 3).
- Backfilling anything.
- Testing `password_changed_notification`. The flow is unmapped and deferred — if it shows
  up in logs as an unmapped action, note it, don't fix it.

**Build order:**

1. **Human step — the three flows.** The AI walks Jordan through them one at a time, not
   as a list to go do. For each: state what to do, what should arrive, and what to report.
   1. Sign up at the app with a throwaway address → expect the Loops **Confirm your email**
      template → click the link → expect the account to verify.
   2. Request a password reset for that address → expect the Loops **Password reset**
      template → click the link → expect to be able to set a new password.
   3. Delete that test user → expect the **Account deleted** email.

   After each one, the AI asks which template actually arrived (Loops templates are visually
   distinct from Supabase's default) and checks the function logs before moving on.

2. **If any flow fails:** the AI's first instruction is the rollback — disable the hook in
   Authentication → Hooks — *then* debug from the logs. Do not troubleshoot a live signup
   outage with the hook still enabled.

3. **Implement:** append the two Open Question answers to
   `docs/runbooks/loops-auth-email-cutover.md`.

4. **Verify:** report pass/fail per flow with what actually arrived, and quote any log
   lines found. These three flows are the ticket's acceptance criteria — all must pass.

5. **Checkpoint 2 review:** last task of checkpoint 2 (Tasks 3–4). Run review-changes-mini
   once both are done. Expect a near-empty diff (a runbook append only), so the substance
   of this report is the flow-by-flow outcome, not the code.

---

## Phase 3 — Audit the nine emails live since June

Context: `LOOPS_TRANSPORT` has been `live` since 2026-06-26, so nine of eleven emails have
been sending for real and unverified. Welcome + Account deleted since 2026-06-26; the four
order emails since 2026-06-29; the three book emails since 2026-07-01.

### Task 5 [Master]: Part A — DB stamp-gap counts

**Reference:** `orderEmails.ts:117-131` and `bookEmails.ts:51-76` — each stamp is written
**only after** `sendTransactional` returns true, so a missing stamp on an eligible row is a
customer email that silently didn't happen.

**In scope:**

- Establish DB read access first — design Open Question 3, not yet resolved. Try in order:
  `supabase db` via the linked CLI, then the dashboard SQL editor. **`SELECT` only.**
  If it comes to the SQL editor, that's a human step: give Jordan the exact query to paste
  and ask for the result table back.
- Count the following, splitting `buyer_email IS NULL` out separately in every order and
  book query — the code warns and skips those (`orderEmails.ts:118-122`,
  `bookEmails.ts:51-56`), which distinguishes "couldn't send" from "tried and failed":
  - `orders`, window from **2026-06-29**: `status='paid'` ∧ `receipt_email_sent_at IS NULL`;
    `status='refunded'` ∧ `refund_email_sent_at IS NULL`; `status='failed'` ∧
    `payment_failed_email_sent_at IS NULL`.
  - `generated_books`, window from **2026-07-01**: `pipeline_status='done'` ∧
    `ready_email_sent_at IS NULL`; `pipeline_status='failed'` ∧
    `failed_email_sent_at IS NULL`; `creating_email_sent_at IS NULL`.
    (Confirmed `pipeline_status` values: `story`, `portraits`, `done`, `failed`.)
  - Welcome, window from **2026-06-26**: `profiles.welcomed_at IS NULL`, **restricted to
    users who actually signed in**. `profiles` rows are created at signup by the
    `on_auth_user_created` trigger, but `welcome` is sent by `sync-contact` on first
    sign-in — a never-signed-in user legitimately has no stamp. Join
    `auth.users.last_sign_in_at IS NOT NULL`; a raw `profiles` count overstates the gap.
- Save queries and results to `.context/thi-9-audit-part-a.md` (gitignored scratch).

**NOT in scope:**

- Any `UPDATE`, backfill send, or stamp write.
- Parts B and C.
- Adding monitoring or alerting for future silent failures.

**Build order:**

1. **Test:** before trusting a zero, sanity-check each query with the `IS NULL` clause
   removed and confirm a plausible total row count. A 0-gap result on a 0-row table proves
   nothing.
2. **Implement:** run the queries, record counts.
3. **Verify:** confirm `generated_books` actually has a `created_at` column before relying
   on the date windows; if it doesn't, say so and use an unbounded window.

---

### Task 6 [Master]: Parts B + C and the findings doc

**In scope:**

- **Part C first — highest priority.** `sync-contact` calls `upsertContact` on every
  sign-in, so contacts accumulate with signups. Check current Loops contact count against
  the **1,000** cap and month-to-date sends against **4,000/month**
  (`loops --team thistle …`, or the dashboard). If either was ever crossed, Loops rejected
  sends — and every rejection path here is silent (`loops.ts:66-71` logs and returns false;
  `maybeSend*` returns false without stamping). A crossed cap reframes all of Part A.
- **Part B.** Loops dashboard → transactional analytics for the `mail.thistlebook.com`
  group: delivery and bounce rate per template over the window. This is a **human step** —
  the AI gives Jordan the exact view to open and the exact numbers to read back (per
  template: sent, delivered, bounced). Stamps prove Loops *accepted* a payload, not that it
  *delivered*.
- New `docs/runbooks/loops-auth-email-audit-2026-08.md`: per-gap counts from Task 5, cap
  headroom, delivery and bounce rates, and **an explicit backfill decision**. Default
  recommendation to put to Jordan: **do not backfill** — a five-week-late receipt likely
  confuses more than it helps. The decision is Jordan's; record whatever he decides,
  including "no".

**NOT in scope:**

- Executing any backfill — deferred by the design regardless of the decision.
- Upgrading the Loops plan — deferred; the trigger to upgrade is silent send rejection,
  not a bill.
- Building alerting for future silent cap rejections. If Part C shows thin headroom,
  **note it and ask** — don't build it.

**Build order:**

1. **Test:** none applicable (read-only analysis).
2. **Implement:** gather Part C, then Part B, then write the findings doc.
3. **Verify:** every number in the doc traces to a named query or a named dashboard view.
   Present the backfill recommendation to Jordan and **wait for his call** before marking
   the task done — this task is not complete on the AI's recommendation alone.
4. **Checkpoint 3 review:** last task of checkpoint 3 (Tasks 5–6). Run review-changes-mini
   over the docs added in this phase. Phase 3's output is a docs-only PR, separate from
   Phase 1's.

---

## Task Dependencies

- **Task 1 ∥ Task 2** — can run in parallel. They touch disjoint files; Task 2's runbook
  describes the behaviour Task 1 creates but doesn't read its code.
- **Tasks 1–2 → Task 3** — hard blocker, and it crosses a merge. Phase 1 must be **merged
  to `main` and deployed** before the hook is enabled.
- **Task 3 → Task 4** — strictly sequential. The hook must be enabled before end-to-end
  flows mean anything.
- **Task 4 → Task 5** — soft. Phase 3 is independent analysis of already-live emails and
  could run in parallel with Phase 2, but doing so splits attention during the only step
  with outage risk. Run it after.
- **Task 5 → Task 6** — Part C's cap answer determines how Task 5's counts are interpreted.
  If a cap was crossed, revisit Task 5's conclusions rather than its queries.

## Notes

**`config.toml:37` already says `enabled = true`** while the hosted hook is off, so the
file has been misdescribing production in two ways, not one. Task 1 fixes only the
`secret` → `secrets` key, per the design's scope. After Task 3 the `enabled = true` becomes
accurate, so leaving it is correct — but it wasn't accurate before.

**Phase 2 has no agent-only path.** Enabling a Supabase auth hook has no CLI equivalent.
Expect to be driven through Tasks 3 and 4 step by step, one action per message.
