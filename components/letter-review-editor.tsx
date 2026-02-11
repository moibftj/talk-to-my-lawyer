'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  CheckCircle,
  XCircle,
  Save,
  Loader2,
  AlertTriangle,
  Edit3,
  Eye,
  FileText,
} from 'lucide-react'

interface LetterData {
  id: string
  title: string
  status: string
  letter_type: string
  ai_draft_content: string | null
  final_content: string | null
  review_notes: string | null
  rejection_reason: string | null
  user_id: string
  profiles?: {
    id: string
    full_name: string
    email: string
  }
}

interface LetterReviewEditorProps {
  letter: LetterData
  variant: 'attorney' | 'super_admin'
  csrfToken: string
}

const ATTORNEY_REJECTION_REASONS = [
  'Insufficient factual basis - more details needed about the dispute',
  'Legal claims not supported by the described facts',
  'Missing critical information (dates, amounts, or parties)',
  'Jurisdiction issues - wrong state laws referenced',
  'Tone or language needs significant revision',
  'Potential ethical concerns with the claims made',
  'Other (please specify)',
]

export function LetterReviewEditor({ letter, variant, csrfToken }: LetterReviewEditorProps) {
  const router = useRouter()
  const initialContent = letter.final_content || letter.ai_draft_content || ''
  
  const [editorContent, setEditorContent] = useState<string>(initialContent)
  const [isEditing, setIsEditing] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(letter.review_notes || '')
  const [rejectionReason, setRejectionReason] = useState('')
  const [customRejectionReason, setCustomRejectionReason] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const canEdit = ['pending_review', 'under_review'].includes(letter.status)
  const canApprove = canEdit && editorContent.trim().length > 0
  const canReject = canEdit

  const portalBase = variant === 'attorney' ? '/attorney-portal' : '/secure-admin-gateway'

  const handleSaveDraft = useCallback(async () => {
    if (!editorContent.trim()) return
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/letters/${letter.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          finalContent: editorContent,
          reviewNotes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save draft')
      }

      setSuccess('Draft saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }, [editorContent, reviewNotes, letter.id, csrfToken])

  const handleApprove = useCallback(async () => {
    if (!editorContent.trim()) {
      setError('Letter content cannot be empty')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/letters/${letter.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          finalContent: editorContent,
          reviewNotes: reviewNotes || 'Approved after attorney review',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || data.message || 'Failed to approve letter')
      }

      setSuccess('Letter approved successfully! PDF generation has been triggered.')
      setAction(null)
      setTimeout(() => {
        router.push(`${portalBase}/review`)
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to approve letter')
    } finally {
      setLoading(false)
    }
  }, [editorContent, reviewNotes, letter.id, csrfToken, router, portalBase])

  const handleReject = useCallback(async () => {
    const finalReason = variant === 'attorney'
      ? (rejectionReason === 'Other (please specify)' ? customRejectionReason : rejectionReason)
      : rejectionReason

    if (!finalReason.trim()) {
      setError('Rejection reason is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/letters/${letter.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          rejectionReason: finalReason,
          reviewNotes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || data.message || 'Failed to reject letter')
      }

      setSuccess('Letter rejected. The subscriber has been notified.')
      setAction(null)
      setTimeout(() => {
        router.push(`${portalBase}/review`)
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to reject letter')
    } finally {
      setLoading(false)
    }
  }, [rejectionReason, customRejectionReason, reviewNotes, letter.id, csrfToken, variant, router, portalBase])

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Success</p>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Editor Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isEditing ? 'Edit Letter Content' : 'Letter Content'}
              {letter.final_content && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 ml-2">
                  Previously Edited
                </Badge>
              )}
            </CardTitle>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Draft
                  </Button>
                )}
              </div>
            )}
          </div>
          {canEdit && (
            <p className="text-sm text-muted-foreground mt-1">
              {isEditing
                ? 'Make edits to the AI-generated draft. Your changes will be saved as the final content when approved.'
                : 'Click "Edit" to make changes to the letter content before approving.'}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <RichTextEditor
              content={editorContent}
              onChange={setEditorContent}
              placeholder="Letter content..."
              editable={true}
              className="min-h-[400px]"
            />
          ) : (
            <div className="bg-muted/30 p-6 rounded-lg border min-h-[400px]">
              {editorContent ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: editorContent }}
                />
              ) : (
                <p className="text-muted-foreground italic">No draft content available.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Notes */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Notes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add internal notes about your review. These are visible to other admins but not to the subscriber.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add review notes (optional)..."
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {canEdit && !action && (
        <div className="flex gap-4">
          <Button
            onClick={() => setAction('approve')}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 text-base"
            disabled={!canApprove}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Approve &amp; Generate PDF
          </Button>
          <Button
            onClick={() => setAction('reject')}
            variant="destructive"
            className="flex-1 h-12 text-base"
            disabled={!canReject}
          >
            <XCircle className="w-5 h-5 mr-2" />
            Reject Letter
          </Button>
        </div>
      )}

      {/* Approve Confirmation */}
      {action === 'approve' && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Confirm Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700">
              By approving this letter, the following will happen:
            </p>
            <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
              <li>The edited content will be saved as the final version</li>
              <li>The letter status will change to &quot;Approved&quot;</li>
              <li>The PDF generation workflow will be triggered automatically</li>
              <li>The subscriber will be notified that their letter is ready</li>
            </ul>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setAction(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Approval
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject Confirmation */}
      {action === 'reject' && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Letter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {variant === 'attorney' ? (
              <div className="space-y-3">
                <Label className="text-red-700 font-medium">
                  Rejection Reason (Client Will See This) *
                </Label>
                <p className="text-xs text-red-600">
                  Select a reason or choose &quot;Other&quot; to provide a custom explanation:
                </p>
                <div className="space-y-2">
                  {ATTORNEY_REJECTION_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 p-2.5 bg-white rounded border border-red-200 cursor-pointer hover:bg-red-50 transition-colors"
                    >
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
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Please provide a specific reason for rejection..."
                    rows={3}
                    className="border-red-300"
                    required
                  />
                )}
              </div>
            ) : (
              <div>
                <Label className="text-red-700 font-medium">
                  Rejection Reason (Client Will See This) *
                </Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this letter is being rejected..."
                  rows={3}
                  className="mt-2 border-red-300"
                  required
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setAction(null)
                  setRejectionReason('')
                  setCustomRejectionReason('')
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={
                  loading ||
                  (variant === 'attorney'
                    ? !rejectionReason || (rejectionReason === 'Other (please specify)' && !customRejectionReason.trim())
                    : !rejectionReason.trim())
                }
                variant="destructive"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Confirm Rejection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
