-- Migration: Add payout_requests table and enhance employee features
-- Run this after the main schema is in place

-- Create payout_requests table for employee commission withdrawals
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  payment_details JSONB DEFAULT '{}',
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_employee_id ON payout_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at DESC);
-- Add RLS policies
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
-- Employees can view their own payout requests
DROP POLICY IF EXISTS "Employees can view own payout requests" ON payout_requests;
CREATE POLICY "Employees can view own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = employee_id);
-- Employees can create payout requests
DROP POLICY IF EXISTS "Employees can create payout requests" ON payout_requests;
CREATE POLICY "Employees can create payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = employee_id);
-- Add draft_metadata column to letters table for auto-save feature
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letters' AND column_name = 'draft_metadata') THEN
    ALTER TABLE letters ADD COLUMN draft_metadata JSONB DEFAULT NULL;
  END IF;
END $$;
-- Add description column to employee_coupons for promo codes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_coupons' AND column_name = 'description') THEN
    ALTER TABLE employee_coupons ADD COLUMN description TEXT;
  END IF;
END $$;
-- Add max_uses column to employee_coupons
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_coupons' AND column_name = 'max_uses') THEN
    ALTER TABLE employee_coupons ADD COLUMN max_uses INTEGER DEFAULT NULL;
  END IF;
END $$;
-- Add expires_at column to employee_coupons
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employee_coupons' AND column_name = 'expires_at') THEN
    ALTER TABLE employee_coupons ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;
-- Function to process payout (admin only)
CREATE OR REPLACE FUNCTION process_payout(
  p_payout_id UUID,
  p_admin_id UUID,
  p_action VARCHAR(20),
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payout RECORD;
  v_result JSONB;
BEGIN
  -- Get payout request
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;
  
  IF v_payout.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout already processed');
  END IF;
  
  IF p_action = 'approve' THEN
    -- Mark as processing/completed
    UPDATE payout_requests
    SET status = 'completed',
        processed_at = NOW(),
        processed_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_payout_id;
    
    -- Mark related commissions as paid
    UPDATE commissions
    SET status = 'paid', updated_at = NOW()
    WHERE employee_id = v_payout.employee_id
      AND status = 'pending';
    
    v_result := jsonb_build_object('success', true, 'message', 'Payout approved and processed');
    
  ELSIF p_action = 'reject' THEN
    UPDATE payout_requests
    SET status = 'rejected',
        processed_at = NOW(),
        processed_by = p_admin_id,
        rejection_reason = p_rejection_reason,
        updated_at = NOW()
    WHERE id = p_payout_id;
    
    v_result := jsonb_build_object('success', true, 'message', 'Payout rejected');
    
  ELSE
    v_result := jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
  
  RETURN v_result;
END;
$$;
COMMENT ON TABLE payout_requests IS 'Employee payout/withdrawal requests for commission earnings';
