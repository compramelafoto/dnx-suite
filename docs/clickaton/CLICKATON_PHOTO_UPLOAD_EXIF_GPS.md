# Clickatón — Carga de fotografías, EXIF, GPS y vínculo FotoRank (Etapa 11)

**Fecha:** 2026-07-28  
**Edición:** Clickatón Argentina 2026 — 19/09/2026 — TZ `America/Argentina/Cordoba`  
**Alcance:** flujo de carga por consigna RELEASED + validación técnica + entry FotoRank. Sin jurado/ranking.

---

## 1. Arquitectura encontrada (preflight)

| Área | Estado previo |
|---|---|
| Timeline / consignas | Etapa 10 — fuente de verdad temporal |
| Upload Clickatón | Solo foto de perfil (`DnxMediaAsset` / welcome storage) |
| Sync FotoRank | Solo roster (`FotorankContestParticipant`) |
| Entries FotoRank | Pipeline completo: SHA-256, EXIF, GPS, checklist, confirm/replace, R2 privado |
| Cardinalidad FR | 1 entry por inscripción nativa FR; `registrationId` ya opcional |
| Linkage Entry↔Prompt | Ausente |

**Decisión:** Clickatón orquesta gates + submission; FotoRank persiste la obra (`FotorankContestEntry` + assets/metadata). No se duplica un segundo sistema de entries.

---

## 2. Responsabilidades

| Clickatón | FotoRank |
|---|---|
| Edición, pago, número, timeline, consigna | Obra, original, derivados, hash, EXIF |
| Ventanas captura/subida | Checklist técnico, review, jurado futuro |
| Reglas operativas upload | Ranking / resultados futuros |

---

## 3. Política de ventanas

- **Captura:** `effectiveCaptureStartsAt = releasedAt ?? captureStartsAt` → `captureEndsAt`
- **Subida:** `uploadStartsAt ?? effectiveCaptureStartsAt` → `uploadEndsAt`
- Liberación manual: captura efectiva desde `releasedAt` (planificado se conserva en snapshot)
- Servidor = fuente de verdad; snapshots en entry al confirmar
- Timeline desplazado: entries ya enviadas conservan snapshot; nuevas cargas usan versión ACTIVE

---

## 4. Flujo

1. Request upload (auth + PAID/APPROVED + RELEASED + ventana subida + límites)
2. Upload privado (multipart → storage privado, sin URL pública)
3. Procesamiento durable (hash, MIME, dims, EXIF, GPS, derivados)
4. Checklist participante (PASS/WARNING/FAIL/MANUAL_REVIEW)
5. Confirmación → entry visible para review técnico (no jurado hasta CONFIRMED + reglas FR)

---

## 5. Modelos

- Extensión `FotorankContestEntry`: `sourcePlatform`, `external*`, snapshots ventana, `clickatonParticipantNumber`
- `ClickatonEditionUploadConfig` — límites/tolerancia/GPS policy (uploadsEnabled=false en seed)
- Extensión `ClickatonPrompt` — min/max entries, replacement, GPS mode, tolerancia
- `ClickatonPhotoSubmission` — orquestación / outbox por registration+prompt
- `ClickatonPhotoSubmissionJob` — worker durable

---

## 6. Seguridad

Originales privados; firmas cortas futuras; no indexables; GPS no público; logs sanitizados; MIME real; SHA-256; aislamiento por edición/ownership.

---

## 7. Implementación (código)

| Pieza | Path |
|---|---|
| Dominio | `apps/clickaton/lib/photo-upload/**` |
| APIs | `/api/public/registrations/[id]/prompts/[promptId]/{upload-intent,upload,confirm}` |
| Cron cleanup | `/api/cron/photo-upload-cleanup` |
| Dashboard | `PromptPhotoUpload` en `/mi-cuenta/inscripciones/[id]` |
| Admin | `/admin/ediciones/[id]/envios` |
| Migración | `20260728110000_clickaton_photo_upload` |
| Selfcheck | `pnpm --filter clickaton selfcheck:photo-upload` |

Seed Argentina 2026: `uploadsEnabled=false`, GPS OPTIONAL, tolerancia 5 min, prompts DRAFT sin textos.

---

## 8. Pendientes

- **Etapa 12 (hecha):** acreditación / QR / check-in / kit — `CLICKATON_ACCREDITATION_AND_CHECKIN.md`
- **Etapa 13 (hecha):** admisión técnica / batch / freeze — `CLICKATON_TECHNICAL_ADMISSION.md` (no scores; jurado solo consume FROZEN)
- Jurado, ranking, resultados, RAW, detección IA avanzada
- Firmas R2 pre-signed PUT, asset FR versionado completo desde Clickatón
