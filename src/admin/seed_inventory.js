import { supabase } from '../lib/firebaseClient'

const inventoryItems = [
  { name: 'Moong Dal', category_id: 1, stock: 50, unit: 'kg', low_stock: 10, category: 'Pulses & Lentils' },
  { name: 'Chana Dal', category_id: 1, stock: 50, unit: 'kg', low_stock: 10, category: 'Pulses & Lentils' },
  { name: 'Toor Dal', category_id: 1, stock: 50, unit: 'kg', low_stock: 10, category: 'Pulses & Lentils' },
  { name: 'Masoor Dal', category_id: 1, stock: 30, unit: 'kg', low_stock: 5, category: 'Pulses & Lentils' },
  { name: 'Urad Dal', category_id: 1, stock: 20, unit: 'kg', low_stock: 5, category: 'Pulses & Lentils' },
  { name: 'Kabuli Chana', category_id: 1, stock: 40, unit: 'kg', low_stock: 10, category: 'Pulses & Lentils' },
  { name: 'Kala Chana', category_id: 1, stock: 30, unit: 'kg', low_stock: 5, category: 'Pulses & Lentils' },
  { name: 'Rajma', category_id: 1, stock: 20, unit: 'kg', low_stock: 5, category: 'Pulses & Lentils' },
  { name: 'Soya Chunks', category_id: 1, stock: 10, unit: 'kg', low_stock: 2, category: 'Pulses & Lentils' },
  { name: 'Kolam Rice', category_id: 2, stock: 200, unit: 'kg', low_stock: 40, category: 'Grains & Rice' },
  { name: 'Basmati Rice', category_id: 2, stock: 50, unit: 'kg', low_stock: 10, category: 'Grains & Rice' },
  { name: 'Wheat Flour (Atta)', category_id: 2, stock: 500, unit: 'kg', low_stock: 100, category: 'Grains & Rice' },
  { name: 'Maida', category_id: 2, stock: 50, unit: 'kg', low_stock: 10, category: 'Grains & Rice' },
  { name: 'Besan', category_id: 2, stock: 50, unit: 'kg', low_stock: 10, category: 'Grains & Rice' },
  { name: 'Sooji (Rava)', category_id: 2, stock: 30, unit: 'kg', low_stock: 5, category: 'Grains & Rice' },
  { name: 'Daliya', category_id: 2, stock: 10, unit: 'kg', low_stock: 2, category: 'Grains & Rice' },
  { name: 'Salt', category_id: 3, stock: 50, unit: 'kg', low_stock: 10, category: 'Spices & Condiments' },
  { name: 'Turmeric Powder', category_id: 3, stock: 10, unit: 'kg', low_stock: 2, category: 'Spices & Condiments' },
  { name: 'Red Chili Powder', category_id: 3, stock: 20, unit: 'kg', low_stock: 5, category: 'Spices & Condiments' },
  { name: 'Coriander Powder', category_id: 3, stock: 15, unit: 'kg', low_stock: 3, category: 'Spices & Condiments' },
  { name: 'Cumin Seeds (Jeera)', category_id: 3, stock: 10, unit: 'kg', low_stock: 2, category: 'Spices & Condiments' },
  { name: 'Mustard Seeds (Rai)', category_id: 3, stock: 5, unit: 'kg', low_stock: 1, category: 'Spices & Condiments' },
  { name: 'Garam Masala', category_id: 3, stock: 5, unit: 'kg', low_stock: 1, category: 'Spices & Condiments' },
  { name: 'Black Pepper', category_id: 3, stock: 2, unit: 'kg', low_stock: 0.5, category: 'Spices & Condiments' },
  { name: 'Cloves (Laung)', category_id: 3, stock: 1, unit: 'kg', low_stock: 0.2, category: 'Spices & Condiments' },
  { name: 'Cardamom (Elaichi)', category_id: 3, stock: 1, unit: 'kg', low_stock: 0.2, category: 'Spices & Condiments' },
  { name: 'Kasuri Methi', category_id: 3, stock: 2, unit: 'kg', low_stock: 0.5, category: 'Spices & Condiments' },
  { name: 'Sunflower Oil', category_id: 4, stock: 100, unit: 'L', low_stock: 20, category: 'Oils, Ghee & Fats' },
  { name: 'Groundnut Oil', category_id: 4, stock: 50, unit: 'L', low_stock: 10, category: 'Oils, Ghee & Fats' },
  { name: 'Ghee', category_id: 4, stock: 30, unit: 'kg', low_stock: 5, category: 'Oils, Ghee & Fats' },
  { name: 'Butter', category_id: 4, stock: 10, unit: 'kg', low_stock: 2, category: 'Oils, Ghee & Fats' },
  { name: 'Chicken', category_id: 5, stock: 50, unit: 'kg', low_stock: 10, category: 'Meat & Poultry' },
  { name: 'Mutton', category_id: 5, stock: 20, unit: 'kg', low_stock: 5, category: 'Meat & Poultry' },
  { name: 'Eggs', category_id: 5, stock: 1000, unit: 'pcs', low_stock: 100, category: 'Meat & Poultry' },
  { name: 'Potatoes', category_id: 6, stock: 200, unit: 'kg', low_stock: 40, category: 'Vegetables & Fruits' },
  { name: 'Onions', category_id: 6, stock: 200, unit: 'kg', low_stock: 40, category: 'Vegetables & Fruits' },
  { name: 'Tomatoes', category_id: 6, stock: 100, unit: 'kg', low_stock: 20, category: 'Vegetables & Fruits' },
  { name: 'Garlic', category_id: 6, stock: 20, unit: 'kg', low_stock: 5, category: 'Vegetables & Fruits' },
  { name: 'Ginger', category_id: 6, stock: 20, unit: 'kg', low_stock: 5, category: 'Vegetables & Fruits' },
  { name: 'Green Chili', category_id: 6, stock: 10, unit: 'kg', low_stock: 2, category: 'Vegetables & Fruits' },
  { name: 'Lemon', category_id: 6, stock: 5, unit: 'kg', low_stock: 1, category: 'Vegetables & Fruits' },
  { name: 'Milk', category_id: 7, stock: 100, unit: 'L', low_stock: 20, category: 'Dairy & Eggs' },
  { name: 'Curd', category_id: 7, stock: 50, unit: 'kg', low_stock: 10, category: 'Dairy & Eggs' },
  { name: 'Paneer', category_id: 7, stock: 20, unit: 'kg', low_stock: 5, category: 'Dairy & Eggs' },
  { name: 'Sugar', category_id: 11, stock: 100, unit: 'kg', low_stock: 20, category: 'Miscellaneous' },
  { name: 'Jaggery', category_id: 11, stock: 20, unit: 'kg', low_stock: 5, category: 'Miscellaneous' },
  { name: 'Tea Powder', category_id: 11, stock: 10, unit: 'kg', low_stock: 2, category: 'Miscellaneous' },
  { name: 'Coffee Powder', category_id: 11, stock: 5, unit: 'kg', low_stock: 1, category: 'Miscellaneous' },
  { name: 'Phenyl', category_id: 9, stock: 20, unit: 'L', low_stock: 5, category: 'Cleaning & Hygiene' },
  { name: 'Dishwash Liquid', category_id: 9, stock: 20, unit: 'L', low_stock: 5, category: 'Cleaning & Hygiene' },
  { name: 'Handwash', category_id: 9, stock: 10, unit: 'L', low_stock: 2, category: 'Cleaning & Hygiene' },
  { name: 'Soap Bar', category_id: 9, stock: 50, unit: 'pcs', low_stock: 10, category: 'Cleaning & Hygiene' },
  { name: 'Garbage Bags', category_id: 10, stock: 20, unit: 'rolls', low_stock: 5, category: 'Packaging & Disposable' },
  { name: 'Aluminium Foil', category_id: 10, stock: 10, unit: 'rolls', low_stock: 2, category: 'Packaging & Disposable' },
  { name: 'Paper Napkins', category_id: 10, stock: 50, unit: 'pkts', low_stock: 10, category: 'Packaging & Disposable' },
]

async function seed() {
  console.log('Seeding Al-Mawaid inventory...')
  for (const item of inventoryItems) {
    const { data, error } = await supabase
      .from('inventory')
      .upsert(item, { onConflict: 'name' })
      .select()

    if (error) {
      console.error(`Error inserting ${item.name}:`, error.message)
    } else {
      console.log(`Inserted/Updated: ${item.name}`)
    }
  }
  console.log('Seeding complete!')
}

seed()
