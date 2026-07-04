#!/bin/bash

# Script para configurar permisos de AWS Rekognition usando AWS CLI
# 
# Uso en AWS CloudShell:
#   1. Copia y pega este script completo en CloudShell
#   2. O ejecuta los comandos uno por uno
#
# IMPORTANTE: Asegúrate de estar en la región correcta (us-east-1)

set -e

USER_NAME="compramelafoto-rekognition"
POLICY_NAME="ComprameLaFoto-Rekognition-Policy"

echo "🔧 Configurando permisos de AWS Rekognition para el usuario: $USER_NAME"
echo ""

# Verificar que AWS CLI esté configurado
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI no está instalado"
    exit 1
fi

# Verificar que el usuario existe
echo "📋 Verificando que el usuario existe..."
if ! aws iam get-user --user-name "$USER_NAME" &> /dev/null; then
    echo "❌ Error: El usuario '$USER_NAME' no existe"
    echo ""
    echo "Lista de usuarios disponibles:"
    aws iam list-users --query 'Users[*].UserName' --output table
    exit 1
fi

echo "✅ Usuario encontrado: $USER_NAME"
echo ""

# Crear política personalizada con permisos mínimos necesarios
echo "📝 Creando política personalizada..."

POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:ListCollections",
        "rekognition:CreateCollection",
        "rekognition:DescribeCollection",
        "rekognition:DeleteCollection",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DetectFaces",
        "rekognition:ListFaces",
        "rekognition:GetFaceSearch",
        "rekognition:GetFaceDetection"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# Verificar si la política ya existe
POLICY_ARN=$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='$POLICY_NAME'].Arn" \
    --output text 2>/dev/null || echo "")

if [ -z "$POLICY_ARN" ]; then
    echo "   Creando nueva política: $POLICY_NAME"
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --description "Permisos de Rekognition para ComprameLaFoto" \
        --query 'Policy.Arn' \
        --output text)
    echo "   ✅ Política creada: $POLICY_ARN"
else
    echo "   ⚠️  La política ya existe: $POLICY_ARN"
    echo "   Actualizando política existente..."
    aws iam create-policy-version \
        --policy-arn "$POLICY_ARN" \
        --policy-document "$POLICY_DOCUMENT" \
        --set-as-default \
        --output text > /dev/null
    echo "   ✅ Política actualizada"
fi

echo ""

# Verificar si el usuario ya tiene la política adjunta
echo "📋 Verificando políticas adjuntas al usuario..."
ATTACHED_POLICIES=$(aws iam list-attached-user-policies \
    --user-name "$USER_NAME" \
    --query 'AttachedPolicies[*].PolicyArn' \
    --output text)

if echo "$ATTACHED_POLICIES" | grep -q "$POLICY_ARN"; then
    echo "   ✅ La política ya está adjunta al usuario"
else
    echo "   Adjuntando política al usuario..."
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN"
    echo "   ✅ Política adjuntada exitosamente"
fi

echo ""

# Verificar permisos
echo "🔍 Verificando permisos..."
echo ""

# Listar todas las políticas adjuntas
echo "Políticas adjuntas al usuario '$USER_NAME':"
aws iam list-attached-user-policies \
    --user-name "$USER_NAME" \
    --query 'AttachedPolicies[*].[PolicyName,PolicyArn]' \
    --output table

echo ""
echo "✅ Configuración completada!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Prueba la conexión ejecutando:"
echo "      aws rekognition list-collections --region us-east-1"
echo ""
echo "   2. Si funciona, ejecuta el script de diagnóstico:"
echo "      node scripts/test-facial-recognition.js"
echo ""
