create index if not exists idx_data_deletion_requests_approved_by on public.data_deletion_requests (approved_by);
create index if not exists idx_email_delivery_log_email_queue_id on public.email_delivery_log (email_queue_id);
create index if not exists idx_promotional_code_usage_subscription_id on public.promotional_code_usage (subscription_id);;
