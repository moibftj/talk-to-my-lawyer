import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi, beforeEach, beforeAll } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js environment
beforeEach(() => {
  // Mock Next.js navigation
  vi.mock('next/navigation', () => ({
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: '/',
      query: {},
    }),
    useSearchParams: () => ({
      get: vi.fn(),
    }),
    usePathname: () => '/',
  }))

  // Set environment variables for tests (use real credentials for integration tests)
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://app.talk-to-my-lawyer.com'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbWlpcXp4YXh5eG54bmR2a2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzQwNzYsImV4cCI6MjA4MzY5NDA3Nn0.Wi5A7cHcx95-mDogBbxBzLQ9K7ACbJDrGx0hAhKOK1k'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbWlpcXp4YXh5eG54bmR2a2JlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMzNDA3NiwiZXhwIjoyMDgzNjk0MDc2fQ.rT5YJKIBRiVEfFYzC8Cgfi49KfvQt6aDmIO9iSTF8RU'
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key'
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'test-stripe-key'
  process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'test-stripe-pub-key'
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'test-webhook-secret'
  process.env.ADMIN_PORTAL_KEY = process.env.ADMIN_PORTAL_KEY || 'test-admin-portal-key'
  process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret'
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-resend-key'
  process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'test@example.com'
})

// Suppress console errors in tests unless debugging
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : String(args[0])
    // Only suppress certain expected errors
    if (
      !message.includes('Warning: ReactDOM.render') &&
      !message.includes('Warning: useLayoutEffect') &&
      !message.includes('Not implemented:')
    ) {
      originalError(...args)
    }
  }
  console.warn = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : String(args[0])
    if (!message.includes('componentWillReceiveProps')) {
      originalWarn(...args)
    }
  }
})
