'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Shield, Scale, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface CreateAdminFormProps {
  onSuccess?: () => void
}

export function CreateAdminForm({ onSuccess }: CreateAdminFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [subRole, setSubRole] = useState<'super_admin' | 'attorney_admin'>('attorney_admin')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      const csrfRes = await fetch('/api/admin/users/create', { method: 'GET', credentials: 'include' })
      const csrfData = await csrfRes.json()

      if (!csrfData.csrfToken) {
        setResult({ success: false, message: 'Failed to get security token' })
        setIsSubmitting(false)
        return
      }

      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, fullName, adminSubRole: subRole }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({ success: true, message: `${subRole === 'attorney_admin' ? 'Attorney' : 'Super Admin'} account created for ${email}` })
        setEmail('')
        setPassword('')
        setFullName('')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setResult({ success: false, message: data.error || 'Failed to create account' })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Create Admin Account
      </Button>
    )
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5" />
          Create Admin Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Smith"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Role *</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSubRole('attorney_admin')}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                    subRole === 'attorney_admin'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Scale className="h-4 w-4" />
                  Attorney
                </button>
                <button
                  type="button"
                  onClick={() => setSubRole('super_admin')}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                    subRole === 'super_admin'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Super Admin
                </button>
              </div>
            </div>
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {result.message}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setIsOpen(false); setResult(null) }}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
