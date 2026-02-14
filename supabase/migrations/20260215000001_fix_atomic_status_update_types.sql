/*
  # Fix Type Mismatches in Atomic Letter Status Update

  ## Problem
  The `update_letter_status_atomic` function declared `v_user_role` as TEXT
  instead of the `user_role` enum type, causing implicit casting mismatches
  when comparing against the `profiles.role` enum column. The comparison
  also lacked a NULL check, which could allow unauthenticated access when
  the profile lookup returns no rows.

  ## Changes
  1. `v_user_role TEXT` → `v_user_role user_role` (matches profiles.role enum)
  2. `IF v_user_role != 'admin'` → `IF v_user_role IS NULL OR v_user_role != 'admin'::user_role`
     (NULL-safe comparison with explicit enum cast, matching pattern from admin_role_separation)
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
  v_current_status letter_status;
  v_updated_count INT;
  v_user_id UUID;
  v_user_role user_role;
BEGIN
  -- SECURITY: Verify the calling user is an admin
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required'::TEXT, p_letter_id, NULL::letter_status;
    RETURN;
  END IF;

  -- Check that the user has admin role
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'admin'::user_role THEN
    RETURN QUERY SELECT false, 'Admin authorization required'::TEXT, p_letter_id, NULL::letter_status;
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
  IF p_additional_data IS NOT NULL
     AND jsonb_typeof(p_additional_data) = 'object'
     AND jsonb_object_length(p_additional_data) > 0 THEN
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
