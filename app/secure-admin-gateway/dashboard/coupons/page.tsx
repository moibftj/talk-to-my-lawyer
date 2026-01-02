'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Ticket,
  Users,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Percent,
  Plus,
  Power
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { getAdminCsrfToken } from '@/lib/admin/csrf-client'

interface CouponData {
  id: string
  code: string
  employee_name: string
  employee_email: string
  discount_percent: number
  is_active: boolean
  usage_count: number
  total_discount_given: number
  total_commissions_earned: number
  created_at: string
}

interface CouponAnalytics {
  summary: {
    total_coupons: number
    active_coupons: number
    total_uses: number
    total_discount_given: number
    total_commissions_paid: number
    avg_discount_per_use: number
  }
  coupons: CouponData[]
  top_performers: CouponData[]
}

export default function CouponsAnalyticsPage() {
  const [data, setData] = useState<CouponAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountPercent: 10,
    maxUses: '',
    description: ''
  })

  const handleCreateCoupon = async () => {
    if (newCoupon.discountPercent < 1 || newCoupon.discountPercent > 100) {
      toast.error('Discount must be between 1 and 100')
      return
    }

    setCreating(true)
    try {
      const csrfToken = await getAdminCsrfToken()
      const response = await fetch('/api/admin/coupons/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          code: newCoupon.code || undefined,
          discountPercent: newCoupon.discountPercent,
          maxUses: newCoupon.maxUses ? parseInt(newCoupon.maxUses) : undefined,
          description: newCoupon.description || undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create coupon')
      }

      toast.success(`Coupon "${result.coupon.code}" created successfully!`)
      setCreateDialogOpen(false)
      setNewCoupon({ code: '', discountPercent: 10, maxUses: '', description: '' })
      fetchCouponAnalytics()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create coupon')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleCoupon = async (couponId: string, currentStatus: boolean) => {
    try {
      const csrfToken = await getAdminCsrfToken()
      const response = await fetch('/api/admin/coupons/create', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ couponId, isActive: !currentStatus })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      toast.success(result.message)
      fetchCouponAnalytics()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update coupon')
    }
  }

  const fetchCouponAnalytics = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/admin/coupons')
      if (!response.ok) {
        throw new Error('Failed to fetch coupon analytics')
      }
      const result = await response.json()
      setData(result.data)
      setError(null)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load coupon analytics'
      setError(errorMessage)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCouponAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to Load Coupon Analytics</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchCouponAnalytics}>Try Again</Button>
      </div>
    )
  }

  if (!data) return null

  const usageChartData = data.top_performers.map(coupon => ({
    name: coupon.code,
    uses: coupon.usage_count,
    discount: Number(coupon.total_discount_given),
    commissions: Number(coupon.total_commissions_earned)
  }))

  const statusData = [
    { name: 'Active', value: data.summary.active_coupons, color: '#10b981' },
    { name: 'Inactive', value: data.summary.total_coupons - data.summary.active_coupons, color: '#6b7280' }
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Coupon Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Monitor employee coupon usage, discounts, and commission impact
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Promo Coupon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Promotional Coupon</DialogTitle>
                <DialogDescription>
                  Create a new promotional coupon code. Leave the code empty to auto-generate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Coupon Code (optional)</Label>
                  <Input
                    id="code"
                    placeholder="Leave empty to auto-generate"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount Percentage *</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="1"
                    max="100"
                    value={newCoupon.discountPercent}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountPercent: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUses">Max Uses (optional)</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={newCoupon.maxUses}
                    onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="Internal note about this coupon"
                    value={newCoupon.description}
                    onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateCoupon} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Coupon'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchCouponAnalytics}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_coupons}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs bg-green-500">
                {data.summary.active_coupons} active
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_uses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg ${Number(data.summary.avg_discount_per_use).toFixed(2)}/use
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${Number(data.summary.total_discount_given).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Discount impact on revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Commissions Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${Number(data.summary.total_commissions_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Paid to employees
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performers Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Performing Coupons
            </CardTitle>
            <CardDescription>
              Usage and revenue impact by coupon code
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="uses" name="Total Uses" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="commissions" name="Commissions ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No coupon data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coupon Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Coupon Status
            </CardTitle>
            <CardDescription>
              Active vs inactive coupons
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No coupon status data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Employee Coupons</CardTitle>
          <CardDescription>
            Complete list of all coupon codes and their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Uses
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Discount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Commissions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-primary">
                      {coupon.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{coupon.employee_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{coupon.employee_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {coupon.discount_percent}%
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {coupon.usage_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-orange-600 font-medium">
                      ${Number(coupon.total_discount_given).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600 font-medium">
                      ${Number(coupon.total_commissions_earned).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={coupon.is_active ? 'default' : 'secondary'} className={coupon.is_active ? 'bg-green-100 text-green-800' : ''}>
                          {coupon.is_active ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                          )}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleCoupon(coupon.id, coupon.is_active)}
                          title={coupon.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power className={`h-4 w-4 ${coupon.is_active ? 'text-red-500' : 'text-green-500'}`} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.coupons.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No coupons found
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
