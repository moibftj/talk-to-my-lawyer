# CI/CD Pipeline Documentation

## Overview

The project uses GitHub Actions for continuous integration and testing. The pipeline runs on every push to `main` and on pull requests, using **GitHub Repository Secrets** for secure environment variable management.

## Pipeline Steps

1. **Checkout** - Get the latest code
2. **Setup pnpm** - Install package manager
3. **Setup Node.js** - Install Node.js runtime
4. **Install dependencies** - Install all project dependencies
5. **Run linter** - Check code quality and style
6. **Security audit** - Check for high-severity vulnerabilities
7. **Build project** - Create production build with real environment variables
8. **Environment validation** - Validate environment configuration

## GitHub Repository Secrets

The CI pipeline uses GitHub Repository Secrets to securely provide environment variables.

### Required Secrets

Add these in GitHub Repository Settings → Secrets and variables → Actions:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key for letter generation
- `STRIPE_SECRET_KEY` - Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `ADMIN_EMAIL` - Admin email address
- `ADMIN_PORTAL_KEY` - Admin portal access key
- `CRON_SECRET` - Cron job authentication secret
- `KV_REST_API_URL` - Upstash Redis URL
- `KV_REST_API_TOKEN` - Upstash Redis token
- `RESEND_API_KEY` - Resend email service API key

### Optional Secrets

- `NEXT_PUBLIC_APP_URL` - Production app URL (defaults to https://www.talk-to-my-lawyer.com)
- `NEXT_PUBLIC_SITE_URL` - Site URL for metadata

## Environment Validation Modes

### Development Mode

- Requires critical environment variables
- Warns about missing production variables
- Uses `.env.local` and `.env` files

### CI Mode

- Accepts dummy values for critical variables
- Shows warnings instead of errors for missing variables
- Uses `.env.ci` file for testing

### Production Mode

- Requires all critical and production environment variables
- Fails if any required variables are missing

## Running CI Locally

To test the CI environment validation locally:

```bash
# Copy CI environment file
cp .env.ci .env

# Run validation in CI mode
CI=true node scripts/validate-env.js

# Clean up
rm .env
```

## Adding New Environment Variables

When adding new required environment variables:

1. Add to `scripts/validate-env.js` in the appropriate category
2. Add dummy values to `.env.ci` if needed for CI
3. Update this documentation

## Troubleshooting

- If CI fails on environment validation, check that `.env.ci` has all required dummy values
- If adding new critical variables, ensure they're included in `.env.ci`
- For production deployment, ensure all real environment variables are configured in your hosting platform
