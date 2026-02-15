-- Migration: Fix service_role RLS policies for N8N workflow integration
-- Date: 2026-02-15
-- Description: Add missing SELECT and INSERT policies for service_role on letters and profiles tables.
-- The service_role needs these policies because relforcerowsecurity=true is enabled,
-- which means even the service_role is subject to RLS policies.
-- Without these policies, N8N workflows using the service role key cannot read or update letters.

-- ============================================================================
-- Letters table: Add service_role SELECT and INSERT policies
-- ============================================================================

-- Allow service_role to SELECT any letter (needed for N8N to find letters by ID)
CREATE POLICY IF NOT EXISTS letters_service_role_select
  ON letters
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to INSERT letters (needed for potential N8N letter creation)
CREATE POLICY IF NOT EXISTS letters_service_role_insert
  ON letters
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================================
-- Profiles table: Add service_role SELECT and UPDATE policies
-- ============================================================================

-- Allow service_role to SELECT any profile (needed for N8N PDF workflow to fetch user profiles)
CREATE POLICY IF NOT EXISTS profiles_service_role_select
  ON profiles
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to UPDATE any profile (needed for admin operations)
CREATE POLICY IF NOT EXISTS profiles_service_role_update
  ON profiles
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Verify policies
-- ============================================================================
-- Run this query to verify:
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename IN ('letters', 'profiles') ORDER BY tablename, policyname;
