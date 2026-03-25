# Guía Paso a Paso: Agregar Variable de Entorno en Vercel

## Paso 1: Acceder al Dashboard de Vercel

1. Ve a: **https://vercel.com/dashboard**
2. Inicia sesión si es necesario
3. Busca y selecciona tu proyecto **compramelafoto**

## Paso 2: Ir a Settings

1. En la parte superior de la página del proyecto, haz clic en la pestaña **"Settings"**
2. En el menú lateral izquierdo, busca y haz clic en **"Environment Variables"**

## Paso 3: Agregar la Variable SHARP_TMPDIR

1. Verás una lista de variables de entorno existentes (si hay alguna)
2. Haz clic en el botón **"Add New"** o **"Add"** (dependiendo de la versión de Vercel)
3. Completa el formulario:
   - **Name**: `SHARP_TMPDIR`
   - **Value**: `/tmp`
   - **Environment**: Selecciona las tres opciones:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
4. Haz clic en **"Save"** o **"Add"**

## Paso 4: Verificar que se Agregó Correctamente

Deberías ver la nueva variable en la lista:
- **SHARP_TMPDIR** = `/tmp` (Production, Preview, Development)

## Paso 5: Forzar un Nuevo Deploy (Importante)

Después de agregar la variable, Vercel debería hacer un deploy automático, pero para asegurarte:

### Opción A: Redeploy Manual
1. Ve a la pestaña **"Deployments"**
2. Encuentra el deployment más reciente
3. Haz clic en los **tres puntos** (⋯) al lado del deployment
4. Selecciona **"Redeploy"**
5. Confirma el redeploy

### Opción B: Push Vacío (Alternativa)
Si prefieres hacerlo desde la terminal:

```bash
git commit --allow-empty -m "Trigger deploy after adding SHARP_TMPDIR env var"
git push origin main
```

## Paso 6: Verificar el Deploy

1. Ve a **"Deployments"**
2. Deberías ver un nuevo deployment iniciándose
3. Espera a que termine (puede tardar 2-5 minutos)
4. Verifica que el status sea **"Ready"** (verde)

## Paso 7: Probar el Upload

1. Ve a tu aplicación en producción
2. Intenta subir una foto
3. Verifica que:
   - ✅ No aparezca el error `EROFS`
   - ✅ La foto se procese correctamente
   - ✅ La foto se suba a R2

## Paso 8: Verificar Logs (Opcional pero Recomendado)

1. Ve a **"Deployments"** → último deployment
2. Haz clic en **"View Function Logs"** o **"Runtime Logs"**
3. Busca:
   - ❌ NO deberían aparecer errores de `EROFS`
   - ❌ NO deberían aparecer errores de "read-only file system"
   - ✅ Deberías ver logs de procesamiento exitoso
   - ✅ Deberías ver URLs de R2 en las respuestas

## Variables de Entorno que Deberías Tener

Asegúrate de tener estas variables configuradas:

### R2 (Cloudflare)
- ✅ `R2_ACCOUNT_ID`
- ✅ `R2_ACCESS_KEY_ID`
- ✅ `R2_SECRET_ACCESS_KEY`
- ✅ `R2_BUCKET_NAME` (o `R2_BUCKET`)
- ✅ `R2_ENDPOINT`
- ✅ `R2_PUBLIC_URL` (opcional pero recomendado)

### Sharp (NUEVA - Requerida)
- ✅ `SHARP_TMPDIR` = `/tmp`

## Troubleshooting

### Si el error persiste después de agregar la variable:

1. **Verifica que la variable esté en todas las environments**:
   - Production ✅
   - Preview ✅
   - Development ✅

2. **Verifica que hiciste redeploy** después de agregar la variable

3. **Verifica los logs de Vercel**:
   - Busca errores específicos
   - Verifica que Sharp esté usando `/tmp`

4. **Verifica que el código esté actualizado**:
   - El commit en Vercel debe ser `036d092` o posterior
   - El código debe tener `process.env.SHARP_TMPDIR = "/tmp"`

### Si no puedes agregar la variable:

- Verifica que tengas permisos de administrador en el proyecto
- Intenta desde otro navegador o en modo incógnito
- Contacta al administrador del proyecto en Vercel

## Resumen Visual

```
Vercel Dashboard
  └── Tu Proyecto (compramelafoto)
      └── Settings
          └── Environment Variables
              └── Add New
                  ├── Name: SHARP_TMPDIR
                  ├── Value: /tmp
                  └── Environment: ✅ Production ✅ Preview ✅ Development
                      └── Save
                          └── Deployments → Redeploy
```

## Checklist Final

- [ ] Variable `SHARP_TMPDIR=/tmp` agregada en Vercel
- [ ] Variable aplicada a Production, Preview y Development
- [ ] Nuevo deploy completado después de agregar la variable
- [ ] Probar upload de foto en producción
- [ ] Verificar que no aparezca error `EROFS`
- [ ] Verificar que las fotos se suban correctamente a R2

¡Después de completar estos pasos, el error debería desaparecer!
