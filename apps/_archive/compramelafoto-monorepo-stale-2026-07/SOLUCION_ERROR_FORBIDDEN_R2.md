# Solución: Error "Forbidden" en R2

## Problema

Estás recibiendo un error `403 Forbidden` al intentar acceder a imágenes en Cloudflare R2:
```
Forbidden
gru1::rs84d-1769058040456-0e12ca981ce1
```

## Causa

El bucket de R2 **no tiene acceso público habilitado**. Por defecto, los buckets de R2 son privados y requieren autenticación para acceder.

## Solución: Habilitar Acceso Público en R2

### Paso 1: Ir al Dashboard de Cloudflare

1. Ve a [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
2. Selecciona tu cuenta
3. Ve a **R2** en el menú lateral

### Paso 2: Seleccionar tu Bucket

1. Busca tu bucket (probablemente `compramelafoto-prod`)
2. Haz clic en el nombre del bucket

### Paso 3: Habilitar Acceso Público

1. Ve a la pestaña **Settings** (Configuración)
2. Busca la sección **"Public Access"** o **"Public Bucket Access"**
3. Habilita **"Allow Access"** o activa el toggle de acceso público
4. Guarda los cambios

### Paso 4: Configurar CORS (Opcional pero Recomendado)

En la misma página de Settings, busca **CORS Policy** y agrega:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Para producción**, restringe los orígenes a tus dominios:

```json
[
  {
    "AllowedOrigins": [
      "https://tu-dominio.vercel.app",
      "https://tu-dominio.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Paso 5: Verificar Variables de Entorno en Vercel

Asegúrate de tener configurado `R2_PUBLIC_URL` en Vercel:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que existe `R2_PUBLIC_URL` con el valor:
   ```
   https://<accountid>.r2.cloudflarestorage.com/<bucket-name>
   ```
   
   Ejemplo:
   ```
   https://f2657ee448aca18d2af0cf2b0669289b.r2.cloudflarestorage.com/compramelafoto-prod
   ```

   **IMPORTANTE**: No incluyas `/` al final.

### Paso 6: Verificar que las URLs sean Correctas

Las URLs deberían verse así:
```
https://f2657ee448aca18d2af0cf2b0669289b.r2.cloudflarestorage.com/compramelafoto-prod/uploads/uuid-preview_foto.jpg
```

**NO** deberían verse así:
- ❌ `/uploads/uuid-preview_foto.jpg` (relativa)
- ❌ `uploads/uuid-preview_foto.jpg` (sin dominio)
- ❌ `https://localhost/uploads/...` (localhost)

## Verificación

### 1. Probar Acceso Directo

Copia una URL de una imagen y pégala directamente en el navegador. Si funciona, el acceso público está habilitado correctamente.

### 2. Verificar en Network Tab

1. Abre DevTools (F12)
2. Ve a la pestaña **Network**
3. Recarga la página
4. Busca peticiones a `r2.cloudflarestorage.com`
5. Verifica el código de respuesta:
   - **200 OK**: ✅ Funciona correctamente
   - **403 Forbidden**: ❌ Acceso público no habilitado
   - **404 Not Found**: ❌ La key del archivo es incorrecta
   - **CORS Error**: ❌ CORS no configurado

## Si el Problema Persiste

### Opción 1: Verificar que el Archivo Existe

1. Ve al Dashboard de R2
2. Busca el archivo por su key (ej: `uploads/uuid-preview_foto.jpg`)
3. Verifica que el archivo existe y tiene el nombre correcto

### Opción 2: Verificar Variables de Entorno

Ejecuta este script para verificar la configuración:

```bash
npm run test:r2
```

O verifica manualmente en Vercel que todas estas variables estén configuradas:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET_NAME` o `R2_BUCKET`
- `R2_PUBLIC_URL` (opcional pero recomendado)

### Opción 3: Usar Dominio Personalizado (Recomendado para Producción)

Si tienes un dominio personalizado para R2:

1. En Cloudflare R2 → Settings → Custom Domains
2. Agrega tu dominio (ej: `cdn.tu-dominio.com`)
3. Configura el DNS según las instrucciones
4. Actualiza `R2_PUBLIC_URL` en Vercel:
   ```
   R2_PUBLIC_URL=https://cdn.tu-dominio.com
   ```

## Checklist

- [ ] Bucket R2 tiene acceso público habilitado
- [ ] CORS está configurado en R2
- [ ] `R2_PUBLIC_URL` está configurado en Vercel (sin `/` al final)
- [ ] Las URLs generadas son absolutas (`https://...`)
- [ ] Las URLs funcionan al acceder directamente en el navegador
- [ ] No hay errores de CORS en la consola del navegador

## Nota Importante

Después de habilitar acceso público en R2, **puede tomar unos minutos** para que los cambios se propaguen. Si sigues viendo el error después de habilitar acceso público, espera 2-3 minutos y vuelve a intentar.
