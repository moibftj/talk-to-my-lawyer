drop policy if exists commissions_admin_all on public.commissions;
drop policy if exists commissions_employee_select on public.commissions;

create policy commissions_select on public.commissions
  for select to public
  using (is_super_admin() OR (employee_id = (select auth.uid()) AND is_employee()));

create policy commissions_insert on public.commissions
  for insert to public
  with check (is_super_admin());

create policy commissions_update on public.commissions
  for update to public
  using (is_super_admin())
  with check (is_super_admin());

create policy commissions_delete on public.commissions
  for delete to public
  using (is_super_admin());;
