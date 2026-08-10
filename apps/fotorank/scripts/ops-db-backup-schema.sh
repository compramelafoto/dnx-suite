#!/usr/bin/env bash
# Backup schema-only con pg_dump 17 (compatible Neon 17).
# Uso: DATABASE_URL=... ./ops-db-backup-schema.sh [label]
set -euo pipefail
LABEL="${1:-manual}"
PGDUMP="${PGDUMP_BIN:-/opt/homebrew/opt/postgresql@17/bin/pg_dump}"
if [[ ! -x "$PGDUMP" ]]; then
  echo "ABORT: pg_dump 17 no encontrado en $PGDUMP" >&2
  exit 1
fi
URL="${DIRECT_URL:-${DATABASE_URL:?DATABASE_URL required}}"
OUT_DIR="${BACKUP_DIR:-/tmp/fotorank-prod-backups}"
mkdir -p "$OUT_DIR"
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$OUT_DIR/fotorank-schema-${LABEL}-${TS}.sql"
"$PGDUMP" "$URL" --schema-only --no-owner --no-acl -f "$OUT"
shasum -a 256 "$OUT" | tee "$OUT.sha256"
echo "OK path=$OUT"
