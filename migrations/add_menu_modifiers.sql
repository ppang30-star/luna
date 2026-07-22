-- Add menu modifiers (required options) support
-- Stores modifier groups (e.g., "Staff List") and their options (e.g., "John", "Jane")

-- Create modifier groups table
CREATE TABLE IF NOT EXISTS menu_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  group_name_ko TEXT NOT NULL,
  group_name_en TEXT,
  group_name_ja TEXT,
  group_name_zh TEXT,
  group_name_es TEXT,
  group_name_th TEXT,
  group_name_vi TEXT,
  is_required BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create modifier options table (e.g., staff names)
CREATE TABLE IF NOT EXISTS modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES menu_modifiers(id) ON DELETE CASCADE,
  option_value TEXT NOT NULL,
  option_label_ko TEXT NOT NULL,
  option_label_en TEXT,
  option_label_ja TEXT,
  option_label_zh TEXT,
  option_label_es TEXT,
  option_label_th TEXT,
  option_label_vi TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_menu_modifiers_menu_item_id ON menu_modifiers(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_modifier_options_modifier_id ON modifier_options(modifier_id);

-- Add comment for documentation
COMMENT ON TABLE menu_modifiers IS 'Groups of required options/modifiers for menu items (e.g., Staff List for Lady Charge)';
COMMENT ON TABLE modifier_options IS 'Individual options within a modifier group (e.g., John, Jane, Bob)';
