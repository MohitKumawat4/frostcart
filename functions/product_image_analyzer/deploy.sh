#!/usr/bin/env bash
# Deployment helper for the `product_image_analyzer` Google Cloud Function.
#
# The script exports the required environment variables and triggers the
# `gcloud functions deploy` command. Update the placeholder values before
# executing.

set -euo pipefail
# --- Environment configuration -------------------------------------------------
# Replace the placeholder strings with the real credentials for your project
# before deploying. Keeping them here ensures the deploy command picks them up
# without requiring manual input each time.
export SUPABASE_URL="https://oievbsjqlaeaxxzoibqt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXZic2pxbGFlYXh4em9pYnF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTI4NzI5OCwiZXhwIjoyMDc2ODYzMjk4fQ.KL7d-iwu0JslaY0yc0DBc3jmAH0tL9ddwJRG_FCqtEc"
export GEMINI_API_KEY="AIzaSyDZ2kDhRND8FL8Uliq1IBb1M4ek1isMTs4"
export GEMINI_MODEL_ID="gemini-2.5-flash"
export GCP_PROJECT="mailflow-469108"

# (Optional) customise the Google Cloud region or function name here to match
# your deployment preferences.
FUNCTION_NAME="analyze-product-image"
GCP_REGION="asia-south1"
# --- Deployment ----------------------------------------------------------------
# The `--source` flag is set to the directory that contains this script so the
# relative import path for the Cloud Function code remains accurate.

gcloud functions deploy "${FUNCTION_NAME}" \
  --project "${GCP_PROJECT}" \
  --runtime python311 \
  --region "${GCP_REGION}" \
  --entry-point analyze_product_image \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},GEMINI_API_KEY=${GEMINI_API_KEY},GEMINI_MODEL_ID=${GEMINI_MODEL_ID}" \
  --source "$(dirname "$0")"
