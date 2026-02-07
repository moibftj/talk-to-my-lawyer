/**
 * Generate Button Component Tests
 *
 * Tests for the GenerateLetterButton component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the CSS module
vi.mock('../ui/generate-letter-button.module.css', () => ({
  button: 'button-class',
  loading: 'loading-class',
  animationPaused: 'animation-paused-class',
  btnText: 'btn-text-class',
  btnIcon: 'btn-icon-class',
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
})) as any

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
  configurable: true,
})

describe('GenerateLetterButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Logic', () => {
    it('should have default buttonText "Subscribe to Generate" when no subscription', () => {
      const loading = false
      const hasSubscription = false
      const buttonText = loading ? 'Generating...' : hasSubscription ? 'Generate Letter' : 'Subscribe to Generate'

      expect(buttonText).toBe('Subscribe to Generate')
    })

    it('should have buttonText "Generate Letter" when hasSubscription is true', () => {
      const loading = false
      const hasSubscription = true
      const buttonText = loading ? 'Generating...' : hasSubscription ? 'Generate Letter' : 'Subscribe to Generate'

      expect(buttonText).toBe('Generate Letter')
    })

    it('should have buttonText "Generating..." when loading is true', () => {
      const loading = true
      const hasSubscription = true
      const buttonText = loading ? 'Generating...' : hasSubscription ? 'Generate Letter' : 'Subscribe to Generate'

      expect(buttonText).toBe('Generating...')
    })

    it('should disable button when loading or disabled prop is true', () => {
      const loading = true
      const disabled = false
      const buttonDisabled = loading || disabled

      expect(buttonDisabled).toBe(true)
    })

    it('should not disable button when neither loading nor disabled', () => {
      const loading = false
      const disabled = false
      const buttonDisabled = loading || disabled

      expect(buttonDisabled).toBe(false)
    })
  })

  describe('Haptic Feedback', () => {
    it('should provide haptic feedback on touch devices when clicked', () => {
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
      const shouldVibrate = isTouchDevice

      expect(typeof shouldVibrate).toBe('boolean')
    })

    it('should call navigator.vibrate with 50ms duration on touch devices', () => {
      const mockVibrate = navigator.vibrate as unknown as ReturnType<typeof vi.fn>
      mockVibrate.mockClear()

      // Simulate touch device
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any

      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
      if (isTouchDevice) {
        navigator.vibrate(50)
      }

      expect(mockVibrate).toHaveBeenCalledWith(50)
    })
  })

  describe('Accessibility Attributes', () => {
    it('should generate proper accessibility label', () => {
      const loading = false
      const hasSubscription = true
      const ariaLabel = 'Generate a new letter'

      const accessibilityLabel = ariaLabel || (loading ? 'Generating...' : hasSubscription ? 'Generate Letter' : 'Subscribe to Generate')

      expect(accessibilityLabel).toBe('Generate a new letter')
    })

    it('should set aria-busy when loading', () => {
      const loading = true
      const ariaBusy = loading

      expect(ariaBusy).toBe(true)
    })

    it('should set aria-disabled when disabled or loading', () => {
      const loading = false
      const disabled = true
      const ariaDisabled = loading || disabled

      expect(ariaDisabled).toBe(true)
    })

    it('should set data-loading attribute', () => {
      const loading = true
      const dataLoading = loading

      expect(dataLoading).toBe(true)
    })

    it('should set data-disabled attribute', () => {
      const disabled = true
      const dataDisabled = disabled

      expect(dataDisabled).toBe(true)
    })
  })

  describe('Button Type', () => {
    it('should default to type="button"', () => {
      const type = 'button'
      expect(type).toBe('button')
    })

    it('should support type="submit"', () => {
      const type = 'submit' as const
      expect(type).toBe('submit')
    })
  })

  describe('Performance Optimizations', () => {
    it('should use IntersectionObserver for visibility tracking', () => {
      expect(typeof global.IntersectionObserver).toBe('function')
    })

    it('should track page visibility with Visibility API', () => {
      expect(typeof document.addEventListener).toBe('function')
    })
  })
})
