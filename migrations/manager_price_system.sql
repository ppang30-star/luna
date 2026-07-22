-- Add can_adjust_price column to menu_items if it doesn't exist
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS can_adjust_price BOOLEAN DEFAULT FALSE;

-- Create managers table for storing manager credentials
CREATE TABLE IF NOT EXISTS managers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create price_adjustment_logs table for audit trail
CREATE TABLE IF NOT EXISTS price_adjustment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  menu_name TEXT NOT NULL,
  original_price NUMERIC NOT NULL,
  adjusted_price NUMERIC NOT NULL,
  price_change NUMERIC NOT NULL,
  manager_name TEXT NOT NULL,
  adjustment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on managers table
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

-- Allow public select on managers for verification
CREATE POLICY "Allow public select on managers" 
ON managers 
FOR SELECT 
TO public 
USING (TRUE);

-- Allow public insert on managers
CREATE POLICY "Allow public insert on managers" 
ON managers 
FOR INSERT 
TO public 
WITH CHECK (TRUE);

-- Allow public update on managers
CREATE POLICY "Allow public update on managers" 
ON managers 
FOR UPDATE 
TO public 
USING (TRUE)
WITH CHECK (TRUE);

-- Allow public delete on managers
CREATE POLICY "Allow public delete on managers" 
ON managers 
FOR DELETE 
TO public 
USING (TRUE);

-- Enable RLS on price_adjustment_logs table
ALTER TABLE price_adjustment_logs ENABLE ROW LEVEL SECURITY;

-- Allow public select on price_adjustment_logs
CREATE POLICY "Allow public select on price_adjustment_logs" 
ON price_adjustment_logs 
FOR SELECT 
TO public 
USING (TRUE);

-- Allow public insert on price_adjustment_logs
CREATE POLICY "Allow public insert on price_adjustment_logs" 
ON price_adjustment_logs 
FOR INSERT 
TO public 
WITH CHECK (TRUE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_managers_name ON managers(name);
CREATE INDEX IF NOT EXISTS idx_price_logs_menu_item ON price_adjustment_logs(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_price_logs_created_at ON price_adjustment_logs(created_at DESC);
