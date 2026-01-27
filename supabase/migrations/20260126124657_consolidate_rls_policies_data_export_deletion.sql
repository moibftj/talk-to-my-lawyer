drop policy if exists data_deletion_admin_all on public.data_deletion_requests;
drop policy if exists data_deletion_user_select on public.data_deletion_requests;
drop policy if exists data_deletion_user_insert on public.data_deletion_requests;

create policy data_deletion_requests_select on public.data_deletion_requests
  for select to public
  using (is_super_admin() OR user_id = (select auth.uid()));

create policy data_deletion_requests_insert on public.data_deletion_requests
  for insert to public
  with check (is_super_admin() OR user_id = (select auth.uid()));

create policy data_deletion_requests_update on public.data_deletion_requests
  for update to public
  using (is_super_admin())
  with check (is_super_admin());

create policy data_deletion_requests_delete on public.data_deletion_requests
  for delete to public
  using (is_super_admin());


drop policy if exists data_export_admin_all on public.data_export_requests;
drop policy if exists data_export_user_select on public.data_export_requests;
drop policy if exists data_export_user_insert on public.data_export_requests;

create policy data_export_requests_select on public.data_export_requests
  for select to public
  using (is_super_admin() OR user_id = (select auth.uid()));

create policy data_export_requests_insert on public.data_export_requests
  for insert to public
  with check (is_super_admin() OR user_id = (select auth.uid()));

create policy data_export_requests_update on public.data_export_requests
  for update to public
  using (is_super_admin())
  with check (is_super_admin());

create policy data_export_requests_delete on public.data_export_requests
  for delete to public
  using (is_super_admin());;
