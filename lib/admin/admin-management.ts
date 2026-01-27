/**
 * Admin Account Management Utilities
 *
 * Role-based admin system - no shared secrets required.
 * Admin access is determined solely by the `role = 'admin'` field in the profiles table.
 *
 * SECURITY IMPROVEMENTS:
 * - Individual accountability (each admin has unique credentials)
 * - No shared secret to leak or rotate
 * - Easy deactivation (just change the user's role)
 * - Full audit trail of which admin performed each action
 *
 * @example Create a new admin
 * await createAdminAccount('admin@example.com', 'SecurePass123!', 'John Doe')
 *
 * @example Deactivate an admin
 * await deactivateAdminAccount('admin@example.com')
 *
 * @example List all admins
 * const admins = await listAllAdmins()
 */

import { createClient } from '@/lib/supabase/server'
import { Admin } from '@/lib/database.types'

export interface CreateAdminResult {
  success: boolean
  message: string
  adminId?: string
  error?: string
}

export interface AdminInfo {
  id: string
  email: string
  full_name: string | null
  created_at: string
  last_sign_in_at: string | null
}

/**
 * Create a new admin account
 *
 * Creates a Supabase Auth user and sets their role to 'admin'
 *
 * @param email - Admin email address
 * @param password - Admin password (min 8 characters)
 * @param fullName - Admin's full name (optional)
 * @returns Result object with success status and admin details
 */
export async function createAdminAccount(
  email: string,
  password: string,
  fullName?: string
): Promise<CreateAdminResult> {
  const supabase = await createClient()

  // Validate input
  if (!email || !password) {
    return {
      success: false,
      error: 'Email and password are required',
      message: 'Email and password are required'
    }
  }

  if (password.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters',
      message: 'Password must be at least 8 characters'
    }
  }

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users.find((u: any) => u.email === email)

    if (userExists) {
      // User exists, check if they're already an admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userExists.id)
        .single()

      if (profile?.role === 'admin') {
        return {
          success: false,
          error: 'User is already an admin',
          message: 'This email is already registered as an admin'
        }
      }

      // Promote existing user to admin
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userExists.id)

      if (updateError) {
        throw updateError
      }

      console.log('[AdminManagement] Existing user promoted to admin:', {
        userId: userExists.id,
        email
      })

      return {
        success: true,
        adminId: userExists.id,
        message: 'Existing user promoted to admin successfully'
      }
    }

    // Create new auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        role: 'admin'
      }
    })

    if (authError) {
      console.error('[AdminManagement] Failed to create auth user:', authError)
      return {
        success: false,
        error: authError.message,
        message: `Failed to create user: ${authError.message}`
      }
    }

    // Create profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'admin',
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('[AdminManagement] Failed to create profile:', profileError)
      // Clean up auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return {
        success: false,
        error: profileError.message,
        message: `Failed to create profile: ${profileError.message}`
      }
    }

    console.log('[AdminManagement] New admin account created:', {
      userId: authData.user.id,
      email,
      fullName
    })

    return {
      success: true,
      adminId: authData.user.id,
      message: 'Admin account created successfully'
    }

  } catch (error: any) {
    console.error('[AdminManagement] Error creating admin:', error)
    return {
      success: false,
      error: error.message,
      message: `Failed to create admin: ${error.message}`
    }
  }
}

/**
 * Deactivate an admin account
 *
 * Changes the user's role from 'admin' to 'subscriber'
 * This effectively removes admin access while preserving the account
 *
 * @param email - Admin email to deactivate
 * @returns Result object with success status
 */
export async function deactivateAdminAccount(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const supabase = await createClient()

  try {
    // Find user by email
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users.users.find((u: any) => u.email === email)

    if (!user) {
      return {
        success: false,
        error: 'User not found',
        message: 'No user found with this email address'
      }
    }

    // Check if user is currently an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return {
        success: false,
        error: 'Profile not found',
        message: 'User profile not found'
      }
    }

    if (profile.role !== 'admin') {
      return {
        success: false,
        error: 'User is not an admin',
        message: 'This user is not currently an admin'
      }
    }

    // Check if this is the last admin (prevent locking yourself out)
    const { data: allAdmins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (allAdmins && allAdmins.length <= 1) {
      return {
        success: false,
        error: 'Cannot deactivate the last admin',
        message: 'You cannot deactivate the last admin account. Please create another admin first.'
      }
    }

    // Change role to subscriber (removes admin access)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'subscriber',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    console.log('[AdminManagement] Admin deactivated:', {
      userId: user.id,
      email,
      previousName: profile.full_name
    })

    return {
      success: true,
      message: `Admin "${profile.full_name || email}" has been deactivated`
    }

  } catch (error: any) {
    console.error('[AdminManagement] Error deactivating admin:', error)
    return {
      success: false,
      error: error.message,
      message: `Failed to deactivate admin: ${error.message}`
    }
  }
}

/**
 * Reactivate an admin account
 *
 * Changes a user's role from 'subscriber' back to 'admin'
 *
 * @param email - User email to promote to admin
 * @returns Result object with success status
 */
export async function reactivateAdminAccount(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const supabase = await createClient()

  try {
    // Find user by email
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users.users.find((u: any) => u.email === email)

    if (!user) {
      return {
        success: false,
        error: 'User not found',
        message: 'No user found with this email address'
      }
    }

    // Change role to admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    console.log('[AdminManagement] Admin reactivated:', {
      userId: user.id,
      email
    })

    return {
      success: true,
      message: 'Admin account has been reactivated'
    }

  } catch (error: any) {
    console.error('[AdminManagement] Error reactivating admin:', error)
    return {
      success: false,
      error: error.message,
      message: `Failed to reactivate admin: ${error.message}`
    }
  }
}

/**
 * List all admin accounts
 *
 * @returns Array of admin user information
 */
export async function listAllAdmins(): Promise<AdminInfo[]> {
  const supabase = await createClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[AdminManagement] Error listing admins:', error)
    return []
  }

  return profiles as AdminInfo[]
}

/**
 * Get admin count
 *
 * @returns Number of active admin accounts
 */
export async function getAdminCount(): Promise<number> {
  const admins = await listAllAdmins()
  return admins.length
}

/**
 * Check if a specific email is an admin
 *
 * @param email - Email to check
 * @returns true if the email belongs to an admin
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('email', email)
    .single()

  return profile?.role === 'admin'
}

/**
 * Update admin password
 *
 * @param email - Admin email
 * @param newPassword - New password (min 8 characters)
 * @returns Result object with success status
 */
export async function updateAdminPassword(
  email: string,
  newPassword: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const supabase = await createClient()

  if (newPassword.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters',
      message: 'Password must be at least 8 characters'
    }
  }

  try {
    // Find user by email
    const { data: users } = await supabase.auth.admin.listUsers()
    const user = users.users.find((u: any) => u.email === email)

    if (!user) {
      return {
        success: false,
        error: 'User not found',
        message: 'No user found with this email address'
      }
    }

    // Update password via Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    })

    if (error) {
      throw error
    }

    console.log('[AdminManagement] Admin password updated:', {
      userId: user.id,
      email
    })

    return {
      success: true,
      message: 'Password updated successfully'
    }

  } catch (error: any) {
    console.error('[AdminManagement] Error updating password:', error)
    return {
      success: false,
      error: error.message,
      message: `Failed to update password: ${error.message}`
    }
  }
}
