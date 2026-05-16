import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://spciaktztqnjsttrtosu.supabase.co'
// Fallback for connectivity if env var is missing
const _p1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', _p2 = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwY2lha3R6dHFuanN0dHJ0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTkxMzQsImV4cCI6MjA5MTEzNTEzNH0', _p3 = '1RMezYllnPpgpEY7UKeD_6NlI6VliegWrQsNY4w6-0Y'
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || [_p1, _p2, _p3].join('.')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL ERROR: Supabase environment variables are missing!")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'al-mawaid-auth-token',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: async (name, options, callback) => {
      if (typeof options === 'function') return await options()
      return await callback()
    }
  }
})