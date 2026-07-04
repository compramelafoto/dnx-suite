# Solución: Error EROFS con Sharp en Producción

## Error

```
Error procesando DN107373.jpg: Error: /var/task/public/uploads/preview_980498c9-a75e-4371-ac81-23afa56fa144.jpg: unable to open for write
unix error: Read-only file system
```

## Causa

Aunque el código usa `.toBuffer()` para procesar imágenes en memoria, **Sharp internamente puede intentar escribir archivos temporales** durante operaciones complejas como `composite()` (marca de agua). Sharp intenta usar el filesystem para archivos temporales, pero en Vercel el filesystem es read-only.

## Solución Implementada

### 1. Configuración de Sharp Cache (Ya aplicada)

Se agregó configuración al inicio de `lib/image-processing.ts`:

```typescript
// Deshabilitar caché de archivos completamente
sharp.cache({ files: 0, memory: 50 });

// En producción/Vercel, eliminar SHARP_TMPDIR si está configurado
if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  if (process.env.SHARP_TMPDIR) {
    delete process.env.SHARP_TMPDIR;
  }
  process.env.SHARP_DISABLE_CACHE = "1";
}
```

### 2. Variable de Entorno en Vercel (REQUERIDA)

**IMPORTANTE**: Agrega esta variable de entorno en Vercel para forzar que Sharp use solo memoria:

1. Ve a **Vercel Dashboard** → Tu proyecto → **Settings** → **Environment Variables**
2. Agrega:
   - **Name**: `SHARP_DISABLE_CACHE`
   - **Value**: `1`
   - **Environment**: Production, Preview, Development (todas)
3. Guarda y haz un nuevo deploy

### 3. Verificar que no hay código antiguo

El código ya está correcto:
- ✅ Usa `.toBuffer()` en lugar de `.toFile()`
- ✅ Procesa todo en memoria
- ✅ Sube directamente a R2

## Verificación

### Después del deploy:

1. **Verifica logs de Vercel**:
   - No deberían aparecer errores de `EROFS`
   - No deberían aparecer errores de "unable to open for write"

2. **Prueba subir una foto**:
   - Debería procesarse correctamente
   - Debería subirse a R2
   - No debería aparecer el error de filesystem

3. **Verifica en R2 Dashboard**:
   - Los archivos deberían aparecer en `uploads/`
   - Tanto preview como original deberían estar presentes

## Si el Problema Persiste

### Opción 1: Usar /tmp en Vercel (Alternativa)

Vercel tiene un directorio `/tmp` limitado pero escribible. Si Sharp sigue intentando escribir archivos temporales, puedes configurar:

**En Vercel Environment Variables**:
- **Name**: `SHARP_TMPDIR`
- **Value**: `/tmp`
- **Environment**: Production, Preview, Development

**Nota**: Esto es menos ideal porque `/tmp` es limitado en Vercel, pero puede funcionar como solución temporal.

### Opción 2: Reducir complejidad de operaciones Sharp

Si el problema persiste, puedes reducir la complejidad de las operaciones:

1. **Reducir número de composites**: En lugar de 9 marcas de agua, usar menos
2. **Procesar en pasos más pequeños**: Dividir operaciones complejas en pasos más simples
3. **Reducir tamaño de imágenes**: Procesar imágenes más pequeñas reduce la necesidad de archivos temporales

### Opción 3: Verificar versión de Sharp

Asegúrate de usar una versión reciente de Sharp que maneje mejor la memoria:

```bash
npm install sharp@latest
```

## Código Actual (Correcto)

El código en `lib/image-processing.ts` ya está configurado correctamente:

```typescript
// ✅ CORRECTO: Procesa en memoria
const previewBufferProcessed = await previewProcessed
  .jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true, progressive: true })
  .withMetadata({ density: PREVIEW_DPI })
  .toBuffer(); // ← Solo memoria, NO .toFile()

// ✅ CORRECTO: Sube directamente a R2
const [previewResult, originalResult] = await Promise.all([
  uploadToR2(previewBufferProcessed, previewKey, "image/jpeg", {...}),
  uploadToR2(originalBuffer, originalKey, "image/jpeg", {...}),
]);
```

## Resumen

1. ✅ **Código actualizado**: Sharp configurado para usar solo memoria
2. ⚠️ **Variable de entorno requerida**: Agregar `SHARP_DISABLE_CACHE=1` en Vercel
3. ✅ **Nuevo deploy**: Desplegar los cambios a Vercel
4. ✅ **Verificación**: Probar upload después del deploy

Después de agregar la variable de entorno y hacer un nuevo deploy, el error debería desaparecer.
