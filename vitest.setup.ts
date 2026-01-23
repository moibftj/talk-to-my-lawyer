import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi, beforeEach } from 'vitest'

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

  // Mock environment variables
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.OPENAI_API_KEY = 'test-openai-key'
  process.env.STRIPE_SECRET_KEY = 'test-stripe-key'
  process.env.STRIPE_PUBLISHABLE_KEY = 'test-stripe-pub-key'
  process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret'
  process.env.ADMIN_PORTAL_KEY = 'test-admin-portal-key'
  process.env.CRON_SECRET = 'test-cron-secret'
  process.env.RESEND_API_KEY = 'test-resend-key'
  process.env.EMAIL_FROM = 'test@example.com'
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
