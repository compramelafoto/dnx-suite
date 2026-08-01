# Clickatón — Persistencia de placas de participante (Etapa 08)

**Etapa:** 08 — Persistencia, R2, hash e idempotencia  
**Fecha:** 2026-08-01  
**Código:** `apps/clickaton/lib/participant-cards/`  
**Integración HTTP (Etapa 07):** [`clickaton-participant-cards-integration.md`](./clickaton-participant-cards-integration.md)  
**Brecha legal:** [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md)  
**Pipeline legacy:** [`clickaton-welcome-card-pipeline-audit.md`](./clickaton-welcome-card-pipeline-audit.md)

---

## Resumen

Etapa 08 añade **persistencia durable** al pipeline Template V2 de placas (`welcome` / `member`). Cada solicitud HTTP pasa por **`getOrGenerateClickatonParticipantCard`**: devuelve bytes desde R2/DB si el `renderHash` coincide (**HIT**), o renderiza con Chromium, sube a R2 y registra en DB (**MISS** / **REGENERATED**).

El PNG **no** se regenera en cada click cuando los inputs visuales no cambiaron. La invalidación es **lazy**: un cambio de datos produce un hash distinto; el registro anterior queda **STALE** cuando entra uno nuevo **READY**.

---

## Modelo `ClickatonParticipantCard`

Tabla Prisma: `ClickatonParticipantCard` (`packages/db/prisma/schema.prisma`).

| Campo | Rol |
|-------|-----|
| `id` | CUID del registro |
| `registrationId`, `editionId` | Dueño y edición |
| `cardType` | `WELCOME` \| `MEMBER` |
| `templateKey`, `templateVersion` | Preset Template V2 usado |
| `rendererVersion` | Versión del motor PNG (ver abajo) |
| `renderHash` | SHA-256 canónico de inputs visuales (**no es autorización**) |
| `status` | `GENERATING` \| `READY` \| `FAILED` \| `STALE` \| `DELETED` |
| `assetId` | Soft ref a `DnxMediaAsset` (`kind = PARTICIPANT_CARD_PNG`) |
| `storageKey` | Clave R2 determinística |
| `width`, `height`, `mimeType`, `byteSize`, `contentHash` | Metadata del PNG |
| `startedAt`, `generatedAt`, `failedAt` | Tiempos de ciclo de vida |
| `generatedByUserId` | Actor que disparó la generación (nullable) |
| `sourceUpdatedAt` | Snapshot temporal al crear el lock |
| `attemptCount` | Reintentos / re-locks |
| `errorCode` | Código de fallo (`ClickatonCardError.code` o genérico) |
| `lockExpiresAt` | Soft lock multi-instancia (TTL 120 s en app) |

**Índice de idempotencia:** `@@unique([registrationId, cardType, renderHash])`.

---

## `DnxMediaAsset` — `PARTICIPANT_CARD_PNG`

Al pasar a **READY**, `persistParticipantCardMediaAsset()` crea un asset:

| Campo | Valor |
|-------|-------|
| `platform` | `CLICKATON` |
| `ownerType` | `PARTICIPANT_CARD` |
| `ownerId` | ID del registro `ClickatonParticipantCard` |
| `kind` | **`PARTICIPANT_CARD_PNG`** |
| `storageKey` | Misma clave que el registro (prefijo `clickaton/participant-cards/…`) |
| `storageBackend` | `R2`, `LOCAL`, `INLINE_DB` (Vercel sin R2), etc. |
| `metadata` | **Sin PII:** `cardType`, `templateKey`, `templateVersion`, `renderHashPrefix` (+ `inlineBase64` solo en modo inline) |

Los metadatos R2/S3 en upload repiten el mismo criterio (`card-type`, `template-key`, `render-hash-prefix`, dimensiones, `generated-at`). **No** se persisten nombre, email, Instagram ni bytes de foto de perfil en metadata de objeto.

---

## `renderHash` — `computeClickatonParticipantCardRenderHash`

Implementación: `participant-card-hash.ts`. Algoritmo: **SHA-256** sobre JSON canónico (`stableSortKeys` + `JSON.stringify`).

### Incluido en el hash

| Bloque | Campos |
|--------|--------|
| Identidad de placa | `cardType`, `templateKey`, `templateVersion` |
| Documento de plantilla | `templateDocumentNormalized`: `canvas` + `blocks[]` ordenados por `name` (solo `name`, `type`, `pageIndex`, `layout`, `configJson`; **sin** IDs efímeros de instancia) |
| Participante | `firstName`, `lastName`, `displayName`, `instagram` (normalizado), `city`, `province`, `country`, `category`, `number`, `numberFormatted` |
| Foto | `photoAssetId`, `photoContentHash` (hash del asset en DB; **no** el data URL ni los bytes) |
| Edición | `name`, `eventDate`, `eventDateFormatted`, `city`, `venue`, `slug` |
| Branding | `name`, `logo`, `logoUrl`, `primaryColor`, `secondaryColor`, `accentColor` |
| Copy de placa | `card.message` |
| Versiones de motor | `rendererVersion`, `fontConfigVersion` |
| Regeneración forzada | `forceGenerationId` (UUID aleatorio; solo admin `?force=1`) |

Constantes de versión:

```ts
CLICKATON_CARD_RENDERER_VERSION = "template-engine-renderer:1"
CLICKATON_CARD_FONT_CONFIG_VERSION = "preview-fonts:1"
```

Incrementar `CLICKATON_CARD_RENDERER_VERSION` cuando cambie el output PNG para los mismos inputs (motor Playwright, fuentes, DPI). No hace falta bump solo por cambios de persistencia o HTTP.

### Excluido del hash

- `registrationId`, `userId`, `email` y demás campos de autorización / estado de pago
- Consentimientos (`imageUsageConsent`, etc.)
- Data URL / bytes de la foto en memoria (`photoDataUrl`)
- IDs efímeros de bloques tras `instantiatePresetPayload`
- `sponsors` (siempre `[]` en el canonical actual)
- Claves R2, URLs públicas, `assetId`

**Implicación:** dos inscripciones distintas con los mismos datos visuales producirían el mismo hash de contenido, pero el registro DB es por `(registrationId, cardType, renderHash)`.

---

## Claves R2

Función: `buildParticipantCardStorageKey()` (`participant-card-r2-keys.ts`).

```
clickaton/participant-cards/edition-{editionId}/registration-{registrationId}/{welcome|member}/v{n}/{hash}.png
```

- Segmentos sanitizados (`[^a-zA-Z0-9_-]` → `-`).
- `v{n}` = `templateVersion` del preset (mínimo 1).
- `{hash}` = `renderHash` completo (64 hex).

Ejemplo:

```
clickaton/participant-cards/edition-clxyz123/registration-reg456/welcome/v1/a1b2c3….png
```

Backends (`createParticipantCardAssetStore()`):

| Condición | Backend |
|-----------|---------|
| Env R2 completo | `R2ParticipantCardAssetStore` |
| Vercel sin R2 / `CLICKATON_MEDIA_INLINE_DB=1` | `KeyOnlyParticipantCardAssetStore` (bytes en `DnxMediaAsset.metadata.inlineBase64`) |
| Tests | `MemoryParticipantCardAssetStore` |
| Dev local | `LocalParticipantCardAssetStore` → `public/uploads/…` |

---

## Flujo `getOrGenerate`

Orquestador: `getOrGenerateClickatonParticipantCard()` (`participant-card-persistence.ts`).

```
Request autenticado
  → loadRegistration + ownership + elegibilidad + templateData
  → computeClickatonParticipantCardRenderHash
  → findReadyByHash(registrationId, cardType, renderHash)
       ├─ READY existe → load PNG (R2 o asset) → cacheStatus: HIT
       └─ no READY
            → findByRegistrationCardTypeHash
            → si GENERATING + lock vigente → poll hasta 8 s → HIT si READY
            → si GENERATING + lock expirado → extiende lock (+ attemptCount)
            → si no registro / STALE / FAILED → createGenerating o update → GENERATING
            → rate limit (solo aquí; HIT no pasa)
            → renderProvider.render(document)
            → store.putAtKey + persistParticipantCardMediaAsset
            → updateRecord READY + markOtherReadyAsStale
            → cacheStatus: MISS o REGENERATED
```

### Estados de caché HTTP (`cacheStatus`)

| Valor | Cuándo |
|-------|--------|
| `HIT` | Registro **READY** con el mismo `renderHash`; bytes servidos desde almacenamiento |
| `MISS` | Primera generación para ese hash |
| `REGENERATED` | Admin `?force=1` (`forceGenerationId` nuevo tras marcar READY previos como STALE) |

Header de respuesta: `X-Clickaton-Card-Cache: HIT|MISS|REGENERATED`.

### Transiciones de estado DB

```
(none) ──createGenerating──► GENERATING ──éxito──► READY
                                │                    │
                                └── fallo ──► FAILED │
                                                     │
              otro READY mismo tipo ───────────────► STALE
              force regenerate (markAllReadyAsStale) ► STALE
              cleanup ─────────────────────────────► DELETED (borrado físico)
```

- **Lazy invalidation:** si el participante cambia nombre o foto, el hash cambia; no hay job proactivo. La placa vieja queda **STALE** cuando se genera la nueva **READY** (`markOtherReadyAsStale`).
- **FAILED:** el siguiente request con el mismo hash puede reintentar (update a **GENERATING**).
- **GENERATING** huérfano: lock TTL **120 s** (`LOCK_TTL_MS`); tras expiración otro worker puede tomar el lock.

---

## Idempotencia y concurrencia

1. **Unique constraint** `(registrationId, cardType, renderHash)` — dos workers que intentan crear el mismo registro: uno gana, el otro recibe `P2002` → poll / re-lectura → **HIT** si el ganador terminó.
2. **Soft lock** `lockExpiresAt = now + 120s` en fila **GENERATING** — evita renders duplicados mientras el lock está vivo; polling cada 200 ms hasta 8 s.
3. **Rate limit in-memory** — solo en camino **MISS/REGENERATED** (antes de Chromium). **HIT** no consume cupo ni invoca Playwright.

Ver sección Rate limit más abajo.

---

## Admin — regeneración forzada

Query: `?force=1` (también `true` / `yes`). Ruta HTTP vía `runParticipantCardHttp()` → `forceRegenerateClickatonParticipantCard()`:

1. `markAllReadyAsStale(registrationId, cardType)`
2. `getOrGenerate` con `forceGenerationId = randomUUID()` → hash distinto → **REGENERATED**

Solo admin en rutas `/api/admin/…`; participante no expone `force`.

---

## Limpieza — `cleanupStaleClickatonParticipantCards`

Función exportada; modo `{ mode: "dry-run" | "apply" }`. Agrupa por `(registrationId, cardType)`.

| Regla | Acción |
|-------|--------|
| **READY** | Conservar **solo la más reciente** (`generatedAt`); el resto → borrar registro + objeto R2 |
| **STALE** | Conservar **las 2 más recientes** (`updatedAt`); el resto → borrar si `updatedAt` > **30 días** |
| **FAILED** | Borrar registro si **sin** `assetId` y `updatedAt` > **7 días** |
| **dry-run** | Cuenta `deletedRecords` / `deletedAssets` sin mutar |

Retorno: `{ dryRun, deletedRecords, deletedAssets, keptReady, keptStale }`.

No hay cron wired en Etapa 08; invocación manual u ops script.

---

## Eventos de auditoría

Logger estructurado: `recordParticipantCardAudit()` → `console.info` JSON **sin PII**.

| Evento | Cuándo |
|--------|--------|
| `CLICKATON_CARD_GENERATED` | Primera persistencia **MISS** |
| `CLICKATON_CARD_REUSED` | **HIT** desde almacenamiento |
| `CLICKATON_CARD_REGENERATED` | **REGENERATED** (force) |
| `CLICKATON_CARD_FAILED` | Fallo render / persistencia |
| `CLICKATON_CARD_DOWNLOADED` | `disposition=attachment` |

Campos permitidos: `registrationId`, `editionId`, `cardType`, `renderHashPrefix` (12 chars), `cacheStatus`, `actorKind`, `actorUserId`, `durationMs`, `errorCode`, `recordId`, `width`, `height`, `byteSize`, `templateKey`, `templateVersion`, `force`. **No** email, nombre ni hash completo.

---

## Rate limit

Implementación: `participant-card-rate-limit.ts` — **in-memory por instancia** (Map).

| Actor | Límite | Ventana |
|-------|--------|---------|
| Participante | 5 | 60 s |
| Admin | 10 | 60 s |

Clave: `userId` preferido, fallback email normalizado.

**HIT omite rate limit** — servir desde R2/DB no cuenta como generación.

**Gap distribuido:** en Vercel multi-lambda cada instancia tiene su propio Map; no hay Redis/KV global. La protección primaria de concurrencia cara es la **idempotencia DB** + lock **GENERATING**, no el rate limit.

---

## ETag y `Cache-Control`

Headers en `pngResponse()` / `notModifiedResponse()` (`participant-card-http.ts`):

- `Cache-Control: private, no-store` — el navegador **no** debe cachear compartido ni reutilizar sin revalidación auth.
- `ETag: "ck-card-{cardType}-{renderHashPrefix}"` — permite **`If-None-Match`** en la misma sesión autenticada.
- **304** solo si `If-None-Match` coincide **y** `cacheStatus === "HIT"` (ya hay bytes persistidos; no en MISS mid-flight).

Relación: `no-store` evita cache público/CDN; el ETag es optimización **same-origin + auth** (evitar re-descargar bytes cuando el hash no cambió).

---

## `ParticipantCardRenderProvider`

Config: env **`CLICKATON_CARD_RENDER_PROVIDER`** (default `local`).

| Valor | Clase | Comportamiento |
|-------|-------|----------------|
| `local` | `LocalPlaywrightRenderProvider` | `renderTemplatePreviewPng` vía `@repo/template-engine-renderer` + Playwright Chromium |
| `remote` | `RemoteRenderProvider` | **Stub** — lanza `CLICKATON_CARD_RENDER_UNAVAILABLE` («worker no wired») |
| `unavailable` | `UnavailableRenderProvider` | **503** explícito para entornos sin Chromium |

### Estrategia de producción

| Entorno | Recomendación |
|---------|---------------|
| **Dev / CI local** | `local` — Chromium en la misma máquina |
| **Producción (preferida — Opción A)** | Worker dedicado con Chromium (`remote`) — contrato: POST documento resuelto → `{ png, width, height }`. Vercel app sin binario pesado. **Pendiente:** cablear `RemoteRenderProvider` a URL + auth del worker. |
| **Vercel sin Chromium** | `unavailable` → **503** `CLICKATON_CARD_RENDER_UNAVAILABLE`; **HIT** sigue sirviendo placas ya persistidas |
| **`@sparticuz/chromium`** | **No adoptado** sin evaluación explícita de tamaño, cold start y paridad visual con el renderer actual |

---

## Seguridad

| Tema | Regla |
|------|-------|
| **Hash ≠ auth** | Conocer `renderHash` o prefijo **no** autoriza descarga; siempre `requireParticipantCardReadAccess` |
| **Ownership** | Participante: `userId` o email; ajeno → **404**. Admin: rol admin |
| **R2 keys** | **Nunca** expuestas en API pública; lectura vía bytes en respuesta autenticada o proxy interno |
| **Status API** | `/cards/[cardType]/status` devuelve `renderHashPrefix`, **no** hash completo ni `storageKey` |
| **Diagnóstico admin** | JSON con `imageBase64` solo con sesión admin + `Accept: application/json` |

---

## Coexistencia con pipeline legacy

- **`DnxWelcomeCard`** + `@repo/media-composition` (Sharp) + auto-enqueue al pago **siguen activos**.
- **Participant-cards Template V2** es la **fuente de verdad futura** (welcome + member, hash, R2 estructurado).
- UI Mi inscripción muestra **ambos**: `WelcomeCardShareCard` (legacy) y `ParticipantCardsSection` (V2).
- Migración planificada en [`clickaton-welcome-card-pipeline-audit.md`](./clickaton-welcome-card-pipeline-audit.md) — no destructiva.

---

## Brecha legal — producción pública

La persistencia **no** cierra la brecha legal documentada en [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md):

- Placa **Member** sin cláusula explícita
- Consent proxy vs. `socialPublicationConsent`
- Activar generación masiva / auto al pago en V2 requiere revisión legal **antes** de producción pública completa

**Etapa 08 es infraestructura técnica; no es go-live legal.**

---

## Endpoints relacionados (Etapa 08)

| Ruta | Rol |
|------|-----|
| `GET …/cards/[cardType]` | get-or-generate PNG (`?force=1` admin) |
| `GET …/cards/[cardType]/status` | Estado DB sin bytes (`NOT_GENERATED`, `READY`, etc.) |

Participante y admin tienen rutas espejo bajo `/api/account/…` y `/api/admin/…`.

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `participant-card-persistence.ts` | get-or-generate, force, status, cleanup |
| `participant-card-hash.ts` | SHA-256 canónico |
| `participant-card-r2-keys.ts` | Claves determinísticas |
| `participant-card-asset-store.ts` | R2 / local / inline + `DnxMediaAsset` |
| `participant-card-render-provider.ts` | Local / Remote / Unavailable |
| `participant-card-renderer-version.ts` | `CLICKATON_CARD_RENDERER_VERSION` |
| `participant-card-audit.ts` | Eventos JSON sin PII |
| `participant-card-http.ts` | ETag, 304, force, audit download |

---

## Pruebas

```bash
pnpm --filter clickaton test:clickaton-participant-cards
```

Cobertura relevante Etapa 08: `participant-card-persistence.test.ts`, `participant-card-hash.test.ts`, `participant-card-concurrency.test.ts`, `participant-card-storage.test.ts`.
