## Ticket

<!-- Linear ticket, e.g. THI-35. The id should also be in the branch name. -->

## What changed and why

<!-- A few lines a teammate can read without opening the diff. -->

## How it was tested

- [ ] `npm run lint && npm test`
- [ ] `npm run build`
- [ ] `mise exec -- npm run test:deno` (if `supabase/functions/` changed)
- [ ] Tried it in the app (say where: local, PR preview, staging)

<!-- If this changes a request between the app and an edge function, did you add a test that checks the request body? (See AGENTS.md → "Testing caveat".) -->

## Supabase deploy

- [ ] No changes in `supabase/`
- [ ] Has changes in `supabase/functions/` only. They deploy automatically on merge; I'll check the **Deploy edge functions** run passed
- [ ] Has a new migration or new secrets. I'll apply/set them right after merge, then run **Deploy edge functions** by hand, and comment here with what was deployed ([steps](https://github.com/itsyourstory-ai/thistle/blob/main/docs/deploy.md#deploying-supabase-changes))

<!-- List new migrations and any new secrets. -->

## Human steps

<!-- Anything a person must do in a dashboard or account (Stripe, Loops, Supabase, Lulu…), or "None". -->

## Screenshots

<!-- For UI changes. -->
