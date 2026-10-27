#!/usr/bin/env bash
# Deploys the portal API to Cloud Run. Run in Cloud Shell from the repo root, with the project selected:
#   SHEET_ID=<id de la planilla> SEGUIMIENTO_ID=<id del seguimiento interno> bash cloudrun/deploy.sh staging   (or prod)
#   SHEET_ID=<id de la copia de prueba> bash cloudrun/deploy.sh prueba
# Sheet IDs are passed at deploy time and never stored in the repo.
# staging is the live service schools use (domain), prueba the test portal's (copy of the Sheet, fake rows).
set -euo pipefail
ENTORNO="${1:-}"
: "${SHEET_ID:?Falta SHEET_ID}"
case "$ENTORNO" in
  staging|prod)
    # --set-env-vars replaces every variable: a deploy without SEGUIMIENTO_ID silently stops the team tracker
    : "${SEGUIMIENTO_ID:?Falta SEGUIMIENTO_ID (sin él, el seguimiento interno deja de escribirse)}"
    VARS="SHEET_ID=${SHEET_ID};SEGUIMIENTO_ID=${SEGUIMIENTO_ID}" ;;
  prueba)
    # never the team tracker: test data would overwrite the real one every 2 min
    if [ -n "${SEGUIMIENTO_ID:-}" ]; then echo "prueba no escribe el seguimiento interno: quita SEGUIMIENTO_ID"; exit 1; fi
    VARS="SHEET_ID=${SHEET_ID};ORIGENES=https://mau-trabun.github.io,http://localhost:8765" ;;
  *) echo "Uso: SHEET_ID=<id> [SEGUIMIENTO_ID=<id>] bash cloudrun/deploy.sh staging|prod|prueba"; exit 1 ;;
esac
PROYECTO="$(gcloud config get-value project 2>/dev/null)"
REGION=southamerica-west1 # Santiago

cp gas/Code.js cloudrun/Code.js # the service runs the same Code.js as Apps Script
trap 'rm -f cloudrun/Code.js' EXIT

# max-instances 1: one in-memory snapshot and one throttle counter (292 schools fit easily in one instance)
gcloud run deploy "portal-api-${ENTORNO}" \
  --source cloudrun \
  --region "$REGION" \
  --service-account "portal-api@${PROYECTO}.iam.gserviceaccount.com" \
  --no-invoker-iam-check \
  --set-env-vars "^;^${VARS}" \
  --memory 1Gi --cpu 1 \
  --min-instances 0 --max-instances 1 --concurrency 80 \
  --timeout 60
