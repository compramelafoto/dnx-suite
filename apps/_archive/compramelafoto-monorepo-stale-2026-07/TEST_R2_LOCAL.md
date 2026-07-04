# Guía Rápida: Probar R2 en Local

## Paso 1: Verificar Variables de Entorno

Asegúrate de tener estas variables en tu archivo `.env.local`:

```bash
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_BUCKET_NAME=nombre_del_bucket  # ⚠️ Nota: debe ser R2_BUCKET_NAME (no R2_BUCKET)
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
```

**Opcional** (para URLs públicas):
```bash
R2_PUBLIC_URL=https://tu-dominio-publico.com
# O alternativamente:
R2_PUBLIC_BASE_URL=https://tu-dominio-publico.com
```

### ⚠️ Nota Importante

Si tienes `R2_BUCKET` en tu `.env.local`, cámbialo a `R2_BUCKET_NAME` porque el código espera ese nombre.

## Paso 2: Ejecutar el Script de Prueba

```bash
npm run test:r2
```

O directamente:

```bash
npx tsx scripts/test-r2.ts
```

Este script verificará:
- ✅ Que todas las variables estén configuradas
- ✅ Que la conexión con R2 funcione
- ✅ Que puedas subir un archivo de prueba
- ✅ Que puedas leer el archivo
- ✅ Que las URLs se generen correctamente

## Paso 3: Probar el Endpoint Real

Una vez que el script de prueba pase, inicia el servidor de desarrollo:

```bash
npm run dev
```

Luego prueba subir una imagen usando curl:

```bash
curl -X POST http://localhost:3000/api/uploads \
  -F "files=@ruta/a/tu/imagen.jpg"
```

O usando un cliente HTTP como Postman/Insomnia:
- **URL**: `http://localhost:3000/api/uploads`
- **Método**: `POST`
- **Body**: `form-data`
- **Campo**: `files` (puedes agregar múltiples archivos)

## Paso 4: Verificar en Cloudflare Dashboard

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Selecciona tu cuenta → **R2**
3. Abre tu bucket
4. Verifica que los archivos se hayan subido en la carpeta `uploads/`

## Solución de Problemas

### Error: "R2 configuration missing"
- Verifica que todas las variables estén en `.env.local`
- Asegúrate de que el nombre sea `R2_BUCKET_NAME` (no `R2_BUCKET`)

### Error: "Access Denied"
- Verifica que las credenciales sean correctas
- Verifica que el token tenga permisos de lectura/escritura en el bucket

### Las URLs no funcionan
- Configura `R2_PUBLIC_URL` o `R2_PUBLIC_BASE_URL`
- O habilita acceso público en la configuración del bucket de Cloudflare R2

### El servidor no inicia
- Asegúrate de haber ejecutado `npm install`
- Verifica que las dependencias `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` estén instaladas
