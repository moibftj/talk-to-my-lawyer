/**
 * Sentry Error Filters and Utilities
 *
 * Handles:
 * - Expected error filtering (validation, auth, rate limits)
 * - User context attachment from requests
 * - Breadcrumb management
 * - Tag enrichment
 */

import type { Event, Breadcrumb } from "@sentry/nextjs"

/**
 * Expected errors that should NOT be sent to Sentry.
 * These are normal application behaviors, not bugs.
 */
const EXPECTED_ERRORS = [
  // Validation errors (400 Bad Request)
  {
    check: (event: Event) =>
      event.exception?.values?.[0]?.type?.includes("ValidationError") ||
      event.contexts?.response?.status === 400,
    reason: "Validation error",
  },

  // Authentication failures (401 Unauthorized) - too noisy
  {
    check: (event: Event) =>
      event.contexts?.response?.status === 401,
    reason: "Auth failure",
  },

  // Authorization failures (403 Forbidden) - expected for role-based access
  {
    check: (event: Event) =>
      event.contexts?.response?.status === 403 &&
      event.request?.url?.includes("/api"),
    reason: "Authorization failure",
  },

  // Not found errors (404) - for API resources
  {
    check: (event: Event) =>
      event.contexts?.response?.status === 404 &&
      event.request?.url?.match(/\/api\/(letters|subscriptions|profiles)\/[a-f0-9-]+/),
    reason: "Resource not found",
  },

  // Rate limit errors (429 Too Many Requests) - expected behavior
  {
    check: (event: Event) =>
      event.contexts?.response?.status === 429,
    reason: "Rate limited",
  },

  // Supabase PostgREST errors that are expected
  {
    check: (event: Event) => {
      const message = event.exception?.values?.[0]?.value || ""
      return (
        message.includes("PGRST116") || // Not found (expected)
        message.includes("PGRST204") || // No rows returned (expected)
        message.includes("duplicate key") // Duplicate constraint (expected, DB handles)
      )
    },
    reason: "Expected Supabase error",
  },

  // n8n webhook timeout errors (handled with retry logic)
  {
    check: (event: Event) => {
      const message = event.exception?.values?.[0]?.value || ""
      return message.includes("n8n request timed out")
    },
    reason: "n8n timeout (retries)",
  },
]

/**
 * Filter out expected errors before sending to Sentry
 */
export function isExpectedError(event: Event): boolean {
  // Don't filter in development (send everything for debugging)
  if (process.env.NODE_ENV === "development") {
    return false
  }

  // Check each expected error pattern
  for (const { check, reason } of EXPECTED_ERRORS) {
    if (check(event)) {
      // Log filtered errors for debugging (not sent to Sentry)
      console.log(`[Sentry] Filtered ${reason}:`, {
        type: event.exception?.values?.[0]?.type,
        status: event.contexts?.response?.status,
        url: event.request?.url,
      })
      return true
    }
  }

  return false
}

/**
 * Attach user context from request if available
 *
 * Note: This is called from Sentry's beforeSend hook which is synchronous,
 * so we can't await async cookie operations. We skip user context here
 * and rely on Sentry's automatic context from the request instead.
 */
export function attachUserContext(event: Event): void {
  // User context is now automatically captured by Sentry's SDK
  // via NextRequest data in the event
  // This function is kept for future customization if needed
}

/**
 * Determine if a breadcrumb should be tracked
 */
export function shouldTrackBreadcrumb(breadcrumb: Breadcrumb): boolean {
  // Track all important breadcrumbs
  // Filter out very noisy ones

  // Ignore console.info and console.debug
  if (breadcrumb.category === "console") {
    if (breadcrumb.level === "info" || breadcrumb.level === "debug") {
      return false
    }
  }

  // Ignore health check fetches
  if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
    const url = breadcrumb.data?.url || ""
    if (url.includes("/health") || url.includes("/ping")) {
      return false
    }
  }

  return true
}

/**
 * Enrich event with custom tags based on error context
 */
export function enrichEventTags(event: Event, context: {
  route?: string
  userId?: string
  operation?: string
}): void {
  event.tags = {
    ...event.tags,
    ...context,
  }

  // Tag Supabase-related errors
  const errorMessage = event.exception?.values?.[0]?.value || ""
  if (errorMessage.includes("supabase") || errorMessage.includes("PGRST")) {
    event.tags.database = "supabase"
  }

  // Tag n8n-related errors
  if (errorMessage.includes("n8n")) {
    event.tags.external_service = "n8n"
  }

  // Tag Stripe-related errors
  if (errorMessage.includes("stripe") || errorMessage.includes("payment")) {
    event.tags.external_service = "stripe"
  }

  // Tag OpenAI-related errors
  if (errorMessage.includes("openai") || errorMessage.includes("gpt")) {
    event.tags.external_service = "openai"
  }
}
