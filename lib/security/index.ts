/**
 * Security Configuration and Utilities
 *
 * Centralizes security-related configurations and utilities
 * for the Talk-to-my-Lawyer application.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Security Headers Configuration
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  "X-Frame-Options": "DENY",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Enable XSS protection
  "X-XSS-Protection": "1; mode=block",

  // Referrer Policy
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Content Security Policy
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://app.talk-to-my-lawyer.com https://api.stripe.com https://designtec.app.n8n.cloud",
    "frame-src 'self' https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; "),

  // Permissions Policy (formerly Feature Policy)
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    'payment=(self "https://js.stripe.com")',
    "usb=()",
    "serial=()",
    "bluetooth=()",
  ].join(", "),
} as const;

/**
 * Sensitive Routes that require extra protection
 */
export const SENSITIVE_ROUTES = [
  "/api/admin",
  "/api/generate-letter",
  "/api/letters",
  "/api/create-checkout",
  "/api/stripe",
  "/secure-admin-gateway",
  "/attorney-portal",
] as const;

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMITS = {
  // Authentication endpoints
  AUTH_LOGIN: { requests: 5, window: 900000 }, // 5 requests per 15 minutes
  AUTH_SIGNUP: { requests: 3, window: 3600000 }, // 3 requests per hour

  // API endpoints
  LETTER_GENERATION: { requests: 10, window: 3600000 }, // 10 requests per hour
  ADMIN_API: { requests: 100, window: 3600000 }, // 100 requests per hour

  // General API
  GENERAL_API: { requests: 1000, window: 3600000 }, // 1000 requests per hour
} as const;

/**
 * Environment-specific security validation
 */
export function validateSecurityConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = process.env.NODE_ENV === "production";

  // Required environment variables
  const requiredVars = [
    "CSRF_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Production-specific requirements
  if (isProduction) {
    const prodRequiredVars = [
      "ADMIN_PORTAL_KEY",
      "RESEND_API_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ];

    for (const varName of prodRequiredVars) {
      if (!process.env[varName]) {
        errors.push(`Missing production environment variable: ${varName}`);
      }
    }

    // Check for development values in production
    if (process.env.ADMIN_PORTAL_KEY === "dev-admin-key") {
      errors.push("ADMIN_PORTAL_KEY is using development value in production");
    }
  } else {
    // Development warnings
    if (!process.env.ADMIN_PORTAL_KEY) {
      warnings.push(
        "ADMIN_PORTAL_KEY not set - admin authentication will be limited",
      );
    }

    if (!process.env.RESEND_API_KEY) {
      warnings.push("RESEND_API_KEY not set - emails will not be sent");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Check if a route is sensitive and requires extra protection
 */
export function isSensitiveRoute(pathname: string): boolean {
  return SENSITIVE_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Generate a secure random string for tokens/secrets
 */
export function generateSecureToken(length: number = 32): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const values = new Uint8Array(length);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(values);
  } else {
    // Fallback for Node.js environment
    const { randomBytes } = require("crypto");
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
      values[i] = bytes[i];
    }
  }

  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }

  return result;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push("Password must be at least 8 characters");

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push("Password must contain lowercase letters");

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push("Password must contain uppercase letters");

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push("Password must contain numbers");

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push("Password must contain special characters");

  return {
    valid: score >= 4,
    score,
    feedback,
  };
}

/**
 * Security audit log entry
 */
export interface SecurityAuditEntry {
  timestamp: string;
  event: string;
  severity: "low" | "medium" | "high" | "critical";
  details: Record<string, any>;
  userAgent?: string;
  ip?: string;
}

/**
 * Log security events
 */
export function logSecurityEvent(
  entry: Omit<SecurityAuditEntry, "timestamp">,
): void {
  const logEntry: SecurityAuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // In production, this would typically go to a security monitoring service
  if (process.env.NODE_ENV === "production") {
    // Log to monitoring service
    console.warn("[SECURITY]", JSON.stringify(logEntry));
  } else {
    console.log("[SECURITY]", logEntry);
  }
}
