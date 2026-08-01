# Clickatón — Placas de participante (Template V2, on-demand)

**Etapa:** 07 — Integración, contratos HTTP y pruebas · **08 — Persistencia live**  
**Fecha:** 2026-08-01  
**Código:** `apps/clickaton/lib/participant-cards/`  
**UI participante:** `components/account/ParticipantCardsSection.tsx`  
**UI admin:** `components/admin/registrations/AdminParticipantCardsPanel.tsx`

---

## Etapa 08 — Persistencia activa

Desde Etapa 08, las placas usan **get-or-generate con persistencia**:

- Registro DB `ClickatonParticipantCard` + asset `DnxMediaAsset` (`PARTICIPANT_CARD_PNG`)
- PNG en R2 con clave determinística por `renderHash`
- Caché **HIT** / **MISS** / **REGENERATED** (`X-Clickaton-Card-Cache`)
- Idempotencia `unique(registrationId, cardType, renderHash)` + lock **GENERATING** (TTL 120 s)

Documentación completa: **[`clickaton-participant-cards-persistence.md`](./clickaton-participant-cards-persistence.md)**.

Pipeline legacy (`DnxWelcomeCard` / Sharp): **[`clickaton-welcome-card-pipeline-audit.md`](./clickaton-welcome-card-pipeline-audit.md)** — coexistencia; V2 es fuente de verdad futura.

---

## Resumen

Generación **bajo demanda** de placas PNG (1080×1920, Instagram Story) para participantes confirmados. Dos tipos: **welcome** (bienvenida) y **member** (soy parte). Cada solicitud pasa por **`getOrGenerateClickatonParticipantCard`**: si el `renderHash` coincide con un registro **READY**, se sirven bytes desde R2/DB (**HIT**); si no, se renderiza con Playwright Chromium vía `@repo/template-engine-renderer`, se persiste y se devuelve (**MISS**). Admin puede forzar regeneración con `?force=1`. Las plantillas viven como presets en `@repo/template-engine/clickaton-presets` (re-export en `participant-card-presets.ts`).

---

## Modelos auditados (`ClickatonRegistration`)

Campos leídos por `REGISTRATION_SELECT` en `participant-card-service.ts`:

| Campo | Uso en placas |
|-------|----------------|
| `id` | Identificador de ruta / filename fallback |
| `userId`, `email` | Autorización (ownership) |
| `firstName`, `lastName` | Nombre en placa |
| `city`, `province`, `country` | Ciudad / metadata |
| `instagramHandle`, `instagramHandleNormalized` | Handle en placa |
| `profilePhotoAssetId`, `profilePhotoStatus` | Foto (requerida en modo final participante) |
| `visibleCode`, `sequenceNumber` | Número de participante |
| `status`, `paymentStatus` | Elegibilidad |
| `imageUsageConsent`, `socialPublicationConsent` | Consent proxy (solo `imageUsage*` + términos en gate) |
| `consentAcceptedAt`, `acceptedImageAt`, `acceptedTermsAt`, `termsAcceptedAt`, `termsVersion` | Proxy de consentimiento / auditoría |
| Relación `ticketType.name` | Categoría |
| Relación `edition.*` | Nombre, slug, ciudad, fecha, timezone, cover |
| Relación `venue.name`, `venue.city` | Sede / ciudad fallback |

---

## Tabla de mapeo — variables de plantilla

Origen real vía `buildClickatonParticipantTemplateData()` (`participant-card-data.ts`).

| VARIABLE TEMPLATE | ORIGEN REAL | CAMPO | OBLIGATORIO | FALLBACK | RIESGO |
|-------------------|-------------|-------|-------------|----------|--------|
| `participant.fullName` | Nombre compuesto | `firstName` + `lastName` | Sí (elegibilidad) | — | Bloqueo si vacío |
| `participant.displayName` | Uppercase de fullName | derivado | No | `""` | Bajo |
| `participant.firstName` | Directo | `firstName` | Sí (indirecto) | trim | Bajo |
| `participant.lastName` | Directo | `lastName` | Sí (indirecto) | trim | Bajo |
| `participant.instagramHandle` | Normalizado `@handle` | `instagramHandle` / `instagramHandleNormalized` | No | `""` | Warning `INSTAGRAM_MISSING` |
| `participant.instagram` | Handle sin `@` | mismo | No | `""` | Idem |
| `participant.numberFormatted` | Padded 4 dígitos | `sequenceNumber` o dígitos de `visibleCode` | No | `""` | Placa sin número visible |
| `participant.number` | Numérico | `sequenceNumber` o parse `visibleCode` | No | `null` | Idem |
| `participant.photoUrl` / `participant.photo` | Data URL desde asset | `profilePhotoAssetId` → R2/local | Sí (participante final) | Placeholder admin/preview | 422 participante; placeholder admin |
| `participant.city` | Cascada ciudad | `city` → `venue.city` → `edition.city` | No | `""` | Campo vacío en Member |
| `participant.province` | Directo | `province` | No | `""` | Bajo |
| `participant.country` | Directo | `country` | Sí (schema) | — | Bajo |
| `participant.category` | Tipo de entrada | `ticketType.name` | No | — | Texto genérico |
| `edition.name` | Directo | `edition.name` | Sí (implícito) | — | Bajo |
| `edition.eventDate` | ISO date | `edition.startAt` | Sí welcome (final) | `""` | Bloqueo welcome; warning member |
| `edition.eventDateFormatted` | `formatDateDayMonthUppercase` | `edition.startAt` + `edition.timezone` | Sí welcome (final) | `""` | Idem |
| `edition.city`, `edition.venue`, `edition.slug` | Directos / fallback | `edition.*`, `venue.*` | No | `""` | Metadata incompleta |
| `edition.registrationDate` | Formato corto | `termsAcceptedAt` | No | `""` | Bajo |
| `edition.coverImageUrl` | Directo | `edition.coverImageUrl` | No | `""` | No usado en presets actuales |
| `event.name`, `event.date`, `event.dateFormatted`, `event.city`, `event.venue` | Duplicados de edición | `edition` + `venue` | No | `""` | Compatibilidad plugin |
| `branding.logoUrl` / `branding.logo` | URL absoluta app | `NEXT_PUBLIC_CLICKATON_URL` + path logo | No | path relativo | Logo roto si base URL ausente en prod |
| `branding.name`, colores | Constantes | hardcoded Clickatón | No | — | Bajo |
| `card.message` | Constante en mapper | string fija en `participant-card-data.ts` | No | fallback en preset Member | Bajo |

Bloques TEXT con placeholders `{participant.category} · {participant.city}` y `{edition.name}\n{edition.eventDateFormatted}` se resuelven en el motor de plantillas (no son `VARIABLE_TEXT`).

---

## Reglas de elegibilidad

Implementación: `evaluateClickatonCardEligibility()` (`participant-card-eligibility.ts`).

### Bloqueos duros (participante, modo `final`)

- Nombre vacío (`firstName` y `lastName` sin contenido).
- `status` en `CANCELLED`, `REFUNDED`, `DISQUALIFIED`, `DRAFT`, `PENDING_PAYMENT`.
- `status !== CONFIRMED` (salvo admin preview).
- `paymentStatus` no en `APPROVED` | `NOT_REQUIRED` (salvo `MANUAL_REVIEW` en admin preview).
- Placa **welcome** sin `edition.startAt`.
- Sin consent proxy (participante final).
- Sin foto de perfil resoluble (participante final).

### Warnings (no bloquean en admin preview)

| Código | Condición |
|--------|-----------|
| `PAYMENT_MANUAL_REVIEW` | Estado/pago no confirmado en preview admin |
| `CONSENT_MISSING` | Sin proxy de consentimiento |
| `PHOTO_PLACEHOLDER` | Sin foto; se usa fixture |
| `EVENT_DATE_MISSING` | Sin `startAt` (member permite con warning) |
| `INSTAGRAM_MISSING` | Sin handle Instagram |

### Admin preview

- `mode=preview` (default en ruta admin) permite generar con warnings y placeholder de foto.
- Diagnóstico JSON incluye `eligibility` y `warnings`.

---

## Consent proxy

No existe flag `cardConsent`. Gate en `hasClickatonCardConsent()`:

- `imageUsageConsent === true`, **o**
- `acceptedImageAt != null`, **o**
- `termsAcceptedAt != null`, **o**
- `acceptedTermsAt != null`

`socialPublicationConsent` **no** participa en el gate de generación (solo publicación social futura). Ver `clickaton-participant-cards-legal-gap.md`.

---

## Endpoints HTTP

### Participante

```
GET /api/account/registrations/[registrationId]/cards/[cardType]
```

| Parámetro | Valores | Default participante |
|-----------|---------|----------------------|
| `cardType` | `welcome`, `member`, alias `bienvenida`, `soy-parte`, `miembro` | — |
| `disposition` | `inline`, `attachment` | `attachment` |
| `mode` | `preview`, `final` | `final` |

**Autorización:** sesión Clickatón (`getClickatonAuthUser`). Ownership por `userId` o email normalizado. Inscripción ajena → **404** (no revelar existencia).

**Respuesta éxito:** `image/png` con headers:

- `Content-Disposition`, `Cache-Control: private, no-store`, `ETag`
- `X-Clickaton-Card-Type`, `X-Clickaton-Registration-Id`, `X-Clickaton-Card-Width`, `X-Clickaton-Card-Height`, `X-Clickaton-Card-Duration-Ms`
- `X-Clickaton-Card-Cache` (`HIT` \| `MISS` \| `REGENERATED`), `X-Clickaton-Card-Hash` (prefijo 12 chars)
- `X-Clickaton-Card-Generated-At` (si persistido)

**Condicional:** `If-None-Match` + caché **HIT** → **304** sin cuerpo.

**Status (sin bytes):** `GET …/cards/[cardType]/status` → `{ status, renderHashPrefix, generatedAt }`.

### Admin

```
GET /api/admin/registrations/[registrationId]/cards/[cardType]
```

Mismos query params. Defaults admin: `mode=preview`, `disposition=inline`.

**Autorización:** sesión + `hasClickatonAdminAccess`. Sin sesión → **401**. Sin rol admin → **403**.

**Diagnóstico:** header `Accept: application/json` → JSON con `imageBase64`, `eligibility`, `warnings`, `sourceSummary`, `durationMs` (solo actor admin).

---

## UI participante — «Mis placas»

- Ruta: `/mi-cuenta/inscripciones/[id]`
- Componente: `ParticipantCardsSection`
- Estados UI: `available`, `missing_photo`, `missing_consent`, `not_confirmed`, `error`
- Acciones: Vista previa, Descargar PNG, Compartir (Web Share API + fallback descarga)
- Test IDs: `clickaton-card-welcome-preview`, `clickaton-card-member-preview`, `clickaton-card-preview-dialog`, `clickaton-card-preview-image`, `clickaton-card-preview-error`

---

## UI admin

- Ruta: `/admin/inscripciones/[registrationId]`
- Panel: `AdminParticipantCardsPanel` (`data-testid="admin-participant-cards"`)
- Acciones: preview/descarga welcome y member, **Ver diagnóstico** (JSON)
- Muestra metadata: consent proxy, elegibilidad por tipo, foto, Instagram, número

---

## Descarga y compartir

| Actor | Descarga | Compartir |
|-------|----------|-----------|
| Participante | `disposition=attachment` → filename `clickaton-bienvenida-NNNN.png` / `clickaton-soy-parte-NNNN.png` | Web Share con archivo PNG; fallback descarga |
| Admin | Igual vía botones del panel | No expuesto en UI admin |

Filename: `buildParticipantCardFilename()` + `sanitizeParticipantCardFilenamePart()`.

---

## Errores (JSON)

| Código | HTTP | Cuándo |
|--------|------|--------|
| `CLICKATON_CARD_UNAUTHORIZED` | 401 | Sin sesión |
| `CLICKATON_CARD_FORBIDDEN` | 403 | Admin sin permisos |
| `CLICKATON_CARD_NOT_FOUND` | 404 | Inscripción inexistente o no propia (participante) |
| `CLICKATON_CARD_NOT_ELIGIBLE` | 409 | Estado/pago/nombre no permitido |
| `CLICKATON_CARD_PHOTO_REQUIRED` | 422 | Foto requerida |
| `CLICKATON_CARD_CONSENT_REQUIRED` | 422 | Consent proxy ausente |
| `CLICKATON_CARD_REGISTRATION_INVALID` | 422 | Datos/registro inválidos (p. ej. foto ilegible) |
| `CLICKATON_CARD_TEMPLATE_INVALID` | 422 | Tipo de placa inválido o plantilla rota |
| `CLICKATON_CARD_RATE_LIMITED` | 429 | Rate limit (+ header `Retry-After`) |
| `CLICKATON_CARD_RENDER_UNAVAILABLE` | 503 | Chromium ocupado / no disponible |
| `CLICKATON_CARD_RENDER_FAILED` | 500 | Error de render genérico |

Cuerpo error: `{ ok: false, error: string, code: string }`.

---

## Rate limit

In-memory por instancia serverless (`participant-card-rate-limit.ts`):

| Actor | Límite | Ventana |
|-------|--------|---------|
| Participante | 5 req | 60 s |
| Admin | 10 req | 60 s |

Clave: `userId` preferido, fallback email normalizado. **Solo aplica en MISS/REGENERATED** (antes de Chromium); **HIT** desde R2 no consume cupo. **Nota:** en Vercel multi-instancia el límite es por lambda, no global; la idempotencia DB es la protección primaria de concurrencia.

---

## Métricas

Agregadas en proceso (`participant-card-metrics.ts`), sin PII:

- `attempts`, `successes`, `errors`, `renderFailures`, `rateLimited`, `lastDurationMs`
- `errorsByCode`, `byCardType`, `byActorKind`

Expuestas vía `getParticipantCardMetricsSnapshot()` para logs/diagnóstico interno (no endpoint público en Etapa 07).

---

## Infraestructura de render y persistencia

```
Preset (@repo/template-engine/clickaton-presets)
  → getOrGenerateClickatonParticipantCard
       ├─ HIT: load R2 / DnxMediaAsset
       └─ MISS: instantiatePresetPayload()
            → resolveTemplateDocument (clickatonTemplateVariablesPlugin)
            → ParticipantCardRenderProvider.render()
                 └── LocalPlaywright → renderTemplatePreviewPng
            → R2 put + ClickatonParticipantCard READY + DnxMediaAsset
```

- Runtime ruta: `nodejs`, `maxDuration: 60`
- Provider: `CLICKATON_CARD_RENDER_PROVIDER` = `local` \| `remote` \| `unavailable` (ver [`clickaton-participant-cards-persistence.md`](./clickaton-participant-cards-persistence.md))
- Formato canvas: 1080×1920 px

---

## Limitaciones conocidas

1. **Render remoto no cableado:** `remote` responde 503 hasta conectar worker Chromium (Opción A prod).
2. **Sin auto-generación al pago en V2:** el legacy `welcome-card` sigue encolando al PAID; V2 es on-demand HTTP.
3. **Vercel sin Chromium:** provider `unavailable` → 503 en MISS; HIT sigue sirviendo placas ya persistidas.
4. **Rate limit local:** no distribuido entre instancias (HIT no afectado).
5. **Logo branding:** requiere `NEXT_PUBLIC_CLICKATON_URL` (o equivalentes) para URL absoluta en render remoto.
6. **Member template:** no tiene cláusula legal específica aparte de welcome (ver doc legal gap).
7. **Brecha legal:** persistencia no habilita go-live público completo — ver [`clickaton-participant-cards-legal-gap.md`](./clickaton-participant-cards-legal-gap.md).

---

## Pruebas

| Tipo | Comando |
|------|---------|
| Unit / contrato HTTP | `pnpm --filter clickaton test:clickaton-participant-cards` |
| E2E placas (opt-in) | `CLICKATON_E2E_PARTICIPANT_CARDS=1 pnpm --filter clickaton test:e2e:clickaton-participant-cards` |

Variables E2E: ver cabecera de `e2e/participant-cards.spec.ts` y `e2e/admin-participant-cards.spec.ts`.

---

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `lib/participant-cards/participant-card-persistence.ts` | get-or-generate, force, cleanup |
| `lib/participant-cards/participant-card-http.ts` | Parse query + respuestas HTTP + ETag |
| `lib/participant-cards/participant-card-renderer.ts` | Bridge template engine |
| `lib/participant-cards/participant-card-hash.ts` | SHA-256 renderHash |
| `lib/participant-cards/participant-card-asset-store.ts` | R2 / local / inline |
| `app/api/account/.../cards/[cardType]/route.ts` | API participante |
| `app/api/admin/.../cards/[cardType]/route.ts` | API admin |
| `docs/clickaton/clickaton-participant-cards-persistence.md` | Persistencia Etapa 08 |
