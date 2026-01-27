-- Email Queue Table for reliable email delivery
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "to" TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry ON public.email_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at);
-- Email Delivery Log Table for tracking and analytics
CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_queue_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type TEXT,
  provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- Create indexes for email delivery log
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_recipient ON public.email_delivery_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_status ON public.email_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_created_at ON public.email_delivery_log(created_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_template ON public.email_delivery_log(template_type);
-- Admin Activity Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at);
-- Enable RLS on new tables
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- RLS Policies for email_queue (service role only)
DROP POLICY IF EXISTS "Service role can manage email queue" ON public.email_queue;
CREATE POLICY "Service role can manage email queue" ON public.email_queue
  FOR ALL USING (auth.role() = 'service_role');
-- RLS Policies for email_delivery_log (service role only)
DROP POLICY IF EXISTS "Service role can manage email delivery log" ON public.email_delivery_log;
CREATE POLICY "Service role can manage email delivery log" ON public.email_delivery_log
  FOR ALL USING (auth.role() = 'service_role');
-- RLS Policies for admin_audit_log (admins can view their own actions)
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit log" ON public.admin_audit_log
  FOR SELECT USING (
    auth.uid() = admin_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Service role can insert audit log" ON public.admin_audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
-- Function to clean up old email queue entries
CREATE OR REPLACE FUNCTION public.cleanup_old_email_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_queue
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status != 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.admin_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON public.email_queue TO service_role;
GRANT ALL ON public.email_delivery_log TO service_role;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_email_queue() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs() TO service_role;
-- Add comments for documentation
COMMENT ON TABLE public.email_queue IS 'Queue for reliable email delivery with retry logic';
COMMENT ON TABLE public.email_delivery_log IS 'Log of all email delivery attempts for analytics and debugging';
COMMENT ON TABLE public.admin_audit_log IS 'Audit trail of all admin actions for compliance and security';
