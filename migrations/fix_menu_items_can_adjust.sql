-- Step 1: Add can_adjust column to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS can_adjust BOOLEAN DEFAULT FALSE;

-- Step 2: Enable RLS (already enabled but ensuring)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies to replace them with proper ones
DROP POLICY IF EXISTS "Allow public delete" ON menu_items;
DROP POLICY IF EXISTS "Allow public read access" ON menu_items;
DROP POLICY IF EXISTS "Allow public insert" ON menu_items;
DROP POLICY IF EXISTS "Allow public update" ON menu_items;

-- Step 4: Create new RLS policies
CREATE POLICY "Allow public select" ON menu_items FOR SELECT USING (TRUE);
CREATE POLICY "Allow public insert" ON menu_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Allow public update" ON menu_items FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Allow public delete" ON menu_items FOR DELETE USING (TRUE);
