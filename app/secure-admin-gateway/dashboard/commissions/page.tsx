import { isAdminAuthenticated } from '@/lib/auth/admin-session'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { PayCommissionButton } from '@/components/pay-commission-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Users, Clock, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic';

export default async function AdminCommissionsPage() {
  // Verify admin session
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    redirect('/secure-admin-gateway/login')
  }

  const supabase = await createClient()
  const { data: commissions } = await supabase
    .from('commissions')
    .select(`
      *,
      profiles!employee_id (
        full_name,
        email
      ),
      subscriptions!inner (
        plan,
        price
      )
    `)
    .order('created_at', { ascending: false })

  // Calculate stats
  const totalPending = commissions?.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0) || 0
  const totalPaid = commissions?.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0) || 0
  const pendingCount = commissions?.filter((c: any) => c.status === 'pending').length || 0
  const paidCount = commissions?.filter((c: any) => c.status === 'paid').length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Commission Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage employee commission payouts and track payments
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={pendingCount > 0 ? 'border-amber-300 bg-amber-50/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-700' : ''}`}>
              ${totalPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">{pendingCount} commissions awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{paidCount} commissions paid out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commissions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All time commissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(commissions?.map((c: any) => c.employee_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">Employees with commissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Commissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Commissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions?.map((commission: any) => (
                  <tr key={commission.id} className="hover:bg-muted/30">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium">{commission.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{commission.profiles?.email}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {format(new Date(commission.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {commission.subscriptions?.plan || 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      ${Number(commission.subscription_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-green-600">
                      ${Number(commission.commission_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'}
                        className={commission.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                        {commission.status === 'paid' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Paid</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Pending</>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {commission.status === 'pending' && (
                        <PayCommissionButton commissionId={commission.id} />
                      )}
                    </td>
                  </tr>
                ))}
                {(!commissions || commissions.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No commissions found
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
