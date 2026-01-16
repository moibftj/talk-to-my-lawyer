/**
 * User role constants
 *
 * Centralized role definitions to eliminate magic strings
 */

export const USER_ROLES = {
  SUBSCRIBER: 'subscriber',
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

/**
 * Admin role types (for admin portal)
 */
export const ADMIN_ROLES = {
  ATTORNEY_ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const

export type AdminRole = typeof ADMIN_ROLES[keyof typeof ADMIN_ROLES]

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string): role is AdminRole {
  return role === USER_ROLES.ADMIN || role === USER_ROLES.SUPER_ADMIN
}

/**
 * Check if a role is super admin
 */
export function isSuperAdmin(role: string): boolean {
  return role === USER_ROLES.SUPER_ADMIN
}

/**
 * Check if a role is a subscriber
 */
export function isSubscriber(role: string): boolean {
  return role === USER_ROLES.SUBSCRIBER
}

/**
 * Check if a role is an employee
 */
export function isEmployee(role: string): boolean {
  return role === USER_ROLES.EMPLOYEE
}

/**
 * Get human-readable role name
 */
export function getRoleName(role: string): string {
  switch (role) {
    case USER_ROLES.SUBSCRIBER:
      return 'Subscriber'
    case USER_ROLES.EMPLOYEE:
      return 'Employee'
    case USER_ROLES.ADMIN:
      return 'Attorney Admin'
    case USER_ROLES.SUPER_ADMIN:
      return 'Super Admin'
    default:
      return 'Unknown'
  }
}
