# Migración de Preview URLs a Cloudflare R2

## Resumen de Cambios

Se ha migrado completamente el sistema de preview URLs para que todas las imágenes se sirvan desde Cloudflare R2 con URLs absolutas (https://...), eliminando todas las referencias a rutas locales (`/uploads/`, `localhost`) que no funcionan en producción (Vercel).

## Cambios Implementados

### 1. Función Helper Única (`lib/r2-client.ts`)

- **`getR2PublicUrl(keyOrUrl: string)`**: Función principal para construir URLs públicas de R2
  - Acepta keys de R2 o URLs relativas/absolutas
  - Siempre devuelve URLs absolutas (https://...)
  - Valida y rechaza localhost en producción
  - Logs defensivos para detectar URLs problemáticas

- **`normalizePreviewUrl(previewUrl, originalKey?)`**: Función para normalizar previewUrl
  - Convierte URLs relativas a absolutas
  - Construye URLs desde originalKey si previewUrl es inválida
  - Maneja casos edge (null, undefined, localhost)

### 2. Endpoints Actualizados

Los siguientes endpoints ahora normalizan `previewUrl` antes de devolverlas:

- ✅ `app/api/public/albums/route.ts` - Normaliza coverPhotoUrl
- ✅ `app/api/dashboard/albums/route.ts` - Normaliza coverPhotoUrl
- ✅ `app/api/dashboard/albums/[id]/route.ts` - Normaliza previewUrl de todas las fotos
- ✅ `app/api/a/[id]/order-photos/route.ts` - Normaliza previewUrl en respuesta
- ✅ `app/api/a/[id]/photo/[photoId]/route.ts` - Normaliza previewUrl de foto individual
- ✅ `app/a/[id]/page.tsx` - Normaliza previewUrl antes de pasar al componente

### 3. Páginas Actualizadas

Las siguientes páginas ahora construyen URLs usando `getR2PublicUrl`:

- ✅ `app/l/[handler]/page.tsx` - CoverPhotoUrl normalizado
- ✅ `app/f/[handler]/page.tsx` - CoverPhotoUrl normalizado
- ✅ `app/f/[handler]/albums/page.tsx` - CoverPhotoUrl normalizado

### 4. Validación Defensiva

- ✅ Logs de advertencia cuando se detectan URLs con localhost
- ✅ Logs de advertencia cuando se detectan rutas relativas
- ✅ Validación en `getPublicUrl` que rechaza localhost en producción
- ✅ Normalización automática de rutas relativas a absolutas

## Flujo de Subida (Ya Correcto)

El flujo de subida ya estaba correcto:

1. `processPhoto()` en `lib/image-processing.ts`:
   - Procesa imágenes en memoria (buffers)
   - Sube preview y original a R2 usando `uploadToR2()`
   - `uploadToR2()` usa `getPublicUrl()` que devuelve URLs absolutas
   - Retorna `{ previewUrl, originalKey, originalUrl }` con URLs absolutas

2. Endpoints de subida:
   - `app/api/uploads/route.ts` - Ya usa `processPhoto()` correctamente
   - `app/api/dashboard/albums/[id]/photos/route.ts` - Ya usa `processPhoto()` correctamente

## Migración Opcional de Datos Antiguos

Si tienes registros en la base de datos con `previewUrl` que sean rutas relativas (ej: `/uploads/...` o `uploads/...`), puedes ejecutar esta migración opcional:

### Script de Migración (Opcional)

```typescript
// scripts/migrate-preview-urls.ts
import { PrismaClient } from "@prisma/client";
import { normalizePreviewUrl } from "../lib/r2-client";

const prisma = new PrismaClient();

async function migratePreviewUrls() {
  console.log("Iniciando migración de previewUrl...");

  // Obtener todas las fotos con previewUrl que puedan ser relativas
  const photos = await prisma.photo.findMany({
    where: {
      OR: [
        { previewUrl: { startsWith: "/uploads/" } },
        { previewUrl: { startsWith: "uploads/" } },
        { previewUrl: { contains: "localhost" } },
      ],
    },
    select: {
      id: true,
      previewUrl: true,
      originalKey: true,
    },
  });

  console.log(`Encontradas ${photos.length} fotos para migrar`);

  let migrated = 0;
  let errors = 0;

  for (const photo of photos) {
    try {
      const normalizedUrl = normalizePreviewUrl(photo.previewUrl, photo.originalKey);
      
      if (normalizedUrl && normalizedUrl !== photo.previewUrl) {
        await prisma.photo.update({
          where: { id: photo.id },
          data: { previewUrl: normalizedUrl },
        });
        migrated++;
        console.log(`✅ Foto ${photo.id}: ${photo.previewUrl} -> ${normalizedUrl}`);
      }
    } catch (error: any) {
      errors++;
      console.error(`❌ Error migrando foto ${photo.id}:`, error.message);
    }
  }

  console.log(`\nMigración completada:`);
  console.log(`  - Migradas: ${migrated}`);
  console.log(`  - Errores: ${errors}`);
  console.log(`  - Total: ${photos.length}`);
}

migratePreviewUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Ejecutar Migración

```bash
npx tsx scripts/migrate-preview-urls.ts
```

**Nota**: Esta migración es opcional porque:
- Los endpoints ya normalizan las URLs antes de devolverlas
- Los nuevos uploads siempre crean URLs absolutas
- La función `normalizePreviewUrl` maneja URLs antiguas automáticamente

## Validación

### 1. Build

```bash
npm run build
```

Debe compilar sin errores.

### 2. Prueba de Subida

1. Sube una foto nueva usando el endpoint `/api/uploads` o `/api/dashboard/albums/[id]/photos`
2. Verifica que la respuesta incluya `previewUrl` con formato `https://...` (URL absoluta de R2)
3. Verifica en Cloudflare R2 Dashboard que el archivo se haya subido correctamente

### 3. Prueba de Visualización

1. Abre un álbum en el frontend
2. Verifica que las imágenes se carguen correctamente
3. Inspecciona el código fuente y verifica que los `src` de las imágenes sean URLs absolutas de R2
4. Verifica en Network tab del navegador que las imágenes se carguen desde R2

### 4. Verificación de Logs

En producción (Vercel), revisa los logs para:
- ✅ No deberían aparecer warnings sobre localhost
- ✅ No deberían aparecer warnings sobre rutas relativas (excepto durante migración inicial)
- ✅ Las URLs deberían ser todas absolutas (https://...)

## Variables de Entorno Requeridas

Asegúrate de tener configuradas estas variables en Vercel:

```bash
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_BUCKET_NAME=nombre_del_bucket  # O R2_BUCKET (compatible)
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://tu-dominio-publico.com  # Opcional pero recomendado
# O alternativamente:
R2_PUBLIC_BASE_URL=https://tu-dominio-publico.com  # Opcional pero recomendado
```

## Configuración de Next.js Image

**IMPORTANTE**: Next.js Image requiere que los dominios de imágenes remotas estén configurados en `next.config.ts`.

El archivo `next.config.ts` ya incluye la configuración para Cloudflare R2:

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.r2.cloudflarestorage.com",
      pathname: "/**",
    },
  ],
}
```

**Si usas un dominio público personalizado** (R2_PUBLIC_URL o R2_PUBLIC_BASE_URL), agrégalo también:

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
      hostname: "tu-dominio-publico.com",
      pathname: "/**",
    },
  ],
}
```

Después de modificar `next.config.ts`, **reinicia el servidor de desarrollo** (`npm run dev`).

## Archivos Modificados

1. `lib/r2-client.ts` - Funciones helper mejoradas
2. `app/api/public/albums/route.ts` - Normalización de coverPhotoUrl
3. `app/api/dashboard/albums/route.ts` - Normalización de coverPhotoUrl
4. `app/api/dashboard/albums/[id]/route.ts` - Normalización de previewUrl
5. `app/api/a/[id]/order-photos/route.ts` - Normalización de previewUrl
6. `app/api/a/[id]/photo/[photoId]/route.ts` - Normalización de previewUrl
7. `app/a/[id]/page.tsx` - Normalización de previewUrl
8. `app/l/[handler]/page.tsx` - Normalización de coverPhotoUrl
9. `app/f/[handler]/page.tsx` - Normalización de coverPhotoUrl
10. `app/f/[handler]/albums/page.tsx` - Normalización de coverPhotoUrl

## Notas Importantes

- ✅ **No se rompe compatibilidad**: Los endpoints normalizan automáticamente URLs antiguas
- ✅ **No se requiere migración inmediata**: Los datos antiguos funcionan gracias a la normalización
- ✅ **Nuevos uploads siempre correctos**: `processPhoto()` siempre devuelve URLs absolutas
- ✅ **Logs defensivos**: Se detectan y corrigen URLs problemáticas automáticamente
- ✅ **Validación en producción**: Se rechaza localhost y rutas relativas en producción

## Próximos Pasos

1. ✅ Verificar que `npm run build` compile sin errores
2. ✅ Probar subida de foto nueva y verificar URL absoluta
3. ✅ Probar visualización de álbum existente
4. ⚠️ (Opcional) Ejecutar script de migración si hay muchos registros antiguos
5. ✅ Desplegar a Vercel y verificar logs
