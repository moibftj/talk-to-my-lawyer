alter policy "Users can view own promo usage" on public.promotional_code_usage
  using ((select auth.uid()) = user_id);

alter policy "System can insert promo usage" on public.promotional_code_usage
  with check (((select auth.uid()) = user_id) OR (get_user_role() = 'admin'::text));;
