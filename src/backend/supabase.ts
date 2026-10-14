import type { SupabaseClient } from '@supabase/supabase-js'

// The publishable key is safe to ship in the browser: Row Level Security and the
// database functions decide what each visitor may do.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// Without keys the app still runs as a seat preview; booking is turned off.
export const hasBackend = Boolean(url && key)

// The Supabase library is loaded only when it is first needed, so it doesn't slow
// down the first paint of the theater.
let client: Promise<SupabaseClient> | null = null
export function getSupabase() {
  if (!hasBackend) return null
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, key!))
  return client
}
