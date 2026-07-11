import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pquusffhuholbnlmuyen.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzEzOTAsImV4cCI6MjA5OTM0NzM5MH0.lp8jDk4UalHg5dJHIxTinhqaCJ-OA1RVwcDjM3KxcTo'

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'al-mawaid-auth-token',
    persistSession: true,
    autoRefreshToken: true,
  }
})
