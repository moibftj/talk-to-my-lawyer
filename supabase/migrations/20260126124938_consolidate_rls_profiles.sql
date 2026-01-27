drop policy if exists profiles_admin_select on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;

create policy profiles_select on public.profiles
  for select to public
  using (is_super_admin() OR id = (select auth.uid()));

create policy profiles_insert on public.profiles
  for insert to public
  with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to public
  using (is_super_admin() OR id = (select auth.uid()))
  with check (is_super_admin() OR id = (select auth.uid()));;
