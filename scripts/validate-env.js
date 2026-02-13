#!/usr/bin/env node

const requiredEnvVars = {
  critical: [
    { name: "NEXT_PUBLIC_SUPABASE_URL", description: "Supabase project URL" },
    {
      name: "OPENAI_API_KEY",
      description: "OpenAI API key for letter generation",
    },
  ],
  production: [
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      description: "Supabase service role key (server-only)",
    },
    {
      name: "STRIPE_SECRET_KEY",
      description: "Stripe secret key (server-only)",
    },
    {
      name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      description: "Stripe publishable key",
    },
    {
      name: "STRIPE_PUBLISHABLE_KEY",
      description: "Stripe publishable key (server-side, used by env config)",
    },
    {
      name: "STRIPE_WEBHOOK_SECRET",
      description: "Stripe webhook secret (server-only)",
    },
    { name: "ADMIN_EMAIL", description: "Admin email address" },
    {
      name: "ADMIN_PORTAL_KEY",
      description: "Admin portal access key (server-only)",
    },
    {
      name: "CRON_SECRET",
      description: "Cron job authentication secret (server-only)",
    },
    {
      name: "NEXT_PUBLIC_SITE_URL",
      description: "Production site URL for email links",
    },
  ],
  email: [
    {
      name: "RESEND_API_KEY",
      description: "Resend API key for email delivery (server-only)",
    },
    {
      name: "EMAIL_FROM",
      description: "From email address for transactional emails",
    },
  ],
  rateLimit: [
    {
      name: "KV_REST_API_URL",
      description: "Upstash Redis URL for rate limiting (server-only)",
    },
    {
      name: "KV_REST_API_TOKEN",
      description: "Upstash Redis token (server-only)",
    },
  ],
  n8n: [
    {
      name: "N8N_WEBHOOK_URL",
      description: "n8n webhook URL for AI letter generation",
    },
  ],
  security: [
    {
      name: "CSRF_SECRET",
      description: "Secret for CSRF token generation (server-only)",
    },
  ],
  optional: [
    {
      name: "NEXT_PUBLIC_APP_URL",
      description: "Application URL (legacy, use NEXT_PUBLIC_SITE_URL)",
      default: "http://localhost:3000",
    },
    {
      name: "ENABLE_TEST_MODE",
      description: "Enable test mode (MUST be false in production)",
      default: "false",
    },
  ],
};

function validateEnv() {
  console.log("\n=== Environment Validation ===\n");

  const isProduction = process.env.NODE_ENV === "production";
  const testMode = process.env.ENABLE_TEST_MODE === "true";
  const isCI =
    process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let hasErrors = false;
  let hasWarnings = false;

  // WARNING: Test mode should never be enabled in production
  if (isProduction && testMode) {
    console.error(
      "\n[CRITICAL WARNING] ENABLE_TEST_MODE is true in production environment!",
    );
    console.error(
      "[CRITICAL WARNING] This bypasses important security and validation checks.",
    );
    console.error("[CRITICAL WARNING] Set ENABLE_TEST_MODE=false immediately!");
    hasErrors = true;
  }

  console.log("Critical Variables:");
  requiredEnvVars.critical.forEach(({ name, description }) => {
    const value = process.env[name];
    if (!value) {
      if (isCI && testMode) {
        console.log(`  [WARN] ${name}: Missing (CI mode) - ${description}`);
        hasWarnings = true;
      } else {
        console.log(`  [ERROR] ${name}: Missing - ${description}`);
        hasErrors = true;
      }
    } else {
      const masked = value.substring(0, 8) + "...";
      if (isCI && (value.includes("dummy") || value.includes("test"))) {
        console.log(`  [INFO] ${name}: ${masked} (CI dummy value)`);
      } else {
        console.log(`  [OK] ${name}: ${masked}`);
      }
    }
  });

  if (!supabaseAnonKey) {
    console.log(
      "  [ERROR] NEXT_PUBLIC_SUPABASE_ANON_KEY: Missing - Supabase anonymous key",
    );
    hasErrors = true;
  } else {
    const masked = supabaseAnonKey.substring(0, 8) + "...";
    console.log(`  [OK] NEXT_PUBLIC_SUPABASE_ANON_KEY: ${masked}`);
  }

  if (isProduction && !testMode) {
    console.log("\nProduction Variables:");
    requiredEnvVars.production.forEach(({ name, description }) => {
      const value = process.env[name];
      if (!value) {
        console.log(`  [ERROR] ${name}: Missing - ${description}`);
        hasErrors = true;
      } else {
        const masked = value.substring(0, 8) + "...";
        console.log(`  [OK] ${name}: ${masked}`);
      }
    });
  } else if (!isProduction) {
    console.log("\nProduction Variables (optional in development):");
    requiredEnvVars.production.forEach(({ name, description }) => {
      const value = process.env[name];
      if (!value) {
        console.log(`  [WARN] ${name}: Not set - ${description}`);
        hasWarnings = true;
      } else {
        const masked = value.substring(0, 8) + "...";
        console.log(`  [OK] ${name}: ${masked}`);
      }
    });
  }

  // Email service configuration (Resend is required in production)
  const hasEmailProvider = !!process.env.RESEND_API_KEY;
  if (isProduction && !testMode && !hasEmailProvider) {
    console.log(
      "\n[ERROR] Email Configuration: RESEND_API_KEY is required in production",
    );
    hasErrors = true;
  } else if (hasEmailProvider) {
    console.log("\nEmail Configuration:");
    requiredEnvVars.email.forEach(({ name, description }) => {
      const value = process.env[name];
      if (!value) {
        console.log(`  [INFO] ${name}: Not configured - ${description}`);
      } else {
        const masked = value.substring(0, 12) + "...";
        console.log(`  [OK] ${name}: ${masked}`);
      }
    });
  } else {
    console.log(
      "\nEmail Configuration: No email provider configured (emails will fail in production)",
    );
    hasWarnings = true;
  }

  // Stripe publishable key consistency (client + server expectations)
  const stripePublishablePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const stripePublishableServer = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!stripePublishablePublic) {
    const message =
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required for client-side Stripe usage";
    console.log(`\n[WARN] Stripe: ${message}`);
    hasWarnings = true;
  }

  if (!stripePublishableServer) {
    const message =
      "STRIPE_PUBLISHABLE_KEY is required by server-side env config";
    if (isProduction && !testMode) {
      console.log(`\n[ERROR] Stripe: ${message}`);
      hasErrors = true;
    } else {
      console.log(`\n[WARN] Stripe: ${message}`);
      hasWarnings = true;
    }
  }

  // Rate limiting configuration (strongly recommended for production)
  const hasRateLimitConfig = requiredEnvVars.rateLimit.every(
    ({ name }) => process.env[name],
  );
  if (isProduction && !hasRateLimitConfig) {
    console.log(
      "\n[WARN] Rate Limiting: Upstash Redis not configured. Rate limiting protection is disabled.",
    );
    hasWarnings = true;
  } else if (hasRateLimitConfig) {
    console.log("\nRate Limiting Configuration:");
    requiredEnvVars.rateLimit.forEach(({ name, description }) => {
      const value = process.env[name];
      if (!value) {
        console.log(`  [WARN] ${name}: Not set - ${description}`);
        hasWarnings = true;
      } else {
        const masked = value.substring(0, 15) + "...";
        console.log(`  [OK] ${name}: ${masked}`);
      }
    });
  }

  // n8n webhook configuration (required for letter generation)
  const hasN8nConfig = requiredEnvVars.n8n.every(
    ({ name }) => process.env[name],
  );
  if (isProduction && !testMode && !hasN8nConfig) {
    console.log(
      "\n[ERROR] n8n Configuration: N8N_WEBHOOK_URL is required for letter generation in production",
    );
    hasErrors = true;
  } else if (hasN8nConfig) {
    console.log("\nn8n Webhook Configuration:");
    requiredEnvVars.n8n.forEach(({ name, description }) => {
      const value = process.env[name];
      if (!value) {
        console.log(`  [WARN] ${name}: Not set - ${description}`);
        hasWarnings = true;
      } else {
        const masked = value.substring(0, 20) + "...";
        console.log(`  [OK] ${name}: ${masked}`);
      }
    });
    const authKey = process.env.N8N_WEBHOOK_AUTH_KEY;
    if (!authKey) {
      console.log(
        "  [WARN] N8N_WEBHOOK_AUTH_KEY: Not set - Webhook authentication is disabled",
      );
      hasWarnings = true;
    } else {
      console.log(`  [OK] N8N_WEBHOOK_AUTH_KEY: ${authKey.substring(0, Math.min(8, authKey.length))}...`);
    }
  } else {
    console.log(
      "\nn8n Configuration: N8N_WEBHOOK_URL not configured (letter generation will fail)",
    );
    hasWarnings = true;
  }

  // Security secrets (required for production)
  const hasCsrfSecret = !!process.env.CSRF_SECRET;
  if (isProduction && !testMode && !hasCsrfSecret) {
    console.log(
      "\n[ERROR] Security: CSRF_SECRET is required in production for CSRF protection and admin sessions",
    );
    hasErrors = true;
  } else if (hasCsrfSecret) {
    console.log("\nSecurity Configuration:");
    console.log(`  [OK] CSRF_SECRET: ${process.env.CSRF_SECRET.substring(0, Math.min(8, process.env.CSRF_SECRET.length))}...`);
    const adminSessionSecret = process.env.ADMIN_SESSION_SECRET;
    if (adminSessionSecret) {
      console.log(`  [OK] ADMIN_SESSION_SECRET: ${adminSessionSecret.substring(0, Math.min(8, adminSessionSecret.length))}...`);
    } else {
      console.log(
        "  [INFO] ADMIN_SESSION_SECRET: Not set (falling back to CSRF_SECRET for admin sessions)",
      );
    }
  } else {
    console.log(
      "\nSecurity Configuration: CSRF_SECRET not configured (CSRF protection and admin sessions may fail)",
    );
    hasWarnings = true;
  }

  console.log("\nOptional Variables:");
  requiredEnvVars.optional.forEach(
    ({ name, description, default: defaultValue }) => {
      const value = process.env[name];
      if (!value) {
        if (defaultValue) {
          console.log(
            `  [INFO] ${name}: Using default "${defaultValue}" - ${description}`,
          );
        } else {
          console.log(`  [WARN] ${name}: Not set - ${description}`);
          hasWarnings = true;
        }
      } else {
        const masked =
          value.substring(0, 20) + (value.length > 20 ? "..." : "");
        console.log(`  [OK] ${name}: ${masked}`);
      }
    },
  );

  console.log("\n=== Validation Summary ===");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Test Mode: ${testMode ? "Enabled" : "Disabled"}`);
  console.log(`CI Mode: ${isCI ? "Yes" : "No"}`);

  if (hasErrors) {
    console.log("\n[FAILED] Missing critical environment variables");
    process.exit(1);
  } else if (hasWarnings) {
    if (isCI && testMode) {
      console.log("\n[PASSED] CI validation successful (using dummy values)");
      process.exit(0);
    } else {
      console.log(
        "\n[PASSED WITH WARNINGS] Some optional variables are missing",
      );
      process.exit(0);
    }
  } else {
    console.log("\n[PASSED] All environment variables are configured");
    process.exit(0);
  }
}

if (require.main === module) {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config({ path: ".env" });
  validateEnv();
}

module.exports = { validateEnv, requiredEnvVars };
