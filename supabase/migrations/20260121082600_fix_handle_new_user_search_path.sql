/*
  Migration: fix_handle_new_user_search_path
  Description: Fixes the handle_new_user trigger function to include proper search_path
               so the user_role enum type is visible when the trigger runs in auth schema context.
  
  Issue: "type user_role does not exist" error during signup
  Root cause: Trigger runs in auth schema context where public.user_role type isn't visible
  Fix: Add SET search_path = public to function definition
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert profile with RLS bypassed and proper type casting
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role, 
      'subscriber'::public.user_role
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;;
