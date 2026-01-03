import { createClient } from '@/lib/supabase/server'
import { isAdminAuthenticated } from '@/lib/auth/admin-session'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, UserCheck, Briefcase, Shield, Mail, Calendar, FileText } from 'lucide-react'
import { format } from 'date-fns'

export default async function UsersManagementPage() {
  // Verify admin authentication
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    redirect('/secure-admin-gateway/login')
  }

  const supabase = await createClient()

  // Fetch all users with their stats
  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      role,
      created_at,
      updated_at,
      phone,
      company_name
    `)
    .order('created_at', { ascending: false })

  if (usersError) {
    console.error('[UsersPage] Error fetching users:', usersError)
  }

  // Get letter counts per user
  const { data: letterCounts } = await supabase
    .from('letters')
    .select('user_id')

  // Build letter count map
  const lettersByUser: Record<string, number> = {}
  letterCounts?.forEach(l => {
    lettersByUser[l.user_id] = (lettersByUser[l.user_id] || 0) + 1
  })

  // Get subscription status per user
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id, status, plan_type, credits_remaining, remaining_letters')
    .eq('status', 'active')

  // Build subscription map
  const subscriptionsByUser: Record<string, any> = {}
  subscriptions?.forEach(s => {
    subscriptionsByUser[s.user_id] = s
  })

  // Calculate role stats
  const totalUsers = users?.length || 0
  const subscribers = users?.filter(u => u.role === 'subscriber').length || 0
  const employees = users?.filter(u => u.role === 'employee').length || 0
  const admins = users?.filter(u => u.role === 'admin').length || 0

  const roleColors: Record<string, string> = {
    'subscriber': 'bg-blue-100 text-blue-800 border-blue-300',
    'employee': 'bg-purple-100 text-purple-800 border-purple-300',
    'admin': 'bg-red-100 text-red-800 border-red-300'
  }

  const roleIcons: Record<string, any> = {
    'subscriber': UserCheck,
    'employee': Briefcase,
    'admin': Shield
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all users, subscribers, and employees
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">All registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{subscribers}</div>
            <div className="flex items-center gap-2 mt-1">
              {superUsers > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {superUsers} super user{superUsers !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Briefcase className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{employees}</div>
            <p className="text-xs text-muted-foreground">With referral coupons</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{admins}</div>
            <p className="text-xs text-muted-foreground">System administrators</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Letters
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users?.map((user) => {
                  const RoleIcon = roleIcons[user.role] || UserCheck
                  const subscription = subscriptionsByUser[user.id]
                  const letterCount = lettersByUser[user.id] || 0

                  return (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <RoleIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {user.full_name || 'No Name'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                            {user.company_name && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {user.company_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={roleColors[user.role]}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {subscription ? (
                          <div>
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {subscription.plan_type?.replace(/_/g, ' ')}
                              <span className="ml-2">
                                ({subscription.credits_remaining || subscription.remaining_letters || 0} credits)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{letterCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(user.created_at), 'MMM d, yyyy')}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(!users || users.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No users found
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
