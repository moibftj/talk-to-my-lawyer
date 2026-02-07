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
import { Wand2, Loader2, Scale, FileCheck, XCircle, Settings, Info } from 'lucide-react'
import { getAdminCsrfToken } from '@/lib/admin/csrf-client'

const ATTORNEY_REJECTION_REASONS = [
  'Insufficient legal basis for the claims',
  'Need more specific facts or details',
  'Tone is too aggressive/combative',
  'Tone is not strong enough',
  'Missing important legal elements',
  'Formatting or structure issues',
  'Other (please specify)'
]

interface ReviewModalProps {
  letter: Letter & { profiles?: { full_name: string; email: string } }
  variant?: 'default' | 'attorney' | 'super_admin'
}

export function ReviewModal({ letter, variant = 'default' }: ReviewModalProps) {
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const router = useRouter()

  const logPrefix = variant === 'attorney' ? '[Attorney]' : variant === 'super_admin' ? '[SuperAdmin]' : '[v0]'

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
        console.error(`${logPrefix} Failed to start review:`, error)
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
      console.error(`${logPrefix} AI improvement error:`, error)
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

    const finalRejectionReason = variant === 'attorney' && rejectionReason === 'Other (please specify)'
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
      console.error(`${logPrefix} Review error:`, error)
      toast.error(error.message || 'Failed to update letter status')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    if (variant === 'attorney') {
      return (
        <Button onClick={handleOpen} className="bg-blue-600 hover:bg-blue-700">
          <Scale className="w-4 h-4 mr-2" />
          Review Letter
        </Button>
      )
    }
    if (variant === 'super_admin') {
      return (
        <Button onClick={handleOpen} className="bg-slate-800 hover:bg-slate-900">
          <Settings className="w-4 h-4 mr-2" />
          Review & Edit
        </Button>
      )
    }
    return (
      <Button onClick={handleOpen}>
        Review Letter
      </Button>
    )
  }

  const renderHeader = () => {
    if (variant === 'attorney') {
      return (
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
      )
    }
    if (variant === 'super_admin') {
      return (
        <div className="sticky top-0 bg-slate-800 text-white border-b px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-slate-700 p-2 rounded">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Super Admin Review</h2>
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
      )
    }
    return (
      <div className="sticky top-0 bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Review Letter</h2>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  const renderInfoCards = () => {
    if (variant === 'super_admin') {
      return (
        <>
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
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Submitted By</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium text-blue-700">Name:</span> {letter.profiles?.full_name || 'N/A'}</div>
              <div><span className="font-medium text-blue-700">Email:</span> {letter.profiles?.email}</div>
            </div>
          </div>
        </>
      )
    }
    if (variant === 'attorney') {
      return (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Client Information</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium text-blue-700">Name:</span> {letter.profiles?.full_name || 'N/A'}</div>
            <div><span className="font-medium text-blue-700">Email:</span> {letter.profiles?.email}</div>
            <div><span className="font-medium text-blue-700">Letter Type:</span> <span className="capitalize">{letter.letter_type?.replace('_', ' ')}</span></div>
            <div><span className="font-medium text-blue-700">Status:</span> {letter.status}</div>
          </div>
        </div>
      )
    }
    return (
      <div className="bg-slate-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Letter Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="font-medium">Type:</span> {letter.letter_type}</div>
          <div><span className="font-medium">From:</span> {letter.profiles?.full_name}</div>
          <div><span className="font-medium">Email:</span> {letter.profiles?.email}</div>
          <div><span className="font-medium">Status:</span> {letter.status}</div>
        </div>
      </div>
    )
  }

  const renderAiSection = () => {
    const aiButtonText = variant === 'attorney' ? 'AI Assist' : 'AI Improve'
    const aiSectionBg = variant === 'super_admin'
      ? 'bg-slate-100 border border-slate-300'
      : 'bg-blue-50 border border-blue-200'
    const aiLabelClass = variant === 'super_admin' ? 'text-slate-800' : 'text-blue-900'
    const aiButtonClass = variant === 'attorney'
      ? 'flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50'
      : 'flex items-center gap-2'
    const improveButtonClass = variant === 'attorney'
      ? 'flex items-center gap-2 bg-blue-600 hover:bg-blue-700'
      : 'flex items-center gap-2'
    const cancelClass = variant === 'attorney' ? 'text-blue-700' : undefined
    const placeholder = variant === 'attorney'
      ? "e.g., 'Strengthen the legal argument' or 'Add professional tone' or 'Improve legal clarity'"
      : "e.g., 'Make it more assertive' or 'Add legal citations' or 'Improve clarity'"
    const editorPlaceholder = variant === 'attorney'
      ? 'Review and edit the letter content...'
      : 'Edit the letter content before approval...'
    const editorMinHeight = variant === 'super_admin' ? 'min-h-[350px]' : 'min-h-[400px]'

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="content">Letter Content (Editable)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAiInput(!showAiInput)}
            className={aiButtonClass}
          >
            <Wand2 className="h-4 w-4" />
            {aiButtonText}
          </Button>
        </div>

        {showAiInput && (
          <div className={`mb-4 p-4 ${aiSectionBg} rounded-lg space-y-3`}>
            <div>
              <Label htmlFor="aiInstruction" className={aiLabelClass}>
                {variant === 'attorney' ? 'Legal improvement instruction' : 'How should the AI improve this letter?'}
              </Label>
              <Input
                id="aiInstruction"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder={placeholder}
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
                className={improveButtonClass}
              >
                {aiImproving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    {variant === 'attorney' ? 'Improve' : 'Improve with AI'}
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
                className={cancelClass}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <RichTextEditor
          content={finalContent}
          onChange={setFinalContent}
          placeholder={editorPlaceholder}
          editable={!aiImproving}
          className={editorMinHeight}
        />
      </div>
    )
  }

  const renderReviewNotes = () => {
    const noteDescription = variant === 'attorney'
      ? 'These notes are for internal attorney/admin use only. The client will not see them.'
      : 'These notes are for internal use only and will not be shown to the client'

    return (
      <div>
        <Label htmlFor="notes">Internal Review Notes</Label>
        <p className="text-xs text-slate-500 mb-2">{noteDescription}</p>
        <Textarea
          id="notes"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder={variant === 'attorney' ? 'Add internal notes about this review...' : 'Add any internal notes about this review...'}
          rows={3}
          className="mt-2"
        />
      </div>
    )
  }

  const renderAdvancedOptions = () => {
    if (variant !== 'super_admin') return null
    return (
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
    )
  }

  const renderActionButtons = () => {
    if (variant === 'attorney') {
      return (
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
      )
    }
    if (variant === 'super_admin') {
      return (
        <div className="flex gap-4 pt-4 border-t">
          <Button
            onClick={() => setAction('approve')}
            variant={action === 'approve' ? 'default' : 'outline'}
            className={action === 'approve' ? 'bg-green-600 hover:bg-green-700 flex-1' : 'flex-1'}
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
      )
    }
    return (
      <div className="flex gap-4">
        <Button
          onClick={() => setAction('approve')}
          variant={action === 'approve' ? 'default' : 'outline'}
          className="flex-1"
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
    )
  }

  const renderRejectionReason = () => {
    if (action !== 'reject') return null

    if (variant === 'attorney') {
      return (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <Label htmlFor="rejection" className="text-red-700">Rejection Reason (Client Will See This) *</Label>
          <p className="text-xs text-red-600 mb-3">Select a reason or choose &quot;Other&quot; to provide a custom explanation:</p>

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
      )
    }

    return (
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
    )
  }

  const renderSubmitButtons = () => {
    if (!action) return null

    const isRejectDisabled = variant === 'attorney'
      ? !rejectionReason || (rejectionReason === 'Other (please specify)' && !customRejectionReason.trim())
      : !rejectionReason.trim()

    return (
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
          disabled={loading || (action === 'reject' && isRejectDisabled)}
          className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
        >
          {loading ? 'Processing...' : `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`}
        </Button>
      </div>
    )
  }

  const modalMaxWidth = variant === 'super_admin' ? 'max-w-5xl' : 'max-w-4xl'
  const overlayClass = variant === 'default'
    ? 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    : 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
  const containerShadow = variant === 'default' ? '' : ' shadow-xl'

  return (
    <div className={overlayClass}>
      <div className={`bg-white rounded-lg ${modalMaxWidth} w-full max-h-[90vh] overflow-y-auto${containerShadow}`}>
        {renderHeader()}

        <div className={`p-6 ${variant === 'default' ? 'space-y-6' : 'space-y-5'}`}>
          {renderInfoCards()}
          {renderAiSection()}
          {renderReviewNotes()}
          {renderAdvancedOptions()}
          {renderActionButtons()}
          {renderRejectionReason()}
          {renderSubmitButtons()}
        </div>
      </div>
    </div>
  )
}

export function ReviewLetterModal(props: { letter: Letter & { profiles?: { full_name: string; email: string } } }) {
  return <ReviewModal {...props} variant="default" />
}

export function AttorneyReviewModal(props: { letter: Letter & { profiles?: { full_name: string; email: string } } }) {
  return <ReviewModal {...props} variant="attorney" />
}

export function SuperAdminReviewModal(props: { letter: Letter & { profiles?: { full_name: string; email: string } } }) {
  return <ReviewModal {...props} variant="super_admin" />
}
