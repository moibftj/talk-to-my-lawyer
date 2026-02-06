import Stripe from 'stripe'
import { StripeSync, runMigrations } from 'stripe-replit-sync'

const STRIPE_API_VERSION = '2025-08-27.basil' as any

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not available')
  }

  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null

  if (!xReplitToken) {
    throw new Error('No Replit identity token available')
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1'
  const targetEnvironment = isProduction ? 'production' : 'development'

  const url = new URL(`https://${hostname}/api/v2/connection`)
  url.searchParams.set('include_secrets', 'true')
  url.searchParams.set('connector_names', 'stripe')
  url.searchParams.set('environment', targetEnvironment)

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken,
    },
  })

  if (!response.ok) {
    throw new Error(`Replit connector API returned ${response.status}`)
  }

  const data = await response.json()
  const connectionSettings = data.items?.[0]

  if (!connectionSettings?.settings?.secret) {
    throw new Error('No Stripe credentials returned from connector API')
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  }
}

export async function getStripeSecretKey(): Promise<string> {
  try {
    const credentials = await getCredentials()
    return credentials.secretKey
  } catch (error) {
    const fallback = process.env.STRIPE_SECRET_KEY?.trim()
    if (fallback) {
      console.warn('[Stripe] Connector API unavailable, using STRIPE_SECRET_KEY env var fallback')
      return fallback
    }
    throw new Error(`[Stripe] Unable to get secret key: ${error}`)
  }
}

export async function getStripePublishableKey(): Promise<string> {
  try {
    const credentials = await getCredentials()
    return credentials.publishableKey
  } catch (error) {
    const fallback = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
    if (fallback) {
      console.warn('[Stripe] Connector API unavailable, using NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env var fallback')
      return fallback
    }
    throw new Error(`[Stripe] Unable to get publishable key: ${error}`)
  }
}

export async function getStripeClient(): Promise<Stripe> {
  const secretKey = await getStripeSecretKey()
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}

let stripeSyncInstance: StripeSync | null = null

export async function getStripeSync(): Promise<StripeSync> {
  if (stripeSyncInstance) {
    return stripeSyncInstance
  }

  const secretKey = await getStripeSecretKey()
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('[Stripe] DATABASE_URL is required for StripeSync')
  }

  stripeSyncInstance = new StripeSync({
    stripeSecretKey: secretKey,
    poolConfig: {
      connectionString: databaseUrl,
    },
  })

  return stripeSyncInstance
}
