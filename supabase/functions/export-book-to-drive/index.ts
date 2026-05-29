// export-book-to-drive
//
// Reads a generated_books row, ensures the Drive folder tree
//   ThistleBook / Unprocessed Books / [YYYY-MM-DD]_[Buyer]_[BookTitle]
// exists in the developer's Drive (via Lovable Google Drive connector),
// creates a formatted Google Doc with the full manuscript (page by page,
// including layout id + image prompt as metadata under each page), moves
// the doc into the dated folder, and stamps the resulting IDs/URLs back
// onto the book row.
//
// Best-effort: invoked by generate-book; never blocks the user-facing flow.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GD = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const GDOC = "https://connector-gateway.lovable.dev/google_docs/v1";
const FOLDER_MIME = "application/vnd.google-apps.folder";

const BUYER_LABEL: Record<string, string> = {
  mom: "Mom",
  dad: "Dad",
  parent: "Parent",
  grandma: "Grandma",
  grandpa: "Grandpa",
  grandparent: "Grandparent",
  aunt: "Aunt",
  uncle: "Uncle",
  godparent: "Godparent",
  sibling: "Sibling",
  friend: "Friend",
  teacher: "Teacher",
  myself: "Myself",
  other: "Loved One",
};

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function sanitize(s: string, max = 80): string {
  return (s || "")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || "Untitled";
}

function escQ(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function todayUTC(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- Gateway clients --------------------------------------------------------

async function gfetch(
  url: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<any> {
  const LOVABLE_API_KEY = getEnv("LOVABLE_API_KEY");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": apiKey,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const resp = await fetch(url, { ...init, headers });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`${init.method || "GET"} ${url} → ${resp.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

const driveKey = () => getEnv("GOOGLE_DRIVE_API_KEY");
const docsKey = () => getEnv("GOOGLE_DOCS_API_KEY");

const gdrive = (path: string, init?: RequestInit) =>
  gfetch(`${GD}${path}`, driveKey(), init);
const gdocs = (path: string, init?: RequestInit) =>
  gfetch(`${GDOC}${path}`, docsKey(), init);

// ---- Drive folder ops -------------------------------------------------------

async function findFolder(
  name: string,
  parentId: string | "root",
): Promise<string | null> {
  const q =
    `mimeType='${FOLDER_MIME}' and name='${escQ(name)}' ` +
    `and '${parentId}' in parents and trashed=false`;
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await gdrive(url);
  return r.files?.[0]?.id ?? null;
}

async function createFolder(
  name: string,
  parentId: string,
): Promise<{ id: string; webViewLink: string }> {
  return await gdrive(`/files?fields=id,webViewLink&supportsAllDrives=true`, {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    }),
  });
}

async function ensureSubfolder(
  name: string,
  parentId: string,
): Promise<{ id: string; webViewLink: string }> {
  const existing = await findFolder(name, parentId);
  if (existing) {
    // Need webViewLink too
    const meta = await gdrive(
      `/files/${existing}?fields=id,webViewLink&supportsAllDrives=true`,
    );
    return { id: meta.id, webViewLink: meta.webViewLink };
  }
  return await createFolder(name, parentId);
}

async function uniqueDatedFolder(
  baseName: string,
  parentId: string,
): Promise<{ id: string; webViewLink: string; name: string }> {
  let name = baseName;
  for (let i = 1; i < 20; i++) {
    const existing = await findFolder(name, parentId);
    if (!existing) {
      const created = await createFolder(name, parentId);
      return { ...created, name };
    }
    name = `${baseName}-${i + 1}`;
  }
  throw new Error(`Could not find a unique folder name for ${baseName}`);
}

async function moveFile(fileId: string, toFolderId: string): Promise<void> {
  await gdrive(
    `/files/${fileId}?addParents=${toFolderId}&removeParents=root&fields=id,parents&supportsAllDrives=true`,
    { method: "PATCH", body: JSON.stringify({}) },
  );
}

// ---- Doc body construction --------------------------------------------------

type Para = {
  text: string; // should end with \n
  style?: "TITLE" | "SUBTITLE" | "HEADING_1" | "HEADING_2" | "NORMAL_TEXT";
  italic?: boolean;
};

function buildParagraphs(book: any, brief: any): Para[] {
  const paras: Para[] = [];
  const meta = book.meta || {};
  const child = brief?.child || {};

  paras.push({ text: `${meta.title || "Untitled"}\n`, style: "TITLE" });
  paras.push({
    text: `For ${child.name || "—"} · Generated ${meta.generated_at?.slice(0, 10) || todayUTC()}\n`,
    style: "SUBTITLE",
    italic: true,
  });
  paras.push({
    text:
      `Framework: ${meta.framework_id || "—"}  ·  Age band: ${meta.age_band || "—"}  ·  ` +
      `Words: ${meta.word_count_total ?? "—"}  ·  Pages: ${meta.page_count ?? "—"}\n`,
    style: "NORMAL_TEXT",
  });
  paras.push({ text: "────────────────────────────────────────\n", style: "NORMAL_TEXT" });

  // Cover summary
  paras.push({ text: `Cover\n`, style: "HEADING_2" });
  paras.push({ text: `Title on cover: ${book.cover?.title || meta.title || ""}\n` });
  if (book.cover?.subtitle) {
    paras.push({ text: `Subtitle: ${book.cover.subtitle}\n` });
  }
  if (book.cover?.image_prompt) {
    paras.push({ text: `Cover image prompt:\n${book.cover.image_prompt}\n` });
  }
  paras.push({ text: "\n" });

  const pages = Array.isArray(book.pages) ? book.pages : [];
  for (const p of pages) {
    const label =
      p.role === "title"
        ? "Title page"
        : p.role === "dedication"
          ? "Dedication"
          : `Story${p.beat ? ` · ${p.beat}` : ""}`;
    paras.push({
      text: `Page ${p.page_number} — ${label}\n`,
      style: "HEADING_2",
    });
    paras.push({ text: `Layout: ${p.layout_id || "—"}\n` });
    paras.push({ text: "\n" });
    paras.push({ text: `${p.text || "(no text)"}\n` });
    paras.push({ text: "\n" });
    paras.push({
      text: `Image prompt:\n${p.image_prompt || "(none — title page reuses cover art)"}\n`,
    });
    if (p.continuity_notes) {
      paras.push({ text: `Continuity: ${p.continuity_notes}\n` });
    }
    paras.push({ text: "\n" });
  }

  return paras;
}

function buildBatchRequests(paras: Para[]): any[] {
  const reqs: any[] = [];
  let idx = 1; // Docs body starts at 1

  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    const start = idx;
    const len = p.text.length;
    if (len === 0) continue;

    reqs.push({
      insertText: { location: { index: start }, text: p.text },
    });
    const end = start + len;

    if (p.style && p.style !== "NORMAL_TEXT") {
      reqs.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: p.style },
          fields: "namedStyleType",
        },
      });
    } else if (p.style === "NORMAL_TEXT") {
      reqs.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
          fields: "namedStyleType",
        },
      });
    }

    if (p.italic) {
      // Style covers the text minus trailing newline
      const tEnd = p.text.endsWith("\n") ? end - 1 : end;
      if (tEnd > start) {
        reqs.push({
          updateTextStyle: {
            range: { startIndex: start, endIndex: tEnd },
            textStyle: { italic: true },
            fields: "italic",
          },
        });
      }
    }

    idx = end;
  }

  return reqs;
}

// ---- Main export ------------------------------------------------------------

async function exportBook(bookId: string, supabase: any) {
  const { data: row, error } = await supabase
    .from("generated_books")
    .select("*")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw new Error(`DB read failed: ${error.message}`);
  if (!row) throw new Error(`Book ${bookId} not found`);

  const parsed = row.parsed;
  if (!parsed || !parsed.meta) {
    throw new Error("Book has no parsed payload to export.");
  }
  const brief = row.brief || {};

  // 1. Resolve folder tree
  const thistleId = await findFolder("ThistleBook", "root");
  if (!thistleId) {
    throw new Error(
      "Couldn't find a top-level 'ThistleBook' folder in the connected Drive. Create it (or share it with the connected account) and re-run.",
    );
  }
  const unprocessed = await ensureSubfolder("Unprocessed Books", thistleId);

  const date = todayUTC();
  // Prefer the real buyer name (collected at checkout); fall back to the
  // wizard's relationship label for dev runs before payment is wired up.
  const buyerName = (brief.buyer_name || brief.buyer?.name || "").toString().trim();
  const buyerKey = (brief.buyer_relationship || "other").toString().toLowerCase();
  const buyer = sanitize(
    buyerName || BUYER_LABEL[buyerKey] || buyerKey,
    40,
  );
  const title = sanitize(parsed.meta.title || "Untitled", 80);
  const folderName = `${date}_${buyer}_${title}`;

  const folder = await uniqueDatedFolder(folderName, unprocessed.id);

  // 2. Create the Doc
  const created = await gdocs(`/documents`, {
    method: "POST",
    body: JSON.stringify({ title: `${date} · ${title}` }),
  });
  const docId: string = created.documentId;
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

  // 3. Populate it
  const paras = buildParagraphs(parsed, brief);
  const requests = buildBatchRequests(paras);
  // Send in a single batchUpdate.
  await gdocs(`/documents/${docId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });

  // 4. Move into the dated folder
  await moveFile(docId, folder.id);

  // 5. Stamp back onto the row
  await supabase
    .from("generated_books")
    .update({
      drive_folder_id: folder.id,
      drive_folder_url: folder.webViewLink,
      drive_doc_id: docId,
      drive_doc_url: docUrl,
      drive_export_status: "ok",
      drive_export_error: null,
    })
    .eq("id", bookId);

  return {
    folder_id: folder.id,
    folder_url: folder.webViewLink,
    folder_name: folder.name,
    doc_id: docId,
    doc_url: docUrl,
  };
}

// ---- Handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let bookId: string | null = null;
  let supabase: any = null;
  try {
    const body = await req.json();
    bookId = body.book_id || body.bookId;
    if (!bookId) throw new Error("Missing book_id");

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseSrv =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_ANON_KEY");
    supabase = createClient(supabaseUrl, supabaseSrv);

    const result = await exportBook(bookId, supabase);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("export-book-to-drive error:", msg);
    if (bookId && supabase) {
      try {
        await supabase
          .from("generated_books")
          .update({
            drive_export_status: "failed",
            drive_export_error: msg.slice(0, 1000),
          })
          .eq("id", bookId);
      } catch (_) { /* ignore */ }
    }
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
