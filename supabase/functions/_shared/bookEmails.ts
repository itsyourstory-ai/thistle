import { LOOPS_TEMPLATES, sendTransactional } from "./loops.ts";
import { appBaseUrl, type DbClient } from "./orderEmails.ts";

export interface GeneratedBookRow {
  id: string;
  buyer_email: string | null;
  brief: any;
  creating_email_sent_at: string | null;
  ready_email_sent_at: string | null;
  failed_email_sent_at: string | null;
  [key: string]: unknown;
}

type BookStampColumn =
  | "creating_email_sent_at"
  | "ready_email_sent_at"
  | "failed_email_sent_at";

const ETA_TEXT = "about 5–10 minutes";
const SUPPORT_URL = "mailto:support@thistlebook.com";

function childName(book: GeneratedBookRow): string {
  return book.brief?.child?.name || "";
}

function previewUrl(): string {
  return `${appBaseUrl()}/dashboard`;
}

async function stampBook(
  db: DbClient,
  book: GeneratedBookRow,
  column: BookStampColumn,
): Promise<void> {
  await db.from("generated_books").update({
    [column]: new Date().toISOString(),
  }).eq(
    "id",
    book.id,
  );
}

async function maybeSendBookEmail(
  db: DbClient,
  book: GeneratedBookRow,
  stampColumn: BookStampColumn,
  templateId: string,
  dataVariables: Record<string, unknown>,
): Promise<boolean> {
  if (book[stampColumn] !== null) return false;
  if (!book.buyer_email) {
    console.warn(
      `[bookEmails] skipping ${stampColumn} for book ${book.id}: missing buyer_email`,
    );
    return false;
  }

  const sent = await sendTransactional(
    templateId,
    book.buyer_email,
    dataVariables,
  );
  if (!sent) return false;

  await stampBook(db, book, stampColumn);
  return true;
}

export async function maybeSendCreating(
  db: DbClient,
  book: GeneratedBookRow,
): Promise<boolean> {
  return maybeSendBookEmail(
    db,
    book,
    "creating_email_sent_at",
    LOOPS_TEMPLATES.bookCreating,
    { childName: childName(book), etaText: ETA_TEXT },
  );
}

export async function maybeSendReady(
  db: DbClient,
  book: GeneratedBookRow,
): Promise<boolean> {
  return maybeSendBookEmail(
    db,
    book,
    "ready_email_sent_at",
    LOOPS_TEMPLATES.bookReady,
    {
      childName: childName(book),
      previewUrl: previewUrl(),
      bookId: book.id,
    },
  );
}

export async function maybeSendFailed(
  db: DbClient,
  book: GeneratedBookRow,
): Promise<boolean> {
  return maybeSendBookEmail(
    db,
    book,
    "failed_email_sent_at",
    LOOPS_TEMPLATES.bookFailed,
    { childName: childName(book), supportUrl: SUPPORT_URL },
  );
}
