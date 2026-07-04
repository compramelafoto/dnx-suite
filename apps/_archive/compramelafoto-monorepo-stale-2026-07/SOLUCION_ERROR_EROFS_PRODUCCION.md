# Solución: Error EROFS en Producción

## Error

```
EROFS: read-only file system, open '/var/task/public/uploads/980498c9-a75e-4371-ac81-23afa56fa144.jpg'
Upload failed
```

## Causa

El código en producción (Vercel) está intentando escribir archivos al filesystem local (`/public/uploads/`), pero Vercel tiene un filesystem de solo lectura. Esto significa que:

1. **El código desplegado en Vercel es una versión antigua** que todavía usa `fs.writeFile` o `sharp.toFile()`
2. O hay algún código que no se actualizó correctamente

## Solución Inmediata

### Paso 1: Verificar que el código local está correcto

El código actual en `app/api/uploads/route.ts` ya está migrado a R2. Verifica que:

- ✅ Usa `processPhoto()` que procesa en memoria
- ✅ Usa `uploadToR2()` para subir a R2
- ✅ No usa `fs.writeFile`, `mkdir`, ni `sharp.toFile()`

### Paso 2: Forzar nuevo despliegue en Vercel

1. **Hacer commit de todos los cambios**:
   ```bash
   git add .
   git commit -m "Fix: Migración completa a R2, eliminar escrituras al filesystem"
   git push
   ```

2. **Forzar rebuild en Vercel**:
   - Ve al dashboard de Vercel
   - Selecciona tu proyecto
   - Ve a **Deployments**
   - Haz clic en los tres puntos del último deployment
   - Selecciona **Redeploy**
   - O mejor aún, haz un **push vacío** para forzar rebuild:
     ```bash
     git commit --allow-empty -m "Force redeploy"
     git push
     ```

### Paso 3: Verificar variables de entorno en Vercel

Asegúrate de que estas variables estén configuradas en Vercel:

```bash
R2_ACCOUNT_ID=tu_account_id
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_BUCKET_NAME=compramelafoto-prod  # O R2_BUCKET
R2_ENDPOINT=https://f2657ee448aca18d2af0cf2b0669289b.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://f2657ee448aca18d2af0cf2b0669289b.r2.cloudflarestorage.com/compramelafoto-prod
```

### Paso 4: Limpiar caché de Vercel (si es necesario)

Si el problema persiste después del redeploy:

1. Ve a **Settings** → **Build & Development Settings**
2. En **Build Command**, verifica que sea: `npm run build`
3. En **Output Directory**, verifica que sea: `.next`
4. Haz clic en **Clear Build Cache** (si está disponible)
5. Haz un nuevo deploy

## Verificación Post-Deploy

### 1. Verificar logs de Vercel

Después del deploy, ve a **Deployments** → **View Function Logs** y busca:

- ✅ No deberían aparecer errores de `EROFS`
- ✅ Deberías ver logs de `uploadToR2` exitosos
- ✅ Las URLs generadas deberían ser de R2 (https://...r2.cloudflarestorage.com)

### 2. Probar upload en producción

1. Intenta subir una foto en producción
2. Verifica que no aparezca el error `EROFS`
3. Verifica que la respuesta incluya una URL de R2

### 3. Verificar que las imágenes se suben a R2

1. Ve al [Dashboard de Cloudflare R2](https://dash.cloudflare.com/)
2. Abre tu bucket `compramelafoto-prod`
3. Verifica que los nuevos archivos aparezcan en la carpeta `uploads/`

## Si el Problema Persiste

### Verificar que no hay código antiguo en caché

Ejecuta este comando localmente para verificar que no hay referencias a escritura de archivos:

```bash
grep -r "writeFile\|mkdir.*uploads\|\.toFile\|public/uploads" app/api lib --include="*.ts" --include="*.tsx"
```

Solo deberían aparecer comentarios, no código activo.

### Verificar dependencias

Asegúrate de que `package.json` tenga las dependencias correctas:

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.972.0",
    "@aws-sdk/s3-request-presigner": "^3.972.0",
    "sharp": "^0.33.0"
  }
}
```

### Verificar que sharp no está escribiendo temporales

Sharp puede intentar escribir archivos temporales. Para evitarlo, asegúrate de que:

1. Todos los procesamientos usen `.toBuffer()` en lugar de `.toFile()`
2. No haya configuración de `sharp.cache()` que intente escribir al filesystem

## Código Correcto (Ya Implementado)

El código actual en `app/api/uploads/route.ts` es correcto:

```typescript
// ✅ CORRECTO: Procesa en memoria y sube a R2
const { previewUrl, originalKey, originalUrl } = await processPhoto(
  buffer,
  originalName,
  true
);

// ✅ CORRECTO: Sube directamente a R2
const { url } = await uploadToR2(buffer, key, contentType, {
  originalName,
});
```

## Resumen

El error aparece porque **Vercel está ejecutando código antiguo**. La solución es:

1. ✅ Verificar que el código local está correcto (ya lo está)
2. ✅ Hacer commit y push de todos los cambios
3. ✅ Forzar un nuevo deploy en Vercel
4. ✅ Verificar variables de entorno en Vercel
5. ✅ Probar upload en producción después del deploy

Después del nuevo deploy, el error debería desaparecer porque el código ya está migrado completamente a R2.
