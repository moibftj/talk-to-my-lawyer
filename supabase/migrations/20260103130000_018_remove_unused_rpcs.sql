/*
  Migration: Remove unused RPC functions
  
  Removes get_letters_for_review and update_letter_review functions
  as they are unused - letter review is handled directly in API routes.
*/

-- Drop unused functions
DROP FUNCTION IF EXISTS public.get_letters_for_review();
DROP FUNCTION IF EXISTS public.update_letter_review(UUID, TEXT, TEXT, TEXT);
