# Revisión de Variables de Entorno en Vercel

## ✅ Variables Configuradas en Vercel

### Base de Datos
- ✅ `DATABASE_URL` - URL principal de conexión PostgreSQL
- ✅ `DIRECT_URL` - URL directa para migraciones Prisma

### Autenticación
- ✅ `AUTH_SECRET` - Secreto para cookies/sesiones
- ✅ `AUTH_URL` - URL de autenticación
- ✅ `NEXTAUTH_URL` - URL base para NextAuth
- ✅ `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- ✅ `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret

### Mercado Pago
- ✅ `MP_ACCESS_TOKEN` - Token de acceso Mercado Pago
- ✅ `MP_CLIENT_ID` - Client ID de Mercado Pago
- ✅ `MP_CLIENT_SECRET` - Client Secret de Mercado Pago
- ✅ `MP_REDIRECT_URI` - URI de redirección Mercado Pago
- ✅ `MP_ENV` - Entorno de Mercado Pago (test/prod)

### Cloudflare R2
- ✅ `R2_ACCOUNT_ID` - Account ID de Cloudflare R2
- ✅ `R2_ACCESS_KEY_ID` - Access Key ID de R2
- ✅ `R2_SECRET_ACCESS_KEY` - Secret Access Key de R2
- ✅ `R2_ENDPOINT` - Endpoint de R2
- ✅ `R2_BUCKET` - Nombre del bucket R2
- ✅ `R2_BUCKET_NAME` - Nombre del bucket R2 (alternativo)
- ✅ `R2_REGION` - Región de R2
- ✅ `R2_PUBLIC_URL` - URL pública del bucket R2
- ✅ `NEXT_PUBLIC_R2_PUBLIC_URL` - URL pública R2 (cliente)

### AWS Rekognition
- ✅ `AWS_ACCESS_KEY_ID` - Access Key ID de AWS
- ✅ `AWS_SECRET_ACCESS_KEY` - Secret Access Key de AWS
- ✅ `AWS_REGION` - Región de AWS
- ✅ `REKOGNITION_COLLECTION_ID` - ID de colección Rekognition

### Google Vision API
- ✅ `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Credenciales JSON de Google Vision

### Email (Resend)
- ✅ `RESEND_API_KEY` - API Key de Resend
- ✅ `EMAIL_FROM` - Email remitente

### URLs de la Aplicación
- ✅ `APP_URL` - URL base de la aplicación (server-side)
- ✅ `NEXT_PUBLIC_APP_URL` - URL pública de la aplicación (cliente)

### Admin
- ✅ `ADMIN_EMAIL` - Email del administrador
- ✅ `ADMIN_PASSWORD` - Contraseña del administrador

### Otros
- ✅ `CRON_SECRET` - Secreto para proteger endpoints CRON
- ✅ `ZIP_JOB_PROCESS_SECRET` - Secreto para procesamiento de ZIPs
- ✅ `YOUTUBE_API_KEY` - API Key de YouTube

---

## ⚠️ Variables FALTANTES en Vercel

### 🔴 CRÍTICAS (Pueden causar errores)

1. **`SHADOW_DATABASE_URL`** ⚠️
   - **Uso**: Prisma usa esta URL para migraciones cuando hay cambios en el schema
   - **Impacto**: Las migraciones pueden fallar en producción
   - **Recomendación**: Agregar la misma URL que `DIRECT_URL` o una base de datos separada para shadow

### 🟡 IMPORTANTES (Funcionalidad limitada sin ellas)

2. **`EMAIL_REPLY_TO`** 📧
   - **Uso**: Email de respuesta para emails del sistema
   - **Impacto**: Los emails no tendrán un reply-to configurado
   - **Recomendación**: Agregar un email de soporte (ej: `soporte@compramelafoto.com`)

3. **`EMAIL_FROM_NAME`** 📧
   - **Uso**: Nombre del remitente en emails
   - **Impacto**: Los emails mostrarán solo el email sin nombre amigable
   - **Recomendación**: Agregar un nombre (ej: `"Compramelafoto"`)

4. **`NEXT_PUBLIC_BASE_URL`** 🌐
   - **Uso**: URL base pública usada en algunos componentes y cron jobs
   - **Impacto**: Algunos links pueden no funcionar correctamente
   - **Recomendación**: Agregar la misma URL que `NEXT_PUBLIC_APP_URL`

5. **`R2_PUBLIC_BASE_URL`** 📦
   - **Uso**: URL base pública alternativa para R2 (compatibilidad)
   - **Impacto**: Si `R2_PUBLIC_URL` falla, no hay fallback
   - **Recomendación**: Agregar si usas un dominio personalizado para R2

6. **`NEXT_PUBLIC_R2_PUBLIC_BASE_URL`** 📦
   - **Uso**: URL base pública R2 para cliente (compatibilidad)
   - **Impacto**: Similar al anterior pero para cliente
   - **Recomendación**: Agregar si usas un dominio personalizado para R2

### 🟢 OPCIONALES (Tienen valores por defecto)

7. **`MAX_FILE_SIZE`** 📁
   - **Uso**: Tamaño máximo por archivo en bytes (API)
   - **Valor por defecto**: 50MB (50 * 1024 * 1024)
   - **Recomendación**: Solo agregar si necesitas cambiar el límite

8. **`NEXT_PUBLIC_MAX_UPLOAD_MB`** 📁
   - **Uso**: Límite de tamaño en MB mostrado en el frontend
   - **Valor por defecto**: 10MB (en algunos lugares), 4MB (en otros)
   - **Recomendación**: Solo agregar si necesitas cambiar el límite mostrado

9. **`WATERMARK_BOUGHT_ENABLED`** 🖼️
   - **Uso**: Habilita watermark sutil en fotos compradas
   - **Valor por defecto**: `false` (deshabilitado)
   - **Recomendación**: Solo agregar si querés habilitar esta funcionalidad (`true`)

10. **`PRINT_ICC_PROFILE_PATH`** 🖨️
    - **Uso**: Ruta al perfil ICC para impresión
    - **Valor por defecto**: No aplicado
    - **Recomendación**: Solo agregar si necesitas perfiles ICC personalizados

11. **`PRINT_ICC_PROFILE_BASE64`** 🖨️
    - **Uso**: Perfil ICC en base64 para impresión
    - **Valor por defecto**: No aplicado
    - **Recomendación**: Solo agregar si necesitas perfiles ICC personalizados

12. **`ZIP_JOB_PROCESS_TIMEOUT_MS`** ⏱️
    - **Uso**: Timeout para procesamiento de ZIPs en milisegundos
    - **Valor por defecto**: 15 minutos (15 * 60 * 1000)
    - **Recomendación**: Solo agregar si necesitas cambiar el timeout

13. **`ENABLE_ZIP_READY_EMAIL`** 📧
    - **Uso**: Habilita/deshabilita emails cuando un ZIP está listo
    - **Valor por defecto**: `true` (habilitado)
    - **Recomendación**: Solo agregar si querés deshabilitar (`false`)

---

## 📋 Resumen de Acciones Recomendadas

### Prioridad ALTA (Agregar ahora)
1. ✅ **`SHADOW_DATABASE_URL`** - Usar la misma URL que `DIRECT_URL` o una base de datos separada

### Prioridad MEDIA (Recomendado agregar)
2. ✅ **`EMAIL_REPLY_TO`** - Email de soporte (ej: `soporte@compramelafoto.com`)
3. ✅ **`EMAIL_FROM_NAME`** - Nombre del remitente (ej: `"Compramelafoto"`)
4. ✅ **`NEXT_PUBLIC_BASE_URL`** - Misma URL que `NEXT_PUBLIC_APP_URL`

### Prioridad BAJA (Opcional)
- Las demás variables solo si necesitas cambiar los valores por defecto o habilitar funcionalidades específicas

---

## 🔍 Notas Adicionales

- **`SHADOW_DATABASE_URL`**: Prisma puede usar la misma base de datos que `DIRECT_URL` para shadow, pero es mejor tener una separada en producción para evitar conflictos durante migraciones.

- **Variables de R2**: Si ya tenés `R2_PUBLIC_URL` funcionando, las variables `R2_PUBLIC_BASE_URL` y `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` son opcionales y solo necesarias si usas un dominio personalizado diferente.

- **Variables de Email**: `EMAIL_REPLY_TO` y `EMAIL_FROM_NAME` mejoran la experiencia del usuario al recibir emails del sistema.
