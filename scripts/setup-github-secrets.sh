#!/bin/bash
# GitHub Secrets Setup Helper
# This script outputs the commands you need to run to set up GitHub Repository Secrets

echo "=== GitHub Repository Secrets Setup ==="
echo ""
echo "1. Go to your repository on GitHub"
echo "2. Navigate to Settings → Secrets and variables → Actions"
echo "3. Click 'New repository secret' for each secret below:"
echo ""

# Core secrets (required)
echo "REQUIRED SECRETS:"
echo "=================="
echo "NEXT_PUBLIC_SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY" 
echo "SUPABASE_SERVICE_ROLE_KEY"
echo "OPENAI_API_KEY"
echo "STRIPE_SECRET_KEY"
echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo "STRIPE_WEBHOOK_SECRET"
echo "ADMIN_EMAIL"
echo "ADMIN_PORTAL_KEY"
echo "CRON_SECRET"
echo "KV_REST_API_URL"
echo "KV_REST_API_TOKEN"
echo "RESEND_API_KEY"

echo ""
echo "OPTIONAL SECRETS:"
echo "=================="
echo "NEXT_PUBLIC_APP_URL (defaults to: https://www.talk-to-my-lawyer.com)"
echo "NEXT_PUBLIC_SITE_URL (defaults to: https://www.talk-to-my-lawyer.com)"
echo "DATABASE_URL"
echo "AI_GATEWAY_API_KEY"

echo ""
echo "=== Security Reminder ==="
echo "🔒 NEVER commit real API keys to your repository"
echo "✅ Use GitHub Repository Secrets for all sensitive data"
echo "🧪 Use .env.ci for local CI testing with dummy values"

echo ""
echo "Once you've added the secrets, your CI pipeline should pass!"
echo "You can check the status at: https://github.com/moizjmj-pk/talk-to-my-lawyer/actions"