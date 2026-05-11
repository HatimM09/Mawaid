import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://spciaktztqnjsttrtosu.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function seed() {
  console.log('🌱 Seeding demo data for QR and Surveys...')

  const demoUsers = [
    { name: 'Mustafa Bhai', email: 'mustafa@demo.com', thali_number: 101, phone: '9876543210', address: 'Bohra Colony, Lane 1' },
    { name: 'Hussain Bhai', email: 'hussain@demo.com', thali_number: 102, phone: '9876543211', address: 'Saifee Nagar, Block A' },
    { name: 'Fatema Ben', email: 'fatema@demo.com', thali_number: 103, phone: '9876543212', address: 'Mawaid Street, Flat 4' }
  ]

  for (const u of demoUsers) {
    const { data: user, error: uErr } = await supabase.from('user_stats').upsert([u], { onConflict: 'email' }).select().single()
    if (uErr) {
      console.error('Error seeding user:', uErr.message)
      continue
    }

    // Add a survey response for current week
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    const weekId = monday.toISOString().split('T')[0]

    const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
    if (today === 'sun') continue // Skip sunday for surveys

    const dayKey = today.substring(0, 3).toLowerCase()
    
    const submission = {
      user_id: user.user_id,
      week_id: weekId,
      [`${dayKey}_l_status`]: 'Applied',
      [`${dayKey}_l_dish_1`]: '100',
      [`${dayKey}_l_dish_2`]: '50',
      [`${dayKey}_l_dish_3`]: '25'
    }

    const { error: sErr } = await supabase.from('survey_submissions_flat').upsert([submission], { onConflict: 'user_id,week_id' })
    if (sErr) console.error('Error seeding survey:', sErr.message)
    else console.log(`✓ Seeded ${u.name} (Thali #${u.thali_number})`)
  }

  console.log('✨ Demo seeding complete!')
}

seed()
