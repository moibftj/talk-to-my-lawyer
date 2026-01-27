drop policy if exists payout_requests_admin_all on public.payout_requests;
drop policy if exists payout_requests_employee_insert on public.payout_requests;
drop policy if exists payout_requests_employee_select on public.payout_requests;

create policy payout_requests_select on public.payout_requests
  for select to public
  using (is_super_admin() OR (employee_id = (select auth.uid()) AND is_employee()));

create policy payout_requests_insert on public.payout_requests
  for insert to public
  with check (is_super_admin() OR (employee_id = (select auth.uid()) AND is_employee()));

create policy payout_requests_update on public.payout_requests
  for update to public
  using (is_super_admin())
  with check (is_super_admin());

create policy payout_requests_delete on public.payout_requests
  for delete to public
  using (is_super_admin());;
