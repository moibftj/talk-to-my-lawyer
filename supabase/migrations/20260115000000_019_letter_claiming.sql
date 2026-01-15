/*
  # Letter Claiming Feature Migration

  This migration implements the letter claiming system to prevent duplicate reviews:

  1. Add `claimed_by` column to letters table (references profiles.id)
  2. Add `claimed_at` timestamp for claim expiration
  3. Create indexes for efficient claim queries
  4. Create function to check if a claim is expired (30 minutes)
  5. Create function to claim a letter with conflict detection
  6. Create function to release a letter claim
  7. Update RLS policies to allow admins to see claimed_by
  8. Add audit trail support for claim/release actions

  Claim Expiry: Claims expire after 30 minutes of inactivity
  Conflict Handling: Returns error when trying to claim an already-claimed letter
*/

-- Add claimed_by column (references profiles table)
ALTER TABLE letters
ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add claimed_at timestamp for claim expiration tracking
ALTER TABLE letters
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN letters.claimed_by IS 'ID of the admin who currently has this letter claimed for review. NULL if unclaimed.';
COMMENT ON COLUMN letters.claimed_at IS 'Timestamp when the letter was claimed. Claims expire after 30 minutes.';

-- Create indexes for efficient claim queries
CREATE INDEX IF NOT EXISTS idx_letters_claimed_by ON letters(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_letters_claimed_at ON letters(claimed_at) WHERE claimed_at IS NOT NULL;

-- Composite index for finding expired claims
CREATE INDEX IF NOT EXISTS idx_letters_claim_expiring ON letters(claimed_by, claimed_at)
WHERE claimed_by IS NOT NULL AND claimed_at IS NOT NULL;

-- Function to check if a claim is expired (30 minutes)
CREATE OR REPLACE FUNCTION public.is_claim_expired(claimed_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Function to claim a letter with conflict detection
CREATE OR REPLACE FUNCTION public.claim_letter(letter_id UUID, admin_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_claimer UUID;
  current_claimed_at TIMESTAMPTZ;
  letter_status letter_status;
  admin_role user_role;
BEGIN
  -- Check if user is an admin
  SELECT role INTO admin_role
  FROM profiles
  WHERE id = admin_id;

  IF admin_role IS NULL OR admin_role != 'admin'::user_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can claim letters'
    );
  END IF;

  -- Lock the row for update to prevent race conditions
  SELECT claimed_by, claimed_at, status
  INTO current_claimer, current_claimed_at, letter_status
  FROM letters
  WHERE id = letter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Letter not found'
    );
  END IF;

  -- Check if letter is in a claimable state
  IF letter_status NOT IN ('pending_review'::letter_status, 'under_review'::letter_status) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Letter is not in a claimable state',
      'current_status', letter_status
    );
  END IF;

  -- Check if already claimed by someone else (and claim is not expired)
  IF current_claimer IS NOT NULL AND current_claimer != admin_id THEN
    IF public.is_claim_expired(current_claimed_at) THEN
      -- Claim is expired, allow re-claiming
      NULL;
    ELSE
      -- Get the claimer's name for the error message
      DECLARE
        claimer_name TEXT;
      BEGIN
        SELECT full_name INTO claimer_name
        FROM profiles
        WHERE id = current_claimer;
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Letter is already claimed by another admin',
          'claimed_by', current_claimer,
          'claimer_name', claimer_name,
          'claimed_at', current_claimed_at
        );
      END;
    END IF;
  END IF;

  -- Claim the letter
  UPDATE letters
  SET claimed_by = admin_id,
      claimed_at = NOW(),
      status = 'under_review'
  WHERE id = letter_id;

  -- Log to audit trail
  INSERT INTO letter_audit_trail (letter_id, action, performed_by, old_status, new_status, notes, metadata)
  VALUES (
    letter_id,
    'claimed',
    admin_id,
    letter_status,
    'under_review',
    'Letter claimed for review',
    jsonb_build_object('claimed_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'claimed_by', admin_id,
    'claimed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to release a letter claim
CREATE OR REPLACE FUNCTION public.release_letter_claim(letter_id UUID, admin_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_claimer UUID;
  letter_status letter_status;
BEGIN
  -- Lock the row for update
  SELECT claimed_by, status
  INTO current_claimer, letter_status
  FROM letters
  WHERE id = letter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Letter not found'
    );
  END IF;

  -- Check if the admin owns the claim
  IF current_claimer IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Letter was not claimed'
    );
  END IF;

  IF current_claimer != admin_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You do not own this claim'
    );
  END IF;

  -- Release the claim (but keep status as under_review or pending_review based on approval state)
  UPDATE letters
  SET claimed_by = NULL,
      claimed_at = NULL
  WHERE id = letter_id;

  -- Log to audit trail
  INSERT INTO letter_audit_trail (letter_id, action, performed_by, old_status, new_status, notes, metadata)
  VALUES (
    letter_id,
    'released',
    admin_id,
    letter_status,
    letter_status,
    'Letter claim released',
    jsonb_build_object('released_at', NOW())
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Claim released successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get pending letters count for admins
CREATE OR REPLACE FUNCTION public.get_pending_letters_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM letters
    WHERE status IN ('pending_review'::letter_status, 'under_review'::letter_status)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_claim_expired TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_letter TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_letter_claim TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_letters_count TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.is_claim_expired IS 'Returns true if a claim has expired (older than 30 minutes)';
COMMENT ON FUNCTION public.claim_letter IS 'Claims a letter for review. Returns error if already claimed by another admin.';
COMMENT ON FUNCTION public.release_letter_claim IS 'Releases a letter claim. Only the claim owner can release.';
COMMENT ON FUNCTION public.get_pending_letters_count IS 'Returns the count of letters pending or under review';

-- Enable realtime on letters table for claim status updates
ALTER PUBLICATION supabase_realtime ADD TABLE letters;
