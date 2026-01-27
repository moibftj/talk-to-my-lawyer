-- privacy_policy_acceptances
 drop policy if exists privacy_policy_admin_select on public.privacy_policy_acceptances;
 drop policy if exists privacy_policy_user_select on public.privacy_policy_acceptances;
 drop policy if exists privacy_policy_user_insert on public.privacy_policy_acceptances;

 create policy privacy_policy_acceptances_select on public.privacy_policy_acceptances
   for select to public
   using (is_super_admin() OR user_id = (select auth.uid()));

 create policy privacy_policy_acceptances_insert on public.privacy_policy_acceptances
   for insert to public
   with check (user_id = (select auth.uid()));

-- promotional_code_usage
 drop policy if exists "Admins can view all promo usage" on public.promotional_code_usage;
 drop policy if exists "Users can view own promo usage" on public.promotional_code_usage;
 drop policy if exists "System can insert promo usage" on public.promotional_code_usage;

 create policy promotional_code_usage_select on public.promotional_code_usage
   for select to authenticated
   using (get_user_role() = 'admin'::text OR user_id = (select auth.uid()));

 create policy promotional_code_usage_insert on public.promotional_code_usage
   for insert to authenticated
   with check (((select auth.uid()) = user_id) OR (get_user_role() = 'admin'::text));;
