/*
  # Fix Security Issues in update_letter_status_atomic

  ## Issues Fixed
  1. Missing authorization check - any authenticated user could update letters
  2. Type mismatch - TEXT parameters assigned to letter_status enum
  3. Reviewer spoofing - caller-supplied reviewed_by allows identity spoofing
  4. Dynamic SQL vulnerability - arbitrary column updates via additional_data

  ## Changes
  1. Add admin authorization check using can_review_letters()
  2. Use letter_status enum type for status parameters
  3. Use auth.uid() for reviewed_by (remove parameter)
  4. Whitelist and validate additional_data fields
*/

-- Drop the existing vulnerable function
DROP FUNCTION IF EXISTS public.update_letter_status_atomic(UUID, TEXT, TEXT, UUID, JSONB) CASCADE;

-- Create the secure version with proper types and authorization
CREATE OR REPLACE FUNCTION public.update_letter_status_atomic(
  p_letter_id UUID,
  p_expected_current_status letter_status,
  p_new_status letter_status,
  p_additional_data JSONB DEFAULT NULL::JSONB
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  letter_id UUID,
  new_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status letter_status;
  v_updated_count INT;
  v_reviewed_by UUID;
  v_final_content TEXT;
  v_rejection_reason TEXT;
BEGIN
  -- SECURITY: Verify caller is authorized to review letters
  IF NOT public.can_review_letters() THEN
    RETURN QUERY SELECT false, 'Unauthorized: Only admins can update letter status'::TEXT, p_letter_id, NULL::TEXT;
    RETURN;
  END IF;

  -- SECURITY: Always use auth.uid() for reviewed_by to prevent spoofing
  v_reviewed_by := auth.uid();

  IF v_reviewed_by IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required'::TEXT, p_letter_id, NULL::TEXT;
    RETURN;
  END IF;

  -- Check current status within transaction
  SELECT status INTO v_current_status
  FROM letters
  WHERE id = p_letter_id
  FOR UPDATE;  -- Lock the row to prevent concurrent modifications

  IF v_current_status IS NULL THEN
    RETURN QUERY SELECT false, 'Letter not found'::TEXT, p_letter_id, NULL::TEXT;
    RETURN;
  END IF;

  -- Verify status hasn't changed since validation
  IF v_current_status != p_expected_current_status THEN
    RETURN QUERY SELECT
      false,
      format(
        'Status conflict: expected %L but found %L. Letter may have been modified by another admin.',
        p_expected_current_status::TEXT,
        v_current_status::TEXT
      )::TEXT,
      p_letter_id,
      v_current_status::TEXT;
    RETURN;
  END IF;

  -- Extract and validate whitelisted fields from additional_data
  IF p_additional_data IS NOT NULL THEN
    -- Only allow specific fields to prevent arbitrary column updates
    v_final_content := p_additional_data->>'final_content';
    v_rejection_reason := p_additional_data->>'rejection_reason';
  END IF;

  -- Update letter status atomically
  UPDATE letters
  SET
    status = p_new_status,
    reviewed_by = v_reviewed_by,
    reviewed_at = NOW(),
    updated_at = NOW(),
    -- Conditionally update whitelisted fields
    final_content = COALESCE(v_final_content, final_content),
    rejection_reason = COALESCE(v_rejection_reason, rejection_reason),
    -- Set timestamps based on status
    approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
    rejected_at = CASE WHEN p_new_status = 'rejected' THEN NOW() ELSE rejected_at END
  WHERE id = p_letter_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN QUERY SELECT false, 'Failed to update letter'::TEXT, p_letter_id, p_new_status::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT, p_letter_id, p_new_status::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
-- (authorization is checked inside the function via can_review_letters)
GRANT EXECUTE ON FUNCTION public.update_letter_status_atomic(UUID, letter_status, letter_status, JSONB) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.update_letter_status_atomic IS
  'SECURITY HARDENED: Atomically updates letter status with authorization check, type safety, and whitelisted field updates. Uses can_review_letters() to verify admin access, auth.uid() for reviewer identity, and validates all field updates. Uses SELECT FOR UPDATE to prevent race conditions.';
