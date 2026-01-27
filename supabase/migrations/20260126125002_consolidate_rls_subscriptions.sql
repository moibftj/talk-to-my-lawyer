drop policy if exists subscriptions_admin_all on public.subscriptions;
drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_insert_own on public.subscriptions;
drop policy if exists subscriptions_update_own on public.subscriptions;

create policy subscriptions_select on public.subscriptions
  for select to public
  using (is_super_admin() OR user_id = (select auth.uid()));

create policy subscriptions_insert on public.subscriptions
  for insert to public
  with check (is_super_admin() OR user_id = (select auth.uid()));

create policy subscriptions_update on public.subscriptions
  for update to public
  using (is_super_admin() OR user_id = (select auth.uid()))
  with check (is_super_admin() OR user_id = (select auth.uid()));

create policy subscriptions_delete on public.subscriptions
  for delete to public
  using (is_super_admin());;
