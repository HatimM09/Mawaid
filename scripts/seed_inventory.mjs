import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pquusffhuholbnlmuyen.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzc3MTM5MCwiZXhwIjoyMDk5MzQ3MzkwfQ.4842n8_V5_m-e6t8bBv8U3r3l6I8k4E8-p-n_6g7cI' // Or anon key if service key not in env

const supabase = createClient(SUPABASE_URL, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzEzOTAsImV4cCI6MjA5OTM0NzM5MH0.lp8jDk4UalHg5dJHIxTinhqaCJ-OA1RVwcDjM3KxcTo')

const CSV_PATH = path.resolve('d:/Al-Mawaid/public/Al-mawaid(Inventory) - Sheet1.csv')

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < 4) continue
    const category = parts[0].trim()
    const name = parts[1].trim()
    const minQty = parseFloat(parts[2].trim()) || 0
    let unit = parts[3].trim().toLowerCase()
    if (unit === 'carton') unit = 'Carton'
    else if (unit === 'kg') unit = 'kg'
    else if (unit === 'pcs') unit = 'pcs'
    else unit = parts[3].trim()

    rows.push({ category, name, minQty, unit })
  }
  return rows
}

function mapCategory(cat, name) {
  const c = cat.toLowerCase().trim()
  const n = name.toLowerCase()

  if (c.includes('pulse')) return { id: 1, name: 'Pulses & Lentils' }
  if (c.includes('grain')) return { id: 2, name: 'Grains & Rice' }
  if (c.includes('spice')) return { id: 3, name: 'Spices & Condiments' }
  if (c.includes('syrup') || c.includes('juice')) return { id: 12, name: 'Syrup & Juices' }
  if (c.includes('sauce') || c.includes('dressing')) return { id: 13, name: 'Sauces & Dressings' }
  if (c.includes('crockery')) return { id: 14, name: 'Crockery' }
  if (c.includes('vegetable')) return { id: 6, name: 'Vegetables & Fruits' }
  if (c.includes('fruit')) return { id: 6, name: 'Vegetables & Fruits' }

  // Groceries sub-classification
  if (n.includes('oil') || n.includes('ghee')) return { id: 4, name: 'Oils, Ghee & Fats' }
  if (n.includes('milk') || n.includes('dahi') || n.includes('cheese') || n.includes('butter') || n.includes('paneer') || n.includes('egg')) return { id: 7, name: 'Dairy & Eggs' }
  if (n.includes('kaju') || n.includes('badam') || n.includes('pista') || n.includes('akhrot') || n.includes('anjeer') || n.includes('kishmish') || n.includes('zardalu')) return { id: 8, name: 'Dry Fruits & Nuts' }
  if (n.includes('foil') || n.includes('butter paper') || n.includes('safra') || n.includes('cup') || n.includes('tissues') || n.includes('gloves')) return { id: 10, name: 'Packaging & Disposable' }
  if (n.includes('kucha') || n.includes('sponge')) return { id: 9, name: 'Cleaning & Hygiene' }

  return { id: 11, name: 'Miscellaneous & Groceries' }
}

async function run() {
  const content = fs.readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCSV(content)
  console.log(`Parsed ${rows.length} rows from CSV`)

  const products = rows.map(r => {
    const cat = mapCategory(r.category, r.name)
    return {
      name: r.name,
      category_id: cat.id,
      subcategory: r.category,
      unit: r.unit,
      stock: 0,
      low_stock: r.minQty,
    }
  })

  console.log('Inserting into Supabase inventory table in chunks...')
  let inserted = 0
  for (let i = 0; i < products.length; i += 50) {
    const chunk = products.slice(i, i + 50)
    const { data, error } = await supabase.from('inventory').insert(chunk).select('id')
    if (error) {
      console.error(`Chunk ${i / 50} error:`, error.message)
    } else {
      inserted += (data?.length || chunk.length)
      console.log(`Inserted chunk ${i / 50 + 1}: ${chunk.length} items`)
    }
  }

  console.log(`Finished! Total inserted: ${inserted}`)
}

run().catch(console.error)
