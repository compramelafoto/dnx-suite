# Configuración de Cloudflare R2 para Uploads

## Contexto

En Vercel (y otros entornos serverless), el filesystem es **de solo lectura**. No se puede escribir en `/public/uploads/` ni en ningún directorio del filesystem. Por eso migramos el sistema de uploads a **Cloudflare R2** (S3 compatible).

## Variables de Entorno Requeridas

Configura las siguientes variables en Vercel (o tu entorno):

```bash
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_BUCKET_NAME=nombre_del_bucket
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://tu-dominio-publico.com  # Opcional: URL pública del bucket
```

### Cómo obtener las credenciales de R2

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Selecciona tu cuenta
3. Ve a **R2** en el menú lateral
4. Crea un bucket o selecciona uno existente
5. Ve a **Manage R2 API Tokens**
6. Crea un nuevo token con permisos de lectura/escritura
7. Copia el **Account ID**, **Access Key ID** y **Secret Access Key**

### Configurar URL Pública (Opcional)

Si quieres servir los archivos públicamente desde R2:

1. En la configuración del bucket, habilita **Public Access**
2. Configura un dominio personalizado o usa el dominio por defecto de R2
3. Establece `R2_PUBLIC_BASE_URL` con la URL base pública

## Instalación de Dependencias

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Prueba en Local

### 1. Configurar Variables de Entorno

Crea o edita el archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```bash
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_BUCKET_NAME=nombre_del_bucket
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://tu-dominio-publico.com  # Opcional
# O alternativamente:
R2_PUBLIC_BASE_URL=https://tu-dominio-publico.com  # Opcional
```

### 2. Ejecutar Script de Prueba

El proyecto incluye un script de prueba que verifica la conexión con R2:

```bash
npx tsx scripts/test-r2.ts
```

O usando npm:

```bash
npm run test:r2
```

Este script:
- ✅ Verifica que todas las variables de entorno estén configuradas
- ✅ Crea un cliente S3 y prueba la conexión
- ✅ Sube un archivo de prueba a R2
- ✅ Verifica que el archivo existe
- ✅ Lee el archivo desde R2
- ✅ Genera una URL firmada (signed URL)
- ✅ Construye la URL pública

### 3. Probar el Endpoint de Uploads

Una vez que el script de prueba pase, puedes probar el endpoint real:

```bash
# Con curl (reemplaza con tu URL local)
curl -X POST http://localhost:3000/api/uploads \
  -F "files=@ruta/a/tu/imagen.jpg" \
  -F "files=@ruta/a/otra/imagen.png"
```

O usando un cliente HTTP como Postman o Insomnia:
- **URL**: `http://localhost:3000/api/uploads`
- **Método**: `POST`
- **Body**: `form-data`
- **Campo**: `files` (puedes agregar múltiples archivos)

### 4. Verificar en el Dashboard de Cloudflare

1. Ve al [Dashboard de Cloudflare R2](https://dash.cloudflare.com/)
2. Selecciona tu bucket
3. Verifica que los archivos se hayan subido correctamente
4. Verifica que las URLs públicas funcionen (si configuraste acceso público)

## Estructura de Archivos

Los archivos se suben a R2 con la siguiente estructura:
```
uploads/YYYY/MM/uuid-originalNameSanitized
```

Ejemplo:
```
uploads/2024/01/550e8400-e29b-41d4-a716-446655440000-foto.jpg
```

## Endpoints

### POST /api/uploads

Sube archivos (múltiples) y procesa imágenes con marca de agua.

**Request:**
- `multipart/form-data` con campo `files` (múltiples archivos)

**Response:**
```json
{
  "ok": true,
  "files": [
    {
      "key": "uploads/2024/01/uuid-foto.jpg",
      "url": "https://...",
      "name": "foto.jpg",
      "size": 123456,
      "type": "image/jpeg"
    }
  ]
}
```

### POST /api/print-orders/uploads

Sube archivos para pedidos de impresión (sin marca de agua).

**Request:**
- `multipart/form-data` con campo `files` (múltiples archivos)

**Response:**
```json
{
  "ok": true,
  "files": [
    {
      "key": "uploads/2024/01/uuid-foto.jpg",
      "url": "https://...",
      "name": "foto.jpg",
      "size": 123456,
      "type": "image/jpeg"
    }
  ]
}
```

## Validaciones

- Tamaño máximo por archivo: 10MB (configurable con `MAX_FILE_SIZE`)
- Si no hay archivos: retorna 400
- Si falla el procesamiento: intenta subir el archivo original sin procesar

## Migración desde Filesystem Local

Si tenías archivos en `/public/uploads/`, necesitarás:

1. Subirlos manualmente a R2 usando el mismo formato de keys
2. Actualizar cualquier referencia en la base de datos que apunte a `/uploads/...` para usar las URLs de R2

## Troubleshooting

### Error: "R2 configuration missing"
- Verifica que todas las variables de entorno estén configuradas en Vercel

### Error: "Access Denied"
- Verifica que las credenciales de R2 sean correctas
- Verifica que el token tenga permisos de escritura en el bucket

### Las URLs no funcionan
- Verifica que `R2_PUBLIC_BASE_URL` esté configurado correctamente
- O verifica que el bucket tenga acceso público habilitado
