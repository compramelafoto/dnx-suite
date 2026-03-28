#!/usr/bin/env bash
set -euo pipefail

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "ERROR: falta VERCEL_TOKEN"
  exit 1
fi

if [ -z "${VERCEL_TEAM_ID:-}" ]; then
  echo "ERROR: falta VERCEL_TEAM_ID"
  exit 1
fi

PROJECT="fotorank-dnxsuite"

delete_key_target() {
  local key="$1"
  local target="$2"

  curl -s "https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" |
    jq -r --arg KEY "$key" --arg TARGET "$target" '
      .envs[]
      | select(.key == $KEY)
      | select((.target | index($TARGET)) != null)
      | .id
    ' | while read -r env_id; do
      [ -z "$env_id" ] && continue
      echo "Borrando $key ($target) -> $env_id"
      curl -sS -X DELETE "https://api.vercel.com/v9/projects/${PROJECT}/env/${env_id}?teamId=${VERCEL_TEAM_ID}" \
        -H "Authorization: Bearer ${VERCEL_TOKEN}" | jq .
    done
}

create_key_target() {
  local key="$1"
  local value="$2"
  local target="$3"

  payload=$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    --arg target "$target" \
    '[
      {
        key: $key,
        value: $value,
        type: "encrypted",
        target: [$target]
      }
    ]')

  echo "Creando $key ($target)"
  curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq .
}

for key in APP_URL NEXT_PUBLIC_APP_URL AUTH_URL COOKIE_DOMAIN GOOGLE_REDIRECT_URI; do
  delete_key_target "$key" "production"
  delete_key_target "$key" "preview"
done

create_key_target "APP_URL" "https://fotorank.dnxsuite.com" "production"
create_key_target "NEXT_PUBLIC_APP_URL" "https://fotorank.dnxsuite.com" "production"
create_key_target "AUTH_URL" "https://fotorank.dnxsuite.com" "production"
create_key_target "COOKIE_DOMAIN" ".dnxsuite.com" "production"
create_key_target "GOOGLE_REDIRECT_URI" "https://fotorank.dnxsuite.com/api/auth/google/callback" "production"

create_key_target "APP_URL" "https://fotorank.staging.dnxsuite.com" "preview"
create_key_target "NEXT_PUBLIC_APP_URL" "https://fotorank.staging.dnxsuite.com" "preview"
create_key_target "AUTH_URL" "https://fotorank.staging.dnxsuite.com" "preview"
create_key_target "COOKIE_DOMAIN" ".staging.dnxsuite.com" "preview"
create_key_target "GOOGLE_REDIRECT_URI" "https://fotorank.staging.dnxsuite.com/api/auth/google/callback" "preview"

echo ""
echo "Verificación final:"
curl -s "https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${VERCEL_TEAM_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" | jq -r '
    .envs[]
    | select(.key=="APP_URL" or .key=="NEXT_PUBLIC_APP_URL" or .key=="AUTH_URL" or .key=="COOKIE_DOMAIN" or .key=="GOOGLE_REDIRECT_URI")
    | "\(.key) | \(.target|join(","))"
  '
