# 🔧 Configuración de Permisos AWS Rekognition

## Opción 1: Método Simple (Recomendado)

Usa la política administrada de AWS que ya incluye todos los permisos necesarios.

### Pasos:

1. **Abre AWS CloudShell** desde la consola de AWS:
   - Ve a: https://console.aws.amazon.com/cloudshell/
   - O busca "CloudShell" en la barra de búsqueda

2. **Copia y pega este comando completo:**

```bash
USER_NAME="compramelafoto-rekognition"
POLICY_ARN="arn:aws:iam::aws:policy/AmazonRekognitionFullAccess"

echo "🔧 Agregando permisos de Rekognition..."

# Verificar que el usuario existe
if ! aws iam get-user --user-name "$USER_NAME" &> /dev/null; then
    echo "❌ Error: El usuario '$USER_NAME' no existe"
    aws iam list-users --query 'Users[*].UserName' --output table
    exit 1
fi

# Adjuntar política
aws iam attach-user-policy \
    --user-name "$USER_NAME" \
    --policy-arn "$POLICY_ARN"

echo "✅ Política adjuntada exitosamente"

# Verificar
aws iam list-attached-user-policies \
    --user-name "$USER_NAME" \
    --query 'AttachedPolicies[*].[PolicyName,PolicyArn]' \
    --output table

# Probar conexión
echo ""
echo "🔍 Probando conexión a Rekognition..."
aws rekognition list-collections --region us-east-1
```

3. **Presiona Enter** y espera a que termine

4. **Verifica que funcione** - deberías ver las colecciones de Rekognition (o una lista vacía si no hay ninguna)

---

## Opción 2: Método con Permisos Mínimos (Más Seguro)

Si prefieres dar solo los permisos necesarios (más seguro):

```bash
USER_NAME="compramelafoto-rekognition"
POLICY_NAME="ComprameLaFoto-Rekognition-Policy"

# Crear política personalizada
POLICY_DOCUMENT='{
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
}'

# Crear política
POLICY_ARN=$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "$POLICY_DOCUMENT" \
    --description "Permisos de Rekognition para ComprameLaFoto" \
    --query 'Policy.Arn' \
    --output text)

echo "✅ Política creada: $POLICY_ARN"

# Adjuntar al usuario
aws iam attach-user-policy \
    --user-name "$USER_NAME" \
    --policy-arn "$POLICY_ARN"

echo "✅ Política adjuntada al usuario"

# Verificar
aws iam list-attached-user-policies \
    --user-name "$USER_NAME" \
    --query 'AttachedPolicies[*].[PolicyName,PolicyArn]' \
    --output table

# Probar
aws rekognition list-collections --region us-east-1
```

---

## Verificación Manual

Si prefieres hacerlo paso a paso manualmente:

### 1. Verificar el usuario:
```bash
aws iam get-user --user-name compramelafoto-rekognition
```

### 2. Listar políticas actuales:
```bash
aws iam list-attached-user-policies --user-name compramelafoto-rekognition
```

### 3. Adjuntar política (Opción Simple):
```bash
aws iam attach-user-policy \
    --user-name compramelafoto-rekognition \
    --policy-arn arn:aws:iam::aws:policy/AmazonRekognitionFullAccess
```

### 4. Probar conexión:
```bash
aws rekognition list-collections --region us-east-1
```

---

## Después de Configurar

Una vez que los permisos estén configurados:

1. **Ejecuta el script de diagnóstico:**
   ```bash
   cd /Users/danielcuart/Desktop/compramelafoto
   node scripts/test-facial-recognition.js
   ```

2. **Deberías ver:**
   - ✅ AWS Rekognition conectado
   - ✅ Colección existe o se creará automáticamente

3. **Prueba el reconocimiento facial:**
   - Sube una foto a un álbum
   - El sistema debería procesarla automáticamente

---

## Troubleshooting

### Error: "User does not exist"
- Verifica el nombre del usuario en AWS IAM
- Lista usuarios: `aws iam list-users`

### Error: "Access Denied"
- Verifica que tengas permisos de IAM para modificar políticas
- Asegúrate de estar en la cuenta correcta de AWS

### Error: "Policy already attached"
- No es un error, significa que ya está configurado
- Verifica con: `aws iam list-attached-user-policies --user-name compramelafoto-rekognition`
