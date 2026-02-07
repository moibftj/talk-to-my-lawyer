import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'

export async function GET() {
  try {
    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = getServiceRoleClient()
    
    // Try to select the assignment columns to check if they exist
    const { error } = await supabase
      .from('letters')
      .select('assigned_to, assigned_at')
      .limit(0)

    if (error) {
      return NextResponse.json({
        migrated: false,
        message: 'Assignment columns not found. Please run the migration SQL in Supabase SQL Editor.',
        sql: `ALTER TABLE letters ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);\nALTER TABLE letters ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;\nCREATE INDEX IF NOT EXISTS idx_letters_assigned_to ON letters(assigned_to);\nCREATE INDEX IF NOT EXISTS idx_letters_assigned_at ON letters(assigned_at);`
      })
    }

    return NextResponse.json({ migrated: true, message: 'Schema is up to date' })
  } catch (error) {
    console.error('[CheckSchema] Error:', error)
    return NextResponse.json({ error: 'Failed to check schema' }, { status: 500 })
  }
}
