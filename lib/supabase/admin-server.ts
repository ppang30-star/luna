import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase factory.
 *
 * CRITICAL: This reads environment variables at RUNTIME on the server. Unlike the
 * browser client (lib/supabase/client.ts), which depends on NEXT_PUBLIC_* vars that
 * are inlined into the JS bundle at BUILD time, these server-side vars are always
 * resolved fresh when the request runs. That makes data access host-agnostic and
 * immune to a build that happened before the env vars were configured (the exact
 * failure mode seen on Netlify, where NEXT_PUBLIC_* was missing/stale at build).
 *
 * The fallback chain mirrors app/api/menu/route.ts. The service-role key is
 * preferred on the server (bypasses RLS overhead, avoids anon statement timeouts)
 * and is NEVER exposed to the browser.
 */
export function createAdminServerClient(): SupabaseClient | null {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
}
