# Auditoría: Interesados + Selfie + Aviso Automático

## 1. AUDITORÍA DEL CÓDIGO EXISTENTE

### 1.1 Flujo actual de "Registro como interesado"

| Ubicación | Descripción |
|-----------|-------------|
| `app/api/a/[id]/register-interest/route.ts` | **POST** - Recibe FormData: name, lastName, whatsapp, email, selfie (File opcional), termsAccepted, biometricConsent |
| `components/photo/ClientAlbumView.tsx` | UI del formulario en modo "Próximamente se subirán las fotos" (showComingSoonMessage): inputs nombre, whatsapp, email, selfie opcional, 2 checkboxes (T&C + consentimiento biométrico) |
| `app/api/a/[id]/notifications/route.ts` | **POST** - Endpoint alternativo sin selfie (crea solo AlbumNotification) |

**Comportamiento actual:**
- Si hay selfie → POST register-interest con FormData
- Si no hay selfie → POST /api/a/[id]/notifications (JSON)
- Validación: selfie + no biometricConsent → error
- Sube selfie a R2, indexa en Rekognition, crea AlbumInterest + AlbumNotification
- **Nota:** La ruta del prompt dice `/api/albums/[albumId]/register-interest` pero la implementación real es `/api/a/[id]/register-interest` (ruta cliente de álbum público). **Mantener ruta actual.**

---

### 1.2 Componente de reconocimiento facial (cámara/captura)

| Ubicación | Descripción |
|-----------|-------------|
| `components/photo/ClientAlbumView.tsx` | Usa **native HTML**: `<input type="file" accept="image/*" capture="user">` - NO hay componente custom de video/cámara |
| Búsqueda facial (cuando hay fotos): `faceInputMode: "camera" \| "file"`, `cameraInputRef`, `fileInputRef` | Mismo patrón: input file con capture para cámara, input file sin capture para archivo |
| Selfie para registro: `notificationSelfieInputRef`, `notificationSelfie` (File) | Input con `capture="user"` y `accept="image/*"` |

**Conclusión:** El "componente" es un `<input type="file" accept="image/*" capture="user">`. No existe un componente React de cámara en vivo (video stream + canvas). La captura es nativa del navegador. **Reutilizar exactamente este patrón** ya está hecho.

---

### 1.3 Funciones y helpers existentes

| Función | Ubicación | Descripción |
|---------|-----------|-------------|
| `indexFaces({ imageBytes, externalImageId? })` | `lib/faces/rekognition.ts` | Indexa caras en colección Rekognition, retorna `FaceIndexResult[]` |
| `searchFacesByImage(imageBytes)` | `lib/faces/rekognition.ts` | Busca caras similares (FaceMatchThreshold 70), retorna `FaceSearchMatch[]` |
| `deleteFace(faceId)` | `lib/faces/rekognition.ts` | Elimina cara de Rekognition (DeleteFaces) |
| `readFromR2(key)` | `lib/r2-client.ts` | Lee archivo de R2 como Buffer |
| `uploadToR2(source, key, contentType, metadata?)` | `lib/r2-client.ts` | Sube buffer o path a R2 |
| `deleteFromR2(key)` | `lib/r2-client.ts` | Elimina archivo de R2 |
| `generateR2Key(filename, folder)` | `lib/r2-client.ts` | Genera key única |
| `sendEmail(params)` | `emails/send.ts` | Envía email vía Resend |

---

### 1.4 Modelos Prisma existentes

| Modelo | Campos relevantes |
|--------|-------------------|
| **AlbumInterest** | id, albumId, email, name, lastName, whatsapp, hasPurchased, lastNotifiedAt, nextEmailAt, sentE01-08, **biometricConsent**, **biometricConsentAt**, **biometricDeletedAt**, **selfieKey**, **faceId**, **expiresAt** |
| **AlbumNotification** | id, albumId, email, name, lastName, whatsapp, notifiedWhenReady, notifiedAt3Weeks... |
| **FaceDetection** | id, photoId, rekognitionFaceId, confidence, bbox |
| **FaceMatchEvent** | id, albumInterestId, photoId, faceDetectionId, similarity, notifiedAt, createdAt |
| **Album** | userId (owner), ... |
| **User** | role: PHOTOGRAPHER, LAB_PHOTOGRAPHER, ADMIN |

**AlbumInterest ya tiene todos los campos biométricos necesarios.** No requiere migración estructural. Posibles añadidos:
- `notifiedCount` (Int, default 0) - para rate-limit
- Config global: `biometricRetentionDays`, `similarityThreshold` (si se quiere hacer configurable)

---

### 1.5 Procesamiento al subir fotos

| Ubicación | Trigger | Descripción |
|-----------|---------|-------------|
| `app/api/internal/analysis/run/route.ts` | Cron Vercel: `* * * * *` (cada minuto) | Procesa fotos con analysisStatus=PENDING: OCR, indexFaces (cara de la foto), **matchFacesWithInterested** (searchFacesByImage vs selfies de interesados del álbum), crea FaceMatchEvent, llama a face-matching/notify |
| `app/api/internal/face-matching/notify/route.ts` | Llamado desde analysis/run | Busca FaceMatchEvent con notifiedAt=null, agrupa por interesado/álbum, envía email con link al álbum + link "Eliminar reconocimiento facial" (token firmado) |
| `app/api/cron/biometric-cleanup/route.ts` | Cron: `0 2 * * *` (2 AM) | Elimina datos biométricos expirados (expiresAt < now) |

**Pipeline ya implementado:**
1. Subida de fotos → direct-upload/complete (no hace análisis en la request)
2. Cron analysis/run cada minuto → OCR + indexFaces + matchFacesWithInterested + fetch(notify)
3. notify → envía emails con link delete-biometric
4. Cron biometric-cleanup diario → limpia expirados

---

### 1.6 Endpoints existentes relacionados

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/admin/albums/[id]/interested/[interestId]/selfie` | Sirve selfie como stream (solo ADMIN/fotógrafo dueño) |
| `POST /api/interested/[id]/delete-biometric` | Elimina biometría (token público o admin autenticado) |
| `GET /delete-biometric?token=...` | Landing con confirmación, llama POST delete-biometric |
| `POST /api/albums/[id]/invite` | Invitaciones a colaboradores (distinto de interesados) |

---

## 2. GAPS vs REQUISITOS DEL PROMPT

### Lo que YA existe y cumple

- [x] Registro con email + WhatsApp + selfie opcional
- [x] Checkbox consentimiento biométrico (si hay selfie)
- [x] Retención 90 días (expiresAt)
- [x] Eliminación anticipada (delete-biometric)
- [x] Solo admin del álbum ve selfie (endpoint protegido)
- [x] Selfie sin URL pública (stream autenticado)
- [x] Link "Eliminar reconocimiento facial" en emails
- [x] Si falla Rekognition: actualmente **retorna error 500** - el prompt pide que el registro sin biometría quede igual
- [x] Pipeline matching async (cron)
- [x] FaceMatchEvent para evitar duplicados
- [x] Cron limpieza por expiración

### Lo que FALTA o hay que ajustar

1. **register-interest:** Si Rekognition falla → NO fallar registro; guardar interesado sin biometría y loguear error.
2. **Admin dashboard:** Tabla de interesados con columna "Reconocimiento" (icono 👤 si faceId) y modal para ver selfie + botón "Eliminar datos biométricos". Actualmente el listado de interesados está en `/admin/interesados` (global) y en fotógrafo dashboard, pero **no hay vista por álbum** con selfie.
3. **Token delete:** El prompt pide `POST /api/public/delete-biometric` con token. Existe `POST /api/interested/[id]/delete-biometric` con token en body. La landing usa `?token=...` y llama a ese endpoint. **Añadir** ruta alternativa pública `POST /api/public/delete-biometric` que acepte token en body y resuelva interestId desde el token (opcional, para simplificar).
4. **FaceMatchEvent:** El schema usa `albumInterestId`, el prompt sugiere `interestedId` - ya está bien.
5. **Config:** Añadir en AppConfig o env: `biometricRetentionDays`, `similarityThreshold`, `notificationCooldownHours`.
6. **Rate limit:** Añadir rate-limit en register-interest y delete-biometric (públicos).
7. **Compresión selfie:** El prompt pide ≤300KB. Actualmente se acepta hasta 5MB. Comprimir con sharp antes de subir.
8. **Reutilizar componente cámara:** Ya se usa input file con capture. El prompt pide "EXACTAMENTE el mismo componente" - es el mismo. Opcional: extraer a componente reutilizable `SelfieCaptureInput` si se usa en varios sitios.

---

## 3. PLAN DE ARCHIVOS Y FUNCIONES

### Archivos a MODIFICAR

| Archivo | Cambios |
|---------|---------|
| `app/api/a/[id]/register-interest/route.ts` | Si Rekognition falla: continuar sin biometría (no retornar 500); añadir compresión con sharp a ~300KB; rate-limit |
| `app/dashboard/albums/page.tsx` o nueva página | Añadir en el modal de "Invitar" / gestión del álbum: tabla de interesados con columna Reconocimiento, modal selfie, botón eliminar biometría |
| `app/api/admin/albums/[id]/route.ts` o nuevo | GET listado de interesados del álbum (para el dashboard) - puede existir ya en invite |
| `lib/faces/rekognition.ts` | Añadir parámetro opcional `faceMatchThreshold` a searchFacesByImage (o leer de config) |
| `app/api/internal/analysis/run/route.ts` | Usar similarityThreshold configurable (default 90 en lugar de 70) |
| `prisma/schema.prisma` | Añadir `notifiedCount` a AlbumInterest si se usa para rate-limit; verificar AppConfig para biometricRetentionDays |
| `next.config.ts` o middleware | Rate limit para /api/a/[id]/register-interest y /api/interested/[id]/delete-biometric |
| `app/delete-biometric/page.tsx` | Corregir extracción de interestId desde token (el payload tiene formato `interestId:email:expiresAt`) |

### Archivos a CREAR (opcionales)

| Archivo | Descripción |
|---------|-------------|
| `app/api/admin/albums/[id]/interested/route.ts` | GET listado de interesados del álbum con faceId, email, etc. (si no existe) |
| `app/api/admin/albums/[id]/interested/[interestId]/delete-biometric/route.ts` | POST para admin eliminar biometría desde panel |
| `lib/rate-limit.ts` | Helper rate-limit por IP/key (puede existir ya) |
| `components/photo/SelfieCaptureInput.tsx` | Componente reutilizable (opcional) |
| `docs/INTERESADOS_SELFIE_README.md` | Documentación de flujos y env vars |

### Archivos que NO requieren cambios (ya correctos)

- `app/api/admin/albums/[id]/interested/[interestId]/selfie/route.ts` ✅
- `app/api/interested/[id]/delete-biometric/route.ts` ✅
- `app/api/cron/biometric-cleanup/route.ts` ✅
- `app/api/internal/face-matching/notify/route.ts` ✅
- `app/delete-biometric/page.tsx` (solo fix menor de token decode)
- `components/photo/ClientAlbumView.tsx` (flujo selfie ya implementado)

---

## 4. ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. **Fix register-interest:** Rekognition falla → continuar sin biometría, loguear.
2. **Compresión selfie:** sharp, max ~300KB antes de subir.
3. **Rate limit:** register-interest y delete-biometric.
4. **Admin: listado interesados por álbum** con columna Reconocimiento + modal selfie + delete.
5. **Config:** AppConfig o env para retention, threshold, cooldown.
6. **Fix delete-biometric page:** decode correcto del token.
7. **Documentación:** README con env vars y flujos.

---

## 5. VARIABLES DE ENTORNO NECESARIAS

| Variable | Descripción |
|----------|-------------|
| `BIOMETRIC_DELETION_SECRET` | Secret para firmar tokens de eliminación (si no, usa CRON_SECRET) |
| `CRON_SECRET` | Para crons (analysis, biometric-cleanup, face-matching) |
| `REKOGNITION_COLLECTION_ID` | Colección de Rekognition |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Rekognition |
| `R2_*` o equivalentes | Para R2 (selfies, fotos) |
| `RESEND_API_KEY` | Emails |

---

## 6. ESTRATEGIA MATCHING (ya implementada)

- **Modo:** 1 búsqueda por foto (searchFacesByImage con la imagen completa)
- **Threshold:** 70 (cambiable a 90 por config)
- **Filtro:** Solo interesados del álbum con faceId activo, no expirados, no eliminados
- **Antispam:** FaceMatchEvent por (photoId, albumInterestId); notify agrupa por interesado y envía 1 email por interesado/álbum
- **Async:** Cron cada minuto, no bloquea uploads
