/**
 * Letter Review Interface Tests
 *
 * Tests attorney/admin letter review functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LetterReviewInterface } from '../letter-review-interface'

// Mock Next.js navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock CSRF client
vi.mock('@/lib/admin/csrf-client', () => ({
  getAdminCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
}))

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fetch
global.fetch = vi.fn()

describe('LetterReviewInterface Component', () => {
  const mockLetter = {
    id: 'letter-123',
    user_id: 'user-123',
    title: 'Demand Letter for Unpaid Wages',
    letter_type: 'demand',
    status: 'pending_review',
    ai_draft_content: 'This is the AI generated content for the demand letter...',
    final_content: null,
    intake_data: {
      senderName: 'John Doe',
      recipientName: 'ABC Company',
      issueDescription: 'Unpaid wages',
    },
    created_at: '2025-01-25T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z',
  }

  const mockAuditTrail: any[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    mockPush.mockClear()
    mockRefresh.mockClear()
  })

  describe('Rendering', () => {
    it('should render letter review interface', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByText(/Letter Review Workflow/i)).toBeInTheDocument()
    })

    it('should display letter status badge', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByText('Pending Review')).toBeInTheDocument()
    })

    it('should display review notes textarea', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByLabelText(/Review Notes/i)).toBeInTheDocument()
    })

    it('should have tabs for different sections', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByRole('tab', { name: 'Review' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Edit & Improve' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Actions' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    })
  })

  describe('Approval Flow', () => {
    it('should show approve button for pending_review letters', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByRole('button', { name: /Approve Letter/i })).toBeInTheDocument()
    })

    it('should show reject button for pending_review letters', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument()
    })

    it('should not show approve button for approved letters', () => {
      const approvedLetter = { ...mockLetter, status: 'approved' as const }
      render(<LetterReviewInterface letter={approvedLetter} auditTrail={mockAuditTrail} />)

      expect(screen.queryByRole('button', { name: /Approve Letter/i })).not.toBeInTheDocument()
    })
  })

  describe('Completed Status Flow', () => {
    it('should show mark as completed button for approved letters', () => {
      const approvedLetter = { ...mockLetter, status: 'approved' as const }
      render(<LetterReviewInterface letter={approvedLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByRole('button', { name: /Mark as Completed/i })).toBeInTheDocument()
    })
  })

  describe('Edit Capability', () => {
    it('should show edit content button', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByRole('button', { name: /Edit Content/i })).toBeInTheDocument()
    })

    it('should show improve with AI button', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      expect(screen.getByRole('button', { name: /✨ Improve with AI/i })).toBeInTheDocument()
    })

    it('should have a textarea for letter content', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      // Switch to edit tab first to see the textarea
      const editTab = screen.getByRole('tab', { name: 'Edit & Improve' })
      userEvent.click(editTab)

      expect(screen.getByLabelText(/Letter Content/i)).toBeInTheDocument()
    })
  })

  describe('Actions Tab', () => {
    it('should have download PDF button', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      const actionsTab = screen.getByRole('tab', { name: 'Actions' })
      userEvent.click(actionsTab)

      expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument()
    })

    it('should have send to user button', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      const actionsTab = screen.getByRole('tab', { name: 'Actions' })
      userEvent.click(actionsTab)

      expect(screen.getByRole('button', { name: /Send to User/i })).toBeInTheDocument()
    })
  })

  describe('Status Management', () => {
    it('should have status change dropdown', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={mockAuditTrail} />)

      const actionsTab = screen.getByRole('tab', { name: 'Actions' })
      userEvent.click(actionsTab)

      expect(screen.getByText(/Change Status/i)).toBeInTheDocument()
    })
  })

  describe('History Tab', () => {
    it('should show empty state when no audit trail', () => {
      render(<LetterReviewInterface letter={mockLetter} auditTrail={[]} />)

      const historyTab = screen.getByRole('tab', { name: 'History' })
      userEvent.click(historyTab)

      expect(screen.getByText(/No history available/i)).toBeInTheDocument()
    })

    it('should show audit trail entries when available', () => {
      const auditTrail = [
        {
          id: 'audit-1',
          action: 'Letter created',
          old_status: null,
          new_status: 'draft',
          notes: 'Initial draft created',
          created_at: '2025-01-25T10:00:00Z',
        },
      ]

      render(<LetterReviewInterface letter={mockLetter} auditTrail={auditTrail} />)

      const historyTab = screen.getByRole('tab', { name: 'History' })
      userEvent.click(historyTab)

      expect(screen.getByText('Letter created')).toBeInTheDocument()
    })
  })
})
