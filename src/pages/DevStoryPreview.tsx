// Dev-only preview for the full-book engine output.
// Not linked from anywhere. No auth — closed prototype, no PII.
//
// Renders BOTH:
//   - V2 (page-by-page) books — the current shape; one card per page with the
//     paired image prompt and a layout-aware text/image placement preview.
//   - V1 (legacy spread-based) books — for any rows generated before V2.
//
// Provides Copy JSON / Copy image prompt per page, plus full book.json and
// pages.csv downloads for manual book layout work.
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getLayout, PageLayout } from "@/lib/pageLayouts";
import { Copy, Check, Download } from "lucide-react";

// ---- V2 types --------------------------------------------------------------
interface BookPageV2 {
  page_number: number;
  role: "title" | "dedication" | "story";
  beat?: string | null;
  text: string;
  image_scene?: string | null;
  characters_present?: string[];
  setting?: string | null;
  mood?: string | null;
  continuity_notes?: string | null;
  layout_id: string;
  image_prompt: string | null;
}
interface BookOutputV2 {
  schema_version?: "v2";
  meta: {
    title: string;
    framework_id: string;
    word_count_total: number;
    page_count: number;
    age_band: string;
    art_style: string | null;
    repeating_phrase: string | null;
  };
  cover: { title: string; subtitle: string | null; image_prompt: string };
  pages: BookPageV2[];
}

// ---- V1 (legacy) -----------------------------------------------------------
interface SpreadV1 { spread_number: number; beat_label: string; prose?: string; text?: string }
interface ParsedV1 {
  cover_text?: string;
  outfit?: string;
  outfit_description?: string;
  dedication_text?: string;
  repeating_phrase?: string;
  belongs_to_text?: string | null;
  belongs_to_page_text?: string | null;
  spreads?: SpreadV1[];
}

interface BookRow {
  id: string;
  created_at: string;
  framework_id: string;
  brief: any;
  raw_output: string | null;
  parsed: any | null;
  model: string;
  generation_ms: number | null;
  status: string;
  drive_folder_url?: string | null;
  drive_doc_url?: string | null;
  drive_export_status?: string | null;
  drive_export_error?: string | null;
}

function isV2(p: any): p is BookOutputV2 {
  return !!(p && Array.isArray(p.pages) && p.meta && p.cover);
}

// ---- Copy button -----------------------------------------------------------
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-[hsl(var(--wizard-primary))]"
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

// ---- Layout-aware page preview --------------------------------------------
// Tiny schematic — uses textPlacement + illustrationCoverage so new layouts
// that fit those enums get a preview "for free".
function LayoutPreview({ layout }: { layout: PageLayout | undefined }) {
  if (!layout) {
    return <div className="w-16 h-20 rounded border border-dashed border-muted-foreground/40 grid place-items-center text-[10px] text-muted-foreground">?</div>;
  }
  const tp = layout.textPlacement;
  const cov = layout.illustrationCoverage;
  const imgClass = "bg-[hsl(var(--wizard-primary)/0.18)]";
  const txtClass = "bg-[hsl(var(--wizard-primary)/0.45)]";

  // Build a small SVG-ish div schematic 64x80
  let content: JSX.Element;
  if (cov === "none") {
    content = <div className={`absolute inset-1 rounded ${txtClass}`} />;
  } else if (cov === "full") {
    content = (
      <>
        <div className={`absolute inset-1 rounded ${imgClass}`} />
        {tp === "overlay-center" && <div className={`absolute inset-x-3 top-1/2 -translate-y-1/2 h-2 rounded ${txtClass}`} />}
      </>
    );
  } else if (cov === "spot") {
    content = (
      <>
        <div className={`absolute top-1.5 left-1.5 right-1.5 h-2 rounded ${txtClass}`} />
        <div className={`absolute left-1/2 bottom-2 -translate-x-1/2 w-4 h-4 rounded-full ${imgClass}`} />
      </>
    );
  } else if (cov === "three-quarter") {
    const isTop = tp === "top";
    content = (
      <>
        <div className={`absolute inset-x-1 ${isTop ? "bottom-1 top-1/4" : "top-1 bottom-1/4"} rounded ${imgClass}`} />
        <div className={`absolute inset-x-1 ${isTop ? "top-1 h-3" : "bottom-1 h-3"} rounded ${txtClass}`} />
      </>
    );
  } else if (cov === "half") {
    const isLeft = tp === "left";
    content = (
      <>
        <div className={`absolute top-1 bottom-1 ${isLeft ? "right-1 left-1/2" : "left-1 right-1/2"} rounded ${imgClass}`} />
        <div className={`absolute top-2 bottom-2 ${isLeft ? "left-1 right-1/2 mr-1" : "right-1 left-1/2 ml-1"} rounded ${txtClass}`} />
      </>
    );
  } else {
    content = <div className={`absolute inset-1 rounded ${imgClass}`} />;
  }

  return (
    <div className="relative w-16 h-20 rounded border border-muted-foreground/30 bg-white shrink-0">
      {content}
    </div>
  );
}

// ---- CSV/JSON download -----------------------------------------------------
function downloadBlob(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pagesToCsv(pages: BookPageV2[]): string {
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["page_number", "role", "beat", "layout_id", "text", "image_prompt", "characters_present", "setting", "mood", "continuity_notes"];
  const rows = pages.map((p) => [
    p.page_number, p.role, p.beat ?? "", p.layout_id, p.text,
    p.image_prompt ?? "", (p.characters_present || []).join("|"),
    p.setting ?? "", p.mood ?? "", p.continuity_notes ?? "",
  ].map(esc).join(","));
  return [header.join(","), ...rows].join("\n");
}

// ---- Main page -------------------------------------------------------------
export default function DevStoryPreview() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<BookRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!id || id === ":id") return;
    (async () => {
      const { data, error } = await supabase
        .from("generated_books")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) setError(error.message);
      else if (!data) setError("Book not found.");
      else setRow(data as BookRow);
    })();
  }, [id]);

  const regenerate = async () => {
    if (!row) return;
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-book", {
        body: { brief: row.brief },
      });
      if (error) throw error;
      if (data?.id) window.location.assign(`/dev/story-preview/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  };

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-destructive">Error: {error}</p>
        <Link to="/" className="underline">← Home</Link>
      </div>
    );
  }
  if (!row) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  const parsed = row.parsed;
  const v2 = isV2(parsed) ? (parsed as BookOutputV2) : null;
  const child = row.brief?.child || {};

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--wizard-bg))] py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-xs uppercase tracking-wider font-mono text-muted-foreground border border-dashed border-muted-foreground/40 rounded-full px-3 py-1 inline-block">
          ⚙ dev preview — full book engine {v2 ? "(v2)" : "(v1 legacy)"}
        </div>

        <header className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
          <h1 className="font-heading text-2xl font-semibold text-[hsl(var(--wizard-primary))]">
            {v2 ? v2.meta.title : (parsed?.cover_text || "Untitled")}
          </h1>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div><dt className="font-semibold">Child</dt><dd>{child.name} ({child.ageRange})</dd></div>
            <div><dt className="font-semibold">Framework</dt><dd>{row.framework_id}</dd></div>
            <div><dt className="font-semibold">Model</dt><dd className="truncate">{row.model}</dd></div>
            <div><dt className="font-semibold">Time</dt><dd>{row.generation_ms ? `${(row.generation_ms / 1000).toFixed(1)}s` : "—"}</dd></div>
            {v2 && (
              <>
                <div><dt className="font-semibold">Pages</dt><dd>{v2.meta.page_count}</dd></div>
                <div><dt className="font-semibold">Words</dt><dd>{v2.meta.word_count_total}</dd></div>
                <div><dt className="font-semibold">Age band</dt><dd>{v2.meta.age_band}</dd></div>
                <div><dt className="font-semibold">Art style</dt><dd>{v2.meta.art_style || "—"}</dd></div>
              </>
            )}
          </dl>
          <p className="text-xs text-muted-foreground">Status: <span className="font-mono">{row.status}</span> · Created {new Date(row.created_at).toLocaleString()}</p>

          {v2 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => downloadBlob(`book-${row.id.slice(0, 8)}.json`, "application/json", JSON.stringify(parsed, null, 2))}
                className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[hsl(var(--wizard-primary))] border border-[hsl(var(--wizard-primary)/0.4)] rounded-full px-3 py-1.5 hover:bg-[hsl(var(--wizard-primary)/0.05)]"
              >
                <Download className="w-3.5 h-3.5" /> book.json
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(`pages-${row.id.slice(0, 8)}.csv`, "text/csv", pagesToCsv(v2.pages))}
                className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[hsl(var(--wizard-primary))] border border-[hsl(var(--wizard-primary)/0.4)] rounded-full px-3 py-1.5 hover:bg-[hsl(var(--wizard-primary)/0.05)]"
              >
                <Download className="w-3.5 h-3.5" /> pages.csv
              </button>
              <CopyButton text={JSON.stringify(parsed, null, 2)} label="Copy full JSON" />
            </div>
          )}

          {(row.drive_doc_url || row.drive_folder_url || row.drive_export_error) && (
            <div className="pt-3 border-t border-dashed border-muted-foreground/30 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Google Drive export — {row.drive_export_status || "unknown"}
              </div>
              {(row.drive_doc_url || row.drive_folder_url) && (
                <div className="flex flex-wrap gap-2">
                  {row.drive_doc_url && (
                    <a
                      href={row.drive_doc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[hsl(var(--wizard-primary))] border border-[hsl(var(--wizard-primary)/0.4)] rounded-full px-3 py-1.5 hover:bg-[hsl(var(--wizard-primary)/0.05)]"
                    >
                      Open Google Doc ↗
                    </a>
                  )}
                  {row.drive_folder_url && (
                    <a
                      href={row.drive_folder_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[hsl(var(--wizard-primary))] border border-[hsl(var(--wizard-primary)/0.4)] rounded-full px-3 py-1.5 hover:bg-[hsl(var(--wizard-primary)/0.05)]"
                    >
                      Open Drive folder ↗
                    </a>
                  )}
                </div>
              )}
              {row.drive_export_error && (
                <p className="text-xs text-destructive font-mono whitespace-pre-wrap">
                  {row.drive_export_error}
                </p>
              )}
            </div>
          )}
        </header>

        {v2 ? <V2Body book={v2} /> : <V1Body parsed={parsed as ParsedV1} />}

        {/* Raw */}
        <section>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs font-mono uppercase tracking-wider text-muted-foreground underline"
          >
            {showRaw ? "Hide" : "View"} raw model output
          </button>
          {showRaw && (
            <pre className="mt-3 bg-black/90 text-green-200 text-xs p-4 rounded-xl overflow-auto max-h-[60vh]">
              {row.raw_output ?? "(empty)"}
            </pre>
          )}
        </section>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="px-6 py-3 rounded-full bg-[hsl(var(--wizard-primary))] text-white font-semibold disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : "Regenerate from same brief"}
          </button>
          <Link
            to="/"
            className="px-6 py-3 rounded-full border-2 border-[hsl(var(--wizard-primary))] text-[hsl(var(--wizard-primary))] font-semibold"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2 body — cover + 32 page cards
// ---------------------------------------------------------------------------
function V2Body({ book }: { book: BookOutputV2 }) {
  return (
    <>
      {/* Cover */}
      <section className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold text-[hsl(var(--wizard-primary))]">Cover</h2>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">2:3 portrait</span>
        </header>
        <p className="font-heading text-2xl font-semibold text-center text-[hsl(var(--wizard-primary))]">{book.cover.title}</p>
        {book.cover.subtitle && <p className="text-center italic text-muted-foreground">{book.cover.subtitle}</p>}
        <div className="border-t border-black/5 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover image prompt</p>
            <CopyButton text={book.cover.image_prompt} label="Copy" />
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-black/[0.03] p-3 rounded-lg">{book.cover.image_prompt}</pre>
        </div>
        {book.meta.repeating_phrase && (
          <div className="bg-[hsl(var(--wizard-primary)/0.08)] rounded-xl p-3 border border-[hsl(var(--wizard-primary)/0.2)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--wizard-primary))] mb-0.5">Repeating phrase</p>
            <p className="text-sm font-medium text-[hsl(var(--wizard-primary))]">"{book.meta.repeating_phrase}"</p>
          </div>
        )}
      </section>

      {/* Pages */}
      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold text-[hsl(var(--wizard-primary))]">
          Pages ({book.pages.length})
        </h2>
        {book.pages.map((p) => (
          <PageCard key={p.page_number} page={p} />
        ))}
      </section>
    </>
  );
}

function PageCard({ page }: { page: BookPageV2 }) {
  const layout = getLayout(page.layout_id);
  const words = page.text.trim().split(/\s+/).filter(Boolean).length;
  const pageJson = useMemo(() => JSON.stringify(page, null, 2), [page]);

  return (
    <article className="bg-white rounded-2xl p-5 shadow-sm">
      <header className="flex items-start gap-4 mb-3">
        <LayoutPreview layout={layout} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="font-heading font-semibold text-[hsl(var(--wizard-primary))]">
              Page {page.page_number}
              <span className="ml-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {page.role}{page.beat ? ` · ${page.beat}` : ""}
              </span>
            </h3>
            <span className="text-xs text-muted-foreground">{words} words · layout: <span className="font-mono">{page.layout_id}</span></span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{layout?.label || page.layout_id}</p>
        </div>
      </header>

      {page.text && (
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Text</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{page.text}</p>
        </div>
      )}

      {page.image_prompt && (
        <div className="border-t border-black/5 pt-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Image prompt</p>
            <CopyButton text={page.image_prompt} label="Copy prompt" />
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-black/[0.03] p-3 rounded-lg">{page.image_prompt}</pre>
        </div>
      )}

      {(page.characters_present?.length || page.setting || page.mood || page.continuity_notes) && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t border-black/5">
          {!!page.characters_present?.length && (
            <div className="col-span-2"><dt className="font-semibold">Characters</dt><dd>{page.characters_present.join(", ")}</dd></div>
          )}
          {page.setting && <div className="col-span-2"><dt className="font-semibold">Setting</dt><dd>{page.setting}</dd></div>}
          {page.mood && <div><dt className="font-semibold">Mood</dt><dd>{page.mood}</dd></div>}
          {page.continuity_notes && <div className="col-span-full"><dt className="font-semibold">Continuity</dt><dd className="italic">{page.continuity_notes}</dd></div>}
        </dl>
      )}

      <div className="flex justify-end mt-3">
        <CopyButton text={pageJson} label="Copy page JSON" />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// V1 legacy body — used for older rows
// ---------------------------------------------------------------------------
function V1Body({ parsed }: { parsed: ParsedV1 | null }) {
  const p = parsed || {};
  const spreads = p.spreads || [];
  const belongsTo = p.belongs_to_text ?? p.belongs_to_page_text;
  return (
    <>
      {(p.outfit || p.outfit_description) && (
        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Locked outfit</h2>
          <p className="text-sm">{p.outfit || p.outfit_description}</p>
        </section>
      )}
      {p.dedication_text && (
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dedication</h2>
          <p className="font-heading italic text-lg leading-relaxed">{p.dedication_text}</p>
        </section>
      )}
      {p.repeating_phrase && (
        <section className="bg-[hsl(var(--wizard-primary)/0.08)] rounded-2xl p-5 border-2 border-[hsl(var(--wizard-primary)/0.2)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--wizard-primary))] mb-1">Repeating phrase</h2>
          <p className="text-base font-medium text-[hsl(var(--wizard-primary))]">"{p.repeating_phrase}"</p>
        </section>
      )}
      {belongsTo && (
        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Belongs-to page</h2>
          <p className="text-sm italic">{belongsTo}</p>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-[hsl(var(--wizard-primary))]">
          Spreads ({spreads.length})
        </h2>
        {spreads.map((s) => (
          <article key={s.spread_number} className="bg-white rounded-2xl p-6 shadow-sm">
            <header className="flex items-baseline justify-between mb-3 gap-3">
              <h3 className="font-heading font-semibold text-[hsl(var(--wizard-primary))]">
                Spread {s.spread_number}
              </h3>
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {s.beat_label}
              </span>
            </header>
            <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{s.prose || s.text}</p>
          </article>
        ))}
      </section>
    </>
  );
}
