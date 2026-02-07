-- Migration: Add research_data column for n8n jurisdiction research
-- Purpose: Store state-specific legal research data from n8n workflow
-- Date: 2026-02-07

ALTER TABLE letters
ADD COLUMN IF NOT EXISTS research_data JSONB;

CREATE INDEX IF NOT EXISTS idx_letters_research_data
  ON letters USING gin(research_data)
  WHERE research_data IS NOT NULL;

COMMENT ON COLUMN letters.research_data IS 'Jurisdiction-specific research data from n8n workflow (state, statutes, disclosures, conventions)';
