import { getAdminSession } from '@/lib/auth/admin-session'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Gavel, Scale } from 'lucide-react'
import { AdminLogoutButton } from '@/components/admin-logout-button'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default async function AttorneyReviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()

  if (!session) {
    redirect('/attorney-portal/login')
  }

  // Require attorney_admin OR super_admin access
  if (session.subRole !== 'attorney_admin' && session.subRole !== 'super_admin') {
    redirect('/attorney-portal/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-blue-800/50 backdrop-blur border-r border-blue-700 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-blue-700">
            <div className="flex items-center gap-2 mb-2">
              <Image
                src={DEFAULT_LOGO_SRC}
                alt={DEFAULT_LOGO_ALT}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full logo-badge"
                priority
              />
              <div>
                <h1 className="text-sm font-bold text-white">Attorney Portal</h1>
                <p className="text-xs text-blue-300">Review Center</p>
              </div>
            </div>
          </div>

          {/* Admin Info */}
          <div className="p-4 border-b border-blue-700 bg-blue-900/50">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-blue-100 truncate">{session.email}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Scale className="h-3 w-3 text-blue-400" />
              <span className="text-xs text-blue-400 font-semibold">Attorney Admin</span>
            </div>
            <p className="text-xs text-blue-400 mt-1">
              Session expires in {Math.round((1800000 - (Date.now() - session.lastActivity)) / 60000)} min
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <Link
              href="/attorney-portal/review"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-blue-200 hover:text-white hover:bg-blue-700 transition-colors"
            >
              <Gavel className="h-4 w-4" />
              <span className="text-sm">Review Center</span>
            </Link>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-blue-700">
            <AdminLogoutButton />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-8 max-w-7xl">
            <div className="bg-white rounded-lg shadow-sm border p-6 min-h-full">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
