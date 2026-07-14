DROP POLICY IF EXISTS "Anyone can read inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can delete inventory" ON inventory;
DROP POLICY IF EXISTS "Anyone can read categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON inventory_categories;
DROP POLICY IF EXISTS "Anyone can read inventory log" ON inventory_log;
DROP POLICY IF EXISTS "Admins can insert inventory log" ON inventory_log;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;

CREATE TABLE IF NOT EXISTS inventory_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES inventory_categories(id) ON DELETE SET NULL,
  category TEXT,
  subcategory TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'L', 'pcs', 'pkts', 'rolls')),
  stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  low_stock DECIMAL(10, 2) DEFAULT 10,
  low_stock_threshold DECIMAL(10, 2) DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  quantity DECIMAL(10, 2) NOT NULL,
  old_stock DECIMAL(10, 2),
  new_stock DECIMAL(10, 2),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_item ON inventory_log(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_date ON inventory_log(created_at DESC);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;

-- Inventory: anyone can read (menu/display), only admins can write
CREATE POLICY "Anyone can read inventory"
  ON inventory FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert inventory"
  ON inventory FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update inventory"
  ON inventory FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete inventory"
  ON inventory FOR DELETE
  USING (public.is_admin());

-- Categories: anyone can read
CREATE POLICY "Anyone can read categories"
  ON inventory_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON inventory_categories FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
  ON inventory_categories FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete categories"
  ON inventory_categories FOR DELETE
  USING (public.is_admin());

-- Log: anyone can read, only admins can insert
CREATE POLICY "Anyone can read inventory log"
  ON inventory_log FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert inventory log"
  ON inventory_log FOR INSERT
  WITH CHECK (public.is_admin());

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
