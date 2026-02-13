/**
 * Audit Note Sanitization
 * 
 * Prevents accidental exposure of sensitive admin-only information in audit notes
 * that may be visible to letter owners (subscribers).
 */

import { sanitizeString } from './input-sanitizer'

/**
 * Patterns that indicate potentially sensitive information
 * These will be redacted from audit notes visible to non-admins
 */
const SENSITIVE_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (various formats)
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g,
  
  // SSN patterns
  /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Credit card patterns (basic)
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // API keys and tokens (common patterns)
  /\b[A-Za-z0-9_-]{32,}\b/g,
  
  // Internal system references
  /\b(internal|confidential|private|admin-only)\b/gi,
]

/**
 * Sanitize audit notes to prevent accidental exposure of sensitive information
 * 
 * @param notes - The raw audit notes from an admin
 * @param isAdminViewing - Whether the viewer is an admin (admins see unredacted notes)
 * @returns Sanitized notes safe for the viewer's role
 */
export function sanitizeAuditNotes(notes: string, isAdminViewing: boolean = false): string {
  // First, apply basic sanitization
  let sanitized = sanitizeString(notes, 2000)
  
  // If an admin is viewing, return the full (but sanitized) notes
  if (isAdminViewing) {
    return sanitized
  }
  
  // For non-admin viewers (subscribers), redact sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }
  
  return sanitized
}

/**
 * Validate that audit notes don't contain obvious sensitive information
 * Returns a warning message if sensitive content is detected
 * 
 * @param notes - The audit notes to validate
 * @returns Warning message if sensitive content detected, null otherwise
 */
export function validateAuditNotesForSensitiveContent(notes: string): string | null {
  const warnings: string[] = []
  
  // Check for email addresses
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(notes)) {
    warnings.push('email addresses')
  }
  
  // Check for phone numbers
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(notes)) {
    warnings.push('phone numbers')
  }
  
  // Check for SSN
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(notes)) {
    warnings.push('social security numbers')
  }
  
  // Check for credit cards
  if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(notes)) {
    warnings.push('credit card numbers')
  }
  
  if (warnings.length > 0) {
    return `Warning: Audit notes may contain sensitive information (${warnings.join(', ')}). This will be redacted for non-admin viewers.`
  }
  
  return null
}

/**
 * Enhanced sanitization for review data that includes audit note filtering
 */
export interface SanitizedReviewData {
  valid: boolean
  sanitized: Record<string, string | null>
  warnings?: string[]
  error?: string
}

export function sanitizeReviewDataWithAuditCheck(data: {
  finalContent?: string
  reviewNotes?: string
  rejectionReason?: string
}): SanitizedReviewData {
  const result: Record<string, string | null> = {}
  const warnings: string[] = []
  
  if (data.finalContent !== undefined) {
    const sanitized = sanitizeString(data.finalContent, 10000)
    if (!sanitized) {
      return { valid: false, sanitized: {}, error: 'Invalid final content provided' }
    }
    result.finalContent = sanitized
  }
  
  if (data.reviewNotes !== undefined && data.reviewNotes) {
    // Check for sensitive content in review notes
    const sensitiveWarning = validateAuditNotesForSensitiveContent(data.reviewNotes)
    if (sensitiveWarning) {
      warnings.push(sensitiveWarning)
    }
    
    // Sanitize the notes (but don't redact yet - that happens when displaying to non-admins)
    result.reviewNotes = sanitizeString(data.reviewNotes, 2000)
  } else if (data.reviewNotes === '') {
    result.reviewNotes = null
  }
  
  if (data.rejectionReason !== undefined) {
    const sanitized = sanitizeString(data.rejectionReason, 1000)
    if (!sanitized) {
      return { valid: false, sanitized: {}, error: 'Invalid rejection reason provided' }
    }
    result.rejectionReason = sanitized
  }
  
  return {
    valid: true,
    sanitized: result,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}
