'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_LOGO_ALT, DEFAULT_LOGO_SRC } from '@/lib/constants'

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckEmailContent />
    </Suspense>
  )
}

function CheckEmailContent() {
  const searchParams = useSearchParams()
  const emailFromUrl = searchParams.get('email') || ''
  
  const [email, setEmail] = useState(emailFromUrl)
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleResendConfirmation = async () => {
    if (!email) {
      setResendMessage({ type: 'error', text: 'Please enter your email address' })
      return
    }

    setIsResending(true)
    setResendMessage(null)

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.alreadyConfirmed) {
          setResendMessage({ type: 'success', text: 'Your email is already confirmed! You can sign in.' })
        } else {
          setResendMessage({ type: 'success', text: data.message || 'Confirmation email sent! Check your inbox.' })
        }
      } else {
        setResendMessage({ type: 'error', text: data.error || 'Failed to resend confirmation email' })
      }
    } catch (error) {
      setResendMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-muted/30 to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
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
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We've sent you a confirmation email. Please check your inbox and click the link to verify your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            After confirming your email, you'll be able to sign in and access your dashboard.
          </p>
          
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-center">Didn't receive the email?</p>
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isResending}
              />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleResendConfirmation}
                disabled={isResending}
              >
                {isResending ? 'Sending...' : 'Resend Confirmation Email'}
              </Button>
            </div>
            
            {resendMessage && (
              <div className={`p-3 text-sm rounded-md ${
                resendMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {resendMessage.text}
              </div>
            )}
          </div>
          
          <Button asChild className="w-full">
            <Link href="/auth/login">
              Return to Sign In
            </Link>
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Tip: Check your spam or junk folder if you don't see the email in your inbox.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
