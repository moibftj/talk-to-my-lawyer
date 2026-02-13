import { getUser } from '@/lib/auth/get-user'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Button } from './ui/button'
import { createClient } from '@/lib/supabase/server'
import { 
  Home, 
  FileText, 
  Plus, 
  CreditCard, 
  DollarSign, 
  Ticket, 
  Share2, 
  Wallet, 
  Receipt, 
  Settings,
  LogOut,
  User,
  Bell,
  ShieldCheck,
  ChevronRight
} from 'lucide-react'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getUser()
  
  if (!profile) {
    redirect('/auth/login')
  }

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
  }

  const navigation = {
    subscriber: [
      { name: 'Overview', href: '/dashboard', icon: Home },
      { name: 'My Letters', href: '/dashboard/letters', icon: FileText },
      { name: 'Create New Letter', href: '/dashboard/letters/new', icon: Plus },
      { name: 'Subscription', href: '/dashboard/subscription', icon: CreditCard },
      { name: 'Billing', href: '/dashboard/billing', icon: Receipt },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
    employee: [
      { name: 'Overview', href: '/dashboard', icon: Home },
      { name: 'Commissions', href: '/dashboard/commissions', icon: DollarSign },
      { name: 'My Coupons', href: '/dashboard/coupons', icon: Ticket },
      { name: 'Referral Links', href: '/dashboard/referrals', icon: Share2 },
      { name: 'Payouts', href: '/dashboard/payouts', icon: Wallet },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ]
  }

  const userNav = navigation[profile.role as keyof typeof navigation] || navigation.subscriber

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-legal-navy text-white flex-col sticky top-0 h-screen">
        <div className="p-8 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-white p-1 rounded-full shadow-lg transition-transform group-hover:scale-110">
              <Image
                src={DEFAULT_LOGO_SRC}
                alt={DEFAULT_LOGO_ALT}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full"
              />
            </div>
            <span className="text-xl font-serif font-bold text-white tracking-tight">Talk-to-my-Lawyer</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <div className="px-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/30">Main Menu</p>
          </div>
          {userNav.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group text-sky-100/60 hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-5 w-5 text-sky-100/40 group-hover:text-legal-gold" />
                <span className="font-bold text-sm tracking-wide">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="bg-white/5 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-legal-gold/20 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-legal-gold" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">Premium Support</span>
            </div>
            <p className="text-[10px] text-sky-100/40 leading-relaxed mb-3">Need legal assistance? Our team is here to help.</p>
            <Link href="/contact" className="text-[10px] font-bold text-legal-gold hover:text-white uppercase tracking-widest">
              Contact Attorney
            </Link>
          </div>
          
          <form action={handleSignOut}>
            <button
              type="submit"
              className="flex items-center gap-4 px-4 py-3 w-full rounded-xl text-sky-100/60 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
            >
              <LogOut className="h-5 w-5 text-sky-100/40 group-hover:text-red-400" />
              <span className="font-bold text-sm tracking-wide">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Nav */}
      <nav className="lg:hidden bg-legal-navy text-white p-4 sticky top-0 z-50 flex justify-between items-center border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={DEFAULT_LOGO_SRC}
            alt={DEFAULT_LOGO_ALT}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full bg-white p-0.5"
          />
          <span className="font-serif font-bold text-sm">Talk-to-my-Lawyer</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
            <User className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header - Desktop */}
        <header className="hidden lg:flex h-20 bg-white border-b border-slate-200 items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-serif font-bold text-legal-navy">Dashboard</h2>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:text-legal-navy transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-legal-gold rounded-full border-2 border-white"></span>
            </button>
            
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-legal-navy leading-none mb-1">{profile.full_name || profile.email}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profile.role}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                <User className="h-5 w-5 text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-12">
          <div className="max-w-6xl mx-auto animate-fade-in">
            {/* Mobile Horizontal Nav */}
            <div className="lg:hidden flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
              {userNav.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className="shrink-0">
                    <Button variant="outline" size="sm" className="flex items-center gap-2 border-slate-200 text-slate-600">
                      <Icon className="h-3.5 w-3.5" />
                      {item.name}
                    </Button>
                  </Link>
                )
              })}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
