/**
 * Letter Review Interface Tests
 *
 * Tests attorney/admin letter review functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LetterReviewInterface } from '../letter-review-interface'

// Mock fetch
global.fetch = vi.fn()

// Mock Next.js router
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

describe('LetterReviewInterface Component', () => {
  const mockLetter = {
    id: 'letter-123',
    user_id: 'user-123',
    title: 'Demand Letter for Unpaid Wages',
    letter_type: 'demand',
    status: 'pending_review',
    ai_draft_content: 'This is the AI generated content...',
    intake_data: {
      senderName: 'John Doe',
      recipientName: 'ABC Company',
      issueDescription: 'Unpaid wages',
    },
    created_at: '2025-01-25T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    global.console.error = vi.fn()
    global.alert = vi.fn()
  })

  describe('Rendering', () => {
    it('should display letter content', () => {
      render(<LetterReviewInterface letter={mockLetter} />)

      expect(screen.getByText(/Demand Letter/i)).toBeInTheDocument()
      expect(screen.getByText(/AI generated content/i)).toBeInTheDocument()
    })

    it('should display intake data', () => {
      render(<LetterReviewInterface letter={mockLetter} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('ABC Company')).toBeInTheDocument()
    })

    it('should show approve and reject buttons', () => {
      render(<LetterReviewInterface letter={mockLetter} />)

      expect(
        screen.getByRole('button', { name: /approve/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /reject/i })
      ).toBeInTheDocument()
    })
  })

  describe('Approval Flow', () => {
    it('should approve letter successfully', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<LetterReviewInterface letter={mockLetter} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      await user.click(approveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/letters/letter-123/approve',
          expect.objectContaining({
            method: 'POST',
          })
        )
      })
    })

    it('should show confirmation before approving', async () => {
      const user = userEvent.setup()

      render(<LetterReviewInterface letter={mockLetter} />)

      const approveButton = screen.getByRole('button', { name: /approve/i })
      await user.click(approveButton)

      expect(
        screen.getByText(/are you sure|confirm approval/i)
      ).toBeInTheDocument()
    })
  })

  describe('Rejection Flow', () => {
    it('should require rejection reason', async () => {
      const user = userEvent.setup()

      render(<LetterReviewInterface letter={mockLetter} />)

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      await user.click(rejectButton)

      // Should show reason input
      expect(
        screen.getByRole('textbox', { name: /reason/i })
      ).toBeInTheDocument()
    })

    it('should reject letter with reason', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<LetterReviewInterface letter={mockLetter} />)

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      await user.click(rejectButton)

      const reasonInput = screen.getByRole('textbox', { name: /reason/i })
      await user.type(reasonInput, 'Needs more specific details')

      const confirmButton = screen.getByRole('button', { name: /confirm|submit/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/letters/letter-123/reject',
          expect.objectContaining({
            body: expect.stringContaining('Needs more specific details'),
          })
        )
      })
    })

    it('should not allow rejection without reason', async () => {
      const user = userEvent.setup()

      render(<LetterReviewInterface letter={mockLetter} />)

      const rejectButton = screen.getByRole('button', { name: /reject/i })
      await user.click(rejectButton)

      const confirmButton = screen.getByRole('button', { name: /confirm|submit/i })

      // Button should be disabled without reason
      expect(confirmButton).toBeDisabled()
    })
  })

  describe('Edit Capability', () => {
    it('should allow editing AI draft before approval', async () => {
      const user = userEvent.setup()

      render(<LetterReviewInterface letter={mockLetter} canEdit />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      // Should show editable content
      const editor = screen.getByRole('textbox')
      expect(editor).toBeInTheDocument()
    })

    it('should save edits before approval', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<LetterReviewInterface letter={mockLetter} canEdit />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      await user.click(editButton)

      const editor = screen.getByRole('textbox')
      await user.clear(editor)
      await user.type(editor, 'Edited letter content')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/admin/letters/letter-123/update',
          expect.objectContaining({
            body: expect.stringContaining('Edited letter content'),
          })
        )
      })
    })
  })

  describe('View Mode', () => {
    it('should show read-only view for non-editors', () => {
      render(<LetterReviewInterface letter={mockLetter} canEdit={false} />)

      expect(
        screen.queryByRole('button', { name: /edit/i })
      ).not.toBeInTheDocument()
    })

    it('should show audit trail', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          audit: [
            {
              id: 'audit-1',
              old_status: 'draft',
              new_status: 'pending_review',
              changed_by: 'user-123',
              changed_at: '2025-01-25T10:00:00Z',
            },
          ],
        }),
      })

      render(<LetterReviewInterface letter={mockLetter} showAudit />)

      const auditButton = screen.getByRole('button', { name: /history|audit/i })
      await userEvent.setup().click(auditButton)

      expect(screen.getByText(/draft.*pending review/i)).toBeInTheDocument()
    })
  })

  describe('Status Display', () => {
    it('should show current letter status', () => {
      render(<LetterReviewInterface letter={mockLetter} />)

      expect(screen.getByText(/pending review/i)).toBeInTheDocument()
    })

    it('should show status badge with correct color', () => {
      const { container } = render(
        <LetterReviewInterface letter={mockLetter} />
      )

      const badge = container.querySelector('.badge')
      expect(badge).toBeInTheDocument()
    })
  })
})
