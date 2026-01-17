#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SUPABASE_ACCESS_TOKEN=xxx PROJECT_REF=yyy AWS_SECRET_NAME=zzz bash ./scripts/rotate-supabase-keys.sh
# or export the env vars first:
#   export SUPABASE_ACCESS_TOKEN="..."
#   export PROJECT_REF="nomiiqzxaxyxnxndvkbe"
#   export AWS_SECRET_NAME="supabase/project/nomiiqzxaxyxnxndvkbe/keys"
#   bash ./scripts/rotate-supabase-keys.sh

: "${SUPABASE_ACCESS_TOKEN:?Need to set SUPABASE_ACCESS_TOKEN}"
: "${PROJECT_REF:?Need to set PROJECT_REF}"
: "${AWS_SECRET_NAME:?Need to set AWS_SECRET_NAME}"

# Optional: set to "yes" to also update supabase CLI secrets (requires supabase CLI and linked project)
UPDATE_SUPABASE_CLI="${UPDATE_SUPABASE_CLI:-no}"

API_BASE="https://api.supabase.com"   # adjust if your org uses a different management API base
ROTATE_ENDPOINT="${API_BASE}/v1/projects/${PROJECT_REF}/service_key/rotate"

echo "Rotating keys for project: ${PROJECT_REF}"
echo "Calling: ${ROTATE_ENDPOINT}"

# Call the management API to rotate and revoke old keys, requesting new keys returned
response=$(curl -sS -X POST "${ROTATE_ENDPOINT}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"revoke_old_keys": true, "return_keys": true}')

if [[ -z "$response" ]]; then
  echo "No response from Supabase Management API. Aborting."
  exit 1
fi

# Expect JSON with fields: anon, service_role (names may vary). Try to parse.
# Use jq to parse; fail cleanly if not present.
if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed. Install jq and rerun."
  exit 1
fi

# Attempt common key names
NEW_ANON_KEY=$(echo "$response" | jq -r '.anon // .anon_key // .anon_api_key // empty')
NEW_SERVICE_ROLE_KEY=$(echo "$response" | jq -r '.service_role // .service_role_key // .service_role_api_key // empty')

if [[ -z "$NEW_ANON_KEY" || -z "$NEW_SERVICE_ROLE_KEY" ]]; then
  echo "Failed to parse new keys from API response."
  echo "Check the Management API docs or rotate manually in the Dashboard."
  exit 1
fi

echo "Received new keys. Storing in AWS Secrets Manager: ${AWS_SECRET_NAME}"

# Build JSON secret payload
secret_payload=$(jq -n --arg anon "$NEW_ANON_KEY" --arg service_role "$NEW_SERVICE_ROLE_KEY" '{SUPABASE_ANON_KEY: $anon, SUPABASE_SERVICE_ROLE_KEY: $service_role}')

# Check if secret exists
if aws secretsmanager describe-secret --secret-id "${AWS_SECRET_NAME}" >/dev/null 2>&1; then
  echo "Secret exists — creating new secret value (PutSecretValue)."
  aws secretsmanager put-secret-value --secret-id "${AWS_SECRET_NAME}" --secret-string "$secret_payload" >/dev/null
else
  echo "Secret does not exist — creating it."
  aws secretsmanager create-secret --name "${AWS_SECRET_NAME}" --secret-string "$secret_payload" >/dev/null
fi

echo "AWS Secrets Manager updated."

# Optionally update supabase CLI secrets for Edge Functions
if [[ "${UPDATE_SUPABASE_CLI}" == "yes" ]]; then
  if ! command -v supabase >/dev/null 2>&1; then
    echo "supabase CLI not found in PATH. Skipping supabase secrets update."
  else
    echo "Updating supabase project secrets..."
    # This sets both secrets; you may need to be in project directory or have project linked.
    supabase secrets set SUPABASE_ANON_KEY="${NEW_ANON_KEY}" SUPABASE_SERVICE_ROLE_KEY="${NEW_SERVICE_ROLE_KEY}"
    echo "Supabase CLI secrets updated."
  fi
fi

echo
echo "Rotation completed successfully."
echo "Keys are stored in AWS Secrets Manager: ${AWS_SECRET_NAME}"
echo
echo "Next immediate steps (must do now):"
echo " 1) Replace anon key in all client apps. (Public key — but revoked old key will stop working.)"
echo " 2) Replace service_role key in all server/CI/Edge Function environments."
echo " 3) Redeploy Edge Functions if they read keys at build time; if they use runtime secrets, a restart may not be required."
echo " 4) Run quick smoke tests against staging/production to validate functionality."
echo
echo "If anything breaks and you need emergency support, contact Supabase support with your project ref: ${PROJECT_REF}."
