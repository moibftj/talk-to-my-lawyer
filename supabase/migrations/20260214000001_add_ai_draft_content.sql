-- Migration: Add ai_draft_content column for n8n workflow integration
-- Purpose: Store AI-generated letter content directly from n8n workflow
-- Date: 2026-02-14

-- Add column for AI draft content (n8n workflow saves this directly)
ALTER TABLE letters
ADD COLUMN IF NOT EXISTS ai_draft_content TEXT;

-- Add comment for documentation
COMMENT ON COLUMN letters.ai_draft_content IS 'AI-generated letter content saved directly by n8n workflow';

-- Create index for efficient queries on AI draft availability
CREATE INDEX IF NOT EXISTS idx_letters_ai_draft_content
  ON letters(id, status, created_at)
  WHERE ai_draft_content IS NOT NULL;