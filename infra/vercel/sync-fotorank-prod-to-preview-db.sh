#!/usr/bin/env bash
set -euo pipefail

PROJECT="fotorank-dnxsuite"
FILE="$HOME/Desktop/dnx-suite/infra/vercel/envs/fotorank-dnxsuite.preview.env"

get_val() {
  grep "^$1=" "$FILE" | head -n1 | cut -d= -f2-
}

upsert_prod() {
  local key="$1"
  local value="$2"

  raw=$(curl -s "https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}")

  ids=$(echo "$raw" | jq -r --arg KEY "$key" '
    (.envs // [])[]
    | select(.key == $KEY)
    | select((.target | index("production")) != null)
    | .id
  ')

  for id in $ids; do
    [ -z "$id" ] && continue
    curl -sS -X DELETE "https://api.vercel.com/v9/projects/${PROJECT}/env/${id}?teamId=${VERCEL_TEAM_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" >/dev/null
  done

  payload=$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    '[{key:$key,value:$value,type:"encrypted",target:["production"]}]')

  curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq .
}

upsert_prod "DATABASE_URL" "$(get_val DATABASE_URL)"
upsert_prod "DIRECT_URL" "$(get_val DIRECT_URL)"
