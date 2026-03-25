#!/bin/bash

# Script para procesar todas las fotos en PRODUCCIÓN (Vercel)
# 
# Uso:
#   1. Configura las variables de entorno:
#      export PRODUCTION_URL="https://compramelafoto.com"
#      export CRON_SECRET="tu-secret-aqui"
#
#   2. Ejecuta el script:
#      bash scripts/process-all-photos-production.sh
#
# O ejecuta directamente desde terminal:
#   curl -X POST "https://compramelafoto.com/api/internal/analysis/run?token=TU_CRON_SECRET"
#   (repetir hasta que processed=0)

PRODUCTION_URL="${PRODUCTION_URL:-https://compramelafoto.com}"
CRON_SECRET="${CRON_SECRET:-}"

if [ -z "$CRON_SECRET" ]; then
  echo "❌ Error: CRON_SECRET no está configurado"
  echo ""
  echo "Ejecuta:"
  echo "  export CRON_SECRET='tu-secret-aqui'"
  echo "  bash scripts/process-all-photos-production.sh"
  exit 1
fi

echo "🚀 Procesando fotos en producción: $PRODUCTION_URL"
echo ""

ITERATION=1
MAX_ITERATIONS=100
TOTAL_PROCESSED=0

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "📋 Iteración $ITERATION..."
  
  RESPONSE=$(curl -s -X POST \
    "$PRODUCTION_URL/api/internal/analysis/run?token=$CRON_SECRET" \
    -H "Authorization: Bearer $CRON_SECRET")
  
  PROCESSED=$(echo "$RESPONSE" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*' || echo "0")
  BACKFILLED=$(echo "$RESPONSE" | grep -o '"backfilled":[0-9]*' | grep -o '[0-9]*' || echo "0")
  ERRORS=$(echo "$RESPONSE" | grep -o '"errors":\[.*\]' | grep -o '\[.*\]' || echo "[]")
  
  echo "   ✅ Procesadas: $PROCESSED"
  echo "   📝 Jobs creados: $BACKFILLED"
  
  TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
  
  # Si no se procesó nada y no hay jobs nuevos, terminamos
  if [ "$PROCESSED" = "0" ] && [ "$BACKFILLED" = "0" ]; then
    echo ""
    echo "✅ ¡Todas las fotos han sido procesadas!"
    break
  fi
  
  # Esperar 2 segundos antes de la siguiente iteración
  sleep 2
  
  ITERATION=$((ITERATION + 1))
done

echo ""
echo "📊 RESUMEN:"
echo "   Total procesadas: $TOTAL_PROCESSED"
echo "   Iteraciones: $ITERATION"
echo ""
