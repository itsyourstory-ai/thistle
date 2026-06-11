# Fix: Replace Lovable Google Drive Connector

## Problem

`export-book-to-drive` and `export-book-images-to-drive` both use a Lovable-proprietary
service (`connector-gateway.lovable.dev`) to write the generated book manuscript and page
images into Google Drive / Google Docs. That service is auto-injected by Lovable and is
not accessible outside of a Lovable-hosted project — we have no API key for it and cannot
replicate it.

Now that Thistle runs on its own Supabase project (not Lovable-managed), both export
functions will fail silently. Book *generation* is unaffected (Drive export is fire-and-
forget), but the Drive output that the Thistle workflow depends on (manuscript doc +
images folder) will not be produced.

## Affected files

- `supabase/functions/export-book-to-drive/index.ts` — calls
  `connector-gateway.lovable.dev/google_drive` and `/google_docs`
- `supabase/functions/export-book-images-to-drive/index.ts` — same connector gateway
- `supabase/functions/_shared/driveUpload.ts` — shared Drive upload helper; also calls
  the connector gateway

## What needs to be done

Replace the Lovable connector gateway calls with direct Google Drive API calls using a
service account or OAuth 2.0 credentials stored as Supabase secrets.

### Recommended approach: Google service account

1. **Google Cloud Console**
   - Create (or reuse) a GCP project.
   - Enable the **Google Drive API** and **Google Docs API**.
   - Create a **Service Account**; download its JSON key.
   - Share the target Drive folder with the service account email (`...@...iam.gserviceaccount.com`).

2. **Supabase secrets** (project `uglsyitjasajubfvbiry`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the full JSON key from step 1 (or break into
     `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` if the JSON is too large for one secret).

3. **Edge function changes**
   - In `_shared/driveUpload.ts`: replace the `connector-gateway.lovable.dev` fetch with
     calls to `https://www.googleapis.com/upload/drive/v3/files` (multipart upload) and
     `https://docs.googleapis.com/v1/documents` using a short-lived access token obtained
     via JWT + Google token endpoint (`https://oauth2.googleapis.com/token`).
   - In `export-book-to-drive/index.ts` and `export-book-images-to-drive/index.ts`:
     swap any remaining connector-gateway references to the same direct Drive API helpers.

4. **No frontend changes needed** — the client only polls `generated_books.pipeline_status`
   and reads Drive URLs from `generated_books.drive_folder_url` / `drive_doc_url`.

### Alternative: disable Drive export for now

If Drive output is not needed for the MVP, simply remove the
`export-book-to-drive` and `export-book-images-to-drive` invocations from
`generate-book/index.ts` and `generate-book-images/index.ts`. The generated story and
images are already stored in Supabase (`generated_books.parsed` + `book_images`), so the
book preview still works without Drive.
