# Solución: Imágenes Rotas en Frontend (R2)

## Problema

Las imágenes se suben correctamente a Cloudflare R2, pero aparecen rotas en el frontend. Esto generalmente se debe a que R2 no tiene **acceso público** habilitado o **CORS** no está configurado.

## Solución 1: Habilitar Acceso Público en R2 (Recomendado)

### Paso 1: Configurar Bucket Público

1. Ve al [Dashboard de Cloudflare R2](https://dash.cloudflare.com/)
2. Selecciona tu bucket (`compramelafoto-prod`)
3. Ve a **Settings** → **Public Access**
4. Habilita **"Allow Access"** o **"Public Access"**
5. Guarda los cambios

### Paso 2: Configurar CORS (Opcional pero Recomendado)

1. En la misma página de Settings, busca **CORS Policy**
2. Agrega esta configuración:

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

O para producción, restringe los orígenes:

```json
[
  {
    "AllowedOrigins": [
      "https://tu-dominio.com",
      "https://www.tu-dominio.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Paso 3: Verificar Variables de Entorno

Asegúrate de tener configurado `R2_PUBLIC_URL` o `R2_PUBLIC_BASE_URL` en Vercel:

```bash
R2_PUBLIC_URL=https://<accountid>.r2.cloudflarestorage.com/<bucket-name>
# O si tienes dominio personalizado:
R2_PUBLIC_URL=https://tu-dominio-publico.com
```

## Solución 2: Usar Signed URLs (Alternativa)

Si no quieres hacer el bucket público, puedes usar **signed URLs** (URLs temporales firmadas). Esto requiere modificar el código para generar URLs firmadas cuando se solicitan las imágenes.

### Implementación con Signed URLs

Modifica `app/api/a/[id]/order-photos/route.ts`:

```typescript
import { getSignedUrlForFile } from "@/lib/r2-client";

// En lugar de:
url: normalizePreviewUrl(p.previewUrl, p.originalKey) || p.previewUrl,

// Usar:
url: await getSignedUrlForFile(p.originalKey.replace(/^original_/, "preview_"), 3600),
```

**Nota**: Esto requiere que el endpoint sea `async` y puede ser más lento si hay muchas fotos.

## Solución 3: Verificar URLs Generadas

### Debug: Ver qué URL se está generando

Agrega un `console.log` temporal en `app/api/a/[id]/order-photos/route.ts`:

```typescript
const files = album.photos.map((p: { id: number; previewUrl: string; originalKey: string }) => {
  const normalizedUrl = normalizePreviewUrl(p.previewUrl, p.originalKey) || p.previewUrl;
  console.log(`Foto ${p.id}:`, {
    originalPreviewUrl: p.previewUrl,
    originalKey: p.originalKey,
    normalizedUrl: normalizedUrl,
  });
  return {
    fileKey: p.originalKey,
    url: normalizedUrl,
    originalName: `foto-${p.id}.jpg`,
  };
});
```

Luego verifica en los logs de Vercel qué URLs se están generando.

### Verificar en el Navegador

1. Abre las DevTools (F12)
2. Ve a la pestaña **Network**
3. Intenta cargar la página con las imágenes rotas
4. Busca las peticiones a R2 (filtra por "r2.cloudflarestorage.com")
5. Verifica el código de respuesta:
   - **200**: La URL es correcta pero puede haber problema de CORS
   - **403 Forbidden**: El bucket no tiene acceso público habilitado
   - **404 Not Found**: La key del archivo es incorrecta
   - **CORS Error**: Necesitas configurar CORS en R2

## Solución 4: Usar Dominio Personalizado (Recomendado para Producción)

Si tienes un dominio personalizado para R2:

1. En Cloudflare R2, ve a **Settings** → **Custom Domains**
2. Agrega tu dominio personalizado (ej: `cdn.tu-dominio.com`)
3. Configura el DNS según las instrucciones
4. Actualiza `R2_PUBLIC_URL` en Vercel:

```bash
R2_PUBLIC_URL=https://cdn.tu-dominio.com
```

5. Agrega el dominio a `next.config.ts`:

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.r2.cloudflarestorage.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "cdn.tu-dominio.com",
      pathname: "/**",
    },
  ],
}
```

## Verificación Final

### 1. Verificar que las URLs sean absolutas

Las URLs deberían verse así:
- ✅ `https://f2657ee448aca18d2af0cf2b0669289b.r2.cloudflarestorage.com/compramelafoto-prod/uploads/uuid-preview_foto.jpg`
- ❌ `/uploads/uuid-preview_foto.jpg`
- ❌ `uploads/uuid-preview_foto.jpg`

### 2. Probar acceso directo

Copia una URL generada y pégala directamente en el navegador. Si funciona, el problema es de CORS o configuración de Next.js Image. Si no funciona, el problema es de acceso público en R2.

### 3. Verificar Next.js Image Config

Ya está configurado en `next.config.ts`:
```typescript
{
  protocol: "https",
  hostname: "*.r2.cloudflarestorage.com",
  pathname: "/**",
}
```

**IMPORTANTE**: Después de cambiar `next.config.ts`, **reinicia el servidor**:
```bash
npm run dev
# O en producción, vuelve a desplegar en Vercel
```

## Checklist de Solución

- [ ] Bucket R2 tiene acceso público habilitado
- [ ] CORS está configurado en R2 (opcional pero recomendado)
- [ ] `R2_PUBLIC_URL` o `R2_PUBLIC_BASE_URL` está configurado en Vercel
- [ ] `next.config.ts` tiene el dominio de R2 en `remotePatterns`
- [ ] Servidor de desarrollo reiniciado después de cambios en `next.config.ts`
- [ ] URLs generadas son absolutas (https://...)
- [ ] Las URLs funcionan al acceder directamente en el navegador

## Si Nada Funciona

1. **Verifica los logs de Vercel** para ver errores específicos
2. **Verifica la consola del navegador** (F12 → Console) para ver errores de CORS
3. **Verifica Network tab** para ver el código de respuesta HTTP
4. **Prueba con una URL directa** de una imagen en R2 para verificar acceso público

## Nota sobre Signed URLs

Si prefieres mantener el bucket privado, puedes usar signed URLs, pero esto requiere:
- Modificar los endpoints para generar URLs firmadas
- Las URLs expiran después de un tiempo (ej: 1 hora)
- Puede ser más lento si hay muchas imágenes

La solución más simple es **habilitar acceso público** en R2 y configurar CORS correctamente.
