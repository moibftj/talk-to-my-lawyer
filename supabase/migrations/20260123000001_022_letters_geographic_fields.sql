-- Migration: Add Geographic Fields to Letters Table
-- Purpose: Support jurisdiction-aware letter generation with state/country tracking
-- Date: 2026-01-23

-- Add geographic columns to letters table
ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS sender_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS sender_country VARCHAR(2) DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS recipient_state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS recipient_country VARCHAR(2) DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),
  ADD COLUMN IF NOT EXISTS court_type VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN letters.sender_state IS '2-letter US state code for sender (e.g., CA, TX, NY)';
COMMENT ON COLUMN letters.sender_country IS '2-letter ISO country code for sender (default: US)';
COMMENT ON COLUMN letters.recipient_state IS '2-letter US state code for recipient (e.g., CA, TX, NY)';
COMMENT ON COLUMN letters.recipient_country IS '2-letter ISO country code for recipient (default: US)';
COMMENT ON COLUMN letters.jurisdiction IS 'Computed jurisdiction for legal research (state name or region)';
COMMENT ON COLUMN letters.court_type IS 'Type of court if applicable (state_court, federal_court, small_claims, etc.)';

-- Create index for jurisdiction-based queries
CREATE INDEX IF NOT EXISTS idx_letters_jurisdiction ON letters(jurisdiction)
  WHERE jurisdiction IS NOT NULL;

-- Create index for recipient state queries (common for geographic filtering)
CREATE INDEX IF NOT EXISTS idx_letters_recipient_state ON letters(recipient_state)
  WHERE recipient_state IS NOT NULL;

-- Add check constraints for state codes (US states)
ALTER TABLE letters
  ADD CONSTRAINT letters_sender_state_check
    CHECK (sender_state ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT letters_recipient_state_check
    CHECK (recipient_state ~ '^[A-Z]{2}$');

-- Add check constraint for country codes (ISO 3166-1 alpha-2)
ALTER TABLE letters
  ADD CONSTRAINT letters_sender_country_check
    CHECK (sender_country ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT letters_recipient_country_check
    CHECK (recipient_country ~ '^[A-Z]{2}$');

-- Create function to automatically derive jurisdiction from recipient state
CREATE OR REPLACE FUNCTION derive_jurisdiction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only derive jurisdiction if not explicitly set
  IF NEW.jurisdiction IS NULL AND NEW.recipient_state IS NOT NULL THEN
    -- Map state codes to full state names for jurisdiction
    CASE UPPER(NEW.recipient_state)
      WHEN 'AL' THEN NEW.jurisdiction := 'Alabama';
      WHEN 'AK' THEN NEW.jurisdiction := 'Alaska';
      WHEN 'AZ' THEN NEW.jurisdiction := 'Arizona';
      WHEN 'AR' THEN NEW.jurisdiction := 'Arkansas';
      WHEN 'CA' THEN NEW.jurisdiction := 'California';
      WHEN 'CO' THEN NEW.jurisdiction := 'Colorado';
      WHEN 'CT' THEN NEW.jurisdiction := 'Connecticut';
      WHEN 'DE' THEN NEW.jurisdiction := 'Delaware';
      WHEN 'FL' THEN NEW.jurisdiction := 'Florida';
      WHEN 'GA' THEN NEW.jurisdiction := 'Georgia';
      WHEN 'HI' THEN NEW.jurisdiction := 'Hawaii';
      WHEN 'ID' THEN NEW.jurisdiction := 'Idaho';
      WHEN 'IL' THEN NEW.jurisdiction := 'Illinois';
      WHEN 'IN' THEN NEW.jurisdiction := 'Indiana';
      WHEN 'IA' THEN NEW.jurisdiction := 'Iowa';
      WHEN 'KS' THEN NEW.jurisdiction := 'Kansas';
      WHEN 'KY' THEN NEW.jurisdiction := 'Kentucky';
      WHEN 'LA' THEN NEW.jurisdiction := 'Louisiana';
      WHEN 'ME' THEN NEW.jurisdiction := 'Maine';
      WHEN 'MD' THEN NEW.jurisdiction := 'Maryland';
      WHEN 'MA' THEN NEW.jurisdiction := 'Massachusetts';
      WHEN 'MI' THEN NEW.jurisdiction := 'Michigan';
      WHEN 'MN' THEN NEW.jurisdiction := 'Minnesota';
      WHEN 'MS' THEN NEW.jurisdiction := 'Mississippi';
      WHEN 'MO' THEN NEW.jurisdiction := 'Missouri';
      WHEN 'MT' THEN NEW.jurisdiction := 'Montana';
      WHEN 'NE' THEN NEW.jurisdiction := 'Nebraska';
      WHEN 'NV' THEN NEW.jurisdiction := 'Nevada';
      WHEN 'NH' THEN NEW.jurisdiction := 'New Hampshire';
      WHEN 'NJ' THEN NEW.jurisdiction := 'New Jersey';
      WHEN 'NM' THEN NEW.jurisdiction := 'New Mexico';
      WHEN 'NY' THEN NEW.jurisdiction := 'New York';
      WHEN 'NC' THEN NEW.jurisdiction := 'North Carolina';
      WHEN 'ND' THEN NEW.jurisdiction := 'North Dakota';
      WHEN 'OH' THEN NEW.jurisdiction := 'Ohio';
      WHEN 'OK' THEN NEW.jurisdiction := 'Oklahoma';
      WHEN 'OR' THEN NEW.jurisdiction := 'Oregon';
      WHEN 'PA' THEN NEW.jurisdiction := 'Pennsylvania';
      WHEN 'RI' THEN NEW.jurisdiction := 'Rhode Island';
      WHEN 'SC' THEN NEW.jurisdiction := 'South Carolina';
      WHEN 'SD' THEN NEW.jurisdiction := 'South Dakota';
      WHEN 'TN' THEN NEW.jurisdiction := 'Tennessee';
      WHEN 'TX' THEN NEW.jurisdiction := 'Texas';
      WHEN 'UT' THEN NEW.jurisdiction := 'Utah';
      WHEN 'VT' THEN NEW.jurisdiction := 'Vermont';
      WHEN 'VA' THEN NEW.jurisdiction := 'Virginia';
      WHEN 'WA' THEN NEW.jurisdiction := 'Washington';
      WHEN 'WV' THEN NEW.jurisdiction := 'West Virginia';
      WHEN 'WI' THEN NEW.jurisdiction := 'Wisconsin';
      WHEN 'WY' THEN NEW.jurisdiction := 'Wyoming';
      WHEN 'DC' THEN NEW.jurisdiction := 'District of Columbia';
      ELSE NEW.jurisdiction := UPPER(NEW.recipient_state);
    END CASE;
  END IF;

  -- Normalize country codes to uppercase
  IF NEW.sender_country IS NOT NULL THEN
    NEW.sender_country := UPPER(NEW.sender_country);
  END IF;
  IF NEW.recipient_country IS NOT NULL THEN
    NEW.recipient_country := UPPER(NEW.recipient_country);
  END IF;

  -- Normalize state codes to uppercase
  IF NEW.sender_state IS NOT NULL THEN
    NEW.sender_state := UPPER(NEW.sender_state);
  END IF;
  IF NEW.recipient_state IS NOT NULL THEN
    NEW.recipient_state := UPPER(NEW.recipient_state);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically derive jurisdiction on insert/update
DROP TRIGGER IF EXISTS letters_derive_jurisdiction_trigger ON letters;
CREATE TRIGGER letters_derive_jurisdiction_trigger
  BEFORE INSERT OR UPDATE OF recipient_state, jurisdiction
  ON letters
  FOR EACH ROW
  EXECUTE FUNCTION derive_jurisdiction();

-- Update existing letters to derive jurisdiction from intake_data if available
-- This is a one-time data migration for existing records
DO $$
DECLARE
  letter_record RECORD;
  intake_data_json JSONB;
  sender_state_val TEXT;
  recipient_state_val TEXT;
BEGIN
  FOR letter_record IN
    SELECT id, intake_data FROM letters
    WHERE intake_data IS NOT NULL
      AND (sender_state IS NULL OR recipient_state IS NULL)
  LOOP
    intake_data_json := letter_record.intake_data;

    -- Extract state codes from intake_data if they exist
    sender_state_val := intake_data_json->>'senderState';
    recipient_state_val := intake_data_json->>'recipientState';

    -- Update the letter with extracted geographic data
    UPDATE letters
    SET
      sender_state = COALESCE(sender_state_val, sender_state),
      recipient_state = COALESCE(recipient_state_val, recipient_state)
    WHERE id = letter_record.id;
  END LOOP;
END $$;

-- Grant necessary permissions (maintains existing RLS)
-- No additional grants needed as columns are part of existing table
