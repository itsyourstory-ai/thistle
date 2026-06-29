import { sendTransactional, LOOPS_TEMPLATES } from "./loops.ts";

// Type representing the minimal subset of a Supabase profile row we need.
export interface ProfileRow {
  welcomed_at: string | null;
  [key: string]: unknown;
}

// Type for the user object (just what we use).
export interface UserRecord {
  id: string;
  email: string;
}

// Minimal chainable Supabase db interface needed by maybeSendWelcome.
export interface DbClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<unknown>;
    };
  };
}

/**
 * Sends a welcome email if the user hasn't received one yet.
 * Returns true if an email was sent, false if skipped.
 *
 * Skips if:
 * - profile is null (defensive — trigger guarantees a profile exists)
 * - profile.welcomed_at is already set
 */
export async function maybeSendWelcome(
  db: DbClient,
  user: UserRecord,
  profile: ProfileRow | null,
): Promise<boolean> {
  if (!profile) return false;
  if (profile.welcomed_at !== null) return false;

  await sendTransactional(LOOPS_TEMPLATES.welcome, user.email, {});
  await db.from("profiles").update({ welcomed_at: new Date().toISOString() }).eq("id", user.id);
  return true;
}

/**
 * Sends an account deletion confirmation email.
 * Returns true if sent successfully, false on failure.
 */
export async function sendAccountDeletionEmail(email: string): Promise<boolean> {
  return sendTransactional(LOOPS_TEMPLATES.accountDeletion, email, {});
}
