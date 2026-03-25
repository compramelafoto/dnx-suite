#!/usr/bin/env bash
set -euo pipefail

ENV_DIR="$HOME/Desktop/dnx-suite/infra/vercel/envs"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "ERROR: falta VERCEL_TOKEN"
  exit 1
fi

if [ -z "${VERCEL_TEAM_ID:-}" ]; then
  echo "ERROR: falta VERCEL_TEAM_ID"
  exit 1
fi

upload_file() {
  local project="$1"
  local file="$2"

  echo ""
  echo "=============================="
  echo "Subiendo preview envs a: $project"
  echo "Archivo: $file"
  echo "=============================="

  while IFS='=' read -r key value; do
    [ -z "${key:-}" ] && continue
    case "$key" in \#*) continue ;; esac

    payload=$(jq -n \
      --arg key "$key" \
      --arg value "$value" \
      '[
        {
          key: $key,
          value: $value,
          type: "encrypted",
          target: ["preview"]
        }
      ]')

    curl -sS -X POST "https://api.vercel.com/v10/projects/${project}/env?teamId=${VERCEL_TEAM_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$payload" | jq .
  done < "$file"
}

upload_file "compramelafoto-dnxsuite" "$ENV_DIR/compramelafoto-dnxsuite.preview.env"
upload_file "fotorank-dnxsuite" "$ENV_DIR/fotorank-dnxsuite.preview.env"
