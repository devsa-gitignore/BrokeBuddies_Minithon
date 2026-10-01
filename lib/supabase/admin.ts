import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | undefined

/** Service-role client. Server-only: never import from client components. */
export function createAdminClient(): SupabaseClient {
  if (admin) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role is not configured')
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return admin
}
