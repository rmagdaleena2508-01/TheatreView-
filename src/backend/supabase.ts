import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship in the browser: Row Level Security and the
// database functions decide what each visitor may do.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// Without keys the app still runs as a seat preview; booking is turned off.
export const supabase = url && key ? createClient(url, key) : null
