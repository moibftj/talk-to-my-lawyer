'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Home,
  FileText,
  Users,
  CreditCard,
  Gift,
  Settings,
  LogOut,
  Menu,
  Shield,
  TrendingUp,
  User,
  ChevronDown
} from 'lucide-react'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profileData)
      } catch (error) {
        console.error('Error loading profile:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear local state immediately to prevent redirect loops
    setProfile(null)
    // Force a hard navigation to ensure clean session state
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-40 w-40 border-b-2 border-primary"></div>
      </div>
    )
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['subscriber', 'employee', 'admin'] },
    { name: 'My Letters', href: '/dashboard/letters', icon: FileText, roles: ['subscriber'] },
    { name: 'Commissions', href: '/dashboard/commissions', icon: TrendingUp, roles: ['employee'] },
    { name: 'Coupons', href: '/dashboard/coupons', icon: Gift, roles: ['employee'] },
    { name: 'Subscription', href: '/dashboard/subscription', icon: CreditCard, roles: ['subscriber'] },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['subscriber'] },
    { name: 'Employee Settings', href: '/dashboard/employee-settings', icon: Settings, roles: ['employee'] },
    { name: 'Admin Panel', href: '/dashboard/admin', icon: Shield, roles: ['admin'] },
    { name: 'Users', href: '/dashboard/admin/users', icon: Users, roles: ['admin'] },
    { name: 'Analytics', href: '/dashboard/admin/analytics', icon: TrendingUp, roles: ['admin'] },
    { name: 'Admin Settings', href: '/dashboard/admin-settings', icon: Settings, roles: ['admin'] },
      ]

  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(profile?.role)
  )

  function NavItems({ mobile = false }: { mobile?: boolean }) {
    return (
      <>
        {filteredNavigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))

          if (mobile) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={() => mobile && document.body.click()}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            )
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:z-50 md:flex md:w-64 md:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 py-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src={DEFAULT_LOGO_SRC}
                alt={DEFAULT_LOGO_ALT}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full logo-badge"
                priority
              />
              <span className="text-xl font-bold">TalkToMyLawyer.com</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <NavItems />
                </ul>
              </li>
            </ul>
          </nav>

          {/* User Profile */}
          <div className="border-t pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                  <User className="mr-2 h-4 w-4" />
                  {profile?.full_name || profile?.email || 'User'}
                  <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.full_name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile?.email}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {profile?.role}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between border-b bg-background px-4 py-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full logo-badge"
              priority
            />
            <span className="text-lg font-bold">TTML</span>
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-full flex-col gap-y-5 overflow-y-auto bg-background px-6 py-4">
                {/* Logo */}
                <div className="flex h-16 shrink-0 items-center">
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <Image
                      src={DEFAULT_LOGO_SRC}
                      alt={DEFAULT_LOGO_ALT}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full logo-badge"
                      priority
                    />
                    <span className="text-xl font-bold">TalkToMyLawyer.com</span>
                  </Link>
                </div>

                {/* Navigation */}
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-1">
                        <NavItems mobile />
                      </ul>
                    </li>
                  </ul>
                </nav>

                {/* User Profile */}
                <div className="border-t pt-4">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">
                      {profile?.full_name || profile?.email || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {profile?.role}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:pl-64">
        <main className="p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
