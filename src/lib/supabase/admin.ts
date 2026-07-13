import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for the Auth Admin API (creating users on invite).
 * Server-only — SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix so it's
 * never bundled to the browser, but never import this from client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
