drop policy if exists letters_super_admin_all on public.letters;
drop policy if exists letters_subscriber_delete on public.letters;
drop policy if exists letters_subscriber_insert on public.letters;
drop policy if exists letters_attorney_select on public.letters;
drop policy if exists letters_subscriber_select on public.letters;
drop policy if exists letters_attorney_update on public.letters;
drop policy if exists letters_subscriber_update on public.letters;

create policy letters_select on public.letters
  for select to public
  using (
    is_super_admin()
    OR is_attorney_admin()
    OR (
      user_id = (select auth.uid())
      AND exists (
        select 1 from profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'subscriber'::user_role
      )
    )
  );

create policy letters_insert on public.letters
  for insert to public
  with check (
    is_super_admin()
    OR (
      user_id = (select auth.uid())
      AND exists (
        select 1 from profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'subscriber'::user_role
      )
    )
  );

create policy letters_update on public.letters
  for update to public
  using (
    is_super_admin()
    OR is_attorney_admin()
    OR (
      user_id = (select auth.uid())
      AND exists (
        select 1 from profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'subscriber'::user_role
      )
    )
  )
  with check (
    is_super_admin()
    OR is_attorney_admin()
    OR (
      user_id = (select auth.uid())
      AND exists (
        select 1 from profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'subscriber'::user_role
      )
    )
  );

create policy letters_delete on public.letters
  for delete to public
  using (
    is_super_admin()
    OR (
      user_id = (select auth.uid())
      AND exists (
        select 1 from profiles
        where profiles.id = (select auth.uid())
          and profiles.role = 'subscriber'::user_role
      )
      AND status = 'draft'::letter_status
    )
  );;
