#!/usr/bin/env bash

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
ZIP_SECRET="${ZIP_JOB_PROCESS_SECRET:-}"
ORDER_ID="${ORDER_ID:-123}" # reemplazá con un order real
PHOTO_IDS="${PHOTO_IDS:-"1,2"}" # IDs separados por coma

if [[ -z "$ZIP_SECRET" ]]; then
  echo "ZIP_JOB_PROCESS_SECRET no definido; define la variable antes de ejecutar este script."
  exit 1
fi

IFS=',' read -ra IDs <<< "$PHOTO_IDS"
PAYLOAD=$(jq -c -n --arg orderId "$ORDER_ID" --argjson photoIds "$(printf '%s\n' "${IDs[@]}" | jq -R . | jq -cs .)" \
  '{orderId: ($orderId|tonumber?), photoIds: $photoIds}')

echo "Creando job ZIP..."
CREATE=$(curl -s -X POST "$APP_URL/api/zip-jobs/create" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
JOB_ID=$(echo "$CREATE" | jq -r '.jobId')
STATUS_URL=$(echo "$CREATE" | jq -r '.statusUrl')
PROCESS_URL=$(echo "$CREATE" | jq -r '.processUrl')

[ -z "$JOB_ID" ] && echo "No se creó el job: $CREATE" && exit 1

echo "Job creado: $JOB_ID"

echo "Consultando status..."
while true; do
  STATUS=$(curl -s "$STATUS_URL")
  echo "$STATUS"
  STATE=$(echo "$STATUS" | jq -r '.status')
  if [[ "$STATE" == "COMPLETED" || "$STATE" == "FAILED" ]]; then
    break
  fi
  sleep 3
done

echo "Forzando procesamiento (POST a process)..."
curl -s -X POST "$PROCESS_URL?zipSecret=$ZIP_SECRET"

echo "Listo."
