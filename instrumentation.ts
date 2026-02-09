/**
 * Next.js Instrumentation API
 *
 * This file is automatically called when the Next.js server starts.
 * Use it to initialize global services, monitoring, and lifecycle handlers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await initializeTracing()
    
    console.log('[Instrumentation] Initializing server instrumentation...')

    const { getShutdownManager } = await import('./lib/server/graceful-shutdown')
    const shutdownManager = getShutdownManager()

    console.log('[Instrumentation] Graceful shutdown handler registered')

    shutdownManager.register('database', async () => {
      console.log('[Shutdown] Closing database connections...')
    })

    shutdownManager.register('redis', async () => {
      console.log('[Shutdown] Closing Redis connections...')
    })

    await initStripe()

    console.log('[Instrumentation] Server instrumentation complete')
  }
}

async function initializeTracing() {
  try {
    const { setupTracing } = await import('./lib/monitoring/tracing')
    await setupTracing()
    console.log('[Instrumentation] OpenTelemetry tracing initialized')
  } catch (error) {
    console.error('[Instrumentation] Failed to initialize tracing:', error)
  }
}

async function initStripe() {
  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      console.warn('[Instrumentation] DATABASE_URL not set, skipping Stripe sync initialization')
      return
    }

    const isReplit = Boolean(process.env.REPL_ID || process.env.REPLIT_CONNECTORS_HOSTNAME)

    if (isReplit) {
      const { runMigrations } = await import('stripe-replit-sync')
      const dbUrlForSync = databaseUrl.includes('sslmode=')
        ? databaseUrl.replace(/sslmode=[^&]+/, 'sslmode=no-verify')
        : databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=no-verify'
      await runMigrations({ databaseUrl: dbUrlForSync })
      console.log('[Instrumentation] Stripe sync migrations completed')

      const { getStripeSync } = await import('./lib/stripe/client')
      const stripeSync = await getStripeSync()

      const domain = process.env.REPLIT_DOMAINS?.split(',')[0]
      if (domain) {
        const webhookUrl = `https://${domain}/api/stripe/webhook`
        await stripeSync.findOrCreateManagedWebhook(webhookUrl)
        console.log('[Instrumentation] Stripe managed webhook configured:', webhookUrl)
      } else {
        console.warn('[Instrumentation] REPLIT_DOMAINS not set, skipping managed webhook setup')
      }

      stripeSync.syncBackfill().then(() => {
        console.log('[Instrumentation] Stripe backfill sync completed')
      }).catch((error: unknown) => {
        console.error('[Instrumentation] Stripe backfill sync failed:', error)
      })
    } else {
      console.log('[Instrumentation] Non-Replit environment detected, using standard Stripe webhook (configure STRIPE_WEBHOOK_SECRET)')
    }
  } catch (error) {
    console.error('[Instrumentation] Failed to initialize Stripe sync:', error)
  }
}
