import fs from 'fs'
import path from 'path'

const CSV_PATH = path.resolve('d:/Al-Mawaid/public/Al-mawaid(Inventory) - Sheet1.csv')
const OUT_PATH = path.resolve('d:/Al-Mawaid/src/common/masterInventoryData.js')

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < 4) continue
    const category = parts[0].trim()
    const name = parts[1].trim()
    const minQty = parseFloat(parts[2].trim()) || 0
    let unit = parts[3].trim()
    if (unit.toLowerCase() === 'carton') unit = 'Carton'
    else if (unit.toLowerCase() === 'kg') unit = 'kg'
    else if (unit.toLowerCase() === 'pcs') unit = 'pcs'

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

const content = fs.readFileSync(CSV_PATH, 'utf-8')
const rows = parseCSV(content)

const items = rows.map((r, idx) => {
  const cat = mapCategory(r.category, r.name)
  return {
    id: idx + 1,
    name: r.name,
    category_id: cat.id,
    category_name: cat.name,
    subcategory: r.category,
    unit: r.unit,
    stock: 0,
    low_stock: r.minQty,
  }
})

const fileContent = `// Auto-generated from public/Al-mawaid(Inventory) - Sheet1.csv
// Total master items: ${items.length}

export const MASTER_INVENTORY_ITEMS = ${JSON.stringify(items, null, 2)};
`

fs.writeFileSync(OUT_PATH, fileContent, 'utf-8')
console.log(`Generated ${OUT_PATH} with ${items.length} items.`)
