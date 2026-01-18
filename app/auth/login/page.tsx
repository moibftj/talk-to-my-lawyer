'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      console.log('[Login] Starting login process...')
      
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('[Login] Auth response:', { authData, signInError })

      if (signInError) throw signInError

      if (!authData.user) {
        throw new Error('No user data returned from sign in')
      }

      console.log('[Login] User signed in:', authData.user.id)

      // Get user role to redirect appropriately - retry a few times if profile doesn't exist yet
      let profile = null
      let profileError = null
      
      for (let i = 0; i < 3; i++) {
        const result = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle()
        
        profile = result.data
        profileError = result.error
        
        if (profile) break
        
        // Wait a bit before retrying
        if (i < 2) {
          console.log('[Login] Profile not found, retrying...')
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      console.log('[Login] Profile data:', { profile, profileError })

      if (!profile) {
        console.warn('[Login] Profile not found after retries, creating via API...')
        
        // Create profile using the API endpoint (has service role access)
        try {
          const createResponse = await fetch('/api/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: authData.user.id,
              email: authData.user.email || email,
              role: 'subscriber',
              fullName: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'User'
            })
          })
          
          if (createResponse.ok) {
            console.log('[Login] Profile created successfully via API')
          } else {
            console.error('[Login] Failed to create profile via API:', await createResponse.text())
          }
        } catch (err) {
          console.error('[Login] Error calling create-profile API:', err)
        }
        
        // Default to subscriber dashboard
        console.log('[Login] Redirecting to default: /dashboard/letters')
        router.push('/dashboard/letters')
        router.refresh()
        return
      }

      const roleRedirects: Record<string, string> = {
        'subscriber': '/dashboard/letters',
        'employee': '/dashboard/commissions',
        'admin': '/dashboard/admin/letters'
      }

      const redirectPath = roleRedirects[profile?.role || 'subscriber']
      console.log('[Login] Redirecting to:', redirectPath)
      
      router.push(redirectPath)
      router.refresh()
    } catch (err: any) {
      console.error('[Login] Error:', err)

      // Provide clear, user-friendly error messages
      const errorMessage = err?.message || ''
      let friendlyError = 'Failed to sign in'

      if (errorMessage.includes('Invalid login credentials')) {
        friendlyError = 'Incorrect email or password. Please check your credentials and try again.'
      } else if (errorMessage.includes('Email not confirmed')) {
        friendlyError = 'Please confirm your email address before signing in. Check your inbox for the confirmation link.'
      } else if (errorMessage.includes('Too many requests')) {
        friendlyError = 'Too many sign-in attempts. Please wait a moment and try again.'
      } else if (errorMessage.includes('Invalid email')) {
        friendlyError = 'Please enter a valid email address.'
      } else if (err instanceof Error) {
        friendlyError = err.message
      }

      setError(friendlyError)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Image
              src={DEFAULT_LOGO_SRC}
              alt={DEFAULT_LOGO_ALT}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full logo-badge"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access TalkToMyLawyer.com
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-primary hover:text-primary/80 hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
