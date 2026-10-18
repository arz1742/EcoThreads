import { createClient } from "@supabase/supabase-js";

// Same database as the store. The anon key is public; Row Level Security keeps this viewer read-only.
const FALLBACK_URL = "https://psehpfabxnhcwvqceoqr.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZWhwZmFieG5oY3d2cWNlb3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjM4MjUsImV4cCI6MjEwNzg5OTgyNX0.IiliqylwTpXSdI3xO-7Rt2TYKPjN7-UW-1L0t_OCIuE";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
export const STORE_URL = import.meta.env.VITE_STORE_URL || "";
export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY);

export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg))
    return "Can't reach the database. Check your internet connection, or the Supabase project may be paused.";
  if (/Could not find the (table|function)|does not exist/i.test(msg))
    return "Database tables are missing. Run database/schema.sql in the Supabase SQL Editor.";
  return msg;
}

export const formatNumber = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(Number(n) || 0));
export function timeAgo(d: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
