
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://spciaktztqnjsttrtosu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwY2lha3R6dHFuanN0dHJ0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTkxMzQsImV4cCI6MjA5MTEzNTEzNH0.1RMezYllnPpgpEY7UKeD_6NlI6VliegWrQsNY4w6-0Y'

const supabase = createClient(supabaseUrl, supabaseKey)

const inventoryItems = [
  // Pulses & Lentils (1)
  { name: 'Moong Dal', category_id: 1, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Chana Dal', category_id: 1, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Toor Dal', category_id: 1, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Masoor Dal', category_id: 1, stock: 30, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Urad Dal', category_id: 1, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Kabuli Chana', category_id: 1, stock: 40, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Kala Chana', category_id: 1, stock: 30, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Rajma', category_id: 1, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Soya Chunks', category_id: 1, stock: 10, unit: 'kg', low_stock_threshold: 2 },

  // Grains & Rice (2)
  { name: 'Kolam Rice', category_id: 2, stock: 200, unit: 'kg', low_stock_threshold: 40 },
  { name: 'Basmati Rice', category_id: 2, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Wheat Flour (Atta)', category_id: 2, stock: 500, unit: 'kg', low_stock_threshold: 100 },
  { name: 'Maida', category_id: 2, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Besan', category_id: 2, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Sooji (Rava)', category_id: 2, stock: 30, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Daliya', category_id: 2, stock: 10, unit: 'kg', low_stock_threshold: 2 },

  // Spices & Condiments (3)
  { name: 'Salt', category_id: 3, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Turmeric Powder', category_id: 3, stock: 10, unit: 'kg', low_stock_threshold: 2 },
  { name: 'Red Chili Powder', category_id: 3, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Coriander Powder', category_id: 3, stock: 15, unit: 'kg', low_stock_threshold: 3 },
  { name: 'Cumin Seeds (Jeera)', category_id: 3, stock: 10, unit: 'kg', low_stock_threshold: 2 },
  { name: 'Mustard Seeds (Rai)', category_id: 3, stock: 5, unit: 'kg', low_stock_threshold: 1 },
  { name: 'Garam Masala', category_id: 3, stock: 5, unit: 'kg', low_stock_threshold: 1 },
  { name: 'Black Pepper', category_id: 3, stock: 2, unit: 'kg', low_stock_threshold: 0.5 },
  { name: 'Cloves (Laung)', category_id: 3, stock: 1, unit: 'kg', low_stock_threshold: 0.2 },
  { name: 'Cardamom (Elaichi)', category_id: 3, stock: 1, unit: 'kg', low_stock_threshold: 0.2 },
  { name: 'Kasuri Methi', category_id: 3, stock: 2, unit: 'kg', low_stock_threshold: 0.5 },

  // Oils, Ghee & Fats (4)
  { name: 'Sunflower Oil', category_id: 4, stock: 100, unit: 'L', low_stock_threshold: 20 },
  { name: 'Groundnut Oil', category_id: 4, stock: 50, unit: 'L', low_stock_threshold: 10 },
  { name: 'Ghee', category_id: 4, stock: 30, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Butter', category_id: 4, stock: 10, unit: 'kg', low_stock_threshold: 2 },

  // Meat & Poultry (5)
  { name: 'Chicken', category_id: 5, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Mutton', category_id: 5, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Eggs', category_id: 5, stock: 1000, unit: 'pcs', low_stock_threshold: 100 },

  // Vegetables & Fruits (6)
  { name: 'Potatoes', category_id: 6, stock: 200, unit: 'kg', low_stock_threshold: 40 },
  { name: 'Onions', category_id: 6, stock: 200, unit: 'kg', low_stock_threshold: 40 },
  { name: 'Tomatoes', category_id: 6, stock: 100, unit: 'kg', low_stock_threshold: 20 },
  { name: 'Garlic', category_id: 6, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Ginger', category_id: 6, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Green Chili', category_id: 6, stock: 10, unit: 'kg', low_stock_threshold: 2 },
  { name: 'Lemon', category_id: 6, stock: 5, unit: 'kg', low_stock_threshold: 1 },

  // Dairy & Eggs (7)
  { name: 'Milk', category_id: 7, stock: 100, unit: 'L', low_stock_threshold: 20 },
  { name: 'Curd', category_id: 7, stock: 50, unit: 'kg', low_stock_threshold: 10 },
  { name: 'Paneer', category_id: 7, stock: 20, unit: 'kg', low_stock_threshold: 5 },

  // Miscellaneous (11)
  { name: 'Sugar', category_id: 11, stock: 100, unit: 'kg', low_stock_threshold: 20 },
  { name: 'Jaggery', category_id: 11, stock: 20, unit: 'kg', low_stock_threshold: 5 },
  { name: 'Tea Powder', category_id: 11, stock: 10, unit: 'kg', low_stock_threshold: 2 },
  { name: 'Coffee Powder', category_id: 11, stock: 5, unit: 'kg', low_stock_threshold: 1 },

  // Cleaning & Hygiene (9)
  { name: 'Phenyl', category_id: 9, stock: 20, unit: 'L', low_stock_threshold: 5 },
  { name: 'Dishwash Liquid', category_id: 9, stock: 20, unit: 'L', low_stock_threshold: 5 },
  { name: 'Handwash', category_id: 9, stock: 10, unit: 'L', low_stock_threshold: 2 },
  { name: 'Soap Bar', category_id: 9, stock: 50, unit: 'pcs', low_stock_threshold: 10 },

  // Packaging & Disposable (10)
  { name: 'Garbage Bags', category_id: 10, stock: 20, unit: 'rolls', low_stock_threshold: 5 },
  { name: 'Aluminium Foil', category_id: 10, stock: 10, unit: 'rolls', low_stock_threshold: 2 },
  { name: 'Paper Napkins', category_id: 10, stock: 50, unit: 'pkts', low_stock_threshold: 10 },
]

async function seed() {
  console.log('🚀 Seeding Al-Mawaid inventory...')
  for (const item of inventoryItems) {
    const { data, error } = await supabase
      .from('inventory')
      .upsert(item, { onConflict: 'name' })
      .select()
    
    if (error) {
      console.error(`❌ Error inserting ${item.name}:`, error.message)
    } else {
      console.log(`✅ Inserted/Updated: ${item.name}`)
    }
  }
  console.log('✨ Seeding complete!')
}

seed()
