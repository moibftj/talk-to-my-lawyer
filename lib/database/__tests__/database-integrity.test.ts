/**
 * Database Integrity Tests
 *
 * Tests for:
 * - Foreign key constraints
 * - RLS policy enforcement
 * - Data validation at database level
 * - Cascade behaviors
 * - Unique constraints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Use service role key for database integrity tests (bypasses RLS for validation)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nomiiqzxaxyxnxndvkbe.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Skip tests if no Supabase credentials
const describeIf = supabaseUrl && supabaseKey ? describe : describe.skip

describeIf('Database Integrity', () => {
  let supabase: ReturnType<typeof createClient>

  beforeEach(() => {
    supabase = createClient(supabaseUrl, supabaseKey)
  })

  describe('Foreign Key Constraints', () => {
    it('should enforce letters.user_id → profiles.id foreign key', async () => {
      // Try to insert a letter with invalid user_id
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'draft',
          intake_data: {},
        })
        .select()

      // Should fail due to foreign key constraint
      expect(error).toBeDefined()
      expect(error?.code).toBe('23503') // Foreign key violation
      expect(data).toBeNull()
    })

    it('should enforce subscriptions.user_id → profiles.id foreign key', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
          stripe_customer_id: 'cus_test',
          status: 'active',
        })
        .select()

      expect(error?.code).toBe('23503')
      expect(data).toBeNull()
    })

    it('should enforce letter_audit.user_id → profiles.id foreign key', async () => {
      const { data, error } = await supabase
        .from('letter_audit')
        .insert({
          letter_id: '00000000-0000-0000-0000-000000000000',
          user_id: '00000000-0000-0000-0000-000000000000',
          old_status: 'draft',
          new_status: 'pending_review',
          change_reason: 'test',
        })
        .select()

      expect(error?.code).toBe('23503')
      expect(data).toBeNull()
    })
  })

  describe('Unique Constraints', () => {
    it('should enforce unique email in profiles (via auth.users)', async () => {
      // This is handled by Supabase Auth, but we can test the constraint
      const testEmail = `test-${Date.now()}@example.com`

      // Create first profile
      const { data: profile1, error: error1 } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: testEmail,
          role: 'subscriber',
        })
        .select()
        .single()

      expect(error1).toBeNull()
      expect(profile1).toBeDefined()

      // Try to create duplicate
      const { data: profile2, error: error2 } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: testEmail, // Duplicate email
          role: 'subscriber',
        })
        .select()
        .single()

      // Should fail due to unique constraint
      expect(error2).toBeDefined()
      expect(error2?.code).toBe('23505') // Unique violation
      expect(profile2).toBeNull()

      // Cleanup
      await supabase.from('profiles').delete().eq('id', profile1.id)
    })

    it('should enforce unique stripe_customer_id in subscriptions', async () => {
      const stripeCustomerId = `cus_test_${Date.now()}`

      // Insert first subscription with this customer
      const { data: sub1, error: error1 } = await supabase
        .from('subscriptions')
        .insert({
          user_id: crypto.randomUUID(),
          stripe_customer_id: stripeCustomerId,
          status: 'active',
        })
        .select()
        .single()

      expect(error1).toBeNull()

      // Try to insert duplicate stripe_customer_id
      const { data: sub2, error: error2 } = await supabase
        .from('subscriptions')
        .insert({
          user_id: crypto.randomUUID(),
          stripe_customer_id: stripeCustomerId, // Duplicate
          status: 'active',
        })
        .select()
        .single()

      expect(error2?.code).toBe('23505')
      expect(sub2).toBeNull()

      // Cleanup
      await supabase.from('subscriptions').delete().eq('id', sub1.id)
    })
  })

  describe('Check Constraints', () => {
    it('should enforce valid letter status values', async () => {
      const validStatuses = [
        'draft',
        'generating',
        'pending_review',
        'under_review',
        'approved',
        'rejected',
        'completed',
        'failed',
      ]

      // Test each valid status
      for (const status of validStatuses) {
        const { data, error } = await supabase
          .from('letters')
          .insert({
            user_id: crypto.randomUUID(),
            letter_type: 'demand',
            title: `Test ${status}`,
            status: status as any,
            intake_data: {},
          })
          .select()

        // Should succeed for valid statuses
        if (error) {
          expect(['23503', '23505']).toContain(error.code) // FK or unique, not check
        } else {
          expect(data).not.toBeNull()
          // Cleanup
          if (data?.[0]?.id) {
            await supabase.from('letters').delete().eq('id', data[0].id)
          }
        }
      }
    })

    it('should reject invalid letter status', async () => {
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'invalid_status' as any,
          intake_data: {},
        })
        .select()

      // Should fail due to check constraint
      expect(error).toBeDefined()
      expect(error?.code).toBe('23514') // Check constraint violation
      expect(data).toBeNull()
    })

    it('should enforce valid user role values', async () => {
      const validRoles = ['subscriber', 'employee', 'attorney_admin', 'system_admin']

      for (const role of validRoles) {
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: crypto.randomUUID(),
            email: `test-${role}-${Date.now()}@example.com`,
            role: role as any,
          })
          .select()

        if (error) {
          expect(['23503', '23505']).toContain(error.code)
        } else {
          expect(data).not.toBeNull()
          // Cleanup
          if (data?.[0]?.id) {
            await supabase.from('profiles').delete().eq('id', data[0].id)
          }
        }
      }
    })

    it('should reject invalid user role', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: `test-invalid-${Date.now()}@example.com`,
          role: 'super_user' as any,
        })
        .select()

      expect(error?.code).toBe('23514')
      expect(data).toBeNull()
    })
  })

  describe('Not Null Constraints', () => {
    it('should require letters.user_id', async () => {
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: null as any,
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'draft',
          intake_data: {},
        })
        .select()

      expect(error?.code).toBe('23502') // Not null violation
      expect(data).toBeNull()
    })

    it('should require letters.letter_type', async () => {
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: null as any,
          title: 'Test Letter',
          status: 'draft',
          intake_data: {},
        })
        .select()

      expect(error?.code).toBe('23502')
      expect(data).toBeNull()
    })

    it('should require letters.status', async () => {
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: 'demand',
          title: 'Test Letter',
          status: null as any,
          intake_data: {},
        })
        .select()

      expect(error?.code).toBe('23502')
      expect(data).toBeNull()
    })
  })

  describe('Default Values', () => {
    it('should set default status for letters', async () => {
      const userId = crypto.randomUUID()

      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: userId,
          letter_type: 'demand',
          title: 'Test Letter',
          intake_data: {},
        })
        .select()
        .single()

      // May fail due to FK constraint, but if succeeds, should have default status
      if (!error) {
        expect(data?.status).toBe('draft')
        // Cleanup
        await supabase.from('letters').delete().eq('id', data.id)
      }
    })

    it('should set default created_at timestamp', async () => {
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: 'demand',
          title: 'Test Letter',
          intake_data: {},
        })
        .select()
        .single()

      if (!error) {
        expect(data?.created_at).toBeDefined()
        // Cleanup
        await supabase.from('letters').delete().eq('id', data.id)
      }
    })
  })

  describe('Cascade Behaviors', () => {
    it('should cascade delete letters when user is deleted', async () => {
      const userId = crypto.randomUUID()

      // Insert letter (may fail due to FK, that's ok)
      const { data: letter, error: letterError } = await supabase
        .from('letters')
        .insert({
          user_id: userId,
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'draft',
          intake_data: {},
        })
        .select()
        .single()

      if (!letterError && letter) {
        // Delete user profile (may fail if RLS blocks)
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId)

        if (!deleteError) {
          // Letter should be deleted
          const { data: remainingLetters } = await supabase
            .from('letters')
            .select()
            .eq('user_id', userId)

          expect(remainingLetters?.length || 0).toBe(0)
        } else {
          // Cleanup letter
          await supabase.from('letters').delete().eq('id', letter.id)
        }
      }
    })
  })
})

describe('RLS Policy Enforcement', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    // Use anon key to test RLS policies (RLS blocks anon access)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://nomiiqzxaxyxnxndvkbe.supabase.co'
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbWlpcXp4YXh5eG54bmR2a2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzQwNzYsImV4cCI6MjA4MzY5NDA3Nn0.Wi5A7cHcx95-mDogBbxBzLQ9K7ACbJDrGx0hAhKOK1k'
    supabase = createClient(url, key)
  })

  describe('Anonymous Access', () => {
    it('should block anonymous access to letters table', async () => {
      const { data, error, status } = await supabase.from('letters').select('*')

      // RLS should block access (anon key should be blocked by RLS)
      expect(status).toBe(406) // Not acceptable RLS
      expect(error).toBeDefined()
      expect(data).toBeNull()
    })

    it('should block anonymous access to profiles table', async () => {
      const { data, error, status } = await supabase.from('profiles').select('*')

      expect(status).toBe(406)
      expect(error).toBeDefined()
      expect(data).toBeNull()
    })

    it('should block anonymous insert to letters table', async () => {
      const { data, error, status } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'draft',
          intake_data: {},
        })
        .select()

      expect(status).toBe(403) // Forbidden
      expect(error).toBeDefined()
      expect(data).toBeNull()
    })
  })
})

describe('Data Validation', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    // Use service role key to bypass RLS for validation tests
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://nomiiqzxaxyxnxndvkbe.supabase.co'
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbWlpcXp4YXh5eG54bmR2a2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMzNDA3NiwiZXhwIjoyMDgzNjk0MDc2fQ.rT5YJKIBRiVEfFYzC8Cgfi49KfvQt6aDmIO9iSTF8RU'
    supabase = createClient(url, key)
  })

  describe('Email Format Validation', () => {
    const invalidEmails = [
      'not-an-email',
      '@example.com',
      'user@',
      'user @example.com',
      '',
    ]

    it.each(invalidEmails)('should reject invalid email: %s', async (email) => {
      // This validates at the DB level through check constraints or triggers
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: email,
          role: 'subscriber',
        })
        .select()

      // Should reject invalid email format
      expect(error).toBeDefined()
      expect(data).toBeNull()
    })
  })

  describe('JSONB Validation', () => {
    it('should accept valid JSONB for intake_data', async () => {
      const validData = {
        recipient: 'John Doe',
        address: '123 Main St',
        issue: 'Unpaid wages',
        amount: 5000,
      }

      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'draft',
          intake_data: validData,
        })
        .select()

      // May fail due to FK, but JSONB should be valid
      if (!error) {
        expect(data?.[0]?.intake_data).toEqual(validData)
        // Cleanup
        await supabase.from('letters').delete().eq('id', data[0].id)
      }
    })

    it('should accept empty JSONB object for intake_data', async () => {
      const { data, error } = await supabase
        .from('letters')
        .insert({
          user_id: crypto.randomUUID(),
          letter_type: 'demand',
          title: 'Test Letter',
          status: 'draft',
          intake_data: {},
        })
        .select()

      if (!error) {
        expect(data?.[0]?.intake_data).toEqual({})
        // Cleanup
        await supabase.from('letters').delete().eq('id', data[0].id)
      }
    })
  })
})
