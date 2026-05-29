// export-book-images-to-drive
//
// Final cleanup pass that uploads any book_images rows that don't yet have
// a drive_file_id. With progressive uploads in generate-book-images, this
// is usually a no-op — but it remains the safety net for anything that
// progressive upload skipped (subfolder wasn't ready, retries exhausted).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  ensureBookImagesSubfolder,
  uploadAndStampImage,
  type BookImageRow,
} from "../_shared/driveUpload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

async function exportImages(bookId: string, supabase: any) {
  const subfolder = await ensureBookImagesSubfolder(supabase, bookId);

  // Fetch ids only first — image_data_url is huge base64 and a bulk SELECT
  // including it routinely hits the statement timeout.
  const { data: idRows, error: idErr } = await supabase
    .from("book_images")
    .select("id")
    .eq("book_id", bookId)
    .eq("status", "ok")
    .is("drive_file_id", null)
    .order("kind", { ascending: true })
    .order("slot", { ascending: true });
  if (idErr) throw new Error(`book_images id read failed: ${idErr.message}`);

  let uploaded = 0;
  for (const { id } of (idRows || []) as { id: string }[]) {
    const { data: img, error: rowErr } = await supabase
      .from("book_images")
      .select("id,book_id,kind,slot,image_data_url,drive_file_id")
      .eq("id", id)
      .maybeSingle();
    if (rowErr || !img) continue;
    if (img.drive_file_id) continue;
    if (!img.image_data_url) continue;
    const ok = await uploadAndStampImage(supabase, img as BookImageRow, subfolder.id);
    if (ok) uploaded += 1;
  }

  return {
    folder_id: subfolder.id,
    folder_url: subfolder.webViewLink,
    uploaded_count: uploaded,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let bookId: string | null = null;
  try {
    const body = await req.json();
    bookId = body.book_id || body.bookId;
    if (!bookId) throw new Error("Missing book_id");

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseSrv =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl, supabaseSrv);

    const result = await exportImages(bookId, supabase);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("export-book-images-to-drive error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
