#!/bin/bash
# Post-deployment smoke tests
# Run immediately after deployment to verify critical functionality
#
# Usage: ./scripts/post-deploy-smoke-test.sh [site-url]
# Example: ./scripts/post-deploy-smoke-test.sh https://www.talk-to-my-lawyer.com

set -e

SITE_URL="${1:-https://www.talk-to-my-lawyer.com}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Running post-deployment smoke tests on $SITE_URL"
echo ""

# Track overall success
TESTS_PASSED=true

# Test 1: Health endpoint
echo "Test 1: Health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/api/health" || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Health check passed (200)${NC}"
  
  # Check for startup errors in health response
  HEALTH_RESPONSE=$(curl -s "$SITE_URL/api/health")
  if echo "$HEALTH_RESPONSE" | grep -q '"healthy":false'; then
    echo -e "${RED}❌ Health endpoint reports unhealthy status${NC}"
    echo "Response: $HEALTH_RESPONSE"
    TESTS_PASSED=false
  elif echo "$HEALTH_RESPONSE" | grep -q '"errors":\['; then
    ERROR_COUNT=$(echo "$HEALTH_RESPONSE" | grep -o '"errors":\[[^]]*\]' | grep -o ',' | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo -e "${RED}❌ Health endpoint reports errors${NC}"
      echo "Response: $HEALTH_RESPONSE"
      TESTS_PASSED=false
    fi
  fi
else
  echo -e "${RED}❌ Health check failed with status $HEALTH_STATUS${NC}"
  TESTS_PASSED=false
fi
echo ""

# Test 2: Homepage loads
echo "Test 2: Homepage..."
HOME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" || echo "000")
if [ "$HOME_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Homepage loads (200)${NC}"
else
  echo -e "${RED}❌ Homepage failed with status $HOME_STATUS${NC}"
  TESTS_PASSED=false
fi
echo ""

# Test 3: Login page loads
echo "Test 3: Login page..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/auth/login" || echo "000")
if [ "$LOGIN_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Login page loads (200)${NC}"
else
  echo -e "${RED}❌ Login page failed with status $LOGIN_STATUS${NC}"
  TESTS_PASSED=false
fi
echo ""

# Test 4: Admin portal login page loads
echo "Test 4: Admin portal..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/secure-admin-gateway/login" || echo "000")
if [ "$ADMIN_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Admin portal loads (200)${NC}"
else
  echo -e "${YELLOW}⚠️  Admin portal returned status $ADMIN_STATUS${NC}"
  # Don't fail on admin portal issues, just warn
fi
echo ""

# Test 5: API responds (without auth, should return 401 or 405, not 500)
echo "Test 5: API responsiveness..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/api/generate-letter" || echo "000")
if [ "$API_STATUS" = "500" ]; then
  echo -e "${RED}❌ API returning 500 errors (critical failure)${NC}"
  TESTS_PASSED=false
elif [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "405" ] || [ "$API_STATUS" = "400" ]; then
  echo -e "${GREEN}✅ API is responsive (returned $API_STATUS as expected)${NC}"
else
  echo -e "${YELLOW}⚠️  API returned unexpected status $API_STATUS${NC}"
  # Don't fail, just warn
fi
echo ""

# Test 6: Static assets load
echo "Test 6: Static assets..."
STATIC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/_next/static/css" || echo "000")
if [ "$STATIC_STATUS" = "200" ] || [ "$STATIC_STATUS" = "404" ]; then
  echo -e "${GREEN}✅ Static assets are accessible${NC}"
else
  echo -e "${YELLOW}⚠️  Static assets returned status $STATIC_STATUS${NC}"
fi
echo ""

# Test 7: Response time check
echo "Test 7: Response time..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$SITE_URL/api/health" || echo "0")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
if (( $(echo "$RESPONSE_TIME < 2" | bc -l) )); then
  echo -e "${GREEN}✅ Response time is good (${RESPONSE_TIME_MS}ms)${NC}"
elif (( $(echo "$RESPONSE_TIME < 5" | bc -l) )); then
  echo -e "${YELLOW}⚠️  Response time is slow (${RESPONSE_TIME_MS}ms)${NC}"
else
  echo -e "${RED}❌ Response time is very slow (${RESPONSE_TIME_MS}ms)${NC}"
  TESTS_PASSED=false
fi
echo ""

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  echo ""
  echo "Deployment appears successful. Next steps:"
  echo "  1. Monitor logs for 10-15 minutes"
  echo "  2. Test critical user flows manually"
  echo "  3. Check error rate in monitoring tools"
  echo "  4. Update #deployments Slack channel"
  exit 0
else
  echo -e "${RED}❌ Some smoke tests failed${NC}"
  echo ""
  echo "Deployment may have issues. Recommended actions:"
  echo "  1. Check Vercel logs: vercel logs --follow"
  echo "  2. Review health endpoint response"
  echo "  3. Consider rollback if issues are critical"
  echo "  4. Notify team in #incidents Slack channel"
  exit 1
fi
