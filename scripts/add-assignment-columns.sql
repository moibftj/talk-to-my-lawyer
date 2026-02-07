-- Add letter assignment columns
ALTER TABLE letters ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);
ALTER TABLE letters ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_letters_assigned_to ON letters(assigned_to);
CREATE INDEX IF NOT EXISTS idx_letters_assigned_at ON letters(assigned_at);
