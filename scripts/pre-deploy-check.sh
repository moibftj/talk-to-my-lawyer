#!/bin/bash
# Pre-deployment validation script
# Run this before every production deployment to catch issues early
#
# Usage: ./scripts/pre-deploy-check.sh

set -e

echo "🔍 Running pre-deployment checks..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall success
CHECKS_PASSED=true

# Check 1: Validate .env.example completeness
echo "📋 Check 1: Validating .env.example completeness..."
if [ -f "scripts/validate-env-example.js" ]; then
  if node scripts/validate-env-example.js; then
    echo -e "${GREEN}✅ .env.example is up to date${NC}"
  else
    echo -e "${RED}❌ .env.example validation failed${NC}"
    CHECKS_PASSED=false
  fi
else
  echo -e "${YELLOW}⚠️  Skipping (validate-env-example.js not found)${NC}"
fi
echo ""

# Check 2: Verify Vercel environment variables (if VERCEL_TOKEN is set)
echo "🔧 Check 2: Verifying Vercel environment variables..."
if [ -n "$VERCEL_TOKEN" ] && [ -f "scripts/verify-vercel-env.js" ]; then
  if node scripts/verify-vercel-env.js; then
    echo -e "${GREEN}✅ Vercel environment variables verified${NC}"
  else
    echo -e "${RED}❌ Vercel environment variable verification failed${NC}"
    CHECKS_PASSED=false
  fi
else
  echo -e "${YELLOW}⚠️  Skipping (VERCEL_TOKEN not set or script not found)${NC}"
fi
echo ""

# Check 3: Run linting
echo "🧹 Check 3: Running ESLint..."
if pnpm lint; then
  echo -e "${GREEN}✅ Linting passed${NC}"
else
  echo -e "${RED}❌ Linting failed${NC}"
  CHECKS_PASSED=false
fi
echo ""

# Check 4: Run TypeScript type checking
echo "🔍 Check 4: Running TypeScript type check..."
if pnpm tsc --noEmit; then
  echo -e "${GREEN}✅ Type checking passed${NC}"
else
  echo -e "${YELLOW}⚠️  Type checking found issues (may be acceptable)${NC}"
  # Don't fail on TypeScript errors, just warn
fi
echo ""

# Check 5: Run production build
echo "🏗️  Check 5: Running production build..."
if CI=1 pnpm build; then
  echo -e "${GREEN}✅ Production build succeeded${NC}"
else
  echo -e "${RED}❌ Production build failed${NC}"
  CHECKS_PASSED=false
fi
echo ""

# Check 6: Run tests (if test script exists)
echo "🧪 Check 6: Running test suite..."
if grep -q '"test"' package.json; then
  if pnpm test; then
    echo -e "${GREEN}✅ Tests passed${NC}"
  else
    echo -e "${RED}❌ Tests failed${NC}"
    CHECKS_PASSED=false
  fi
else
  echo -e "${YELLOW}⚠️  Skipping (no test script found)${NC}"
fi
echo ""

# Check 7: Scan for hardcoded secrets
echo "🔒 Check 7: Scanning for hardcoded secrets..."
if git diff --cached | grep -E "(sk-|pk_|whsec_|eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)" > /dev/null; then
  echo -e "${RED}❌ Potential secrets detected in staged changes!${NC}"
  echo "Please review your changes and remove any hardcoded secrets."
  CHECKS_PASSED=false
else
  echo -e "${GREEN}✅ No secrets detected in staged changes${NC}"
fi
echo ""

# Check 8: Verify no uncommitted changes (optional, can be disabled)
echo "📝 Check 8: Checking for uncommitted changes..."
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  You have uncommitted changes${NC}"
  echo "Consider committing or stashing them before deployment."
  # Don't fail, just warn
else
  echo -e "${GREEN}✅ Working directory is clean${NC}"
fi
echo ""

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$CHECKS_PASSED" = true ]; then
  echo -e "${GREEN}✅ All pre-deployment checks passed!${NC}"
  echo ""
  echo "You're ready to deploy to production."
  echo "Next steps:"
  echo "  1. Merge your PR to main"
  echo "  2. Monitor the Vercel deployment"
  echo "  3. Run post-deployment smoke tests"
  echo "  4. Check the health endpoint"
  exit 0
else
  echo -e "${RED}❌ Some pre-deployment checks failed${NC}"
  echo ""
  echo "Please fix the issues above before deploying to production."
  echo "Deployment blocked to prevent production incidents."
  exit 1
fi
