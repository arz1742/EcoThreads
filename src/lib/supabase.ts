import { createClient } from "@supabase/supabase-js";

// The anon key is a public key (safe in the browser). Row Level Security in
// the database decides what each visitor can read or change.
const FALLBACK_URL = "https://psehpfabxnhcwvqceoqr.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZWhwZmFieG5oY3d2cWNlb3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjM4MjUsImV4cCI6MjEwNzg5OTgyNX0.IiliqylwTpXSdI3xO-7Rt2TYKPjN7-UW-1L0t_OCIuE";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Turns database / network errors into short, human sentences. */
export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg))
    return "Can't reach the server. Check your internet connection, or the database may be paused.";
  if (/Invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
  if (/Email not confirmed/i.test(msg)) return "Please confirm your email first — check your inbox.";
  if (/User already registered/i.test(msg)) return "An account with this email already exists. Try signing in.";
  if (/duplicate key/i.test(msg)) return "This is already saved.";
  if (/row-level security/i.test(msg)) return "You don't have permission to do that. Please sign in.";
  if (/price_matches_type/i.test(msg)) return "Items for sale need a price above ₹0. Donations must be free.";
  if (/relation .* does not exist|Could not find the (table|function)/i.test(msg))
    return "Database tables are missing. Run database/schema.sql in Supabase (see SETUP.md).";
  return msg;
}
