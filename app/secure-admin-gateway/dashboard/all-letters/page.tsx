'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  MoreHorizontal,
  CheckSquare,
  Play,
  Ban,
  Eye
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { getAdminCsrfToken } from '@/lib/admin/csrf-client'
import Link from 'next/link'

interface Letter {
  id: string
  title: string
  letter_type: string
  status: string
  created_at: string
  approved_at: string | null
  profiles: {
    full_name: string | null
    email: string
  } | null
}

const statusColors: Record<string, string> = {
  'draft': 'bg-slate-100 text-slate-800',
  'generating': 'bg-blue-100 text-blue-800',
  'pending_review': 'bg-yellow-100 text-yellow-800',
  'under_review': 'bg-orange-100 text-orange-800',
  'approved': 'bg-green-100 text-green-800',
  'rejected': 'bg-red-100 text-red-800',
  'completed': 'bg-emerald-100 text-emerald-800',
  'failed': 'bg-red-100 text-red-800'
}

const statusIcons: Record<string, any> = {
  'draft': FileText,
  'generating': RefreshCw,
  'pending_review': Clock,
  'under_review': Eye,
  'approved': CheckCircle,
  'rejected': XCircle,
  'completed': CheckCircle,
  'failed': AlertCircle
}

export default function AllLettersPage() {
  const [letters, setLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  const [batchAction, setBatchAction] = useState<string>('')
  const [batchNotes, setBatchNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchLetters = async () => {
    try {
      const response = await fetch('/api/admin/letters?limit=200')
      if (!response.ok) throw new Error('Failed to fetch')
      const result = await response.json()
      setLetters(result.letters || [])
    } catch (error) {
      toast.error('Failed to load letters')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLetters()
  }, [])

  const filteredLetters = letters.filter(letter => {
    const matchesStatus = statusFilter === 'all' || letter.status === statusFilter
    const matchesSearch = searchQuery === '' || 
      letter.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      letter.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      letter.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLetters.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLetters.map(l => l.id)))
    }
  }

  const selectByStatus = (status: string) => {
    const ids = filteredLetters.filter(l => l.status === status).map(l => l.id)
    setSelectedIds(new Set(ids))
  }

  const openBatchDialog = (action: string) => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one letter')
      return
    }
    setBatchAction(action)
    setBatchDialogOpen(true)
  }

  const executeBatchAction = async () => {
    if (selectedIds.size === 0) return

    setProcessing(true)
    try {
      const csrfToken = await getAdminCsrfToken()
      const response = await fetch('/api/admin/letters/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          letterIds: Array.from(selectedIds),
          action: batchAction,
          notes: batchNotes
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Batch operation failed')
      }

      toast.success(result.message)
      setBatchDialogOpen(false)
      setBatchNotes('')
      setSelectedIds(new Set())
      fetchLetters()
    } catch (error: any) {
      toast.error(error.message || 'Batch operation failed')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const pendingCount = letters.filter(l => l.status === 'pending_review').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Letters</h1>
          <p className="text-muted-foreground mt-1">
            Manage all letters with batch operations • {letters.length} total
            {pendingCount > 0 && <span className="text-yellow-600 ml-2">({pendingCount} pending review)</span>}
          </p>
        </div>
        <Button variant="outline" onClick={fetchLetters}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters and Batch Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => openBatchDialog('approve')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openBatchDialog('reject')}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openBatchDialog('start_review')}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start Review
                </Button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={toggleSelectAll}>
                  {selectedIds.size === filteredLetters.length ? 'Deselect All' : 'Select All'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectByStatus('pending_review')}>
                  Select All Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectByStatus('under_review')}>
                  Select All Under Review
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedIds(new Set())}>
                  Clear Selection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Letters Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 w-12">
                    <Checkbox
                      checked={selectedIds.size === filteredLetters.length && filteredLetters.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLetters.map((letter) => {
                  const StatusIcon = statusIcons[letter.status] || FileText
                  return (
                    <tr key={letter.id} className={`hover:bg-muted/30 ${selectedIds.has(letter.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(letter.id)}
                          onCheckedChange={() => toggleSelect(letter.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{letter.title || 'Untitled'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{letter.profiles?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{letter.profiles?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {letter.letter_type || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[letter.status] || 'bg-gray-100'}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {letter.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {format(new Date(letter.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/secure-admin-gateway/review/${letter.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/secure-admin-gateway/review/${letter.id}`}>
                                  View & Edit
                                </Link>
                              </DropdownMenuItem>
                              {letter.status === 'pending_review' && (
                                <>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedIds(new Set([letter.id]))
                                    openBatchDialog('approve')
                                  }}>
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedIds(new Set([letter.id]))
                                    openBatchDialog('reject')
                                  }}>
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredLetters.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No letters found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Action Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {batchAction === 'approve' && 'Approve Letters'}
              {batchAction === 'reject' && 'Reject Letters'}
              {batchAction === 'start_review' && 'Start Review'}
              {batchAction === 'complete' && 'Complete Letters'}
            </DialogTitle>
            <DialogDescription>
              This action will be applied to {selectedIds.size} selected letter(s).
              {batchAction === 'approve' && ' Users will be notified by email.'}
              {batchAction === 'reject' && ' Users will be notified by email.'}
            </DialogDescription>
          </DialogHeader>

          {(batchAction === 'reject') && (
            <div className="py-4">
              <Textarea
                placeholder="Reason for rejection (optional but recommended)"
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={executeBatchAction}
              disabled={processing}
              className={batchAction === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {processing ? 'Processing...' : `${batchAction.charAt(0).toUpperCase() + batchAction.slice(1).replace('_', ' ')} ${selectedIds.size} Letters`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
