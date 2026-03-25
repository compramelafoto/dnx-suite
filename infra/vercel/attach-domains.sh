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

add_domain() {
  local project="$1"
  local domain="$2"

  echo ""
  echo "=============================="
  echo "Agregando dominio $domain a $project"
  echo "=============================="

  curl -sS -X POST "https://api.vercel.com/v10/projects/${project}/domains?teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${domain}\"}" | jq .
}

add_domain "compramelafoto-dnxsuite" "compramelafoto.dnxsuite.com"
add_domain "compramelafoto-dnxsuite" "compramelafoto.staging.dnxsuite.com"

add_domain "fotorank-dnxsuite" "fotorank.dnxsuite.com"
add_domain "fotorank-dnxsuite" "fotorank.staging.dnxsuite.com"
