-- Migration: Add letter generation tracking fields
-- Purpose: Support Zapier webhook workflow with proper metadata and error tracking
-- Date: 2026-02-03

-- Add missing columns for letter generation tracking
ALTER TABLE letters
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS generation_metadata JSONB,
ADD COLUMN IF NOT EXISTS generation_error TEXT;

-- Create index for efficient queries on generation timestamp
CREATE INDEX IF NOT EXISTS idx_letters_generated_at
  ON letters(generated_at DESC)
  WHERE generated_at IS NOT NULL;

-- Create index for failed generation queries
CREATE INDEX IF NOT EXISTS idx_letters_generation_error
  ON letters(status, created_at)
  WHERE status = 'failed' AND generation_error IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN letters.generated_at IS 'Timestamp when AI letter generation completed (from Zapier or OpenAI)';
COMMENT ON COLUMN letters.generation_metadata IS 'Metadata from generation service (Zapier/OpenAI): letterType, model, source, etc.';
COMMENT ON COLUMN letters.generation_error IS 'Error message if letter generation failed';
