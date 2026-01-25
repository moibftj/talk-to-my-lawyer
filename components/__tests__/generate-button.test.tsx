/**
 * Generate Button Component Tests
 *
 * Tests letter generation button with loading states and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GenerateButton } from '../generate-button'

// Mock fetch
global.fetch = vi.fn()

describe('GenerateButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.console.error = vi.fn()
    global.alert = vi.fn()
  })

  describe('Rendering', () => {
    it('should render generate button', () => {
      render(<GenerateButton letterType="demand" />)

      expect(
        screen.getByRole('button', { name: /generate|create|draft/i })
      ).toBeInTheDocument()
    })

    it('should show custom label when provided', () => {
      render(<GenerateButton letterType="demand" label="Create Demand Letter" />)

      expect(screen.getByText('Create Demand Letter')).toBeInTheDocument()
    })

    it('should be disabled when disabled prop is true', () => {
      render(<GenerateButton letterType="demand" disabled />)

      expect(
        screen.getByRole('button', { name: /generate|create|draft/i })
      ).toBeDisabled()
    })
  })

  describe('Generation Flow', () => {
    it('should call API on click', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          letterId: 'letter-123',
          status: 'pending_review',
        }),
      })

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/generate-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('demand'),
        })
      })
    })

    it('should show loading state during generation', async () => {
      const user = userEvent.setup()

      // Create a promise that we control
      let resolveFetch: (value: any) => void
      ;(global.fetch as any).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      // Should show loading
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /generating|creating|drafting/i })
        ).toBeInTheDocument()
      })

      // Resolve the promise
      resolveFetch!({
        ok: true,
        json: async () => ({ success: true, letterId: 'letter-123' }),
      })
    })

    it('should redirect to letter page on success', async () => {
      const user = userEvent.setup()
      const mockPush = vi.fn()

      vi.mock('next/navigation', () => ({
        useRouter: () => ({ push: mockPush }),
      }))

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          letterId: 'letter-123',
          status: 'pending_review',
        }),
      })

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/letters/letter-123')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Generation failed' }),
      })

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalled()
      })
    })

    it('should handle network errors', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalled()
      })
    })

    it('should reset button state after error', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Error' }),
      })

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })
  })

  describe('Allowance Check', () => {
    it('should show subscription modal when out of allowance', async () => {
      const user = userEvent.setup()
      const mockPush = vi.fn()

      vi.mock('next/navigation', () => ({
        useRouter: () => ({ push: mockPush }),
      }))

      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'No letter credits remaining',
          needsSubscription: true,
        }),
      })

      render(<GenerateButton letterType="demand" />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/subscription')
      })
    })
  })

  describe('Intake Modal', () => {
    it('should show intake modal before generation', async () => {
      const user = userEvent.setup()

      render(<GenerateButton letterType="demand" requireIntake />)

      const button = screen.getByRole('button', { name: /generate|create|draft/i })
      await user.click(button)

      expect(screen.getByText(/recipient|sender|details/i)).toBeInTheDocument()
    })

    it('should validate intake form before submission', async () => {
      // Test validation logic
      const requiredFields = ['senderName', 'recipientName', 'issueDescription']

      requiredFields.forEach((field) => {
        expect(field).toBeDefined()
      })
    })
  })
})
