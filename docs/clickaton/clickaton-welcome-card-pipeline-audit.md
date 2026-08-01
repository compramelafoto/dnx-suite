# Clickatón — Auditoría pipeline legacy «Welcome Card»

**Etapa:** 08 — Inventario y plan de migración (no destructivo)  
**Fecha:** 2026-08-01  
**Destino futuro:** [`clickaton-participant-cards-persistence.md`](./clickaton-participant-cards-persistence.md) (Template V2 + `template-engine-renderer`)  
**Integración V2:** [`clickaton-participant-cards-integration.md`](./clickaton-participant-cards-integration.md)

---

## Resumen

El pipeline **legacy** genera una placa de **bienvenida** al confirmar pago, la persiste en R2 con clave opaca, y la expone en Mi inscripción vía `WelcomeCardShareCard`. Usa **`@repo/media-composition`** (Sharp), no Template V2.

El pipeline **participant-cards** (Etapa 07–08) es el reemplazo planificado: welcome + member, hash determinístico, R2 estructurado, Playwright renderer. **Ambos coexisten**; no se elimina legacy en Etapa 08.

---

## Diagrama de flujo legacy

```
Pago confirmado (apply-payment-event / get-registration-payment-status)
  └─► enqueueWelcomeCardAfterPaid()
        ├─ upsert DnxWelcomeCard (templateId: clickaton.welcome.story, status: PENDING)
        ├─ upsert ClickatonIntegrationOutboxEvent (CLICKATON_WELCOME_CARD_PENDING)
        └─ update ClickatonRegistration.welcomeCardId / welcomeCardStatus

Cron GET /api/cron/welcome-cards  (Bearer CRON_SECRET o x-vercel-cron)
  └─► processDueWelcomeCards(limit)
        ├─ outbox PENDING/FAILED → processWelcomeCardById
        └─ DnxWelcomeCard PENDING/FAILED (nextRetryAt) → processWelcomeCardById

processWelcomeCardById(cardId, storage?, force?)
  ├─ inputHash = hashRenderInputs(template version, photo hash, nombre, IG, código, crop…)
  ├─ skip si GENERATED + mismo inputHash (salvo force)
  ├─ renderComposition(CLICKATON_WELCOME_STORY_V1)  [@repo/media-composition]
  ├─ storage.put welcome → PNG + WEBP
  ├─ create DnxMediaAsset WELCOME_CARD_PNG + WELCOME_CARD_WEBP
  └─ update DnxWelcomeCard GENERATED + registration.welcomeCardStatus
```

---

## Disparadores (triggers)

| Trigger | Ubicación | Notas |
|---------|-----------|-------|
| **Post-pago** | `lib/checkout/application/apply-payment-event.ts` | `void enqueueWelcomeCardAfterPaid` — soft-fail; no revierte PAID |
| **Polling pago** | `lib/checkout/application/get-registration-payment-status.ts` | Re-enqueue idempotente si faltó en webhook |
| **Cron** | `app/api/cron/welcome-cards/route.ts` | `processDueWelcomeCards(50)` |
| **Admin enqueue** | `lib/welcome-card/admin-actions.ts` → `enqueueWelcomeCardForRegistrationAction` | Inscripción CONFIRMED + APPROVED |
| **Admin regenerate** | `regenerateWelcomeCardAction` | `processWelcomeCardById(id, undefined, true)` |
| **Admin retry** | `retryWelcomeCardAction` | status → PENDING + process |
| **Admin crop/foto** | `updateWelcomeCardCropAction`, `changeWelcomeCardPhotoAction` | Re-render force |
| **Ops scripts** | `ops-10g6*`, `ops-10g7*` | Reconciliación manual |

**No hay trigger automático** del pipeline legacy hacia participant-cards V2 en Etapa 08.

---

## Modelos de datos

### `DnxWelcomeCard`

| Campo relevante | Uso |
|-----------------|-----|
| `platform` / `ownerType` / `ownerId` | `CLICKATON` / `REGISTRATION` / registrationId |
| `templateId` | **`clickaton.welcome.story`** (media-composition, ≠ Template V2 key) |
| `templateVersion`, `rendererVersion` | Versionado legacy (`rendererVersion: "1.0.0"`) |
| `status` | `PENDING` → `GENERATED` \| `FAILED` \| `APPROVED` (moderación) |
| `pngAssetId`, `webpAssetId` | Refs a assets |
| `inputHash`, `contentHash` | Idempotencia render |
| `variablesSnapshot`, `cropSnapshot` | Auditoría |
| `publicationStatus` | Flujo social (Etapa 9) |

Unique: `(platform, ownerType, ownerId, templateId)`.

### `DnxMediaAsset` (legacy)

| kind | Uso |
|------|-----|
| `WELCOME_CARD_PNG` | Placa legacy PNG 1080×1920 |
| `WELCOME_CARD_WEBP` | Variante WebP misma composición |
| `PARTICIPANT_CARD_PNG` | **Solo pipeline V2** (Etapa 08) |

`ownerType`: `WELCOME_CARD` (legacy) vs `PARTICIPANT_CARD` (V2).

### `ClickatonRegistration` (campos legacy)

`welcomeCardId`, `welcomeCardStatus`, `welcomeCardAssetId`, `welcomePublicationStatus`, crop fields (`profilePhotoCropX/Y`, zoom, rotation, boundingBox).

---

## Claves R2 legacy

Función `objectKey()` en `lib/welcome-card/storage.ts`:

```
clickaton/{namespace}/{YYYY-MM-DD}/{uuid}.{ext}
```

- `namespace`: **`welcome`** para placas legacy (también `profile`, `products`, `editions`).
- **No determinístico** — UUID por upload; distinto del esquema V2:

```
clickaton/participant-cards/edition-{id}/registration-{id}/{welcome|member}/v{n}/{hash}.png
```

Lectura: proxy autenticado `/api/public/registrations/[id]/welcome-card` — **no** expone `storageKey`.

---

## Render legacy

| Aspecto | Legacy | V2 (futuro) |
|---------|--------|-------------|
| Paquete | `@repo/media-composition` | `@repo/template-engine-renderer` |
| Plantilla | `CLICKATON_WELCOME_STORY_V1` (`id: clickaton.welcome.story`) | `CLICKATON_WELCOME_STORY_V1` (`templateKey` en `@repo/template-engine/clickaton-presets`) |
| Motor | Sharp composición | Playwright Chromium headless |
| Salidas | PNG + WEBP | PNG |
| Crop foto | Sí (perfil registration) | No (usa foto asset completa / data URL) |
| Member placa | No | Sí (`CLICKATON_MEMBER_STORY_V1`) |

Las plantillas visuales **convergen conceptualmente** (Story 1080×1920 Clickatón) pero son **implementaciones distintas** hasta unificar presets en template-engine.

---

## UI

| Superficie | Componente | Pipeline |
|------------|------------|----------|
| Mi inscripción — placa legacy | `WelcomeCardShareCard` | Lee `welcomeCardStatus === "GENERATED"`; URLs `/api/public/registrations/[id]/welcome-card` |
| Mi inscripción — placas V2 | `ParticipantCardsSection` | `/api/account/registrations/[id]/cards/{welcome\|member}` |
| Admin inscripción | Panel legacy (regenerate, approve, preview PNG) + `AdminParticipantCardsPanel` | Ambos |

`WelcomeCardShareCard` **permanece** en Etapa 08; no migrada a V2.

---

## Tabla de clasificación por componente

Leyenda:

- **REUTILIZAR** — usar tal cual en arquitectura target
- **ADAPTAR** — mismo rol, cambios para V2
- **DEPRECAR** — reemplazar; mantener hasta cutover
- **MANTENER TEMPORALMENTE** — coexistencia explícita en migración
- **ELIMINAR EN ETAPA FUTURA** — borrar tras cutover verificado

| Componente / artefacto | Clasificación | Notas |
|------------------------|---------------|-------|
| `enqueueWelcomeCardAfterPaid` | **DEPRECAR** | Sustituir por hook opcional a participant-cards post-legal |
| `processWelcomeCardById` / `processDueWelcomeCards` | **DEPRECAR** | Reemplazado por `getOrGenerate` + cron cleanup V2 |
| `DnxWelcomeCard` model | **MANTENER TEMPORALMENTE** | Marcar filas `LEGACY`; no borrar datos históricos |
| `DnxMediaAsset` WELCOME_CARD_* | **MANTENER TEMPORALMENTE** | Lectura hasta migración UI |
| `lib/welcome-card/storage.ts` (R2 uuid keys) | **DEPRECAR** | V2 usa `participant-card-asset-store` + keys determinísticas |
| `@repo/media-composition` CLICKATON_WELCOME_STORY | **DEPRECAR** | Paridad visual en `@repo/template-engine/clickaton-presets` |
| `WelcomeCardShareCard` / `WelcomeCardShareActions` | **MANTENER TEMPORALMENTE** | Hasta Mi inscripción lea V2 welcome |
| `/api/public/.../welcome-card` route | **MANTENER TEMPORALMENTE** | Proxy legacy autenticado |
| `/api/cron/welcome-cards` | **DEPRECAR** | Sustituir por worker/cron V2 o eliminar auto-gen legacy |
| Admin welcome actions (regenerate, approve, crop) | **ADAPTAR** | Moderación/crop puede no aplicar a V2; replantear en admin panel V2 |
| `ClickatonIntegrationOutboxEvent` WELCOME_CARD_PENDING | **DEPRECAR** | Outbox no usado en V2 on-demand |
| `ClickatonRegistration.welcomeCard*` fields | **MANTENER TEMPORALMENTE** | Denormalización legacy; sync opcional en migración |
| Social publish (`updateWelcomePublishAssets`) | **ADAPTAR** | Etapa 9; apuntar a asset V2 cuando exista |
| Foto crop en registration | **ADAPTAR** | Legacy lo usa; V2 hoy no — evaluar paridad |
| `ParticipantCardsSection` | **REUTILIZAR** | UI target participante |
| `getOrGenerateClickatonParticipantCard` | **REUTILIZAR** | Orquestación target |
| `@repo/template-engine/clickaton-presets` | **REUTILIZAR** | Fuente de verdad plantillas |
| `@repo/template-engine-renderer` | **REUTILIZAR** | Motor PNG target |
| `ClickatonParticipantCard` + PARTICIPANT_CARD_PNG | **REUTILIZAR** | Persistencia target |

---

## Fuente de verdad futura

| Capa | Target |
|------|--------|
| Plantillas | `@repo/template-engine/clickaton-presets` (`CLICKATON_WELCOME_STORY_V1`, `CLICKATON_MEMBER_STORY_V1`) |
| Render | `template-engine-renderer:1` (Playwright; prod vía worker remoto) |
| Persistencia | `ClickatonParticipantCard` + R2 `clickaton/participant-cards/…` |
| API participante | `/api/account/registrations/[id]/cards/[cardType]` |
| Hash | `computeClickatonParticipantCardRenderHash` |

---

## Plan de migración (no destructivo)

### Fase 0 — Etapa 08 (actual)

- [x] Persistencia V2 live (get-or-generate, R2, hash)
- [x] UI dual: legacy + `ParticipantCardsSection`
- [ ] Etiquetar en DB/docs registros legacy vs `TEMPLATE_ENGINE` (campo futuro o convención `templateId`)

### Fase 1 — Paridad y lectura

- Comparar visual legacy Sharp vs V2 Playwright (misma foto, mismos datos)
- Opción: servir welcome V2 desde `ParticipantCardsSection` manteniendo fallback legacy si `welcomeCardStatus === GENERATED` y V2 `NOT_GENERATED`
- Feature flag `CLICKATON_CARD_UI_SOURCE=legacy|v2|dual`

### Fase 2 — Escritura

- Dejar de llamar `enqueueWelcomeCardAfterPaid` tras revisión legal (flag)
- Opcional: al pagar, pre-warm V2 welcome vía job async (misma idempotencia hash)
- Cron welcome-cards → solo drenaje cola legacy existente

### Fase 3 — Cutover UI

- `WelcomeCardShareCard` → redirect lógico a V2 o componente unificado
- Admin: retirar acciones crop/regenerate legacy cuando V2 cubra moderación

### Fase 4 — Limpieza (etapa futura)

- **ELIMINAR** cron legacy, outbox event type, media-composition path Clickatón
- Retener `DnxWelcomeCard` / assets históicos read-only o archivar
- Migración batch opcional: re-render legacy → V2 solo si negocio lo exige

**Principio:** en cada fase se puede volver a legacy; no borrar assets ni filas hasta verificación en staging.

---

## Marcado LEGACY vs TEMPLATE_ENGINE

Propuesta operativa (sin migración DB obligatoria en Etapa 08):

| Señal | LEGACY | TEMPLATE_ENGINE |
|-------|--------|-----------------|
| Tabla principal | `DnxWelcomeCard` | `ClickatonParticipantCard` |
| Asset kind | `WELCOME_CARD_PNG` / `WEBP` | `PARTICIPANT_CARD_PNG` |
| template id/key | `clickaton.welcome.story` | `CLICKATON_WELCOME_STORY_V1` |
| UI Mi cuenta | `WelcomeCardShareCard` | `ParticipantCardsSection` |

Documentar en runbooks ops cuál pipeline consultar para incidencias.

---

## Referencias cruzadas

- Persistencia V2: [`clickaton-participant-cards-persistence.md`](./clickaton-participant-cards-persistence.md)
- HTTP / elegibilidad V2: [`clickaton-participant-cards-integration.md`](./clickaton-participant-cards-integration.md)
- Legal: [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md)
- Plantillas compartidas: [`../template-engine/clickaton-initial-templates.md`](../template-engine/clickaton-initial-templates.md)
