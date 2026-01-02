"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle,
  XCircle,
  Edit3,
  Save,
  Eye,
  FileText,
  AlertTriangle,
  Send,
  Download,
  History
} from "lucide-react"
import { toast } from "sonner"
import type { Letter, LetterAuditTrail } from "@/lib/types/letter.types"
import { getAdminCsrfToken } from "@/lib/admin/csrf-client"

interface LetterReviewInterfaceProps {
  letter: Letter
  auditTrail: LetterAuditTrail[]
}

export function LetterReviewInterface({ letter, auditTrail }: LetterReviewInterfaceProps) {
  const supabase = createClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(letter.final_content || letter.ai_draft_content || "")
  const [reviewNotes, setReviewNotes] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("review")

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: "secondary" as const, label: "Draft" },
      generating: { variant: "secondary" as const, label: "Generating" },
      pending_review: { variant: "default" as const, label: "Pending Review" },
      under_review: { variant: "secondary" as const, label: "Under Review" },
      approved: { variant: "default" as const, label: "Approved" },
      completed: { variant: "default" as const, label: "Completed" },
      rejected: { variant: "destructive" as const, label: "Rejected" }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const handleSaveEdit = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("letters")
        .update({
          final_content: editedContent,
          updated_at: new Date().toISOString()
        })
        .eq("id", letter.id)

      if (error) throw error

      // Log the edit action
      await supabase.rpc("log_letter_audit", {
        p_letter_id: letter.id,
        p_action: "content_edited",
        p_old_status: letter.status,
        p_new_status: letter.status,
        p_notes: "Letter content edited by admin"
      })

      toast.success("Letter content saved successfully")
      setIsEditing(false)
      window.location.reload()
    } catch (error: unknown) {
      toast.error("Failed to save edits: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("letters")
        .update({
          status: "approved",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
          final_content: editedContent,
          updated_at: new Date().toISOString()
        })
        .eq("id", letter.id)

      if (error) throw error

      // Log the approval
      await supabase.rpc("log_letter_audit", {
        p_letter_id: letter.id,
        p_action: "approved",
        p_old_status: letter.status,
        p_new_status: "approved",
        p_notes: reviewNotes || "Letter approved by admin"
      })

      toast.success("Letter approved successfully")
      window.location.reload()
    } catch (error: unknown) {
      toast.error("Failed to approve letter: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("letters")
        .update({
          status: "rejected",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          review_notes: reviewNotes,
          updated_at: new Date().toISOString()
        })
        .eq("id", letter.id)

      if (error) throw error

      // Log the rejection
      await supabase.rpc("log_letter_audit", {
        p_letter_id: letter.id,
        p_action: "rejected",
        p_old_status: letter.status,
        p_new_status: "rejected",
        p_notes: `Rejected: ${rejectionReason}`
      })

      toast.success("Letter rejected")
      window.location.reload()
    } catch (error: unknown) {
      toast.error("Failed to reject letter: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkCompleted = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("letters")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", letter.id)

      if (error) throw error

      // Log completion
      await supabase.rpc("log_letter_audit", {
        p_letter_id: letter.id,
        p_action: "completed",
        p_old_status: letter.status,
        p_new_status: "completed",
        p_notes: "Letter marked as completed"
      })

      toast.success("Letter marked as completed")
      window.location.reload()
    } catch (error: unknown) {
      toast.error("Failed to complete letter: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleImproveWithAI = async () => {
    setIsLoading(true)
    try {
      const csrfToken = await getAdminCsrfToken()
      const response = await fetch("/api/letters/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        body: JSON.stringify({
          letterId: letter.id,
          content: editedContent
        }),
      })

      if (!response.ok) throw new Error("Failed to improve letter")

      const { improvedContent } = await response.json()
      setEditedContent(improvedContent)

      // Log AI improvement
      await supabase.rpc("log_letter_audit", {
        p_letter_id: letter.id,
        p_action: "ai_improved",
        p_old_status: letter.status,
        p_new_status: letter.status,
        p_notes: "Letter content improved with AI"
      })

      toast.success("Letter improved with AI suggestions")
    } catch (error: unknown) {
      toast.error("Failed to improve letter: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/letters/${letter.id}/pdf`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Failed to generate PDF")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${letter.title.replace(/[^a-z0-9]/gi, "_")}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("PDF downloaded successfully")
    } catch (error: unknown) {
      toast.error("Failed to download PDF: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  return (
    <div className="space-y-6">
      {/* Review Actions Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Letter Review Workflow
            </span>
            {getStatusBadge(letter.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="review">Review</TabsTrigger>
              <TabsTrigger value="edit">Edit & Improve</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="review" className="space-y-4">
              {/* Review Notes */}
              <div>
                <Label htmlFor="reviewNotes">Review Notes</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add your review notes here..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Quick Approval Actions */}
              <div className="flex gap-2">
                {letter.status === "pending_review" && (
                  <>
                    <Button
                      onClick={handleApprove}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve Letter
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" disabled={isLoading}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reject Letter</DialogTitle>
                          <DialogDescription>
                            Please provide a reason for rejecting this letter.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="rejectionReason">Rejection Reason</Label>
                            <Textarea
                              id="rejectionReason"
                              placeholder="Explain why this letter is being rejected..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={isLoading || !rejectionReason.trim()}
                          >
                            Reject Letter
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}

                {letter.status === "approved" && (
                  <Button
                    onClick={handleMarkCompleted}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Completed
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="edit" className="space-y-4">
              {/* Edit Controls */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit Content
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSaveEdit}
                        disabled={isLoading}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                          setEditedContent(letter.final_content || letter.ai_draft_content || "")
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={handleImproveWithAI}
                    variant="secondary"
                    disabled={isLoading}
                  >
                    ✨ Improve with AI
                  </Button>
                </div>
              </div>

              {/* Content Editor */}
              <div>
                <Label>Letter Content</Label>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  disabled={!isEditing}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Letter content will appear here..."
                />
              </div>

              {isEditing && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You are in edit mode. Changes will not be saved until you click "Save Changes".
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleDownloadPDF}
                  variant="outline"
                  className="flex items-center justify-center"
                  disabled={isLoading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center justify-center"
                  disabled={isLoading}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send to User
                </Button>
              </div>

              <Separator />

              {/* Status Management */}
              <div>
                <Label>Change Status</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="space-y-3">
                {auditTrail.length === 0 ? (
                  <p className="text-gray-500 text-sm">No history available</p>
                ) : (
                  auditTrail.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-blue-200 pl-4 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{entry.action}</p>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                      )}
                      {entry.old_status && entry.new_status && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{entry.old_status}</Badge>
                          <span>→</span>
                          <Badge variant="default">{entry.new_status}</Badge>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
