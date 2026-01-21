#!/bin/bash

# Migration Deployment Script for Race Condition Fix
# This script safely deploys the payment race condition fix

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Payment Race Condition Fix Deployment${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}Error: .env.local not found${NC}"
    echo "Please create .env.local with Supabase credentials"
    exit 1
fi

# Load environment variables
source .env.local

# Check required variables
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo -e "${RED}Error: SUPABASE_DB_PASSWORD not set${NC}"
    exit 1
fi

# Configuration
SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-aws-1-us-east-2.pooler.supabase.com}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres.nomiiqzxaxyxnxndvkbe}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-6543}"

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"
PSQL_CONN="psql -h ${SUPABASE_DB_HOST} -U ${SUPABASE_DB_USER} -d ${SUPABASE_DB_NAME} -p ${SUPABASE_DB_PORT}"

echo -e "${YELLOW}Database: ${SUPABASE_DB_HOST}${NC}"
echo -e "${YELLOW}User: ${SUPABASE_DB_USER}${NC}"
echo ""

# Test connection
echo -e "${BLUE}Testing database connection...${NC}"
if $PSQL_CONN -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected successfully${NC}"
else
    echo -e "${RED}✗ Connection failed${NC}"
    exit 1
fi
echo ""

# Backup check
echo -e "${BLUE}Checking for backup...${NC}"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
echo -e "${YELLOW}Recommended: Create backup with:${NC}"
echo -e "${YELLOW}  supabase db dump -f ${BACKUP_FILE}${NC}"
echo ""
read -p "Have you created a backup? (yes/no) " -n 3 -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}Aborting deployment. Please create a backup first.${NC}"
    exit 1
fi

# Deploy migration
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Deploying Migration${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

MIGRATION_FILE="supabase/migrations/20260122000005_verify_payment_race_fix.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: ${MIGRATION_FILE}${NC}"
    exit 1
fi

echo -e "${BLUE}Applying: $(basename $MIGRATION_FILE)${NC}"
echo "--------------------------------------------"

if $PSQL_CONN -f "$MIGRATION_FILE" 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Migration applied successfully${NC}"
else
    echo ""
    echo -e "${RED}✗ Migration failed${NC}"
    echo -e "${YELLOW}Check the error above and consider rolling back${NC}"
    exit 1
fi

# Verification
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Running Verification${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

VERIFY_SCRIPT="scripts/verify-race-fix-deployment.sql"

if [ -f "$VERIFY_SCRIPT" ]; then
    $PSQL_CONN -f "$VERIFY_SCRIPT"
else
    echo -e "${YELLOW}Verification script not found, running basic checks...${NC}"
    
    # Check if function exists
    $PSQL_CONN -c "
    SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN '✓ verify_and_complete_subscription exists'
            ELSE '✗ Function NOT found'
        END
    FROM pg_proc 
    WHERE proname = 'verify_and_complete_subscription';
    "
fi

# Success message
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test payment flow: node test-payment-race-condition.js"
echo "2. Monitor application logs for race conditions"
echo "3. Check for duplicate subscriptions in database"
echo "4. Review DEPLOYMENT_CHECKLIST.md for full testing plan"
echo ""
echo -e "${BLUE}Monitoring queries:${NC}"
echo ""
echo "Check for duplicates:"
echo "  SELECT stripe_session_id, COUNT(*) FROM subscriptions WHERE stripe_session_id IS NOT NULL GROUP BY stripe_session_id HAVING COUNT(*) > 1;"
echo ""
echo "Check email queue:"
echo "  SELECT status, COUNT(*) FROM email_queue GROUP BY status;"
echo ""
