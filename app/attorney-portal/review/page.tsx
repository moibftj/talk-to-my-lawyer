import { createClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/auth/admin-session'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, FileText, User, LogOut, Scale, UserCheck } from 'lucide-react'
import { format } from 'date-fns'

export default async function AttorneyReviewPage() {
  const supabase = await createClient()
  const session = await getAdminSession()
  const currentUserId = session?.userId || null

  const { data: letters, error } = await supabase
    .from('letters')
    .select(`
      *,
      profiles (
        id,
        full_name,
        email
      )
    `)
    .in('status', ['pending_review', 'under_review'])
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[AttorneyReview] Error fetching letters:', error)
  }

  const allLetters = letters || []

  const myLetters = allLetters.filter((l: any) => l.assigned_to && l.assigned_to === currentUserId)
  const unassignedLetters = allLetters.filter((l: any) => !l.assigned_to)
  const othersLetters = allLetters.filter((l: any) => l.assigned_to && l.assigned_to !== currentUserId)

  const assignedToMeCount = myLetters.length
  const unassignedCount = unassignedLetters.length
  const underReviewCount = allLetters.filter((l: any) => l.status === 'under_review').length

  const otherAssigneeIds = [...new Set(othersLetters.map((l: any) => l.assigned_to).filter(Boolean))] as string[]
  let assigneeNames: Record<string, string> = {}

  if (otherAssigneeIds.length > 0) {
    try {
      const { data: assigneeProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', otherAssigneeIds)

      if (assigneeProfiles) {
        for (const p of assigneeProfiles) {
          assigneeNames[p.id] = p.full_name || p.email || 'Unknown'
        }
      }
    } catch (error) {
      console.error('[AttorneyReview] Error fetching assignee profiles:', error)
      // Fall back to empty assigneeNames - will display "Another Attorney"
    }
  }

  const statusColors: Record<string, string> = {
    'pending_review': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'under_review': 'bg-blue-100 text-blue-800 border-blue-300'
  }

  const statusLabels: Record<string, string> = {
    'pending_review': 'Pending Review',
    'under_review': 'Under Review'
  }

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

  const renderLetterCard = (letter: any, borderColor: string, dimmed?: boolean) => (
    <Card key={letter.id} className={`hover:bg-muted/30 transition-colors border-l-4 ${dimmed ? 'opacity-60' : ''}`} style={{
      borderLeftColor: borderColor
    }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {letter.title || 'Untitled Letter'}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={statusColors[letter.status]}>
                    {statusLabels[letter.status]}
                  </Badge>
                  {letter.assigned_to && letter.assigned_to === currentUserId && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      <UserCheck className="w-3 h-3 mr-1" />
                      Assigned to You
                    </Badge>
                  )}
                  {letter.assigned_to && letter.assigned_to !== currentUserId && (
                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                      Assigned to {assigneeNames[letter.assigned_to] || 'Another Attorney'}
                    </Badge>
                  )}
                  {!letter.assigned_to && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                      Unassigned
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="truncate">
                  Client {letter.user_id?.slice(0, 6)}...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="capitalize">{letter.letter_type?.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Submitted {format(new Date(letter.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>

            {letter.status === 'pending_review' && (
              <div className="mt-3 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                Waiting {Math.floor((Date.now() - new Date(letter.created_at).getTime()) / (1000 * 60 * 60))} hours
              </div>
            )}
          </div>

          <Link href={`/attorney-portal/review/${letter.id}`}>
            <Button>
              {letter.status === 'pending_review' ? 'Start Review' : 'Continue Review'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Scale className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Review Center</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve legal letters submitted by subscribers
            </p>
          </div>
        </div>
        <Link href="/api/admin-auth/logout">
          <Button variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </Link>
      </div>

      {isTestMode && (
        <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-amber-800">Test Mode Active</p>
              <p className="text-sm text-amber-700">You're reviewing letters created with simulated payments (no real Stripe charges).</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assigned to You</p>
                <p className="text-3xl font-bold text-green-600">{assignedToMeCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unassigned</p>
                <p className="text-3xl font-bold text-yellow-600">{unassignedCount}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Under Review</p>
                <p className="text-3xl font-bold text-blue-600">{underReviewCount}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {allLetters.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground">No letters pending review at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {myLetters.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Assigned to You ({myLetters.length})
              </h2>
              {myLetters.map((letter: any) => renderLetterCard(letter, '#22c55e'))}
            </div>
          )}

          {unassignedLetters.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                Unassigned ({unassignedLetters.length})
              </h2>
              {unassignedLetters.map((letter: any) => renderLetterCard(letter, '#eab308'))}
            </div>
          )}

          {othersLetters.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                Assigned to Others ({othersLetters.length})
              </h2>
              {othersLetters.map((letter: any) => renderLetterCard(letter, '#9ca3af', true))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
