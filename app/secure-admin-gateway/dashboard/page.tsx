import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, FileText, Users, AlertCircle, CheckCircle, Clock, Ticket, DollarSign, BarChart3, Briefcase, Gavel } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { isAdminAuthenticated } from '@/lib/auth/admin-session'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // Verify admin session
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    redirect('/secure-admin-gateway/login')
  }

  const supabase = await createClient()

  // Fetch all metrics in parallel for performance
  const [
    pendingLettersResult,
    totalLettersResult,
    subscribersResult,
    employeesResult,
    couponsResult,
    pendingCommissionsResult,
    approvedTodayResult,
    recentPendingResult
  ] = await Promise.all([
    supabase.from('letters').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('letters').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'subscriber'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
    supabase.from('employee_coupons').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('commissions').select('commission_amount').eq('status', 'pending'),
    supabase.from('letters').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('approved_at', new Date().toISOString().split('T')[0]),
    supabase.from('letters').select('*, profiles(full_name, email)').eq('status', 'pending_review').order('created_at', { ascending: true }).limit(5)
  ])

  const pendingCount = pendingLettersResult.count || 0
  const totalLetters = totalLettersResult.count || 0
  const subscriberCount = subscribersResult.count || 0
  const employeeCount = employeesResult.count || 0
  const activeCoupons = couponsResult.count || 0
  const pendingCommissionsTotal = pendingCommissionsResult.data?.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0) || 0
  const approvedToday = approvedTodayResult.count || 0
  const recentPending = recentPendingResult.data || []

  // Quick action cards for admin
  const quickActions = [
    {
      title: 'Review Center',
      description: 'Review and approve pending letters',
      href: '/secure-admin-gateway/review',
      icon: Gavel,
      color: 'bg-amber-100 text-amber-700',
      badge: pendingCount > 0 ? `${pendingCount} pending` : null,
      badgeColor: 'bg-amber-500'
    },
    {
      title: 'User Management',
      description: 'View all subscribers and employees',
      href: '/secure-admin-gateway/dashboard/users',
      icon: Users,
      color: 'bg-blue-100 text-blue-700',
      badge: null,
      badgeColor: ''
    },
    {
      title: 'Coupon Analytics',
      description: 'Employee coupon usage and impact',
      href: '/secure-admin-gateway/dashboard/coupons',
      icon: Ticket,
      color: 'bg-purple-100 text-purple-700',
      badge: activeCoupons > 0 ? `${activeCoupons} active` : null,
      badgeColor: 'bg-purple-500'
    },
    {
      title: 'Commissions',
      description: 'Manage employee payouts',
      href: '/secure-admin-gateway/dashboard/commissions',
      icon: DollarSign,
      color: 'bg-green-100 text-green-700',
      badge: pendingCommissionsTotal > 0 ? `$${pendingCommissionsTotal.toFixed(2)} pending` : null,
      badgeColor: 'bg-green-500'
    },
    {
      title: 'Full Analytics',
      description: 'Comprehensive reports and trends',
      href: '/secure-admin-gateway/dashboard/analytics',
      icon: BarChart3,
      color: 'bg-indigo-100 text-indigo-700',
      badge: null,
      badgeColor: ''
    },
    {
      title: 'All Letters',
      description: 'Browse complete letter history',
      href: '/secure-admin-gateway/dashboard/all-letters',
      icon: FileText,
      color: 'bg-slate-100 text-slate-700',
      badge: null,
      badgeColor: ''
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back. Here&apos;s an overview of your platform.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={pendingCount > 0 ? 'border-amber-300 bg-amber-50/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <AlertCircle className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-700' : ''}`}>{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting your review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedToday}</div>
            <p className="text-xs text-muted-foreground">Letters approved today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Letters</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLetters}</div>
            <p className="text-xs text-muted-foreground">All time generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriberCount + employeeCount}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{subscriberCount} subscribers</Badge>
              <Badge variant="outline" className="text-xs">{employeeCount} employees</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="hover:bg-muted/50 transition-colors h-full cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${action.color}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{action.title}</h3>
                        {action.badge && (
                          <Badge variant="default" className={`text-xs text-white ${action.badgeColor}`}>
                            {action.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Review Queue Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Review Queue</h2>
          <Link href="/secure-admin-gateway/review">
            <Button variant="outline" size="sm">
              Go to Review Center <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {!recentPending || recentPending.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-foreground">All caught up!</h3>
              <p className="text-muted-foreground">No pending letters to review.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {recentPending.map((letter: any) => (
              <Card key={letter.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{letter.title || 'Untitled Letter'}</h3>
                      <p className="text-sm text-muted-foreground">
                        {letter.letter_type} • by {letter.profiles?.full_name || letter.profiles?.email || 'Unknown User'}
                      </p>
                    </div>
                  </div>
                  <Link href={`/secure-admin-gateway/review/${letter.id}`}>
                    <Button size="sm">Review</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
