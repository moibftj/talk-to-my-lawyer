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
import { Wand2, Loader2, Settings, Info } from 'lucide-react'
import { getAdminCsrfToken } from '@/lib/admin/csrf-client'

interface SuperAdminReviewModalProps {
  letter: Letter & { profiles?: { full_name: string; email: string } }
}

export function SuperAdminReviewModal({ letter }: SuperAdminReviewModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [finalContent, setFinalContent] = useState(
    letter.ai_draft_content ? `<p>${letter.ai_draft_content.replace(/\n/g, '</p><p>')}</p>` : ''
  )
  const [reviewNotes, setReviewNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiImproving, setAiImproving] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [showAiInput, setShowAiInput] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
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
        console.error('[SuperAdmin] Failed to start review:', error)
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
      console.error('[SuperAdmin] AI improvement error:', error)
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

    if (action === 'reject' && !rejectionReason.trim()) {
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
        : { rejectionReason, reviewNotes }

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
      console.error('[SuperAdmin] Review error:', error)
      toast.error(error.message || 'Failed to update letter status')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={handleOpen} className="bg-slate-800 hover:bg-slate-900">
        <Settings className="w-4 h-4 mr-2" />
        Review & Edit
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header - System Admin themed */}
        <div className="sticky top-0 bg-slate-800 text-white border-b px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-slate-700 p-2 rounded">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">System Admin Review</h2>
                <p className="text-xs text-slate-300">Letter ID: {letter.id}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* System Info Card */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-slate-600" />
              <h3 className="font-semibold text-slate-700">System Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Letter ID:</span>
                <p className="font-mono text-xs bg-slate-200 px-2 py-1 rounded mt-1">{letter.id}</p>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <p className="font-medium text-slate-900 mt-1">{letter.status}</p>
              </div>
              <div>
                <span className="text-slate-500">Type:</span>
                <p className="font-medium text-slate-900 mt-1 capitalize">{letter.letter_type?.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-slate-500">Created:</span>
                <p className="font-medium text-slate-900 mt-1">{new Date(letter.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Submitted By</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium text-blue-700">Name:</span> {letter.profiles?.full_name || 'N/A'}</div>
              <div><span className="font-medium text-blue-700">Email:</span> {letter.profiles?.email}</div>
            </div>
          </div>

          {/* AI Improvement Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="content">Letter Content (Editable)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAiInput(!showAiInput)}
                className="flex items-center gap-2"
              >
                <Wand2 className="h-4 w-4" />
                AI Improve
              </Button>
            </div>

            {showAiInput && (
              <div className="mb-4 p-4 bg-slate-100 border border-slate-300 rounded-lg space-y-3">
                <div>
                  <Label htmlFor="aiInstruction" className="text-slate-800">
                    How should the AI improve this letter?
                  </Label>
                  <Input
                    id="aiInstruction"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="e.g., 'Make it more assertive' or 'Add legal citations' or 'Improve clarity'"
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
                    className="flex items-center gap-2"
                  >
                    {aiImproving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Improving...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Improve with AI
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
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <RichTextEditor
              content={finalContent}
              onChange={setFinalContent}
              placeholder="Edit the letter content before approval..."
              editable={!aiImproving}
              className="min-h-[350px]"
            />
          </div>

          {/* Review Notes (Internal) */}
          <div>
            <Label htmlFor="notes">Internal Review Notes</Label>
            <p className="text-xs text-slate-500 mb-2">These notes are for internal use only and will not be shown to the client</p>
            <Textarea
              id="notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add any internal notes about this review..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-slate-600"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>
            {showAdvanced && (
              <div className="mt-3 p-4 bg-slate-100 border border-slate-300 rounded-lg text-sm space-y-2">
                <p className="font-medium text-slate-700">Advanced Actions:</p>
                <p className="text-slate-600">• All actions are logged to audit trail</p>
                <p className="text-slate-600">• CSRF token: {getAdminCsrfToken.toString().slice(0, 20)}...</p>
                <p className="text-slate-600">• Letter will transition: {letter.status} → {action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending'}</p>
              </div>
            )}
          </div>

          {/* Action Selection */}
          <div className="flex gap-4 pt-4 border-t">
            <Button
              onClick={() => setAction('approve')}
              variant={action === 'approve' ? 'default' : 'outline'}
              className="flex-1"
              className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Approve Letter
            </Button>
            <Button
              onClick={() => setAction('reject')}
              variant={action === 'reject' ? 'destructive' : 'outline'}
              className="flex-1"
            >
              Reject Letter
            </Button>
          </div>

          {/* Rejection Reason */}
          {action === 'reject' && (
            <div>
              <Label htmlFor="rejection" className="text-red-600">Rejection Reason (Client Will See This) *</Label>
              <Textarea
                id="rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this letter is being rejected..."
                rows={3}
                className="mt-2 border-red-300"
                required
              />
            </div>
          )}

          {/* Submit Button */}
          {action && (
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button onClick={() => { setAction(null); setRejectionReason('') }} variant="ghost">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || (action === 'reject' && !rejectionReason.trim())}
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
