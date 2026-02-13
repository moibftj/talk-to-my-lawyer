/**
 * Centralized environment variable configuration
 *
 * This file provides a single source of truth for all environment variables,
 * with validation and type safety. Import this file instead of accessing
 * process.env directly throughout the codebase.
 *
 * Note: Uses lazy evaluation to avoid build-time failures when env vars
 * are not set. Validation happens at runtime when values are accessed.
 */

/**
 * Supabase configuration
 */
export const supabase = {
  get url() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  },
  get anonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  },
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  },
} as const;

/**
 * OpenAI configuration
 */
export const openai = {
  get apiKey() {
    return process.env.OPENAI_API_KEY || "";
  },
} as const;

/**
 * Stripe configuration
 */
export const stripe = {
  get secretKey() {
    return process.env.STRIPE_SECRET_KEY || "";
  },
  get publishableKey() {
    return process.env.STRIPE_PUBLISHABLE_KEY || "";
  },
  get webhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || "";
  },
  get isConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
} as const;

/**
 * Email configuration
 */
export const email = {
  get resendApiKey() {
    return process.env.RESEND_API_KEY || "";
  },
  get from() {
    return process.env.EMAIL_FROM || "noreply@talk-to-my-lawyer.com";
  },
  get fromName() {
    return process.env.EMAIL_FROM_NAME || "Talk-To-My-Lawyer";
  },
} as const;

/**
 * Email configuration with apiKey alias for backward compatibility
 */
export const emailConfig = {
  get apiKey() {
    return process.env.RESEND_API_KEY;
  },
  get from() {
    return process.env.EMAIL_FROM || "noreply@talk-to-my-lawyer.com";
  },
  get fromName() {
    return process.env.EMAIL_FROM_NAME || "Talk-To-My-Lawyer";
  },
} as const;

/**
 * Admin configuration
 */
export const admin = {
  get portalKey() {
    return process.env.ADMIN_PORTAL_KEY || "";
  },
} as const;

/**
 * CRON configuration
 */
export const cron = {
  get secret() {
    return process.env.CRON_SECRET || "";
  },
} as const;

/**
 * App configuration
 */
export const app = {
  get url() {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.NEXT_PUBLIC_SITE_URL)
      return process.env.NEXT_PUBLIC_SITE_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "https://www.talk-to-my-lawyer.com";
  },
  get nodeEnv() {
    return process.env.NODE_ENV || "development";
  },
} as const;

/**
 * Platform detection
 */
export const platform = {
  get isVercel() {
    return Boolean(process.env.VERCEL);
  },
  get name() {
    if (this.isVercel) return "vercel";
    return "standard";
  },
} as const;

/**
 * Rate limiting configuration
 */
export const rateLimit = {
  redisUrl: optional("KV_REST_API_URL"),
  redisToken: optional("KV_REST_API_TOKEN"),
} as const;

/**
 * OpenAI configuration (direct API connection)
 */
export const openaiConfig = {
  get apiKey() {
    return process.env.OPENAI_API_KEY;
  },
  get isConfigured() {
    return Boolean(process.env.OPENAI_API_KEY);
  },
} as const;

/**
 * Environment helpers - exported for use in other modules
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Get the application URL
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://www.talk-to-my-lawyer.com";
}

/**
 * Required environment variable accessor
 * Throws an error if the variable is not set
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Optional environment variable accessor
 * Returns the default value if the variable is not set
 */
function optional<T extends string = string>(
  key: string,
  defaultValue?: T,
): T | undefined {
  const value = process.env[key];
  return (value || defaultValue) as T | undefined;
}

/**
 * Validate all required environment variables
 * Call this during app initialization to fail fast if config is invalid
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const conditionalVars: Array<{ keys: string[]; label: string }> = [
    { keys: ["OPENAI_API_KEY"], label: "OpenAI API Key (OPENAI_API_KEY)" },
    { keys: ["STRIPE_SECRET_KEY"], label: "Stripe (STRIPE_SECRET_KEY)" },
  ];

  const productionVars = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "CRON_SECRET",
  ];

  for (const key of requiredVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  for (const { keys, label } of conditionalVars) {
    if (!keys.some((k) => process.env[k])) {
      missing.push(label);
    }
  }

  if (isProduction()) {
    for (const key of productionVars) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Environment metadata
 */
export const envMetadata = {
  isProduction: isProduction(),
  isDevelopment: isDevelopment(),
  isTest: isTest(),
  version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
} as const;
