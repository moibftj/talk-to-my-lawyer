#!/bin/bash

# Load environment variables
source .env.local

# Use pooler connection for better reliability
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is required}"
: "${SUPABASE_DB_HOST:?SUPABASE_DB_HOST is required}"
: "${SUPABASE_DB_USER:?SUPABASE_DB_USER is required}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-6543}"

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"
PSQL_CONN="psql -h ${SUPABASE_DB_HOST} -U ${SUPABASE_DB_USER} -d ${SUPABASE_DB_NAME} -p ${SUPABASE_DB_PORT}"

# Get all migration files in chronological order (by timestamp in filename)
migrations=($(ls -1 supabase/migrations/*.sql | sort -t'_' -k1))

echo "Found ${#migrations[@]} migration files"
echo "============================================"

# Track already applied migrations
declare -A applied
applied["20251214022657_001_core_schema.sql"]=1

# Apply each migration
for migration in "${migrations[@]}"; do
    filename=$(basename "$migration")
    
    # Skip if already applied
    if [[ ${applied[$filename]} ]]; then
        echo "⊙ Skipped (already applied): $filename"
        continue
    fi
    
    echo ""
    echo "Applying: $filename"
    echo "--------------------------------------------"
    
    $PSQL_CONN -f "$migration" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ Success: $filename"
        applied[$filename]=1
    else
        echo "✗ Failed: $filename"
        echo "Continuing to next migration..."
    fi
done

echo ""
echo "============================================"
echo "Migration deployment completed!"
