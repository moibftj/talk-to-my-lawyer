/**
 * Letter Actions Component Tests
 *
 * Tests UI interactions for letter actions:
 * - Submit for review
 * - Delete letter
 * - Download PDF
 * - Send via email
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LetterActions } from '../letter-actions'

// Mock Next.js router
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
    },
  }),
}))

// Mock jsPDF
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => ({
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn(() => ['line1', 'line2']),
    addPage: vi.fn(),
    setPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    save: vi.fn(),
  })),
}))

// Mock fetch
global.fetch = vi.fn()

describe('LetterActions Component', () => {
  const mockLetter = {
    id: 'letter-123',
    user_id: 'user-123',
    title: 'Test Letter',
    letter_type: 'demand',
    status: 'draft',
    intake_data: {},
    created_at: '2025-01-25T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.console.error = vi.fn()
    // Mock window.alert for happy-dom
    const alertMock = vi.fn()
    global.alert = alertMock
    Object.defineProperty(window, 'alert', {
      value: alertMock,
      writable: true,
      configurable: true,
    })
  })

  describe('Draft Letter Actions', () => {
    it('should render submit button for draft letters', () => {
      render(<LetterActions letter={{ ...mockLetter, status: 'draft' }} />)

      expect(
        screen.getByRole('button', { name: /submit for attorney approval/i })
      ).toBeInTheDocument()
    })

    it('should not show download or email buttons for draft letters', () => {
      render(<LetterActions letter={{ ...mockLetter, status: 'draft' }} />)

      expect(
        screen.queryByRole('button', { name: /download pdf/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /send via email/i })
      ).not.toBeInTheDocument()
    })

    it('should submit letter for review successfully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<LetterActions letter={{ ...mockLetter, status: 'draft' }} />)

      const submitButton = screen.getByRole('button', {
        name: /submit for attorney approval/i,
      })

      await user.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/letters/letter-123/submit',
          { method: 'POST' }
        )
        expect(mockRefresh).toHaveBeenCalled()
        expect(global.alert).toHaveBeenCalledWith(
          'Letter submitted for attorney approval.'
        )
      })
    })

    it('should redirect to subscription page when out of letters', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'No letters remaining', needsSubscription: true }),
      })

      render(<LetterActions letter={{ ...mockLetter, status: 'draft' }} />)

      const submitButton = screen.getByRole('button', {
        name: /submit for attorney approval/i,
      })

      await user.click(submitButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/subscription')
      })
    })
  })

  describe('Approved Letter Actions', () => {
    it('should render download PDF button for approved letters', () => {
      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      expect(
        screen.getByRole('button', { name: /download pdf/i })
      ).toBeInTheDocument()
    })

    it('should render send via email button for approved letters', () => {
      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      expect(
        screen.getByRole('button', { name: /send via email/i })
      ).toBeInTheDocument()
    })

    it('should not show submit button for approved letters', () => {
      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      expect(
        screen.queryByRole('button', { name: /submit for attorney approval/i })
      ).not.toBeInTheDocument()
    })

    it('should download PDF successfully', async () => {
      const user = userEvent.setup()

      render(
        <LetterActions
          letter={{
            ...mockLetter,
            status: 'approved',
            final_content: 'Test letter content',
          }}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /download pdf/i })
      await user.click(downloadButton)

      // jsPDF should be imported and called
      await waitFor(() => {
        expect(global.alert).not.toHaveBeenCalled()
      })
    })
  })

  describe('Delete Letter Actions', () => {
    const deletableStatuses = ['draft', 'rejected', 'failed']

    deletableStatuses.forEach((status) => {
      it(`should show delete button for ${status} letters`, () => {
        render(
          <LetterActions
            letter={{ ...mockLetter, status: status as any }}
          />
        )

        expect(
          screen.getByRole('button', { name: /delete/i })
        ).toBeInTheDocument()
      })
    })

    it('should not show delete button for approved letters', () => {
      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      expect(
        screen.queryByRole('button', { name: /delete/i })
      ).not.toBeInTheDocument()
    })

    it('should show confirmation dialog before deletion', async () => {
      const user = userEvent.setup()

      render(
        <LetterActions letter={{ ...mockLetter, status: 'draft' }} />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      // Check for dialog content
      expect(
        screen.getByText(/delete letter\?/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/this will permanently delete/i)
      ).toBeInTheDocument()
    })

    it('should delete letter after confirmation', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(
        <LetterActions letter={{ ...mockLetter, status: 'draft', title: 'My Letter' }} />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /^delete letter$/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/letters/letter-123/delete',
          { method: 'DELETE' }
        )
        expect(mockPush).toHaveBeenCalledWith('/dashboard/letters')
      })
    })
  })

  describe('Send Email Modal', () => {
    it('should open email modal when button clicked', async () => {
      const user = userEvent.setup()

      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      const emailButton = screen.getByRole('button', { name: /send via email/i })
      await user.click(emailButton)

      expect(
        screen.getByText(/send letter via email/i)
      ).toBeInTheDocument()
      expect(
        screen.getByLabelText(/recipient email/i)
      ).toBeInTheDocument()
    })

    it('should require recipient email', async () => {
      const user = userEvent.setup()

      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      const emailButton = screen.getByRole('button', { name: /send via email/i })
      await user.click(emailButton)

      const sendButton = screen.getByRole('button', { name: /^send email$/i })
      await user.click(sendButton)

      expect(global.alert).toHaveBeenCalledWith('Please enter recipient email')
    })

    it('should send email successfully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Email sent successfully' }),
      })

      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      const emailButton = screen.getByRole('button', { name: /send via email/i })
      await user.click(emailButton)

      const emailInput = screen.getByLabelText(/recipient email/i)
      await user.type(emailInput, 'recipient@example.com')

      const sendButton = screen.getByRole('button', { name: /^send email$/i })
      await user.click(sendButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/letters/letter-123/send-email',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: 'recipient@example.com',
              message: '',
            }),
          }
        )
        expect(global.alert).toHaveBeenCalledWith('Email sent successfully!')
      })
    })

    it('should close modal on cancel', async () => {
      const user = userEvent.setup()

      render(<LetterActions letter={{ ...mockLetter, status: 'approved' }} />)

      const emailButton = screen.getByRole('button', { name: /send via email/i })
      await user.click(emailButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Modal should be closed (title not visible)
      expect(
        screen.queryByText(/send letter via email/i)
      ).not.toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should show loading state during submit', async () => {
      const user = userEvent.setup()
      let resolveFetch: (value: any) => void

      ;(global.fetch as any).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )

      render(<LetterActions letter={{ ...mockLetter, status: 'draft' }} />)

      const submitButton = screen.getByRole('button', {
        name: /submit for attorney approval/i,
      })

      await user.click(submitButton)

      expect(
        screen.getByRole('button', { name: /submitting\.\.\./i })
      ).toBeInTheDocument()

      resolveFetch!({ ok: true, json: async () => ({ success: true }) })
    })

    it('should show loading state during delete', async () => {
      const user = userEvent.setup()
      let resolveFetch: (value: any) => void

      ;(global.fetch as any).mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve
        })
      )

      render(
        <LetterActions letter={{ ...mockLetter, status: 'draft' }} />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /^delete letter$/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /deleting\.\.\./i })
        ).toBeInTheDocument()
      })

      resolveFetch!({ ok: true, json: async () => ({ success: true }) })
    })
  })

  describe('Error Handling', () => {
    it('should handle submit failure', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Network error' }),
      })

      render(<LetterActions letter={{ ...mockLetter, status: 'draft' }} />)

      const submitButton = screen.getByRole('button', {
        name: /submit for attorney approval/i,
      })

      await user.click(submitButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'Failed to submit letter for approval.'
        )
      })
    })

    it('should handle delete failure', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      })

      render(
        <LetterActions letter={{ ...mockLetter, status: 'draft' }} />
      )

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /^delete letter$/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalled()
      })
    })
  })
})
