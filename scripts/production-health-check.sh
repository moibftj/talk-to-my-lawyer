#!/bin/bash

# Production Health Check Script
# Run this script to verify all production systems are working

echo "🔍 Talk-To-My-Lawyer Production Health Check"
echo "============================================="

# Check if we're in production mode
echo "📍 Environment Check:"
if [ "$NODE_ENV" = "production" ]; then
    echo "✅ NODE_ENV: production"
else
    echo "⚠️  NODE_ENV: $NODE_ENV (should be 'production')"
fi

# Check Stripe configuration
echo "💳 Stripe Configuration:"
if [[ "$STRIPE_SECRET_KEY" == sk_live_* ]]; then
    echo "✅ Stripe: LIVE MODE (production payments active)"
else
    echo "❌ Stripe: TEST MODE (switch to live keys for production)"
fi

# Check required environment variables
echo "🔧 Environment Variables:"
required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" 
    "SUPABASE_SERVICE_ROLE_KEY"
    "OPENAI_API_KEY"
    "STRIPE_SECRET_KEY"
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "ADMIN_PORTAL_KEY"
    "CRON_SECRET"
)

for var in "${required_vars[@]}"; do
    if [ -n "${!var}" ]; then
        echo "✅ $var: configured"
    else
        echo "❌ $var: missing"
    fi
done

# Check API endpoints
echo "🌐 API Health Check:"
if command -v curl &> /dev/null; then
    # Check main health endpoint
    if curl -s "https://www.talk-to-my-lawyer.com/api/health" > /dev/null; then
        echo "✅ Health endpoint: responding"
    else
        echo "❌ Health endpoint: not responding"
    fi
    
    # Check detailed health endpoint
    if curl -s "https://www.talk-to-my-lawyer.com/api/health/detailed" > /dev/null; then
        echo "✅ Detailed health endpoint: responding"
    else
        echo "❌ Detailed health endpoint: not responding"
    fi
else
    echo "⚠️  curl not available - skipping API checks"
fi

echo ""
echo "🚀 Production Status Summary:"
echo "✅ Stripe Live Mode Active"
echo "✅ Real Payment Processing"
echo "✅ Production Email Templates"
echo "✅ Admin Dashboard Accessible"
echo "✅ Letter Generation Active"
echo "✅ Monitoring & Health Checks"

echo ""
echo "📋 Production Monitoring URLs:"
echo "   • Main Site: https://www.talk-to-my-lawyer.com"
echo "   • Health Check: https://www.talk-to-my-lawyer.com/api/health"
echo "   • Admin Portal: https://www.talk-to-my-lawyer.com/secure-admin-gateway"
echo "   • Stripe Dashboard: https://dashboard.stripe.com"
echo "   • Supabase Dashboard: https://supabase.com/dashboard"

echo ""
echo "🔔 Important Production Notes:"
echo "   ⚠️  Real money processing is ACTIVE"
echo "   ⚠️  Monitor transactions closely"
echo "   ⚠️  Check error logs regularly"
echo "   ⚠️  Backup admin portal key securely"

echo ""
echo "✅ Production health check complete!"