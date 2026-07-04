# Solución Definitiva: Sharp en Vercel con EROFS

## Problema

Sharp está intentando escribir archivos temporales a `/var/task/public/uploads/` pero Vercel tiene un filesystem read-only. El error es:

```
EROFS: read-only file system, open '/var/task/public/uploads/preview_xxx.jpg'
```

## Solución Aplicada

### 1. Configurar Sharp para usar `/tmp` en Vercel

Se actualizó `lib/image-processing.ts` para que Sharp use `/tmp`, que es el **único directorio escribible** en Vercel:

```typescript
if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  // /tmp es el único directorio escribible en Vercel
  process.env.SHARP_TMPDIR = "/tmp";
  sharp.cache({ files: 0, memory: 50 });
}
```

### 2. Variable de Entorno en Vercel (REQUERIDA)

**IMPORTANTE**: Agrega esta variable de entorno en Vercel:

1. Ve a **Vercel Dashboard** → Tu proyecto → **Settings** → **Environment Variables**
2. Agrega:
   - **Name**: `SHARP_TMPDIR`
   - **Value**: `/tmp`
   - **Environment**: Production, Preview, Development (todas)
3. Guarda y haz un nuevo deploy

### 3. Verificar que el código está actualizado

El código ya está correcto:
- ✅ Usa `.toBuffer()` en lugar de `.toFile()`
- ✅ Procesa en memoria cuando es posible
- ✅ Configura Sharp para usar `/tmp` en producción

## Por qué `/tmp` funciona

- ✅ `/tmp` es el **único directorio escribible** en Vercel
- ✅ Tiene un límite de 512MB por invocación (suficiente para procesar imágenes)
- ✅ Los archivos se eliminan automáticamente al finalizar la función
- ✅ Sharp puede usarlo para archivos temporales durante operaciones complejas

## Limitaciones de `/tmp`

- ⚠️ **512MB máximo** por invocación
- ⚠️ **Archivos se eliminan** al finalizar la función
- ⚠️ **No persiste** entre invocaciones

Para nuestro caso (procesar y subir imágenes a R2), estas limitaciones son aceptables porque:
- Las imágenes se procesan rápidamente
- Los archivos temporales se eliminan automáticamente
- Los archivos finales se suben a R2, no se quedan en `/tmp`

## Verificación Post-Deploy

### 1. Verificar logs de Vercel

Después del deploy, verifica que:
- ✅ No aparezcan errores de `EROFS`
- ✅ No aparezcan errores de "unable to open for write"
- ✅ Las imágenes se procesen correctamente

### 2. Probar upload

1. Sube una foto en producción
2. Verifica que se procese correctamente
3. Verifica que se suba a R2
4. Verifica que no aparezca el error de filesystem

### 3. Verificar en R2

1. Ve al Dashboard de Cloudflare R2
2. Verifica que los archivos aparezcan en `uploads/`
3. Verifica que tanto preview como original estén presentes

## Si el Problema Persiste

### Opción 1: Verificar que el código está desplegado

Asegúrate de que el código actualizado esté en producción:

```bash
# Verificar que los cambios están commiteados
git status

# Hacer push si es necesario
git add lib/image-processing.ts
git commit -m "Fix: Configurar Sharp para usar /tmp en Vercel"
git push
```

### Opción 2: Verificar variables de entorno

Asegúrate de que `SHARP_TMPDIR=/tmp` esté configurado en Vercel:
- Ve a Settings → Environment Variables
- Verifica que `SHARP_TMPDIR` esté configurado
- Si no está, agrégalo y haz un nuevo deploy

### Opción 3: Verificar versión de Sharp

Asegúrate de usar una versión reciente:

```bash
npm install sharp@latest
```

### Opción 4: Reducir complejidad de operaciones

Si `/tmp` no es suficiente, puedes reducir la complejidad:

1. **Reducir número de composites**: Usar menos marcas de agua
2. **Procesar imágenes más pequeñas**: Reducir tamaño antes de procesar
3. **Dividir operaciones**: Procesar en pasos más pequeños

## Resumen

1. ✅ **Código actualizado**: Sharp configurado para usar `/tmp` en Vercel
2. ⚠️ **Variable de entorno requerida**: `SHARP_TMPDIR=/tmp` en Vercel
3. ✅ **Nuevo deploy**: Desplegar los cambios a Vercel
4. ✅ **Verificación**: Probar upload después del deploy

Después de agregar la variable de entorno y hacer un nuevo deploy, el error debería desaparecer porque Sharp ahora usará `/tmp` (escribible) en lugar de intentar escribir en directorios read-only.
