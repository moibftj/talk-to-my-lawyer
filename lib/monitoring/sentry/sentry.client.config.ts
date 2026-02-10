/**
 * Sentry Client-Side Configuration
 *
 * Captures errors from:
 * - React components
 * - Browser JavaScript
 * - Client-side navigation
 * - XHR/fetch calls
 *
 * Features:
 * - Session replay for errors
 * - Core Web Vitals tracking
 * - Browser performance monitoring
 */

import * as Sentry from "@sentry/nextjs"
import { isExpectedError } from "./filters"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || "local",

  // Session Replay - capture replays on errors
  replaysSessionSampleRate: 0.1, // 10% of normal sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Performance monitoring
  tracesSampleRate: 1.0, // 100% of transactions

  // Error filtering
  beforeSend(event, hint) {
    // Filter out expected errors
    if (isExpectedError(event)) {
      return null
    }

    // Scrub sensitive data from the event
    scrubSensitiveData(event)

    // Only send events from production/staging (not development)
    if (process.env.NODE_ENV === "development") {
      // In dev, just log to console instead of sending
      console.warn("[Sentry] Would send event:", event)
      return null
    }

    return event
  },

  // Breadcrumb filtering
  beforeBreadcrumb(breadcrumb, hint) {
    // Filter out console log breadcrumbs (too noisy)
    if (breadcrumb.category === "console") {
      // Only keep errors and warnings
      if (breadcrumb.level !== "error" && breadcrumb.level !== "warning") {
        return null
      }
    }

    // Filter out navigation to same page (SPA routing)
    if (breadcrumb.category === "navigation") {
      const from = breadcrumb.data?.from
      const to = breadcrumb.data?.to
      if (from === to) {
        return null
      }
    }

    return breadcrumb
  },

  // Ignore specific errors
  ignoreErrors: [
    // Random browser/extensions errors
    "top.GLOBALS",
    "originalCreateNotification",
    "canvas.contentDocument",
    "MyApp_RemoveAllHighlights",
    "http://tt.epicgames.com/help",
    "Can't find variable: IKTelegram",

    // Facebook flakiness
    "fb_xd_fragment",

    // Network errors that don't need tracking
    "Network request failed",
    "Failed to fetch",

    // Extension related errors
    /^chrome-.*?extension/,
    /^safari-web-extension/,
  ],

  // Ignore URLs from browser extensions
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,

    // Firefox extensions
    /^moz-extension:\/\//i,

    // Safari extensions
    /^safari-web-extension:\/\//i,

    // Other third-party scripts
    /graph\.facebook\.com/i,
    /connect\.facebook\.net\/en_US\/all\.js/i,
  ],

  // Debug mode
  debug: process.env.SENTRY_DEBUG === "true",

  // Initial scope
  initialScope: {
    tags: {
      service: "talk-to-my-lawyer-client",
      runtime: "browser",
    },
  },
})

/**
 * Scrub sensitive data from Sentry events
 */
function scrubSensitiveData(event: Sentry.Event): void {
  // Scrub request headers
  if (event.request?.headers) {
    delete event.request.headers["authorization"]
    delete event.request.headers["cookie"]
    delete event.request.headers["x-csrf-token"]
  }

  // Scrub user data
  if (event.user) {
    // Keep id and email for identification, but scrub other fields
    // that might contain PII
    if (event.user.ip_address) {
      // Anonymize IP
      event.user.ip_address = "{{auto}}"
    }
  }

  // Scrub breadcrumbs with sensitive URLs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
      if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
        const url = breadcrumb.data?.url || ""

        // Scrub URLs that might contain sensitive data
        breadcrumb.data = {
          ...breadcrumb.data,
          url: scrubUrl(url),
        }
      }
      return breadcrumb
    })
  }
}

/**
 * Scrub sensitive parameters from URLs
 */
function scrubUrl(url: string): string {
  try {
    const urlObj = new URL(url)

    // Scrub query parameters that might contain sensitive data
    const sensitiveParams = [
      "token",
      "apiKey",
      "api_key",
      "password",
      "secret",
      "session",
      "auth",
      "credit_card",
      "ssn",
    ]

    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, "[REDACTED]")
      }
    })

    return urlObj.toString()
  } catch {
    // If URL parsing fails, return a masked version
    return url.replace(/\/([^\/]{20,})/g, "/[REDACTED]")
  }
}
