#!/bin/bash

# Script SIMPLE para agregar permisos de Rekognition usando política AWS administrada
# 
# Uso en AWS CloudShell:
#   Copia y pega este script completo en CloudShell y ejecútalo

USER_NAME="compramelafoto-rekognition"
POLICY_ARN="arn:aws:iam::aws:policy/AmazonRekognitionFullAccess"

echo "🔧 Agregando permisos de Rekognition al usuario: $USER_NAME"
echo ""

# Verificar que el usuario existe
if ! aws iam get-user --user-name "$USER_NAME" &> /dev/null; then
    echo "❌ Error: El usuario '$USER_NAME' no existe"
    echo ""
    echo "Usuarios disponibles:"
    aws iam list-users --query 'Users[*].UserName' --output table
    exit 1
fi

# Verificar si ya tiene la política
ATTACHED=$(aws iam list-attached-user-policies \
    --user-name "$USER_NAME" \
    --query "AttachedPolicies[?PolicyArn=='$POLICY_ARN'].PolicyArn" \
    --output text)

if [ -n "$ATTACHED" ]; then
    echo "✅ El usuario ya tiene la política 'AmazonRekognitionFullAccess' adjunta"
else
    echo "📝 Adjuntando política..."
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN"
    echo "✅ Política adjuntada exitosamente"
fi

echo ""
echo "🔍 Verificando permisos..."
aws iam list-attached-user-policies \
    --user-name "$USER_NAME" \
    --query 'AttachedPolicies[*].[PolicyName,PolicyArn]' \
    --output table

echo ""
echo "✅ ¡Listo! El usuario ahora tiene permisos completos de Rekognition"
echo ""
echo "Prueba la conexión:"
echo "  aws rekognition list-collections --region us-east-1"
