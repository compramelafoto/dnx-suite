# Cómo Verificar la Última Versión Desplegada en Vercel

## Método 1: Dashboard de Vercel (Más Fácil)

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a la pestaña **"Deployments"**
4. El deployment más reciente aparece en la parte superior
5. Haz clic en el deployment para ver detalles:
   - **Commit**: Muestra el hash del commit desplegado
   - **Branch**: Muestra la rama (ej: `main`)
   - **Status**: Muestra si está activo o no
   - **Created**: Muestra cuándo se desplegó

## Método 2: Verificar Commit Hash Localmente

### Ver el último commit en tu repositorio local:

```bash
git log --oneline -1
```

Esto muestra el último commit local. Compara este hash con el que aparece en Vercel.

### Ver todos los commits recientes:

```bash
git log --oneline -10
```

### Ver si hay cambios sin commitear:

```bash
git status
```

Si hay cambios sin commitear (como ahora con `lib/image-processing.ts`), esos cambios **NO están en producción** hasta que hagas commit y push.

## Método 3: Comparar Código Local vs Producción

### Ver qué archivos cambiaron desde el último commit:

```bash
git diff HEAD
```

### Ver cambios específicos en un archivo:

```bash
git diff lib/image-processing.ts
```

### Ver el código que está en producción (último commit):

```bash
git show HEAD:lib/image-processing.ts | head -30
```

Compara esto con tu archivo local actual.

## Método 4: Verificar en los Logs de Vercel

1. Ve a Vercel Dashboard → Tu proyecto → **Deployments**
2. Haz clic en el deployment más reciente
3. Ve a **"Function Logs"** o **"Runtime Logs"**
4. Busca logs que mencionen:
   - `SHARP_TMPDIR`
   - `sharp cache`
   - Errores de `EROFS`

Si ves logs de configuración de Sharp, significa que el código nuevo está desplegado.

## Estado Actual de Tu Repositorio

Según `git status`, tienes:

- ✅ **Cambios sin commitear**: `lib/image-processing.ts` (configuración de `/tmp`)
- ✅ **Archivos nuevos sin trackear**: Documentación de soluciones

**Esto significa que estos cambios NO están en producción todavía.**

## Pasos para Desplegar los Cambios

### 1. Hacer commit de los cambios:

```bash
git add lib/image-processing.ts
git add SOLUCION_DEFINITIVA_SHARP_VERCEL.md SOLUCION_SHARP_EROFS.md SOLUCION_IMAGENES_ROTAS_R2.md SOLUCION_ERROR_EROFS_PRODUCCION.md MIGRACION_PREVIEW_URL_R2.md TEST_R2_LOCAL.md scripts/test-r2.ts scripts/debug-preview-urls.ts next.config.ts

git commit -m "Fix: Configurar Sharp para usar /tmp en Vercel y migrar preview URLs a R2"
```

### 2. Hacer push:

```bash
git push origin main
```

### 3. Verificar en Vercel:

1. Ve a Vercel Dashboard → Deployments
2. Deberías ver un nuevo deployment iniciándose automáticamente
3. Espera a que termine (puede tardar 2-5 minutos)
4. Verifica que el commit hash coincida con tu último commit local

### 4. Verificar que la configuración está activa:

Después del deploy, en los logs de Vercel deberías ver:
- No más errores de `EROFS`
- Las imágenes se procesan correctamente
- Los archivos se suben a R2

## Verificar Variables de Entorno en Vercel

**IMPORTANTE**: También necesitas agregar esta variable de entorno:

1. Ve a **Settings** → **Environment Variables**
2. Agrega:
   - **Name**: `SHARP_TMPDIR`
   - **Value**: `/tmp`
   - **Environment**: Production, Preview, Development
3. Guarda
4. **Haz un nuevo deploy** después de agregar la variable (o Vercel lo hará automáticamente)

## Resumen

- **Código local**: Tiene cambios sin commitear (configuración de `/tmp`)
- **Producción**: Probablemente tiene código antiguo (sin configuración de `/tmp`)
- **Solución**: Hacer commit, push, y agregar variable de entorno `SHARP_TMPDIR=/tmp` en Vercel
