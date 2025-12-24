/**
 * Utility functions for formatting and data manipulation
 */

import { TIME_CONSTANTS } from '@/lib/constants'

/**
 * Format number as USD currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

/**
 * Format ISO date string to human-readable date
 */
export function formatDate(isoDateString: string): string {
  return new Date(isoDateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Convert date to relative time string (e.g., "2m ago", "3h ago")
 */
export function formatRelativeTime(isoDateString: string): string {
  const currentTime = new Date()
  const pastTime = new Date(isoDateString)
  const differenceInSeconds = Math.floor((currentTime.getTime() - pastTime.getTime()) / 1000)

  const { SECONDS_PER_MINUTE, SECONDS_PER_HOUR, SECONDS_PER_DAY, SECONDS_PER_WEEK } = TIME_CONSTANTS

  if (differenceInSeconds < SECONDS_PER_MINUTE) return 'just now'
  if (differenceInSeconds < SECONDS_PER_HOUR) {
    return `${Math.floor(differenceInSeconds / SECONDS_PER_MINUTE)}m ago`
  }
  if (differenceInSeconds < SECONDS_PER_DAY) {
    return `${Math.floor(differenceInSeconds / SECONDS_PER_HOUR)}h ago`
  }
  if (differenceInSeconds < SECONDS_PER_WEEK) {
    return `${Math.floor(differenceInSeconds / SECONDS_PER_DAY)}d ago`
  }
  
  return formatDate(isoDateString)
}

/**
 * Generate a unique coupon code from a name
 * Format: First 4 letters of name + 4 random characters
 */
export function generateCouponCode(employeeName: string): string {
  const namePrefix = employeeName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4)
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${namePrefix}${randomSuffix}`
}

/**
 * Calculate discount amount from price and percentage
 */
export function calculateDiscountAmount(basePrice: number, discountPercentage: number): number {
  return (basePrice * discountPercentage) / 100
}

/**
 * Get Tailwind CSS classes for status badge based on status value
 */
export function getStatusBadgeClasses(status: string): string {
  const statusColorMap: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-800',
    submitted: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    canceled: 'bg-red-100 text-red-800'
  }
  return statusColorMap[status] || 'bg-slate-100 text-slate-800'
}

// Backwards compatibility aliases
export const calculateDiscount = calculateDiscountAmount
export const getStatusColor = getStatusBadgeClasses
