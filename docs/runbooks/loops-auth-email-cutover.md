# Loops auth-email cutover

Use this runbook only after the Phase 1 hardening is merged to `main` and deployed. The
Supabase project is `uglsyitjasajubfvbiry`.

## Cutover

1. Deploy the merged hardening: from the repository root, run
   `supabase functions deploy auth-email-hook`. Do not configure the hook before this
   succeeds; doing so while the old function awaits Loops risks failing signup and password
   reset inside Supabase's five-second hook budget. You should see a successful deployment.

2. In the Supabase dashboard, open `Project uglsyitjasajubfvbiry → Authentication → Hooks
   → Send Email hook`. Enter the following URI, click **Generate Secret**, and copy the
   generated `v1,whsec_…` value:

   ```text
   https://uglsyitjasajubfvbiry.supabase.co/functions/v1/auth-email-hook
   ```

   Do **not** click **Save** yet. You should see the URI and generated secret in the form.

3. In a second Supabase dashboard tab, open `Project uglsyitjasajubfvbiry → Functions →
   Secrets`. Add this secret, pasting the exact generated value, and save it:

   ```text
   SEND_EMAIL_HOOK_SECRET=<the v1,whsec_… value from step 2>
   ```

   Do **not** return to save the hook yet. You should see `SEND_EMAIL_HOOK_SECRET` listed
   without its plaintext value.

4. With the hook still disabled, run the signed pre-flight against the deployed function
   with a throwaway recipient:

   ```bash
   mise exec -- deno run --allow-net scripts/preflight-auth-email-hook.ts \
     https://uglsyitjasajubfvbiry.supabase.co/functions/v1/auth-email-hook \
     'v1,whsec_…' \
     throwaway@example.com
   ```

   Do **not** enable the hook if the result is not `Response status: 200`. A `401` means the
   secret has not propagated: wait, then repeat this step. On 200, confirm the real
   **Confirm your email** message arrives. Its link is expected to be dead because the
   pre-flight uses a fabricated `token_hash`; this checks secret propagation and Loops
   delivery, not account verification.

5. Return to `Project uglsyitjasajubfvbiry → Authentication → Hooks → Send Email hook` and
   click **Save** to enable the configured hook. Do not change the URI or secret at this
   point. You should see the hook listed as enabled and pointing at the deployed function.

6. Verify the live flow with a new throwaway account: complete signup and follow the
   confirmation link, then request a password reset and follow that link. Do not treat the
   pre-flight as verification because its link is intentionally invalid. Both real links
   must work before considering the cutover successful.

7. Delete the throwaway test users. Do not leave them in the production auth database; this
   also exercises the account-deletion email. Confirm the deletion email arrives.

## If Generate Secret enables the hook immediately

If **Generate Secret** activates the hook on click rather than only when **Save** is pressed,
use the fallback ordering: schedule a low-traffic hour, leave `Functions → Secrets` open in
a second tab, then perform cutover steps 2 and 3 back-to-back. Run the pre-flight after
setting the secret. The exposure is limited to the copy-paste window.

## Rollback

Disable the hook at `Project uglsyitjasajubfvbiry → Authentication → Hooks → Send Email
hook`. Nothing else needs undoing: confirm and reset immediately return to Supabase's
built-in SMTP. That SMTP is rate-limited and documented as unsuitable for production, so
rollback restores functionality, not equivalent delivery capacity.

> [!WARNING]
> Do **not** set `LOOPS_TRANSPORT=mock` during rollback. The mock transport returns success
> while discarding sends, silently disabling the nine already-live Loops emails (including
> receipts, refunds, and book-ready notices) with no error, bounce, or visible symptom. The
> hook toggle is the only rollback action.

## Secret rotation

Once this hook is authoritative, a signature mismatch produces a 401 that fails signup and
password reset themselves. Rotate `SEND_EMAIL_HOOK_SECRET` with Supabase's comma-separated
`secrets` form for a gapless transition; do not replace the active value naively. Rotation is
documented here, not implemented by this cutover.

## Operational edges

- Bad or missing HMAC returns 401 and fails the auth request.
- Slow or unavailable Loops may lose an email but must not block auth after Phase 1.
- Unmapped auth action types return 200 and send no email; password-change notifications are
  currently unmapped.
- A Loops free-plan cap rejection is logged but otherwise silent; monitor capacity after
  cutover.
