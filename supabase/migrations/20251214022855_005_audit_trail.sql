/*
  # Audit Trail System

  1. New Tables
    - `letter_audit_trail` - Records all letter status changes and actions
      - `id` (uuid, primary key)
      - `letter_id` (uuid, references letters)
      - `action` (text: created, submitted, review_started, approved, rejected, etc.)
      - `performed_by` (uuid, references profiles)
      - `old_status` (text)
      - `new_status` (text)
      - `notes` (text)
      - `metadata` (jsonb)
      - timestamps

  2. Security
    - RLS enabled with policies for admins and letter owners
    - Admins can view all audit logs
    - Users can view audit logs for their own letters

  3. Functions
    - `log_letter_audit()` - Logs audit trail entries
*/

CREATE TABLE IF NOT EXISTS letter_audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES profiles(id),
    old_status TEXT,
    new_status TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_letter ON letter_audit_trail(letter_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON letter_audit_trail(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON letter_audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON letter_audit_trail(action);
ALTER TABLE letter_audit_trail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view all audit logs" ON letter_audit_trail;
CREATE POLICY "Admins view all audit logs"
    ON letter_audit_trail FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Users view own letter audit" ON letter_audit_trail;
CREATE POLICY "Users view own letter audit"
    ON letter_audit_trail FOR SELECT
    TO authenticated
    USING (
        letter_id IN (
            SELECT id FROM public.letters WHERE user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS "System can insert audit logs" ON letter_audit_trail;
CREATE POLICY "System can insert audit logs"
    ON letter_audit_trail FOR INSERT
    TO authenticated
    WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.log_letter_audit(
    p_letter_id UUID,
    p_action TEXT,
    p_old_status TEXT DEFAULT NULL,
    p_new_status TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.letter_audit_trail (
        letter_id,
        action,
        performed_by,
        old_status,
        new_status,
        notes,
        metadata
    ) VALUES (
        p_letter_id,
        p_action,
        auth.uid(),
        p_old_status,
        p_new_status,
        p_notes,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.log_letter_audit TO authenticated;
