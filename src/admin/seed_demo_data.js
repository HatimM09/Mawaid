import { supabase } from '../lib/firebaseClient'

async function seed() {
  console.log('Seeding demo data for QR and Surveys...')

  const demoUsers = [
    { name: 'Mustafa Bhai', email: 'mustafa@demo.com', thali_number: 'A101', phone: '9876543210', address: 'Bohra Colony, Lane 1' },
    { name: 'Hussain Bhai', email: 'hussain@demo.com', thali_number: 'B-202', phone: '9876543211', address: 'Saifee Nagar, Block A' },
    { name: 'Fatema Ben', email: 'fatema@demo.com', thali_number: 'C303', phone: '9876543212', address: 'Mawaid Street, Flat 4' }
  ]

  for (const u of demoUsers) {
    const { data: user, error: uErr } = await supabase.from('user_stats').upsert([u], { onConflict: 'email' }).select().single()
    if (uErr) {
      console.error('Error seeding user:', uErr.message)
      continue
    }

    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    let diff = now.getDate() - day + (day === 0 ? -6 : 1)
    if (day === 0 || (day === 6 && hour >= 20)) diff += 7
    const monday = new Date(now.setDate(diff))
    const weekId = monday.toISOString().split('T')[0]

    const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
    if (today === 'sun') continue

    const dayKey = today.substring(0, 3).toLowerCase()

    const submission = {
      user_id: user.id,
      week_id: weekId,
      [`${dayKey}_l_status`]: 'Applied',
      [`${dayKey}_l_dish_1`]: '100',
      [`${dayKey}_l_dish_2`]: '50',
      [`${dayKey}_l_dish_3`]: '25'
    }

    const { error: sErr } = await supabase.from('survey_submissions_flat').upsert([submission], { onConflict: 'user_id,week_id' })
    if (sErr) console.error('Error seeding survey:', sErr.message)
    else console.log(`Seeded ${u.name} (Thali #${u.thali_number})`)
  }

  console.log('Demo seeding complete!')
}

seed()
