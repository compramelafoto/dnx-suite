#!/bin/bash

# Script para obtener el JSON completo de Google Cloud Service Account
# 
# Uso:
#   bash scripts/get-google-credentials.sh
#   O simplemente:
#   ./scripts/get-google-credentials.sh

set -e

echo "🔍 Obteniendo credenciales de Google Cloud..."
echo ""

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI no está instalado"
    echo ""
    echo "Instálalo con:"
    echo "  macOS: brew install --cask google-cloud-sdk"
    echo "  O descarga desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar que esté autenticado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "⚠️  No estás autenticado en Google Cloud"
    echo ""
    echo "Ejecuta:"
    echo "  gcloud auth login"
    exit 1
fi

# Configuración
PROJECT_ID="compramelafoto-auth"
SERVICE_ACCOUNT_EMAIL="compramelafoto-vision@compramelafoto-auth.iam.gserviceaccount.com"
OUTPUT_FILE="google-credentials.json"

echo "📋 Configuración:"
echo "   Proyecto: $PROJECT_ID"
echo "   Cuenta de servicio: $SERVICE_ACCOUNT_EMAIL"
echo ""

# Verificar que el proyecto existe
if ! gcloud projects describe "$PROJECT_ID" &> /dev/null; then
    echo "❌ Error: El proyecto '$PROJECT_ID' no existe o no tienes acceso"
    echo ""
    echo "Lista tus proyectos con:"
    echo "  gcloud projects list"
    exit 1
fi

# Configurar el proyecto
echo "🔧 Configurando proyecto..."
gcloud config set project "$PROJECT_ID" --quiet

# Verificar que la cuenta de servicio existe
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
    echo "❌ Error: La cuenta de servicio '$SERVICE_ACCOUNT_EMAIL' no existe"
    echo ""
    echo "Lista las cuentas de servicio con:"
    echo "  gcloud iam service-accounts list"
    exit 1
fi

# Listar claves existentes
echo ""
echo "📋 Claves existentes de la cuenta de servicio:"
gcloud iam service-accounts keys list \
    --iam-account="$SERVICE_ACCOUNT_EMAIL" \
    --format="table(name.basename(),validAfterTime,validBeforeTime)"

echo ""
read -p "¿Crear una nueva clave? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Cancelado"
    exit 0
fi

# Crear nueva clave
echo ""
echo "🔑 Creando nueva clave..."
gcloud iam service-accounts keys create "$OUTPUT_FILE" \
    --iam-account="$SERVICE_ACCOUNT_EMAIL" \
    --key-file-type=json

if [ ! -f "$OUTPUT_FILE" ]; then
    echo "❌ Error: No se pudo crear el archivo"
    exit 1
fi

# Validar JSON
if ! python3 -m json.tool "$OUTPUT_FILE" > /dev/null 2>&1; then
    echo "⚠️  Advertencia: El JSON podría estar mal formado"
fi

echo ""
echo "✅ Clave creada exitosamente: $OUTPUT_FILE"
echo ""
echo "📝 Contenido del archivo:"
echo "---"
cat "$OUTPUT_FILE"
echo "---"
echo ""

# Preguntar si quiere actualizar .env.local
read -p "¿Actualizar .env.local automáticamente? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    # Leer el JSON y convertirlo a una sola línea
    JSON_ONELINE=$(cat "$OUTPUT_FILE" | tr -d '\n' | sed 's/"/\\"/g')
    
    # Actualizar .env.local
    ENV_FILE=".env.local"
    
    if [ -f "$ENV_FILE" ]; then
        # Buscar y reemplazar o agregar
        if grep -q "^GOOGLE_APPLICATION_CREDENTIALS_JSON=" "$ENV_FILE"; then
            # Reemplazar línea existente
            sed -i.bak "s|^GOOGLE_APPLICATION_CREDENTIALS_JSON=.*|GOOGLE_APPLICATION_CREDENTIALS_JSON=\"$JSON_ONELINE\"|" "$ENV_FILE"
            echo "✅ Actualizado GOOGLE_APPLICATION_CREDENTIALS_JSON en $ENV_FILE"
        else
            # Agregar al final
            echo "" >> "$ENV_FILE"
            echo "# ================================" >> "$ENV_FILE"
            echo "# Google Vision API (OCR)" >> "$ENV_FILE"
            echo "# ================================" >> "$ENV_FILE"
            echo "GOOGLE_APPLICATION_CREDENTIALS_JSON=\"$JSON_ONELINE\"" >> "$ENV_FILE"
            echo "✅ Agregado GOOGLE_APPLICATION_CREDENTIALS_JSON a $ENV_FILE"
        fi
    else
        echo "⚠️  Archivo .env.local no existe, créalo manualmente"
    fi
fi

echo ""
echo "🎉 ¡Listo!"
echo ""
echo "Próximos pasos:"
echo "  1. Verifica que el archivo $OUTPUT_FILE tenga el JSON completo"
echo "  2. Si no actualizaste .env.local automáticamente, cópialo manualmente"
echo "  3. Ejecuta: node scripts/test-facial-recognition.js"
echo ""
