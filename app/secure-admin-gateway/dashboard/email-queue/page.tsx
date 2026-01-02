'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Mail,
  RefreshCw,
  Play,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Inbox,
  Send,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { getAdminCsrfToken } from '@/lib/admin/csrf-client'

interface EmailQueueItem {
  id: string
  to: string
  subject: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  max_retries: number
  error: string | null
  created_at: string
  sent_at: string | null
  next_retry_at: string | null
}

interface EmailQueueStats {
  pending: number
  sent: number
  failed: number
  total: number
}

export default function EmailQueuePage() {
  const [emails, setEmails] = useState<EmailQueueItem[]>([])
  const [stats, setStats] = useState<EmailQueueStats>({ pending: 0, sent: 0, failed: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchEmailQueue = async () => {
    try {
      const response = await fetch(`/api/admin/email-queue?status=${statusFilter}&limit=100`)
      if (!response.ok) throw new Error('Failed to fetch')
      const result = await response.json()
      setEmails(result.data.emails)
      setStats(result.data.stats)
    } catch (error) {
      toast.error('Failed to load email queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmailQueue()
  }, [statusFilter])

  const handleAction = async (action: string, emailId?: string) => {
    setProcessing(true)
    try {
      const csrfToken = await getAdminCsrfToken()
      const response = await fetch('/api/admin/email-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ action, emailId })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      toast.success(result.message)
      fetchEmailQueue()
    } catch (error: any) {
      toast.error(error.message || 'Action failed')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Mail className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }
    return variants[status] || ''
  }

  const filteredEmails = emails.filter(email =>
    email.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Email Queue Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage email delivery queue
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEmailQueue()}
            disabled={processing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => handleAction('process')}
            disabled={processing || stats.pending === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            Process Queue
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className={stats.pending > 0 ? 'border-yellow-300 bg-yellow-50/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Send className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          </CardContent>
        </Card>

        <Card className={stats.failed > 0 ? 'border-red-300 bg-red-50/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            {stats.failed > 0 && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs"
                onClick={() => handleAction('retry_all_failed')}
                disabled={processing}
              >
                Retry All Failed
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Email Queue
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Search by email or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={stats.sent === 0}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Old
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Old Emails?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete sent emails older than 30 days.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleAction('clear_old')}>
                      Clear Old Emails
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Attempts</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmails.map((email) => (
                  <tr key={email.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Badge className={getStatusBadge(email.status)}>
                        {getStatusIcon(email.status)}
                        <span className="ml-1 capitalize">{email.status}</span>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{email.to}</td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate" title={email.subject}>
                      {email.subject}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {email.attempts}/{email.max_retries}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {format(new Date(email.created_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-500 max-w-xs truncate" title={email.error || ''}>
                      {email.error || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {email.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction('retry', email.id)}
                            disabled={processing}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Email?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this email from the queue.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleAction('delete', email.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmails.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>No emails in queue</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
