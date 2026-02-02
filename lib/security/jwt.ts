/**
 * JWT (JSON Web Token) Utilities
 * Provides signing and verification for session tokens
 *
 * Uses industry-standard JWT with HS256 (HMAC-SHA256) algorithm.
 * This prevents cookie tampering and ensures session integrity.
 */

import { createHmac, timingSafeEqual, randomBytes } from 'crypto'

// JWT Configuration
const JWT_ALGORITHM = 'HS256'
const JWT_TOKEN_TYPE = 'JWT'

export interface JWTPayload {
  iss: string // Issuer
  iat: number // Issued at (timestamp)
  exp: number // Expiration (timestamp)
  sub: string // Subject (user ID)
  data: Record<string, any> // Custom data
}

/**
 * Base64URL encode (standard for JWTs)
 * Handles special characters for URL-safe encoding
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Base64URL decode
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/')

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '='
  }

  return Buffer.from(base64, 'base64').toString('utf-8')
}

/**
 * Sign a JWT payload
 *
 * Creates a JWT in the format: header.payload.signature
 * Uses HMAC-SHA256 for signature generation
 */
export function signJWT(payload: Omit<JWTPayload, 'iss' | 'iat'>, secret: string): string {
  const now = Math.floor(Date.now() / 1000)

  const fullPayload: JWTPayload = {
    iss: 'talk-to-my-lawyer',
    iat: now,
    ...payload
  }

  // Create header
  const header = {
    alg: JWT_ALGORITHM,
    typ: JWT_TOKEN_TYPE
  }

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return `${data}.${signature}`
}

/**
 * Verify a JWT signature and decode payload
 *
 * Returns null if verification fails (invalid signature, expired, etc.)
 */
export function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null // Invalid JWT format
    }

    const [encodedHeader, encodedPayload, signature] = parts

    // Verify signature
    const data = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    // Constant-time comparison to prevent timing attacks
    const sigBytes = Buffer.from(signature)
    const expectedBytes = Buffer.from(expectedSignature)

    if (sigBytes.length !== expectedBytes.length ||
        !timingSafeEqual(sigBytes, expectedBytes)) {
      return null // Invalid signature
    }

    // Decode payload
    const payload: JWTPayload = JSON.parse(base64UrlDecode(encodedPayload))

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null // Token expired
    }

    return payload
  } catch (error) {
    return null // Verification failed
  }
}

/**
 * Create a signed session token
 *
 * Helper to create JWT for admin sessions
 */
export function createSessionToken(
  userId: string,
  email: string,
  subRole: string,
  expiresInMinutes: number,
  secret: string
): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + expiresInMinutes * 60

  return signJWT({
    sub: userId,
    exp,
    data: {
      email,
      subRole,
      loginTime: now * 1000, // Convert back to milliseconds
      lastActivity: now * 1000
    }
  }, secret)
}

/**
 * Verify and decode a session token
 *
 * Returns null if invalid or expired
 */
export function verifySessionToken(
  token: string,
  secret: string
): { userId: string; email: string; subRole: string; loginTime: number; lastActivity: number } | null {
  const payload = verifyJWT(token, secret)

  if (!payload || !payload.data) {
    return null
  }

  return {
    userId: payload.sub,
    email: payload.data.email,
    subRole: payload.data.subRole,
    loginTime: payload.data.loginTime,
    lastActivity: payload.data.lastActivity
  }
}

/**
 * Get JWT secret from environment
 *
 * For admin sessions, uses ADMIN_SESSION_SECRET.
 * Falls back to CSRF_SECRET for backwards compatibility.
 */
export function getJWTSecret(): string {
  // Prefer ADMIN_SESSION_SECRET for admin sessions
  const adminSecret = process.env.ADMIN_SESSION_SECRET
  if (adminSecret) {
    return adminSecret
  }

  // Fall back to CSRF_SECRET (already required)
  const csrfSecret = process.env.CSRF_SECRET
  if (csrfSecret) {
    return csrfSecret
  }

  // Generate a warning but don't crash in development
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET or CSRF_SECRET environment variable must be set in production')
  }

  console.warn('[JWT] No secret configured - using development secret (DO NOT USE IN PRODUCTION)')
  return randomBytes(32).toString('hex') // Dev mode random secret
}
