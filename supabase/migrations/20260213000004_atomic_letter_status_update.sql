/*
  # Atomic Letter Status Update RPC

  ## Problem
  Race condition in concurrent admin approvals:
  1. Admin A reads letter (status: pending_review)
  2. Admin B reads same letter (status: pending_review)
  3. Admin A approves → status changes to approved
  4. Admin B still sees pending_review cached
  5. Admin B approves same letter again

  ## Solution
  Add RPC function that validates the CURRENT status as a precondition
  for the update. If another request changes the status between validation
  and update, the operation will fail predictably.
*/

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
  new_status letter_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_updated_count INT;
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  -- SECURITY: Verify the calling user is an admin
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required'::TEXT, p_letter_id, NULL::TEXT;
    RETURN;
  END IF;

  -- Check that the user has admin role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role != 'admin' THEN
    RETURN QUERY SELECT false, 'Admin authorization required'::TEXT, p_letter_id, NULL::TEXT;
    RETURN;
  END IF;

  -- Check current status within transaction
  SELECT status INTO v_current_status
  FROM letters
  WHERE id = p_letter_id
  FOR UPDATE;  -- Lock the row to prevent concurrent modifications

  IF v_current_status IS NULL THEN
    RETURN QUERY SELECT false, 'Letter not found'::TEXT, p_letter_id, NULL::letter_status;
    RETURN;
  END IF;

  -- Verify status hasn't changed since validation
  IF v_current_status != p_expected_current_status THEN
    RETURN QUERY SELECT
      false,
      format(
        'Status conflict: expected %L but found %L. Letter may have been modified by another admin.',
        p_expected_current_status,
        v_current_status
      )::TEXT,
      p_letter_id,
      v_current_status;
    RETURN;
  END IF;

  -- Update letter status atomically
  UPDATE letters
  SET
    status = p_new_status,
    reviewed_by = v_user_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_letter_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN QUERY SELECT false, 'Failed to update letter'::TEXT, p_letter_id, NULL::letter_status;
    RETURN;
  END IF;

  -- Apply additional fields if provided (e.g., final_content, rejected_at, approved_at)
  IF p_additional_data IS NOT NULL AND jsonb_array_length(p_additional_data) > 0 THEN
    DECLARE
      v_set_clause TEXT;
    BEGIN
      SELECT string_agg(
        format('%I = %L', key, value),
        ', '
      ) INTO v_set_clause
      FROM jsonb_each_text(p_additional_data);

      IF v_set_clause IS NOT NULL THEN
        EXECUTE format(
          'UPDATE letters SET %s WHERE id = %L',
          v_set_clause,
          p_letter_id
        );
      END IF;
    END;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT, p_letter_id, p_new_status;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_letter_status_atomic(UUID, letter_status, letter_status, JSONB) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.update_letter_status_atomic IS
  'RACE CONDITION FIX: Atomically updates letter status while validating that the current status matches expected value. Uses SELECT FOR UPDATE to lock the row, preventing concurrent modifications. If another admin changes the status between validation and update, this function will return a conflict error instead of silently overwriting.';
