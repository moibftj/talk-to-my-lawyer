# Supabase Project & Repository Review Report

This report provides a comprehensive analysis of the **Talk-To-My-Lawyer** repository and its alignment with the Supabase project **Main** (Reference: `nomiiqzxaxyxnxndvkbe`).

## 1. Executive Summary

The repository contains two sets of SQL files: `scripts/` and `supabase/migrations/`. While they share a common foundation, there are significant discrepancies in how they handle core features like **Letter Allowances**, **Admin Roles**, and **Coupon Management**. The live Supabase project is currently in a state that reflects a mix of these two sources, leading to potential data conflicts and logic errors in the application.

---

## 2. Key Findings & Conflicts

### A. Data Model Discrepancies
The `profiles` and `subscriptions` tables have inconsistent column definitions across different files and the live database.

| Table | Local Script/Migration | Live Database (nomi) | Conflict/Issue |
| :--- | :--- | :--- | :--- |
| `profiles` | `is_super_user` (removed in migration 011) | **Missing** | Some scripts still attempt to use `is_super_user`. |
| `profiles` | `total_letters_generated` (Script 021) | **Missing** | Feature exists in scripts but not deployed to Supabase. |
| `profiles` | `is_licensed_attorney` (Script 019) | **Missing** | Feature exists in scripts but not deployed to Supabase. |
| `subscriptions` | `letters_allowed` / `letters_used` | `remaining_letters` / `credits_remaining` | Migration 011 uses `letters_allowed`, but the DB uses `remaining_letters`. |

### B. Duplicate & Overlapping SQL Files
There is significant overlap between the `scripts/` folder and the `supabase/migrations/` folder.

*   **Core Schema:** Both `scripts/001_setup_schema.sql` and `supabase/migrations/20251214022657_001_core_schema.sql` define the base tables but with slight variations in constraints and default values.
*   **Coupon Logic:** `scripts/023_fix_employee_coupons.sql` and `supabase/migrations/20251227000000_fix_employee_coupons.sql` are **identical in content** but exist in two places.
*   **Promo Codes:** `scripts/012_add_promo_coupons.sql` and `scripts/012_add_promo_coupons_fixed.sql` are duplicates where the "fixed" version should be the only one kept.

### C. Logic Conflicts in Functions
The `deduct_letter_allowance` function has three different implementations:
1.  **Standard:** Simple deduction.
2.  **SuperUser Bypass:** Checks for `is_super_user` (which no longer exists in the schema).
3.  **Atomic (Script 022):** Uses `FOR UPDATE` for race condition prevention.
**Current State:** The live database is using a version that still references `is_super_user`, which will cause errors since the column was dropped.

---

## 3. Detailed Analysis of "nomi" Project State

The project `nomiiqzxaxyxnxndvkbe` has 18 migrations applied. Notable observations:
*   **Redundant Migrations:** Version `20260103003709` and `20260103003754` both attempt to run `001_core_schema`.
*   **Missing Columns:** Several columns defined in the `scripts/` directory (like `total_letters_generated`) are missing from the live schema.
*   **Admin Role:** The `admin_role_separation` (Migration 013) is correctly applied, but the helper functions might conflict with older scripts if they are re-run.

---

## 4. Recommendations for Alignment

To bring the repository and Supabase project into complete alignment, the following steps are recommended:

### 1. Consolidate SQL Sources
*   **Deprecate `scripts/*.sql`:** Move all unique logic from the `scripts/` folder into the `supabase/migrations/` folder using proper timestamped prefixes.
*   **Remove Duplicates:** Delete `scripts/012_add_promo_coupons.sql` (keep the fixed version) and ensure only one version of the core schema exists.

### 2. Fix Schema Inconsistencies
*   **Standardize Subscriptions:** Update all functions to use `remaining_letters` and `credits_remaining` consistently. Remove references to `letters_allowed` and `letters_used` unless you intend to migrate the schema to those names.
*   **Deploy Missing Columns:** Run a new migration to add `total_letters_generated` and `is_licensed_attorney` to the `profiles` table.

### 3. Update Critical Functions
*   **Atomic Deduction:** Deploy the version of `deduct_letter_allowance` from `scripts/022_fix_deduct_letter_allowance.sql` but **remove** the `is_super_user` check to match the current schema.

### 4. Cleanup Supabase Migrations
*   The `supabase_migrations.schema_migrations` table shows some "dirty" or redundant entries. It is recommended to verify the local migration files match the applied versions exactly to prevent future deployment failures.

---

## 5. Conclusion

The app structure is generally sound, but the database layer is fragmented between two different management styles (manual scripts vs. Supabase migrations). By consolidating all SQL into the `supabase/migrations` directory and standardizing the column names for letter tracking, you will eliminate the current data conflicts and ensure the project is production-ready.
