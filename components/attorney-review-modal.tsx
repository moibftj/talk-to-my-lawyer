'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { RichTextEditor } from './ui/rich-text-editor'
import type { Letter } from '@/lib/database.types'
import { Wand2, Loader2, Scale, FileCheck, XCircle } from 'lucide-react'
import { getAdminCsrfToken } from '@/lib/admin/csrf-client'

interface AttorneyReviewModalProps {
  letter: Letter & { profiles?: { full_name: string; email: string } }
}

// Preset rejection reasons for attorneys
const ATTORNEY_REJECTION_REASONS = [
  'Insufficient legal basis for the claims',
  'Need more specific facts or details',
  'Tone is too aggressive/combative',
  'Tone is not strong enough',
  'Missing important legal elements',
  'Formatting or structure issues',
  'Other (please specify)'
]

export function AttorneyReviewModal({ letter }: AttorneyReviewModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [finalContent, setFinalContent] = useState(
    letter.ai_draft_content ? `<p>${letter.ai_draft_content.replace(/\n/g, '</p><p>')}</p>` : ''
  )
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [customRejectionReason, setCustomRejectionReason] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiImproving, setAiImproving] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [showAiInput, setShowAiInput] = useState(false)
  const router = useRouter()

  const getAdminHeaders = async (includeContentType = true) => {
    const csrfToken = await getAdminCsrfToken()
    return {
      ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
      'x-csrf-token': csrfToken,
    }
  }

  const htmlToPlainText = (html: string): string => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    return tempDiv.textContent || tempDiv.innerText || ''
  }

  const handleOpen = async () => {
    setIsOpen(true)

    if (letter.status === 'pending_review') {
      try {
        const headers = await getAdminHeaders(false)
        await fetch(`/api/letters/${letter.id}/start-review`, {
          method: 'POST',
          headers
        })
        router.refresh()
      } catch (error) {
        console.error('[Attorney] Failed to start review:', error)
      }
    }
  }

  const handleAiImprove = async () => {
    if (!aiInstruction.trim()) {
      toast.error('Please enter an improvement instruction')
      return
    }

    setAiImproving(true)
    try {
      const headers = await getAdminHeaders()
      const response = await fetch(`/api/letters/${letter.id}/improve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: htmlToPlainText(finalContent),
          instruction: aiInstruction
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to improve content')
      }

      const { improvedContent } = await response.json()
      const htmlContent = `<p>${improvedContent.replace(/\n/g, '</p><p>')}</p>`
      setFinalContent(htmlContent)
      setAiInstruction('')
      setShowAiInput(false)
      toast.success('Letter improved with AI')
    } catch (error: any) {
      console.error('[Attorney] AI improvement error:', error)
      toast.error(error.message || 'Failed to improve content with AI')
    } finally {
      setAiImproving(false)
    }
  }

  const handleSubmit = async () => {
    if (!action) return

    if (action === 'approve' && !htmlToPlainText(finalContent).trim()) {
      toast.error('Final content is required for approval')
      return
    }

    const finalRejectionReason = rejectionReason === 'Other (please specify)'
      ? customRejectionReason
      : rejectionReason

    if (action === 'reject' && !finalRejectionReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }

    setLoading(true)
    try {
      const endpoint = action === 'approve'
        ? `/api/letters/${letter.id}/approve`
        : `/api/letters/${letter.id}/reject`

      const body = action === 'approve'
        ? { finalContent: htmlToPlainText(finalContent), reviewNotes }
        : { rejectionReason: finalRejectionReason, reviewNotes }

      const headers = await getAdminHeaders()
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update letter')
      }

      setIsOpen(false)
      router.refresh()
    } catch (error: any) {
      console.error('[Attorney] Review error:', error)
      toast.error(error.message || 'Failed to update letter status')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={handleOpen} className="bg-blue-600 hover:bg-blue-700">
        <Scale className="w-4 h-4 mr-2" />
        Review Letter
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header - Attorney/Legal themed */}
        <div className="sticky top-0 bg-blue-800 text-white border-b px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-700 p-2 rounded">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Attorney Review</h2>
                <p className="text-xs text-blue-200">Legal letter review and approval</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-blue-200 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Client Info Card */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Client Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium text-blue-700">Name:</span> {letter.profiles?.full_name || 'N/A'}</div>
              <div><span className="font-medium text-blue-700">Email:</span> {letter.profiles?.email}</div>
              <div><span className="font-medium text-blue-700">Letter Type:</span> <span className="capitalize">{letter.letter_type?.replace('_', ' ')}</span></div>
              <div><span className="font-medium text-blue-700">Status:</span> {letter.status}</div>
            </div>
          </div>

          {/* Letter Content with AI */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="content">Letter Content (Editable)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAiInput(!showAiInput)}
                className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </Button>
            </div>

            {showAiInput && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div>
                  <Label htmlFor="aiInstruction" className="text-blue-900">
                    Legal improvement instruction
                  </Label>
                  <Input
                    id="aiInstruction"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="e.g., 'Strengthen the legal argument' or 'Add professional tone' or 'Improve legal clarity'"
                    className="mt-2"
                    disabled={aiImproving}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleAiImprove}
                    disabled={aiImproving || !aiInstruction.trim()}
                    size="sm"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {aiImproving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Improve
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAiInput(false)
                      setAiInstruction('')
                    }}
                    disabled={aiImproving}
                    className="text-blue-700"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <RichTextEditor
              content={finalContent}
              onChange={setFinalContent}
              placeholder="Review and edit the letter content..."
              editable={!aiImproving}
              className="min-h-[400px]"
            />
          </div>

          {/* Review Notes (Internal) */}
          <div>
            <Label htmlFor="notes">Internal Review Notes</Label>
            <p className="text-xs text-slate-500 mb-2">These notes are for internal attorney/admin use only. The client will not see them.</p>
            <Textarea
              id="notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add internal notes about this review..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Action Selection */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => setAction('approve')}
              variant={action === 'approve' ? 'default' : 'outline'}
              className={action === 'approve' ? 'bg-green-600 hover:bg-green-700 h-auto py-4' : 'h-auto py-4'}
            >
              <div className="flex flex-col items-center gap-1">
                <FileCheck className="w-5 h-5" />
                <span>Approve</span>
                <span className="text-xs opacity-80">Send to client</span>
              </div>
            </Button>
            <Button
              onClick={() => setAction('reject')}
              variant={action === 'reject' ? 'destructive' : 'outline'}
              className={action === 'reject' ? 'bg-red-600 hover:bg-red-700 h-auto py-4' : 'h-auto py-4'}
            >
              <div className="flex flex-col items-center gap-1">
                <XCircle className="w-5 h-5" />
                <span>Reject</span>
                <span className="text-xs opacity-80">Request revision</span>
              </div>
            </Button>
          </div>

          {/* Rejection Reason with Presets */}
          {action === 'reject' && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <Label htmlFor="rejection" className="text-red-700">Rejection Reason (Client Will See This) *</Label>
              <p className="text-xs text-red-600 mb-3">Select a reason or choose "Other" to provide a custom explanation:</p>

              <div className="space-y-2 mb-3">
                {ATTORNEY_REJECTION_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 p-2 bg-white rounded border border-red-200 cursor-pointer hover:bg-red-50 transition-colors">
                    <input
                      type="radio"
                      name="rejectionReason"
                      value={reason}
                      checked={rejectionReason === reason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="text-red-600"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>

              {rejectionReason === 'Other (please specify)' && (
                <Textarea
                  id="customRejection"
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                  placeholder="Please provide a specific reason for rejection..."
                  rows={3}
                  className="mt-2 border-red-300"
                  required
                />
              )}
            </div>
          )}

          {/* Submit Button */}
          {action && (
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                onClick={() => {
                  setAction(null)
                  setRejectionReason('')
                  setCustomRejectionReason('')
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || (action === 'reject' && !rejectionReason)}
                className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {loading ? 'Processing...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
