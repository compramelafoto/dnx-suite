#!/bin/bash

# shell script to exercise zip job lifecycle
set -euo pipefail

if [ -z "${ZIP_JOB_PROCESS_SECRET:-}" ]; then
  echo "ZIP_JOB_PROCESS_SECRET not set"
  exit 1
fi

API_URL="${API_URL:-http://localhost:3000}"

echo "Create job..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/zip-jobs/create" \
  -H "Content-Type: application/json" \
  -d '{"type":"CUSTOM_PHOTOS","photoIds":[1,2,3]}')
JOB_ID=$(echo "$CREATE_RESPONSE" | jq -r '.job?.id // .id')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo "Failed to create job: $CREATE_RESPONSE"
  exit 1
fi

echo "Created job ${JOB_ID}"

echo "Process job..."
PROCESS_RESPONSE=$(curl -s -X POST "$API_URL/api/zip-jobs/$JOB_ID/process" \
  -H "x-zip-secret: $ZIP_JOB_PROCESS_SECRET")
echo "Process response: $PROCESS_RESPONSE"

echo "Status:"
curl -s "$API_URL/api/zip-jobs/$JOB_ID/status"

echo "Done."
