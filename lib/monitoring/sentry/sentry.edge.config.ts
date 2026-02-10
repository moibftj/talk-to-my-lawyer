/**
 * Sentry Edge Runtime Configuration
 *
 * For Next.js middleware running in Edge Runtime.
 * Note: Our middleware uses Node.js runtime, but this config
 * is available if we switch to Edge in the future.
 */

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE || "local",

  tracesSampleRate: 1.0,

  // Edge runtime has limitations - minimal config
  beforeSend(event, hint) {
    // In edge runtime, just send critical errors
    if (event.level !== "error" && event.level !== "fatal") {
      return null
    }

    return event
  },

  debug: process.env.SENTRY_DEBUG === "true",
})
