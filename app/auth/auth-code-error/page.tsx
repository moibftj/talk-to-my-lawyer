'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-red-600">Authentication Error</CardTitle>
          <CardDescription>
            There was a problem confirming your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p>This could happen if:</p>
            <ul className="mt-2 text-sm text-left space-y-1">
              <li>• The confirmation link expired</li>
              <li>• The link was already used</li>
              <li>• There was a network issue</li>
            </ul>
          </div>
          
          <div className="flex flex-col space-y-2">
            <Button asChild>
              <Link href="/auth/signup">
                Try Signing Up Again
              </Link>
            </Button>
            
            <Button variant="outline" asChild>
              <Link href="/auth/signin">
                Sign In Instead
              </Link>
            </Button>
          </div>
          
          <div className="text-center">
            <Link href="/contact" className="text-sm text-blue-600 hover:underline">
              Contact Support
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}