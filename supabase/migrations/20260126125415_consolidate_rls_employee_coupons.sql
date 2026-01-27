drop policy if exists employee_coupons_admin_all on public.employee_coupons;
drop policy if exists employee_coupons_employee_insert on public.employee_coupons;
drop policy if exists employee_coupons_employee_select on public.employee_coupons;
drop policy if exists employee_coupons_public_validate on public.employee_coupons;

create policy employee_coupons_select on public.employee_coupons
  for select to public
  using (
    is_super_admin()
    OR (employee_id = (select auth.uid()) AND is_employee())
    OR is_active = true
  );

create policy employee_coupons_insert on public.employee_coupons
  for insert to public
  with check (is_super_admin() OR (employee_id = (select auth.uid()) AND is_employee()));

create policy employee_coupons_update on public.employee_coupons
  for update to public
  using (is_super_admin())
  with check (is_super_admin());

create policy employee_coupons_delete on public.employee_coupons
  for delete to public
  using (is_super_admin());;
