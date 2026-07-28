# Sistema de perfil social y placas de bienvenida (Etapa 8)

**Fecha:** 2026-07-28  
**Paquete reutilizable:** `@repo/media-composition`  
**Dueño de datos:** Clickatón  
**Consumidor:** FotoRank (solo referencias)  
**Publicación:** Etapa 9 — ver `docs/social-publisher/DNX_SOCIAL_PUBLISHER.md`  
(tras PAID se crea `PublishRequest` en `PENDING_APPROVAL`; dry-run por defecto; LIVE off)

---

## Nota Etapa 9

Al confirmarse el pago, Clickatón solicita publicación al DNX Social Publisher (`PENDING_APPROVAL`). La placa generada actualiza el asset. El cron solo publica si hay aprobación humana y `DNX_SOCIAL_PUBLISHER_LIVE=true`.

---

## 1. Arquitectura

```
Wizard público
  → upload foto (API) → DnxMediaAsset (profile variants)
  → create registration (Instagram + consents + photoId)
Checkout / webhook PAID
  → enqueue CLICKATON_WELCOME_CARD_PENDING (soft-fail)
Cron /admin retry
  → @repo/media-composition.renderComposition
  → PNG + WEBP → DnxMediaAsset
  → DnxWelcomeCard.status = GENERATED
  → soft refs en Registration + FotorankContestParticipant
```

Regla central: **si el render falla, la inscripción sigue PAID**.

---

## 2. Perfil social (obligatorio pre-pago)

| Campo | Notas |
|---|---|
| `instagramHandle` / `Normalized` / `Url` | Normalización en `@repo/media-composition` (sin `@`, lowercase) |
| `profilePhotoAssetId` | Asset cuadrado primario |
| `profilePhotoSource` | Solo `USER_UPLOAD` en esta etapa |
| `profilePhotoStatus` | `PENDING` / `READY` / `REJECTED` |
| Crop | `cropX/Y`, `zoom`, `rotation`, `boundingBox` — original intacto |
| Consents | `imageUsageConsent` + `socialPublicationConsent` + `consentVersion` + `acceptedAt` |

Validación foto (servidor): JPG/PNG/WEBP, peso máx 8MB, mín 400×400. Derivados: original, thumbnail, square, storyCrop.

Recorte: boundingBox FACE (si admin/manual) → Sharp `attention` → centro.

---

## 3. Plantillas (`@repo/media-composition`)

- Layout tipado: bloques `text` / `image` / `rect`
- Variables `{{participantName}}`, `{{instagram}}`, `{{participantNumber}}`, `{{city}}`, `{{editionName}}`, `{{editionDate}}`, …
- Plantilla oficial: `clickaton.welcome.story` — **1080×1920**, frase “¡Bienvenido a Clickatón!”
- Nuevas placas = nueva entrada en registry, sin hardcode en Clickatón

---

## 4. Render y versionado

Cada generación guarda:

- `templateId` + `templateVersion`
- `rendererVersion` (`RENDERER_VERSION`)
- `contentHash`, `inputHash`
- `generatedAt`, dimensiones, assets PNG/WEBP

Cambio de plantilla **no** regenera históricas. Regeneración solo:

- admin fuerza, o
- cambian inputs (foto/crop/datos) → distinto `inputHash`

---

## 5. Workers / outbox

- Evento: `CLICKATON_WELCOME_CARD_PENDING`
- Cron: `/api/cron/welcome-cards` (*/5)
- Estados placa: `PENDING` → `GENERATED` / `FAILED` → admin `APPROVED` / `REJECTED`
- Publicación (prep Etapa 9): `publicationStatus`, `scheduledAt`, `publishedAt`, `metaMediaId`, `instagramPostId`, `publicationError` — **sin publicar**

---

## 6. Storage (R2)

| Entorno | Backend |
|---|---|
| Prod (R2 env completo) | R2 |
| Local | `public/uploads/clickaton/...` |
| Tests | memoria |

Keys: `clickaton/profile/...`, `clickaton/welcome/...`.

---

## 7. FotoRank

Sync Etapa 7 ampliada: copia `instagramHandle`, `profilePhotoAssetId`, `welcomeCardAssetId`, `welcomeCardStatus`.

FotoRank **no** genera la placa.

---

## 8. Panel admin

- Detalle inscripción: preview, regenerar, aprobar/rechazar, crop/foto, descargas PNG/WEBP
- Listado + CSV: Instagram, foto, estado bienvenida, publicación, URL placa
- Filtros por estado (vía listado/acciones)

---

## 9. Tests

- Paquete: `pnpm --filter @repo/media-composition test` (6)
- Clickatón: `pnpm --filter clickaton selfcheck:welcome-card`
- Lint + typecheck Clickatón OK

---

## 10. Pendientes

- OAuth Meta real + conectar cuenta IG (ops)
- Habilitar `DNX_SOCIAL_PUBLISHER_LIVE` solo con cuenta validada
- `INSTAGRAM_IMPORT` de foto
- Detector facial dedicado (hoy attention/center)
- Editor visual de plantillas
- UI FotoRank para mostrar placa del participante
