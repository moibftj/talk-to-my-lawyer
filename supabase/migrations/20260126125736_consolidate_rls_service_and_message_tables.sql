-- email_queue
 drop policy if exists email_queue_service_all on public.email_queue;
 drop policy if exists email_queue_admin_select on public.email_queue;

 create policy email_queue_select on public.email_queue
   for select to public
   using (is_super_admin() OR (select auth.role()) = 'service_role'::text);

 create policy email_queue_insert on public.email_queue
   for insert to public
   with check ((select auth.role()) = 'service_role'::text);

 create policy email_queue_update on public.email_queue
   for update to public
   using ((select auth.role()) = 'service_role'::text)
   with check ((select auth.role()) = 'service_role'::text);

 create policy email_queue_delete on public.email_queue
   for delete to public
   using ((select auth.role()) = 'service_role'::text);

-- email_queue_logs
 drop policy if exists email_queue_logs_service_all on public.email_queue_logs;
 drop policy if exists email_queue_logs_admin_select on public.email_queue_logs;

 create policy email_queue_logs_select on public.email_queue_logs
   for select to public
   using (is_super_admin() OR (select auth.role()) = 'service_role'::text);

 create policy email_queue_logs_insert on public.email_queue_logs
   for insert to public
   with check ((select auth.role()) = 'service_role'::text);

 create policy email_queue_logs_update on public.email_queue_logs
   for update to public
   using ((select auth.role()) = 'service_role'::text)
   with check ((select auth.role()) = 'service_role'::text);

 create policy email_queue_logs_delete on public.email_queue_logs
   for delete to public
   using ((select auth.role()) = 'service_role'::text);

-- email_delivery_log
 drop policy if exists email_delivery_log_service_all on public.email_delivery_log;
 drop policy if exists email_delivery_log_admin_select on public.email_delivery_log;

 create policy email_delivery_log_select on public.email_delivery_log
   for select to public
   using (is_super_admin() OR (select auth.role()) = 'service_role'::text);

 create policy email_delivery_log_insert on public.email_delivery_log
   for insert to public
   with check ((select auth.role()) = 'service_role'::text);

 create policy email_delivery_log_update on public.email_delivery_log
   for update to public
   using ((select auth.role()) = 'service_role'::text)
   with check ((select auth.role()) = 'service_role'::text);

 create policy email_delivery_log_delete on public.email_delivery_log
   for delete to public
   using ((select auth.role()) = 'service_role'::text);

-- webhook_events
 drop policy if exists webhook_events_service_all on public.webhook_events;
 drop policy if exists webhook_events_admin_select on public.webhook_events;

 create policy webhook_events_select on public.webhook_events
   for select to public
   using (is_super_admin() OR (select auth.role()) = 'service_role'::text);

 create policy webhook_events_insert on public.webhook_events
   for insert to public
   with check ((select auth.role()) = 'service_role'::text);

 create policy webhook_events_update on public.webhook_events
   for update to public
   using ((select auth.role()) = 'service_role'::text)
   with check ((select auth.role()) = 'service_role'::text);

 create policy webhook_events_delete on public.webhook_events
   for delete to public
   using ((select auth.role()) = 'service_role'::text);

-- data_access_logs
 drop policy if exists data_access_logs_admin_select on public.data_access_logs;
 drop policy if exists data_access_logs_user_select on public.data_access_logs;
 drop policy if exists data_access_logs_service_insert on public.data_access_logs;

 create policy data_access_logs_select on public.data_access_logs
   for select to public
   using (is_super_admin() OR user_id = (select auth.uid()));

 create policy data_access_logs_insert on public.data_access_logs
   for insert to public
   with check ((select auth.role()) = 'service_role'::text);

-- letter_audit_trail
 drop policy if exists letter_audit_trail_admin_select on public.letter_audit_trail;
 drop policy if exists letter_audit_trail_user_select on public.letter_audit_trail;
 drop policy if exists letter_audit_trail_service_insert on public.letter_audit_trail;

 create policy letter_audit_trail_select on public.letter_audit_trail
   for select to public
   using (
     is_any_admin()
     OR exists (
       select 1 from letters
       where letters.id = letter_audit_trail.letter_id
         and letters.user_id = (select auth.uid())
     )
   );

 create policy letter_audit_trail_insert on public.letter_audit_trail
   for insert to public
   with check ((select auth.role()) = 'service_role'::text);

-- messages
 drop policy if exists messages_admin_select on public.messages;
 drop policy if exists messages_recipient_select on public.messages;
 drop policy if exists messages_sender_select on public.messages;
 drop policy if exists messages_user_insert on public.messages;

 create policy messages_select on public.messages
   for select to public
   using (
     is_super_admin()
     OR recipient_id = (select auth.uid())
     OR sender_id = (select auth.uid())
   );

 create policy messages_insert on public.messages
   for insert to public
   with check (sender_id = (select auth.uid()));;
