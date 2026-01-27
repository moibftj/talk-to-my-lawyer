drop policy if exists coupon_usage_admin_select on public.coupon_usage;
drop policy if exists coupon_usage_employee_select on public.coupon_usage;
drop policy if exists coupon_usage_user_select on public.coupon_usage;
drop policy if exists coupon_usage_service_insert on public.coupon_usage;

create policy coupon_usage_select on public.coupon_usage
  for select to public
  using (
    is_super_admin()
    OR (employee_id = (select auth.uid()) AND is_employee())
    OR user_id = (select auth.uid())
  );

create policy coupon_usage_service_insert on public.coupon_usage
  for insert to public
  with check ((select auth.role()) = 'service_role'::text);;
