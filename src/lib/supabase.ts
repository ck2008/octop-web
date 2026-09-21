import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types/database'

/**
 * The only two environment variables the browser bundle is allowed to carry.
 * Both are publishable; the actual access boundary is Row Level Security.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined

/** Names of the variables that are missing, so the UI can name them exactly. */
export const missingEnvVars: string[] = [
  ...(url?.trim() ? [] : ['VITE_SUPABASE_URL']),
  ...(publishableKey?.trim() ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY']),
]

export const isSupabaseConfigured = missingEnvVars.length === 0

/**
 * When configuration is missing we still hand out a client rather than
 * throwing at module load - a throw here would blank the page before any
 * component could explain what went wrong. `App` checks `isSupabaseConfigured`
 * and renders the setup screen instead of ever calling this stub.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  url?.trim() || 'http://localhost:54321',
  publishableKey?.trim() || 'missing-publishable-key',
  {
    auth: {
      // Session storage, refresh and the auth state listener are all handled
      // by the SDK. Nothing in this app reads or writes the token itself.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
