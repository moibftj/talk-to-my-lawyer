/**
 * Sentry Server-Side Configuration
 *
 * Captures errors from:
 * - API routes
 * - Server components (RSC)
 * - Middleware (Node.js runtime)
 * - Server actions
 *
 * Features:
 * - Error tracking with user context
 * - Performance monitoring (transactions, spans)
 * - Database query tracing
 * - External service call tracking
 */

import * as Sentry from "@sentry/nextjs"
import { isExpectedError, attachUserContext } from "./filters"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || "local",

  // Sample rates for performance monitoring
  tracesSampleRate: 1.0, // 100% of transactions
  profilesSampleRate: 0.1, // 10% for profiling (quota management)

  // Performance monitoring
  beforeSendTransaction(event, hint) {
    // Filter out low-value transactions
    const transactionName = event.transaction || ""

    // Ignore health check transactions
    if (transactionName.includes("/health") || transactionName.includes("/ping")) {
      return null
    }

    return event
  },

  // Error filtering and enrichment
  beforeSend(event, hint) {
    // Filter out expected errors (validation, auth, etc.)
    if (isExpectedError(event)) {
      return null
    }

    // Attach user context if available
    attachUserContext(event)

    // Add custom tags for better filtering
    event.tags = {
      ...event.tags,
      runtime: "nodejs",
      nextjs: "app-router",
    }

    // Add extra context
    event.contexts = {
      ...event.contexts,
      app: {
        name: "talk-to-my-lawyer",
        environment: process.env.NODE_ENV || "development",
      },
    }

    return event
  },

  // Breadcrumb filtering - track important events
  beforeBreadcrumb(breadcrumb, hint) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === "console") {
      // Only include error/warning console logs
      if (breadcrumb.level !== "error" && breadcrumb.level !== "warning") {
        return null
      }
    }

    // Filter out xhr/fetch for health checks
    if (
      breadcrumb.category === "fetch" ||
      breadcrumb.category === "xhr"
    ) {
      const url = breadcrumb.data?.url || ""
      if (url.includes("/health") || url.includes("/ping")) {
        return null
      }
    }

    return breadcrumb
  },

  // Environment-specific settings
  enabled: process.env.NODE_ENV !== "test",

  // Debug mode (set SENTRY_DEBUG=true in .env for verbose logs)
  debug: process.env.SENTRY_DEBUG === "true",

  // Initial scope - custom tags that apply to all events
  initialScope: {
    tags: {
      service: "talk-to-my-lawyer-api",
    },
  },
})

// Export a wrapped fetch function for tracing external calls
export async function tracedFetch(
  url: string,
  options?: RequestInit,
  op?: string,
  description?: string
): Promise<Response> {
  return Sentry.startSpan(
    {
      op: op || "http.client",
      name: description || url,
    },
    async (span) => {
      span?.setAttribute("http.url", url)

      try {
        const response = await fetch(url, options)

        // Add response attributes
        const contentLength = response.headers.get("content-length")
        span?.setAttributes({
          "http.status_code": response.status,
          "http.response_size": contentLength || 0,
        })

        return response
      } catch (error) {
        span?.recordException(error as Error)
        throw error
      }
    }
  )
}
