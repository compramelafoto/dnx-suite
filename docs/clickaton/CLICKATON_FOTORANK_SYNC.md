# Clickatón ↔ FotoRank — Sync postpago (Etapa 7)

**Fecha:** 2026-07-28  
**Alcance:** sincronización mínima y durable de participante tras inscripción `PAID` / `CONFIRMED`.  
**Actualización Etapa 8:** el sync también replica Instagram, `profilePhotoAssetId`, `welcomeCardAssetId` y estado de placa. Clickatón es dueño; FotoRank solo consume. Placas: `WELCOME_CARD_SYSTEM.md`. Publicación Instagram → Etapa 9.

---

## 1. Arquitectura encontrada

### Clickatón

| Pieza | Hallazgo |
|---|---|
| Edición | `ClickatonEdition` con soft ref `fotorankContestId` (sin FK) |
| Inscripción | `ClickatonRegistration` — estados de pago / confirmación reales |
| Número | `sequenceNumber` + `visibleCode` vía `ClickatonEditionSequence` en `confirmPaid` |
| Postpago | Webhook DNX Payments → `applyPaymentEvent` → `confirmPaid` + soft-fail side effects |
| Outbox previo | No había outbox de integraciones; solo cron `expire-registration-holds` |
| Social | Sin Instagram/foto obligatorios en wizard (prep de columnas en Etapa 7) |

### FotoRank

| Pieza | Hallazgo |
|---|---|
| Concurso | `FotorankContest` |
| “Participante” histórico | **No** existía `Participant` / `ContestParticipant` / `Registration` |
| Obra | `FotorankContestEntry` = entrega fotográfica (no inscripción) |
| Alta previa | Admin crea entries; **no** apto para postpago Clickatón |
| Sync externo | Sin `sourcePlatform` / `externalRegistrationId` previos |

**Decisión:** no reutilizar `FotorankContestEntry` como inscripción. Crear roster mínimo `FotorankContestParticipant` + puente durable en Clickatón.

---

## 2. Modelos reutilizados

- `FotorankContest` (validación de vínculo).
- `User` DNX Suite (identidad compartida).
- `ClickatonEdition.fotorankContestId`.
- Numeración Clickatón (`visibleCode` / `sequenceNumber`).
- Flujo postpago existente (`confirmPaid` + soft-fail).

---

## 3. Modelos nuevos / ampliados

### Enums

- `ClickatonFotoRankValidationStatus`: `NOT_CONFIGURED` | `PENDING_VALIDATION` | `VALID` | `INVALID` | `DISABLED`
- `ClickatonFotoRankSyncStatus`: `PENDING` | `PROCESSING` | `SYNCED` | `RETRY_PENDING` | `FAILED` | `MANUAL_REVIEW` | `DISABLED`
- `ClickatonFotoRankSyncMode`: `POST_PAID` | `DISABLED`
- `ClickatonProfilePhotoSource`: `USER_UPLOAD` | `INSTAGRAM_IMPORT` | `ADMIN_UPLOAD`
- `ClickatonIntegrationOutboxStatus`: `PENDING` | `PROCESSING` | `PROCESSED` | `FAILED`

### `ClickatonEdition`

- `fotoRankSyncEnabled` (default `false`)
- `fotoRankSyncMode` (default `DISABLED`)
- `fotoRankValidationStatus` (default `NOT_CONFIGURED`)
- `fotoRankLastValidatedAt`, `fotoRankValidationError`

### `ClickatonRegistration`

- Sociales prep: `instagramHandle`, `instagramHandleNormalized`, `profilePhotoAssetId`, `profilePhotoSource`, `profilePhotoStatus`, consents
- Soft refs: `fotoRankParticipantId`, `fotoRankSyncStatus`, `fotoRankSyncedAt`

### Nuevos

- `FotorankContestParticipant` — roster; unique `(contestId, userId)` y `(contestId, externalRegistrationId)`
- `ClickatonFotoRankSync` — unique `(registrationId, fotoRankContestId)` + `idempotencyKey`
- `ClickatonIntegrationOutboxEvent` — outbox mínima `CLICKATON_REGISTRATION_PAID`

### Migración

```
packages/db/prisma/migrations/20260728070000_clickaton_fotorank_sync/migration.sql
```

---

## 4. Estrategia elegida

1. Tras `confirmPaid`, encolar sync (**nunca** dentro de la TX financiera; soft-fail).
2. Persistencia: `ClickatonFotoRankSync` + outbox.
3. Worker: cron `/api/cron/fotorank-sync` + acciones admin.
4. Identidad: `userId` → email normalizado → vínculo externo; no duplicar usuarios.
5. Número oficial: Clickatón → se copia a `clickatonParticipantNumber` en FotoRank.
6. Si FotoRank falla → inscripción sigue `CONFIRMED` / pago `APPROVED`.

---

## 5. Evento postpago

`CLICKATON_REGISTRATION_PAID`

Payload mínimo:

- `registrationId`, `editionId`, `userId`, `paymentOrderId`, `paidAt`, `eventVersion`, `idempotencyKey`

Emitido desde:

- `apply-payment-event.ts` (webhook)
- `get-registration-payment-status.ts` (refresh S2S)

---

## 6. Outbox / mecanismo durable

- Tabla `ClickatonIntegrationOutboxEvent`
- Fila `ClickatonFotoRankSync` con reintentos
- Cron cada 5 minutos (`vercel.json`)
- **No** depende de `setTimeout` / fire-and-forget en memoria (el `void enqueue…` solo encola durable)

---

## 7. Identidad

Prioridad:

1. `userId` DNX Suite  
2. Email normalizado  
3. `externalRegistrationId` en roster  
4. Crear participante solo si no existe  

No se sobrescribe roster SYNCED con datos conflictivos sin política (Etapa 7: upsert por unique keys).

---

## 8. Numeración

| Fuente | Campo |
|---|---|
| Oficial | Clickatón `visibleCode` (+ `sequenceNumber`) |
| En FotoRank | `clickatonParticipantNumber` = mismo código |

FotoRank **no** genera otro número oficial para el mismo participante Clickatón.

---

## 9. Datos enviados a FotoRank

Incluye: identidad, contacto, geo, Instagram/foto si existen, edición, inscripción, concurso, `paidAt`, número, origen `CLICKATON`, `enabled`.

**No** incluye: tokens MP, snapshots financieros, allocations, secrets.

---

## 10. Reintentos

Backoff: 1m → 5m → 15m → 1h → `MANUAL_REVIEW`.

| Clase | Destino |
|---|---|
| Timeout / DB / lock / rate limit | `RETRY_PENDING` |
| Concurso inexistente / identidad ambigua / datos inválidos | `MANUAL_REVIEW` |

---

## 11. Seguridad

- Concurso solo desde config de edición (admin), no desde payload de participante.
- Actions con `requireClickatonAdmin()`.
- Logs sanitizados (sin secretos / PII financiera).
- Soft refs sin FK rígida a Orders.

---

## 12. Panel admin

- Detalle edición: bloque **Integración FotoRank** (vínculo, validar, stats, retry).
- Listado / detalle inscripciones: estado sync, ID participante, número, intentos, error.
- Acciones: validar, sync manual, retry, manual review, abrir FotoRank (URL env).

---

## 13. Seed Argentina 2026

- `fotoRankSyncEnabled = false`
- `fotoRankValidationStatus = NOT_CONFIGURED`
- `fotorankContestId = null` en create
- **No** inventa concurso ni habilita sync

---

## 14. Archivos clave

| Área | Path |
|---|---|
| Dominio / servicio in-memory | `apps/clickaton/lib/fotorank-sync/**` |
| Prisma adapter | `…/infrastructure/prisma-fotorank-sync.ts` |
| Admin actions | `…/actions/fotorank-sync-admin.ts` |
| Cron | `apps/clickaton/app/api/cron/fotorank-sync/route.ts` |
| Hook pago | `lib/checkout/application/apply-payment-event.ts` |
| Selfcheck | `scripts/fotorank-sync.selfcheck.ts` (`pnpm selfcheck:fotorank-sync`) |

---

## 15. Riesgos

- Migración Prisma pendiente de aplicar en Neon/shared.
- Roster nuevo en FotoRank: UI FR de participantes aún no consume el modelo.
- Cambio de concurso en edición **no** mueve syncs históricos (nuevo pair registration+contest).
- WIP ajeno (InfoSpot / payments) no mezclar.

---

## 16. Alcance Etapa 7 vs Etapa 8

**Cierra Etapa 7:** enqueue durable, create/link participante, idempotencia, número estable, panel, reintentos, PAID intacto.

**Etapa 8 (hecha):** Instagram + foto + consentimientos + crop + placa PNG/WEBP via `@repo/media-composition`. Ver `WELCOME_CARD_SYSTEM.md`.

**Etapa 9:** publicación automática en Instagram.

**Etapa 10:** Clickatón es fuente de verdad del cronograma de la maratón (`lib/timeline`). FotoRank no duplica ventanas; en etapas posteriores podrá consumir snapshots seguros (timeline ACTIVE, consignas RELEASED, número de participante). Ver `CLICKATON_TIMELINE_AND_PARTICIPANT_EXPERIENCE.md`.

**Etapa 11:** Tras consigna RELEASED + ventana de subida, Clickatón crea/actualiza `FotorankContestEntry` con `sourcePlatform=CLICKATON` y soft refs (`externalPromptId`, `externalRegistrationId`, snapshots de ventana). No asigna `entryNumber` ni `CONFIRMED` automáticamente (jurado no ve la obra). Ver `CLICKATON_PHOTO_UPLOAD_EXIF_GPS.md`.
