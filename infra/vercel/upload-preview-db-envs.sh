#!/usr/bin/env bash
set -euo pipefail

if [ -z "${VERCEL_TOKEN:-}" ] || [ -z "${VERCEL_TEAM_ID:-}" ]; then
  echo "Faltan VERCEL_TOKEN o VERCEL_TEAM_ID"
  exit 1
fi

ENV_DIR="$HOME/Desktop/dnx-suite/infra/vercel/envs"

replace_one() {
  local project="$1"
  local target="$2"
  local file="$3"
  local key="$4"

  value=$(grep "^${key}=" "$file" | head -n1 | cut -d= -f2-)

  ids=$(curl -s "https://api.vercel.com/v10/projects/${project}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    | jq -r --arg KEY "$key" --arg TARGET "$target" '
        .envs[]
        | select(.key == $KEY)
        | select((.target | index($TARGET)) != null)
        | .id
      ')

  for id in $ids; do
    curl -sS -X DELETE "https://api.vercel.com/v9/projects/${project}/env/${id}?teamId=${VERCEL_TEAM_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" >/dev/null
  done

  payload=$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    --arg target "$target" \
    '[{key:$key,value:$value,type:"encrypted",target:[$target]}]')

  curl -sS -X POST "https://api.vercel.com/v10/projects/${project}/env?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq .
}

for project in compramelafoto-dnxsuite fotorank-dnxsuite; do
  if [ "$project" = "compramelafoto-dnxsuite" ]; then
    file="$ENV_DIR/compramelafoto-dnxsuite.preview.env"
  else
    file="$ENV_DIR/fotorank-dnxsuite.preview.env"
  fi

  replace_one "$project" "preview" "$file" "DATABASE_URL"
  replace_one "$project" "preview" "$file" "DIRECT_URL"
done
