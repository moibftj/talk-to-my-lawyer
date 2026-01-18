'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setSubmitted(true)
      toast.success('Password reset link sent to your email')

    } catch (err: any) {
      console.error('[Forgot Password] Error:', err)

      // Provide clear, user-friendly error messages
      const errorMessage = err?.message || ''
      let friendlyError = 'Failed to send reset email'

      if (errorMessage.includes('User not found')) {
        friendlyError = 'No account found with this email address. Please check and try again.'
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
        friendlyError = 'Too many attempts. Please wait a moment and try again.'
      } else if (errorMessage.includes('Invalid email')) {
        friendlyError = 'Please enter a valid email address.'
      } else if (err instanceof Error) {
        friendlyError = err.message
      }

      toast.error(friendlyError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-50 px-4">
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
          <div className="flex items-center gap-2 mb-4">
            <Link href="/auth/login" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <CardTitle className="text-2xl font-bold">Forgot Password?</CardTitle>
          </div>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Reset Link
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/auth/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remember your password? Sign in
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 checkmark" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
                <p className="text-muted-foreground mb-4">
                  We've sent a password reset link to your email address.
                  Please check your inbox and follow the instructions.
                </p>
                <p className="text-sm text-muted-foreground">
                  Don't see the email? Check your spam folder or try again.
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSubmitted(false)}
                >
                  Try Again
                </Button>

                <Link href="/auth/login">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
