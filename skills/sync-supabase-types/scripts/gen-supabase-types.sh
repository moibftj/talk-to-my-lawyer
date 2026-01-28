#!/usr/bin/env bash
set -euo pipefail

# Generate Supabase types to a temp file for diffing.
# Usage: gen-supabase-types.sh [--db-url <url>] [--schema <schema>] [--out <path>] [--project-id <id>] [--dry-run]

SCHEMA="public"
OUT="/tmp/supabase.types.ts"
DB_URL=""
PROJECT_ID="${SUPABASE_PROJECT_ID:-nomiiqzxaxyxnxndvkbe}"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-url)
      DB_URL="$2"
      shift 2
      ;;
    --schema)
      SCHEMA="$2"
      shift 2
      ;;
    --out)
      OUT="$2"
      shift 2
      ;;
    --project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      echo "Usage: gen-supabase-types.sh [--db-url <url>] [--schema <schema>] [--out <path>] [--project-id <id>] [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
 done

if [[ -z "$DB_URL" ]]; then
  DB_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
fi

if [[ -n "$DB_URL" ]]; then
  CMD=(pnpm exec supabase gen types typescript --db-url "$DB_URL" --schema "$SCHEMA")
elif [[ -n "$PROJECT_ID" ]]; then
  CMD=(pnpm exec supabase gen types typescript --project-id "$PROJECT_ID" --schema "$SCHEMA")
else
  echo "Missing DB URL or project id. Set DATABASE_URL, POSTGRES_URL, SUPABASE_PROJECT_ID, or pass --db-url/--project-id." >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "DRY RUN: ${CMD[*]} > $OUT"
  exit 0
fi

mkdir -p "$(dirname "$OUT")"
"${CMD[@]}" > "$OUT"

echo "Wrote types to $OUT"
