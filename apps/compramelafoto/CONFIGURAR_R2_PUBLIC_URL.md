# Configurar R2_PUBLIC_URL en Vercel

## URL Pública de Desarrollo de R2

Tu Public Development URL de R2 es:
```
https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev
```

## ¿Por qué necesitas configurarla?

Esta URL es necesaria para que las imágenes se muestren correctamente en la vista previa. Sin ella, el código intentará construir URLs desde `R2_ENDPOINT` + bucket name, pero la Public Development URL es más directa y funciona mejor.

## Cómo configurarla en Vercel

### Paso 1: Ir a Vercel Dashboard

1. Ve a [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto

### Paso 2: Agregar Variable de Entorno

1. Ve a **Settings** → **Environment Variables**
2. Haz clic en **Add New**
3. Configura:
   - **Name**: `R2_PUBLIC_URL`
   - **Value**: `https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev`
   - **Environment**: Selecciona todas (Production, Preview, Development)
4. Haz clic en **Save**

### Paso 3: Verificar que no tenga `/` al final

**IMPORTANTE**: Asegúrate de que la URL NO termine con `/`:
- ✅ Correcto: `https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev`
- ❌ Incorrecto: `https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev/`

### Paso 4: Redeploy

Después de agregar la variable:
1. Ve a **Deployments**
2. Haz clic en los tres puntos (`...`) del último deploy
3. Selecciona **Redeploy**
4. O simplemente haz un nuevo push a `main` y Vercel hará deploy automático

## Cómo funciona

El código tiene esta prioridad para construir URLs públicas:

1. **Prioridad 1**: `R2_PUBLIC_URL` (si está configurado) ← **USA ESTA**
2. **Prioridad 2**: `R2_PUBLIC_BASE_URL` (compatibilidad)
3. **Prioridad 3**: Construir desde `R2_ENDPOINT` + bucket name

Con `R2_PUBLIC_URL` configurado, las URLs se construirán así:
```
https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev/uploads/uuid-preview_foto.jpg
```

## Verificación

Después del deploy, verifica que:
1. Las miniaturas se muestren correctamente
2. Las URLs de las imágenes empiecen con `https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev`
3. No haya errores 403 Forbidden

## Nota sobre Dominio Personalizado

Si en el futuro quieres usar un dominio personalizado (ej: `cdn.tu-dominio.com`):
1. Configúralo en Cloudflare R2 → Settings → Custom Domains
2. Actualiza `R2_PUBLIC_URL` en Vercel con el nuevo dominio
3. Agrega el dominio a `next.config.ts` en `images.remotePatterns`
