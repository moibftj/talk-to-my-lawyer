'use client'

import { useState, useEffect, useRef } from 'react'
import { UserPlus, ChevronDown, X, Loader2, Check } from 'lucide-react'

interface Attorney {
  id: string
  email: string
  full_name: string
  admin_sub_role: string
}

interface LetterAssignDropdownProps {
  letterId: string
  currentAssignedTo?: string | null
  currentAssignedName?: string | null
  onAssigned?: () => void
}

export function LetterAssignDropdown({
  letterId,
  currentAssignedTo,
  currentAssignedName,
  onAssigned,
}: LetterAssignDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [attorneys, setAttorneys] = useState<Attorney[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchAttorneys = async () => {
    if (attorneys.length > 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/attorneys', { credentials: 'include' })
      const data = await res.json()
      if (data.attorneys) {
        setAttorneys(data.attorneys)
      }
    } catch (error) {
      console.error('Failed to fetch attorneys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!isOpen) {
      fetchAttorneys()
    }
    setIsOpen(!isOpen)
  }

  const handleAssign = async (attorneyId: string | null) => {
    setAssigning(true)
    setResult(null)

    try {
      const csrfTokenRes = await fetch('/api/admin/csrf', { credentials: 'include' })
      const csrfData = await csrfTokenRes.json()

      const res = await fetch(`/api/admin/letters/${letterId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ attorneyId }),
      })

      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, message: attorneyId ? 'Assigned!' : 'Unassigned!' })
        setIsOpen(false)
        setTimeout(() => {
          setResult(null)
          window.location.reload()
        }, 1000)
      } else {
        setResult({ success: false, message: data.error || 'Failed to assign' })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error' })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        disabled={assigning}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
          currentAssignedTo
            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
        }`}
      >
        {assigning ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : currentAssignedTo ? (
          <>
            <Check className="h-3 w-3" />
            {currentAssignedName || 'Assigned'}
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            Assign
          </>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {result && (
        <div className={`absolute top-full left-0 mt-1 px-2 py-1 text-xs rounded whitespace-nowrap z-50 ${
          result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {result.message}
        </div>
      )}

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border z-50">
          <div className="p-2 border-b">
            <p className="text-xs font-medium text-gray-500 uppercase">Assign to Attorney</p>
          </div>
          
          {loading ? (
            <div className="p-4 text-center">
              <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {currentAssignedTo && (
                <button
                  onClick={() => handleAssign(null)}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-b"
                >
                  <X className="h-3.5 w-3.5" />
                  Unassign
                </button>
              )}
              {attorneys.map((attorney) => (
                <button
                  key={attorney.id}
                  onClick={() => handleAssign(attorney.id)}
                  disabled={attorney.id === currentAssignedTo}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                    attorney.id === currentAssignedTo ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <div>
                    <div className="font-medium">{attorney.full_name || attorney.email}</div>
                    <div className="text-xs text-gray-400">{attorney.admin_sub_role === 'attorney_admin' ? 'Attorney' : 'Super Admin'}</div>
                  </div>
                  {attorney.id === currentAssignedTo && <Check className="h-4 w-4" />}
                </button>
              ))}
              {attorneys.length === 0 && (
                <p className="p-3 text-sm text-gray-400 text-center">No attorneys available</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
