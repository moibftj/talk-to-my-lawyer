"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Mail,
  Users,
  Users2,
  Ticket,
  DollarSign,
  CreditCard,
  BarChart3,
  Menu,
  X,
  Gavel,
  FileStack
} from "lucide-react"
import { useState } from "react"
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from "@/lib/constants"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard
  },
  {
    title: "Review Center",
    href: "/admin/letters",
    icon: Gavel,
    badge: "Review"
  },
  {
    title: "All Letters",
    href: "/admin/all-letters",
    icon: FileStack
  },
  {
    title: "All Users",
    href: "/admin/users",
    icon: Users
  },
  {
    title: "Employees",
    href: "/admin/employees",
    icon: Users2
  },
  {
    title: "Coupons",
    href: "/admin/coupons",
    icon: Ticket
  },
  {
    title: "Commissions",
    href: "/admin/commissions",
    icon: DollarSign
  },
  {
    title: "Subscriptions",
    href: "/admin/subscriptions",
    icon: CreditCard
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3
  }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 h-screen sticky top-0 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full logo-badge"
              priority
            />
            {!isCollapsed && (
              <span className="text-sm font-semibold text-gray-900">Talk-to-my-Lawyer</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
