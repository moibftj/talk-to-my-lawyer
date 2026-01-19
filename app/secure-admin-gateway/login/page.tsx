'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [portalKey, setPortalKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          portalKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      // Use redirectUrl from response (handles both super admin and attorney admin routing)
      const redirectUrl = data.redirectUrl || '/secure-admin-gateway/dashboard'
      // Use window.location.href for reliable navigation with secure cookies
      window.location.href = redirectUrl

    } catch (err: any) {
      console.error('[AdminLogin] Error:', err)
      setError(err.message || 'Failed to authenticate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <title>Admin Login - Talk-To-My-Lawyer</title>
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={150}
              height={150}
              className="h-38 w-38 rounded-full logo-badge"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">
            Admin Portal
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Sign in with your admin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@talk-to-my-lawyer.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portalKey" className="text-slate-200">Portal Access Key</Label>
              <Input
                id="portalKey"
                type="password"
                placeholder="Enter admin portal key"
                value={portalKey}
                onChange={(e) => setPortalKey(e.target.value)}
                required
                disabled={loading}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-500">Required 3rd factor for admin access</p>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-md flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>

            <div className="pt-4 border-t border-slate-700">
              <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure admin access • All actions are logged
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
