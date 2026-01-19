import { getUser } from '@/lib/auth/get-user'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Button } from './ui/button'
import { createClient } from '@/lib/supabase/server'
import { Home, FileText, Plus, CreditCard, DollarSign, Ticket, Share2, Wallet, Receipt, Settings } from 'lucide-react'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getUser()
  const supabase = await createClient()

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  const navigation = {
    subscriber: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'My Letters', href: '/dashboard/letters', icon: FileText },
      { name: 'Create New Letter', href: '/dashboard/letters/new', icon: Plus },
      { name: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
      { name: 'Billing', href: '/dashboard/billing', icon: Receipt },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
    employee: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Commissions', href: '/dashboard/commissions', icon: DollarSign },
      { name: 'My Coupons', href: '/dashboard/coupons', icon: Ticket },
      { name: 'Referral Links', href: '/dashboard/referrals', icon: Share2 },
      { name: 'Payouts', href: '/dashboard/payouts', icon: Wallet },
    ]
  }

  const userNav = navigation[profile.role as keyof typeof navigation] || navigation.subscriber

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image
                src={DEFAULT_LOGO_SRC}
                alt={DEFAULT_LOGO_ALT}
                width={48}
                height={36}
                className="h-9 w-9 rounded-full logo-badge"
                priority
              />
              <span className="text-lg font-bold text-foreground">TalkToMyLawyer.com</span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {profile.full_name || profile.email}
                <span className="ml-2 px-2 py-1 text-xs bg-muted text-muted-foreground rounded capitalize">
                  {profile.role}
                </span>
              </div>
              <form action={handleSignOut}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8 flex-wrap">
          {userNav.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </div>

        {/* Main Content */}
        {children}
      </div>
    </div>
  )
}
