'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

export function AdminLogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/secure-admin-gateway/login')
      router.refresh()
    } catch (error) {
      console.error('[AdminLogout] Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={loading}
      variant="ghost"
      size="sm"
      className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? 'Logging out...' : 'Logout'}
    </Button>
  )
}
