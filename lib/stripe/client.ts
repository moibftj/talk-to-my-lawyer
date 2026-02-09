import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-08-27.basil" as any;

function isReplitEnvironment(): boolean {
  return Boolean(process.env.REPLIT_CONNECTORS_HOSTNAME);
}

async function getCredentialsFromReplit(): Promise<{
  publishableKey: string;
  secretKey: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME not available");
  }

  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("No Replit identity token available");
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      X_REPLIT_TOKEN: xReplitToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Replit connector API returned ${response.status}`);
  }

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.secret) {
    throw new Error("No Stripe credentials returned from connector API");
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

export async function getStripeSecretKey(): Promise<string> {
  if (isReplitEnvironment()) {
    try {
      const credentials = await getCredentialsFromReplit();
      return credentials.secretKey;
    } catch (error) {
      console.warn(
        "[Stripe] Replit Connector failed, trying env var fallback:",
        error,
      );
    }
  }

  const fallback = process.env.STRIPE_SECRET_KEY?.trim();
  if (fallback) {
    if (!isReplitEnvironment()) {
      console.log(
        "[Stripe] Using STRIPE_SECRET_KEY env var (Vercel/standard deployment)",
      );
    } else {
      console.warn(
        "[Stripe] Connector unavailable, using STRIPE_SECRET_KEY env var fallback",
      );
    }
    return fallback;
  }
  throw new Error(
    "[Stripe] No Stripe secret key available. Set STRIPE_SECRET_KEY or configure Replit Connector.",
  );
}

export async function getStripePublishableKey(): Promise<string> {
  if (isReplitEnvironment()) {
    try {
      const credentials = await getCredentialsFromReplit();
      return credentials.publishableKey;
    } catch (error) {
      console.warn(
        "[Stripe] Replit Connector failed for publishable key, trying env var fallback:",
        error,
      );
    }
  }

  const fallback = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (fallback) {
    return fallback;
  }
  throw new Error(
    "[Stripe] No Stripe publishable key available. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or configure Replit Connector.",
  );
}

export async function getStripeClient(): Promise<Stripe> {
  const secretKey = await getStripeSecretKey();
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

let stripeSyncInstance: any = null;

export async function getStripeSync(): Promise<any> {
  if (stripeSyncInstance) {
    return stripeSyncInstance;
  }

  if (!isReplitEnvironment()) {
    throw new Error(
      "[Stripe] StripeSync (stripe-replit-sync) is only available in Replit environments",
    );
  }

  // Use dynamic require path to prevent Turbopack from analyzing this at build time
  // This module only exists in Replit environments
  const moduleName = "stripe-replit-sync";
  let StripeSync: any;
  try {
    const mod = await import(/* webpackIgnore: true */ moduleName);
    StripeSync = mod.StripeSync;
  } catch (e) {
    throw new Error(`[Stripe] stripe-replit-sync module not available: ${e}`);
  }

  const secretKey = await getStripeSecretKey();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("[Stripe] DATABASE_URL is required for StripeSync");
  }

  const syncDbUrl = databaseUrl.includes("sslmode=")
    ? databaseUrl.replace(/sslmode=[^&]+/, "sslmode=no-verify")
    : databaseUrl +
      (databaseUrl.includes("?") ? "&" : "?") +
      "sslmode=no-verify";

  stripeSyncInstance = new StripeSync({
    stripeSecretKey: secretKey,
    poolConfig: {
      connectionString: syncDbUrl,
    },
  });

  return stripeSyncInstance;
}
