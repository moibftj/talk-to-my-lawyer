'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  User,
  Mail,
  Phone,
  Building,
  Key,
  Gift,
  TrendingUp,
  Users,
  LogOut
} from 'lucide-react'

export const dynamic = 'force-dynamic';

export default function EmployeeSettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [coupons, setCoupons] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const supabase = createClient()

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company_name: ''
  })

  // Password form
  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    async function loadEmployeeData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)
        setFormData({
          full_name: profileData.full_name || '',
          phone: profileData.phone || '',
          company_name: profileData.company_name || ''
        })

        // Load employee coupons
        const { data: couponData } = await supabase
          .from('employee_coupons')
          .select('*')
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false })

        setCoupons(couponData || [])

        // Load commissions
        const { data: commissionData } = await supabase
          .from('commissions')
          .select(`
            *,
            subscriptions!inner(
              id,
              user_id,
              plan,
              status,
              created_at
            )
          `)
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        setCommissions(commissionData || [])
      } catch (error) {
        console.error('Error loading employee data:', error)
        toast.error('Failed to load profile data')
      } finally {
        setLoading(false)
      }
    }

    loadEmployeeData()
  }, [supabase])

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', profile.id)

      if (error) throw error

      setProfile({ ...profile, ...formData })
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordLoading(true)

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match')
      setPasswordLoading(false)
      return
    }

    if (passwordData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters')
      setPasswordLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new_password
      })

      if (error) throw error

      setPasswordData({
        new_password: '',
        confirm_password: ''
      })

      toast.success('Password updated successfully!')
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error('Failed to update password')
    } finally {
      setPasswordLoading(false)
    }
  }

  async function generateNewCoupon() {
    try {
      const couponCode = `TTML${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const { error } = await supabase
        .from('employee_coupons')
        .insert({
          employee_id: profile.id,
          code: couponCode,
          discount_percent: 20,
          is_active: true
        })

      if (error) throw error

      toast.success('New coupon code generated!')

      // Refresh coupons
      const { data: newCoupons } = await supabase
        .from('employee_coupons')
        .select('*')
        .eq('employee_id', profile.id)
        .order('created_at', { ascending: false })

      setCoupons(newCoupons || [])
    } catch (error) {
      console.error('Error generating coupon:', error)
      toast.error('Failed to generate coupon')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-40 w-40 border-b-2 border-primary"></div>
      </div>
    )
  }

  const totalEarnings = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.commission_amount, 0)

  const pendingEarnings = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.commission_amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Settings</h1>
        <p className="text-muted-foreground">Manage your profile, coupons, and commissions</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Profile</CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={updateProfile} className="space-y-4">
                <div className="flex items-center space-x-4 pb-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="text-lg">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium">{profile?.full_name || 'Employee'}</h3>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {profile?.role}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name (Optional)</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Your company name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={profile?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Referral Coupons</CardTitle>
              <CardDescription>
                Generate and manage your discount coupon codes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <h4 className="font-medium">Generate New Coupon</h4>
                  <p className="text-sm text-muted-foreground">
                    Create a new 20% discount coupon for customers
                  </p>
                </div>
                <Button onClick={generateNewCoupon}>
                  <Gift className="h-4 w-4 mr-2" />
                  Generate Coupon
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Your Active Coupons</h4>
                {coupons.length > 0 ? (
                  <div className="grid gap-3">
                    {coupons.map((coupon) => (
                      <div key={coupon.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-mono font-medium">{coupon.code}</p>
                          <p className="text-sm text-muted-foreground">
                            {coupon.discount_percent}% discount • {coupon.usage_count} uses
                          </p>
                        </div>
                        <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No coupons generated yet. Click "Generate Coupon" to create your first one.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Total Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${totalEarnings.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">From paid commissions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pending Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  ${pendingEarnings.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">From pending commissions</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Commissions</CardTitle>
              <CardDescription>
                Your commission history and earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissions.length > 0 ? (
                <div className="space-y-3">
                  {commissions.map((commission) => (
                    <div key={commission.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Subscription Sale</p>
                        <p className="text-sm text-muted-foreground">
                          ${commission.subscription_amount.toFixed(2)} • 5% commission
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${commission.commission_amount.toFixed(2)}</p>
                        <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'}>
                          {commission.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No commissions yet. Share your coupon codes to start earning!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={updatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordData.confirm_password}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    placeholder="Confirm new password"
                  />
                </div>

                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Sign Out</h4>
                  <p className="text-sm text-muted-foreground">
                    Sign out of your current session
                  </p>
                </div>
                <Button variant="outline" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}