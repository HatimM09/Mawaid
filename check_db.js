import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://spciaktztqnjsttrtosu.supabase.co'
const _p1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', _p2 = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwY2lha3R6dHFuanN0dHJ0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTkxMzQsImV4cCI6MjA5MTEzNTEzNH0', _p3 = '1RMezYllnPpgpEY7UKeD_6NlI6VliegWrQsNY4w6-0Y'
const supabaseAnonKey = [_p1, _p2, _p3].join('.')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data: users, error: err } = await supabase.from('user_stats').select('email, thali_number')
  console.log("USERS:", users, err)
  process.exit(0)
}

test()
