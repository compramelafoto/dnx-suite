# DIAGNÓSTICO COMPLETO - Sistema de Reconocimiento Facial y Consentimiento Biométrico

**Fecha:** 2024  
**Proyecto:** ComprameLaFoto  
**Objetivo:** Implementar sistema de consentimiento y protección legal para reconocimiento facial en álbumes

---

## 1. ESTADO ACTUAL DEL PROYECTO

### 1.1 Arquitectura General
- **Framework:** Next.js 16 (App Router)
- **Base de datos:** PostgreSQL con Prisma ORM
- **Almacenamiento:** Cloudflare R2 (S3 compatible)
- **Reconocimiento facial:** AWS Rekognition
- **OCR:** Google Cloud Vision API
- **Emails:** Resend (configurado pero no completamente implementado)
- **Autenticación:** Sistema custom con cookies/sesiones

### 1.2 Modelos de Datos Existentes

#### AlbumInterest (Modelo Actual)
```prisma
model AlbumInterest {
  id             Int       @id @default(autoincrement())
  albumId        Int
  email          String
  name           String?
  createdAt      DateTime  @default(now())
  lastName       String?
  whatsapp       String?
  firstName      String?
  hasPurchased   Boolean   @default(false)
  lastNotifiedAt DateTime?
  nextEmailAt    DateTime?
  sentE01        Boolean   @default(false)
  // ... más campos de tracking de emails
}
```

**Observaciones:**
- ✅ Existe modelo para registrar interesados
- ❌ NO tiene campos para biometría (selfie, faceId, consentimiento)
- ❌ NO tiene campos de expiración/retención
- ❌ NO tiene campos de eliminación de datos biométricos

#### AlbumNotification (Modelo Actual)
```prisma
model AlbumNotification {
  id                Int      @id @default(autoincrement())
  albumId           Int
  email             String
  notifiedWhenReady Boolean  @default(false)
  notifiedAt3Weeks  Boolean  @default(false)
  notifiedAt2Weeks  Boolean  @default(false)
  notifiedAt1Week   Boolean  @default(false)
  createdAt         DateTime @default(now())
  name              String?
  lastName          String?
  whatsapp          String?
}
```

**Observaciones:**
- ✅ Existe modelo para notificaciones
- ❌ NO tiene campos para biometría
- ❌ NO tiene campos de consentimiento

#### FaceDetection (Modelo Actual)
```prisma
model FaceDetection {
  id                  Int      @id @default(autoincrement())
  photoId             Int
  rekognitionFaceId   String   @unique
  confidence          Float?
  bbox                Json
  createdAt           DateTime @default(now())
  photo               Photo    @relation(fields: [photoId], references: [id], onDelete: Cascade)
}
```

**Observaciones:**
- ✅ Existe modelo para caras detectadas en fotos
- ✅ Vinculado a Photo (no a AlbumInterest)
- ❌ NO tiene relación con interesados que subieron selfies

### 1.3 Flujos Existentes

#### A) Registro de Interesados (Actual)
**Endpoint:** `POST /api/a/[id]/notifications`

**Ubicación:** `app/api/a/[id]/notifications/route.ts`

**Flujo actual:**
1. Usuario ingresa nombre, apellido, WhatsApp, email
2. Se crea `AlbumNotification` (upsert por albumId + email)
3. Se crea `AlbumInterest` (upsert por albumId + email)
4. Se crea `PrintOrder` "fantasma" (CANCELED) para tracking de clientes

**Limitaciones:**
- ❌ NO acepta selfie
- ❌ NO valida consentimiento biométrico
- ❌ NO indexa caras en Rekognition para interesados

**UI:** `components/photo/ClientAlbumView.tsx` (líneas 226-262)
- Formulario simple con nombre, WhatsApp, email
- Se muestra cuando `album.showComingSoonMessage === true` y `album.photos.length === 0`

#### B) Búsqueda por Reconocimiento Facial (Actual)
**Endpoint:** `POST /api/albums/[albumId]/search/face`

**Ubicación:** `app/api/albums/[albumId]/search/face/route.ts`

**Flujo actual:**
1. Usuario sube imagen (File o URL)
2. Se busca en Rekognition usando `searchFacesByImage()`
3. Se obtienen `FaceDetection` que coinciden con los `rekognitionFaceId`
4. Se filtran por `albumId`
5. Se devuelven fotos con URLs con marca de agua

**Limitaciones:**
- ✅ Funciona correctamente para búsqueda
- ❌ NO está diseñado para matching automático con interesados
- ❌ NO tiene sistema de notificaciones automáticas

**UI:** `components/photo/ClientAlbumView.tsx` (líneas 367-387)
- Modal con opción de cámara o archivo
- Usa `handleSearchFace()` que llama al endpoint

#### C) Indexación de Caras en Fotos (Actual)
**Endpoint:** `POST /api/internal/analysis/run` (cron interno)

**Ubicación:** `app/api/internal/analysis/run/route.ts`

**Flujo actual:**
1. Cron procesa fotos con `analysisStatus = PENDING`
2. Lee imagen desde R2
3. Normaliza imagen (convierte a JPEG sin metadatos)
4. Llama `indexFaces()` de Rekognition
5. Guarda `FaceDetection` en DB
6. También procesa OCR con Google Vision

**Funciones clave:**
- `lib/faces/rekognition.ts`:
  - `indexFaces()`: Indexa caras en colección Rekognition
  - `searchFacesByImage()`: Busca caras similares
  - `ensureCollectionExists()`: Crea colección si no existe

**Limitaciones:**
- ✅ Funciona correctamente para indexar caras de fotos subidas
- ❌ NO indexa selfies de interesados
- ❌ NO tiene matching automático con interesados

### 1.4 Componentes UI Existentes

#### ClientAlbumView (`components/photo/ClientAlbumView.tsx`)
**Funcionalidades actuales:**
- ✅ Formulario de registro de interesados (nombre, WhatsApp, email)
- ✅ Modal de búsqueda por reconocimiento facial
- ✅ Modal de búsqueda por texto (OCR)
- ✅ Visualización de fotos con marca de agua
- ✅ Selección de fotos para compra

**Estado del modal de reconocimiento facial:**
- Líneas 143-149: Estados para modal (`showFaceModal`, `faceFile`, `facePreviewUrl`, `faceInputMode`)
- Líneas 367-387: Función `handleSearchFace()` que busca caras
- Líneas 191-206: Cierre de modales con ESC

**Limitaciones:**
- ❌ NO tiene opción de capturar selfie durante registro de interesados
- ❌ NO tiene validación de consentimiento biométrico
- ❌ NO tiene preview/confirmación de selfie antes de enviar

### 1.5 Almacenamiento R2

**Cliente R2:** `lib/r2-client.ts`

**Funciones disponibles:**
- ✅ `uploadToR2()`: Sube archivo a R2
- ✅ `readFromR2()`: Lee archivo desde R2
- ✅ `deleteFromR2()`: Elimina archivo de R2
- ✅ `getSignedUrlForFile()`: Genera URL firmada temporal
- ✅ `generateR2Key()`: Genera key única para archivo

**Estructura actual de keys:**
- Fotos: `uploads/{uuid}-{sanitizedName}.{ext}`
- Previews: `uploads/{uuid}-preview_{sanitizedName}.{ext}`

**Limitaciones:**
- ❌ NO hay estructura específica para selfies de interesados
- ❌ NO hay diferenciación entre archivos públicos y privados (todos usan mismo bucket)

### 1.6 Sistema de Emails

**Servicio:** `lib/email.ts`

**Estado actual:**
- ⚠️ **NO IMPLEMENTADO COMPLETAMENTE**
- Solo tiene función `sendEmail()` que loguea (líneas 17-56)
- Tiene función `generatePasswordResetEmailHtml()` como ejemplo
- Variables de entorno configuradas: `RESEND_API_KEY`, `EMAIL_FROM`

**Limitaciones:**
- ❌ NO envía emails reales (solo loguea)
- ❌ NO tiene templates para notificaciones de reconocimiento facial
- ❌ NO tiene sistema de tokens firmados para eliminación de biometría

### 1.7 Autenticación y Autorización

**Middleware:** `middleware.ts` (no revisado en detalle, pero existe)

**Helper de auth:** `lib/auth.ts` (no revisado, pero se usa `getAuthUser()`)

**Roles existentes:**
- `ADMIN`
- `PHOTOGRAPHER`
- `LAB`
- `CUSTOMER`
- `LAB_PHOTOGRAPHER`

**Limitaciones:**
- ❌ NO hay verificación específica de "ADMIN del álbum" (solo verifica `album.userId === user.id`)
- ❌ NO hay sistema de tokens firmados para acciones públicas (eliminación de biometría)

---

## 2. REQUERIMIENTOS vs ESTADO ACTUAL

### 2.1 PARTE 1 - Frontend Registro

**Requerido:**
- ✅ Dos checkboxes (Términos y Condiciones + Consentimiento biométrico)
- ✅ Si usuario sube selfie → segundo checkbox obligatorio
- ✅ Validación frontend y backend

**Estado actual:**
- ❌ NO hay checkboxes de consentimiento
- ❌ NO hay opción de subir selfie en registro
- ❌ NO hay validación de consentimiento

**Archivos a modificar:**
- `components/photo/ClientAlbumView.tsx` (formulario de registro)
- `app/api/a/[id]/notifications/route.ts` (validación backend)

### 2.2 PARTE 2 - Base de Datos

**Requerido:**
- Agregar a `AlbumInterest`:
  - `biometricConsent Boolean @default(false)`
  - `biometricConsentAt DateTime?`
  - `biometricDeletedAt DateTime?`
  - `expiresAt DateTime` (createdAt + 90 días)
  - `selfieKey String?` (key en R2)
  - `faceId String?` (FaceId de Rekognition)

**Estado actual:**
- ❌ NO existen estos campos
- ❌ NO hay modelo `FaceMatchEvent` para tracking de matches

**Archivos a modificar:**
- `prisma/schema.prisma` (agregar campos a `AlbumInterest` y crear `FaceMatchEvent`)

### 2.3 PARTE 3 - Protección de Selfie

**Requerido:**
- Guardar selfie en R2 privado
- Endpoint `GET /api/admin/albums/[albumId]/interested/[id]/selfie`
- Solo accesible si usuario es ADMIN del álbum
- Devolver como stream con `Cache-Control: no-store`

**Estado actual:**
- ❌ NO existe endpoint para servir selfies
- ❌ NO hay diferenciación entre archivos públicos y privados en R2
- ❌ NO hay verificación específica de "ADMIN del álbum"

**Archivos a crear:**
- `app/api/admin/albums/[albumId]/interested/[id]/selfie/route.ts`

### 2.4 PARTE 4 - Listado de Interesados

**Requerido:**
- Agregar columna "Reconocimiento" con ícono 👤
- Modal al hacer click mostrando:
  - Fecha registro
  - Fecha expiración
  - Botón "Eliminar datos biométricos"
  - Imagen de selfie (vía endpoint protegido)

**Estado actual:**
- ❌ NO existe panel de listado de interesados para admin
- ❌ NO existe modal de visualización de selfie

**Archivos a crear/modificar:**
- Panel admin de álbum (probablemente en `app/dashboard/albums/[id]/page.tsx`)
- Componente modal para visualizar selfie

### 2.5 PARTE 5 - Eliminar Datos Biométricos

**Requerido:**
- Endpoint `POST /api/interested/[id]/delete-biometric`
- Verificar identidad del solicitante
- Borrar FaceId en Rekognition
- Borrar selfie en R2
- Actualizar DB (faceId=null, selfieKey=null, biometricDeletedAt=now)
- NO eliminar email ni whatsapp

**Estado actual:**
- ❌ NO existe endpoint para eliminar biometría
- ❌ NO hay función para eliminar faces de Rekognition (solo `indexFaces` y `searchFacesByImage`)

**Archivos a crear:**
- `app/api/interested/[id]/delete-biometric/route.ts`
- Agregar función `deleteFace()` en `lib/faces/rekognition.ts`

### 2.6 PARTE 6 - Email

**Requerido:**
- En email de notificación agregar botón "Eliminar reconocimiento facial"
- Link a `/delete-biometric?token=...`
- Token firmado válido por 24 horas

**Estado actual:**
- ❌ NO se envían emails de notificación automática
- ❌ NO existe sistema de tokens firmados
- ❌ NO existe página `/delete-biometric`

**Archivos a crear:**
- `app/delete-biometric/page.tsx` (landing page)
- `app/api/public/delete-biometric/route.ts` (endpoint público con token)
- Sistema de tokens firmados (nuevo helper)
- Template de email con botón de eliminación

### 2.7 PARTE 7 - Cron Limpieza

**Requerido:**
- Cron diario que busque `AlbumInterest` donde `expiresAt < now()`
- Borrar FaceId en Rekognition
- Borrar selfie en R2
- Actualizar DB

**Estado actual:**
- ✅ Existe sistema de cron (`/api/internal/analysis/run`)
- ❌ NO existe cron específico para limpieza de biometría expirada

**Archivos a crear:**
- `app/api/internal/biometric-cleanup/route.ts` (nuevo cron)

### 2.8 PARTE 8 - Matching Automático

**Requerido:**
- Cuando se sube foto nueva → buscar matches con interesados activos
- Si hay match → enviar email automático
- Evitar duplicados (notificar una vez por foto o lote)

**Estado actual:**
- ✅ Existe procesamiento de fotos (`/api/internal/analysis/run`)
- ✅ Existe función `searchFacesByImage()` en Rekognition
- ❌ NO existe matching automático con interesados
- ❌ NO existe sistema de notificaciones automáticas

**Archivos a crear/modificar:**
- Agregar lógica de matching en `app/api/internal/analysis/run/route.ts` o crear nuevo job
- Crear `FaceMatchEvent` model para tracking
- Implementar envío de emails de notificación

---

## 3. FUNCIONES FALTANTES

### 3.1 AWS Rekognition
- ❌ `deleteFace()`: Eliminar face de colección Rekognition
- ✅ `indexFaces()`: Existe
- ✅ `searchFacesByImage()`: Existe

**Archivo:** `lib/faces/rekognition.ts`

### 3.2 R2 Storage
- ✅ `uploadToR2()`: Existe
- ✅ `readFromR2()`: Existe
- ✅ `deleteFromR2()`: Existe
- ⚠️ Necesita estructura para selfies privados: `interested-selfies/{albumId}/{interestedId}.jpg`

### 3.3 Emails
- ❌ `sendEmail()`: Existe pero NO IMPLEMENTADO (solo loguea)
- ❌ Template para notificación de match facial
- ❌ Template para confirmación de eliminación de biometría

### 3.4 Tokens Firmados
- ❌ Sistema completo de tokens firmados (HMAC SHA256)
- ❌ Generación de tokens para eliminación de biometría
- ❌ Validación de tokens con expiración

---

## 4. ARCHIVOS A CREAR/MODIFICAR

### 4.1 Base de Datos
- ✅ `prisma/schema.prisma` (modificar `AlbumInterest`, crear `FaceMatchEvent`)

### 4.2 Backend - APIs
- ✅ `app/api/albums/[albumId]/register-interest/route.ts` (NUEVO - reemplaza o extiende `/api/a/[id]/notifications`)
- ✅ `app/api/admin/albums/[albumId]/interested/[id]/selfie/route.ts` (NUEVO)
- ✅ `app/api/admin/albums/[albumId]/interested/[id]/delete-biometric/route.ts` (NUEVO)
- ✅ `app/api/public/delete-biometric/route.ts` (NUEVO)
- ✅ `app/api/internal/biometric-cleanup/route.ts` (NUEVO - cron)
- ✅ `app/api/internal/face-matching/route.ts` (NUEVO - job de matching automático)

### 4.3 Frontend - Componentes
- ✅ `components/photo/ClientAlbumView.tsx` (modificar formulario de registro)
- ✅ `components/admin/InterestedList.tsx` (NUEVO - listado de interesados)
- ✅ `components/admin/SelfieViewModal.tsx` (NUEVO - modal para ver selfie)

### 4.4 Frontend - Páginas
- ✅ `app/delete-biometric/page.tsx` (NUEVO - landing page con token)
- ✅ `app/dashboard/albums/[id]/page.tsx` (modificar - agregar tab de interesados)

### 4.5 Helpers/Libs
- ✅ `lib/faces/rekognition.ts` (agregar `deleteFace()`)
- ✅ `lib/email.ts` (implementar `sendEmail()` con Resend)
- ✅ `lib/tokens.ts` (NUEVO - sistema de tokens firmados)
- ✅ `lib/biometric-helpers.ts` (NUEVO - helpers para biometría)

---

## 5. CONSIDERACIONES DE SEGURIDAD

### 5.1 Vulnerabilidades Identificadas
1. **Selfies sin protección:** Actualmente no hay diferenciación entre archivos públicos y privados en R2
2. **Sin rate limiting:** Endpoints públicos de registro podrían ser abusados
3. **Tokens no implementados:** No existe sistema de tokens firmados para acciones públicas
4. **Emails no implementados:** Sistema de emails solo loguea, no envía

### 5.2 Mejoras Necesarias
1. ✅ Implementar rate limiting en endpoints públicos (ya existe `lib/rate-limit.ts`)
2. ✅ Usar keys privadas en R2 para selfies (no URLs públicas)
3. ✅ Implementar tokens firmados con HMAC SHA256
4. ✅ Verificar permisos de ADMIN del álbum correctamente
5. ✅ Implementar envío real de emails con Resend

---

## 6. PLAN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1: Base de Datos y Modelos
1. Modificar `prisma/schema.prisma`
2. Crear migración: `npx prisma migrate dev --name add_biometric_fields`
3. Generar Prisma Client: `npx prisma generate`

### Fase 2: Backend Core
1. Agregar `deleteFace()` en `lib/faces/rekognition.ts`
2. Implementar `sendEmail()` con Resend en `lib/email.ts`
3. Crear `lib/tokens.ts` para tokens firmados
4. Crear `lib/biometric-helpers.ts` para helpers comunes

### Fase 3: Endpoints de Registro
1. Crear/modificar `app/api/albums/[albumId]/register-interest/route.ts`
2. Validar consentimiento biométrico
3. Subir selfie a R2 privado
4. Indexar cara en Rekognition
5. Guardar en `AlbumInterest`

### Fase 4: Endpoints de Administración
1. Crear `app/api/admin/albums/[albumId]/interested/[id]/selfie/route.ts`
2. Crear `app/api/admin/albums/[albumId]/interested/[id]/delete-biometric/route.ts`
3. Verificar permisos de ADMIN del álbum

### Fase 5: Frontend de Registro
1. Modificar `components/photo/ClientAlbumView.tsx`
2. Agregar opción de capturar selfie (reutilizar modal de reconocimiento facial)
3. Agregar checkboxes de consentimiento
4. Validar frontend antes de enviar

### Fase 6: Panel de Administración
1. Crear `components/admin/InterestedList.tsx`
2. Crear `components/admin/SelfieViewModal.tsx`
3. Modificar `app/dashboard/albums/[id]/page.tsx` para agregar tab

### Fase 7: Eliminación Pública
1. Crear `app/delete-biometric/page.tsx`
2. Crear `app/api/public/delete-biometric/route.ts`
3. Implementar validación de tokens

### Fase 8: Matching Automático
1. Crear `app/api/internal/face-matching/route.ts`
2. Integrar con procesamiento de fotos o crear job separado
3. Crear `FaceMatchEvent` para tracking
4. Implementar envío de emails de notificación

### Fase 9: Cron de Limpieza
1. Crear `app/api/internal/biometric-cleanup/route.ts`
2. Configurar cron en Vercel o sistema de scheduling

### Fase 10: Testing y Ajustes
1. Probar flujo completo de registro con selfie
2. Probar matching automático
3. Probar eliminación de biometría
4. Probar cron de limpieza
5. Ajustar UI/UX según feedback

---

## 7. NOTAS IMPORTANTES

### 7.1 Compatibilidad
- ✅ No romper flujo actual de registro de interesados (debe seguir funcionando sin selfie)
- ✅ No romper flujo actual de búsqueda por reconocimiento facial
- ✅ Mantener compatibilidad con datos existentes (campos opcionales)

### 7.2 Performance
- ⚠️ Matching automático debe ser ASÍNCRONO (no bloquear subida de fotos)
- ⚠️ Procesar en lotes para evitar sobrecarga de Rekognition
- ⚠️ Rate limiting en endpoints públicos

### 7.3 Legal/Privacidad
- ✅ Consentimiento explícito obligatorio si hay selfie
- ✅ Retención máxima de 90 días
- ✅ Eliminación anticipada disponible
- ✅ Solo ADMIN del álbum puede ver selfies
- ✅ No exponer URLs públicas de selfies

---

## 8. CONCLUSIÓN

El proyecto tiene una base sólida con:
- ✅ Sistema de reconocimiento facial funcionando
- ✅ Almacenamiento R2 configurado
- ✅ Modelos de datos para interesados existentes
- ✅ UI de registro básica

**Faltan implementar:**
- ❌ Campos de biometría en base de datos
- ❌ Captura de selfie en registro
- ❌ Consentimiento biométrico
- ❌ Matching automático con interesados
- ❌ Sistema de emails real
- ❌ Tokens firmados
- ❌ Eliminación de biometría
- ❌ Cron de limpieza
- ❌ Panel admin para gestionar interesados

**Prioridad de implementación:**
1. **ALTA:** Base de datos, endpoints de registro, frontend de registro
2. **MEDIA:** Matching automático, emails, panel admin
3. **BAJA:** Cron de limpieza, optimizaciones

---

**Fin del Diagnóstico**
