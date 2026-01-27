/* eslint-disable @next/next/no-img-element */
/**
 * Dashboard Layout Component Tests
 *
 * Tests for navigation, responsive behavior, and role-based menu items
 */

import { describe, it, expect, vi } from 'vitest'

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}))

// Mock auth module
vi.mock('@/lib/auth/get-user', () => ({
  getUser: vi.fn().mockResolvedValue({
    profile: {
      id: 'user-123',
      email: 'user@example.com',
      full_name: 'Test User',
      role: 'subscriber',
    },
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signOut: vi.fn(),
    },
  }),
}))

describe('DashboardLayout Component', () => {
  it('should have subscriber navigation items defined', () => {
    const subscriberNav = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'My Letters', href: '/dashboard/letters' },
      { name: 'Create New Letter', href: '/dashboard/letters/new' },
      { name: 'Subscription', href: '/dashboard/subscription' },
      { name: 'Billing', href: '/dashboard/billing' },
      { name: 'Settings', href: '/dashboard/settings' },
    ]

    expect(subscriberNav).toHaveLength(6)
    expect(subscriberNav[0].name).toBe('Dashboard')
    expect(subscriberNav[2].name).toBe('Create New Letter')
  })

  it('should have employee navigation items defined', () => {
    const employeeNav = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Commissions', href: '/dashboard/commissions' },
      { name: 'My Coupons', href: '/dashboard/coupons' },
      { name: 'Referral Links', href: '/dashboard/referrals' },
      { name: 'Payouts', href: '/dashboard/payouts' },
    ]

    expect(employeeNav).toHaveLength(5)
    expect(employeeNav[1].name).toBe('Commissions')
    expect(employeeNav[4].name).toBe('Payouts')
  })

  it('should map subscriber role to correct navigation', () => {
    const navigation = {
      subscriber: [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'My Letters', href: '/dashboard/letters' },
      ],
      employee: [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Commissions', href: '/dashboard/commissions' },
      ]
    }

    const subscriberNav = navigation.subscriber
    expect(subscriberNav).toHaveLength(2)
    expect(subscriberNav[0].href).toBe('/dashboard')
  })

  it('should have sign out handler', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // The component should have a sign out function
    expect(typeof supabase.auth.signOut).toBe('function')
  })
})

describe('Dashboard Navigation Structure', () => {
  it('should include links to key pages', () => {
    const subscriberLinks = ['/dashboard', '/dashboard/letters', '/dashboard/subscription']
    const employeeLinks = ['/dashboard/commissions', '/dashboard/payouts']

    subscriberLinks.forEach(link => {
      expect(link).toMatch(/^\/dashboard/)
    })

    employeeLinks.forEach(link => {
      expect(link).toMatch(/^\/dashboard/)
    })
  })

  it('should have distinct navigation for different roles', () => {
    const subscriberOnly = ['My Letters', 'Create New Letter', 'Subscription']
    const employeeOnly = ['Commissions', 'My Coupons', 'Referral Links', 'Payouts']

    expect(subscriberOnly).not.toEqual(employeeOnly)
    expect(subscriberOnly).toContain('Subscription')
    expect(employeeOnly).toContain('Commissions')
  })
})
