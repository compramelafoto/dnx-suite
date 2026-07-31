# Clickatón — Cronograma y experiencia del participante (Etapa 10)

**Fecha:** 2026-07-28  
**Edición:** Clickatón Argentina 2026 — 19/09/2026 — TZ `America/Argentina/Cordoba`  
**Alcance:** motor temporal + consignas secretas + dashboard/confirmación; sin carga/juzgamiento completo.

---

## 1. Arquitectura encontrada (preflight)

| Área | Estado previo | Estado Etapa 10 |
|---|---|---|
| Fechas edición | Planas (`startAt`, `registrationOpenAt`, …) | Conservadas; timeline versionable es fuente operativa |
| Motor versionable | Ausente | `ClickatonEditionTimeline` + events |
| Consignas persistidas | Ausente | `ClickatonPrompt` + DTOs seguros |
| Dashboard participante | Parcial (`/mi-cuenta` + QR) | Dashboard por inscripción con timeline/prompts |
| Confirmación pago | Básica (`PaymentReturnView`) | Confirmación enriquecida; no PAID por redirect |
| Reloj centralizado | Solo payments `Clock` | `EditionClock` + `serverNow` |
| Caché pública | `/maratones` con `revalidate=60` | APIs consignas `private, no-store`; hitos públicos sin secretos |

**Decisión:** dominio en `apps/clickaton/lib/timeline` (no `@repo/event-timeline` todavía).

---

## 2. Motor de cronograma

Modelos Prisma:

- `ClickatonEditionTimeline` (DRAFT / ACTIVE / SUPERSEDED / CANCELLED)
- `ClickatonTimelineEvent` (REGISTRATION_*, PROMPT_RELEASE, UPLOAD_*, …)
- `ClickatonPrompt` (secreto server-only hasta RELEASED)
- `ClickatonTimelineAudit`
- `ClickatonEditionCapabilityGrant` (`canManageEditionTimeline`, `canReleaseEditionPrompts`)

Migración: `packages/db/prisma/migrations/20260728100000_clickaton_timeline_prompts/`

Servicios:

- `getEditionNow` / `EditionClock` (`clock.ts`)
- `getTimelineState` → `getEditionTemporalState` / `buildEditionTemporalState`
- `isEventOpen` / `isEventClosed` / `getNextEvent` / `getCountdown`
- `canRevealPrompt` / `canUpload` / `canCheckIn`
- `shiftFutureEvents` + `shiftFutureEventsAsNewVersion` (nueva DRAFT)

Reglas:

- ACTIVE inmutable → cambios = nueva versión DRAFT → activar supersede
- Eventos ya ejecutados / consignas RELEASED no se reescriben al desplazar
- UTC en DB; display con timezone de edición
- Reloj inyectable (`fixedClock` / `mutableClock`)

---

## 3. Consignas secretas

DTOs públicos separados (`types.ts` + `prompt-dto.ts`):

- `LockedPromptPublicDto` — sequence, LOCKED, opensAt?, serverNow, message
- `ReleasedPromptPublicDto` — título/instrucciones/assets solo tras apertura
- `ClosedPromptPublicDto` — estado cerrado

Prohibido: CSS hide, payload completo omitido visualmente, ISR con contenido futuro, assets públicos predecibles.

`assertLockedDtoIsSafe` falla si aparecen keys `title` / `instructions` / `assets`.

---

## 4. APIs públicas

| Ruta | Uso |
|---|---|
| `GET /api/public/editions/[slug]/timeline` | Hitos públicos + serverNow |
| `GET /api/public/editions/[slug]/prompts` | DTOs seguros; PAID/CONFIRMED para privados |
| `GET /api/public/editions/[slug]/now` | `{ serverNow, timezone }` |

Cache: `force-dynamic` + `Cache-Control: private, no-store`.

---

## 5. Admin

- `/admin/ediciones/[editionId]/cronograma` — DRAFT, activar, shift, pausa, auditoría
- `/admin/ediciones/[editionId]/consignas` — CRUD mínimo, liberar, vista segura LOCKED

Permisos: grants + allowlist admin Clickatón (no solo email en actions).

---

## 6. Experiencia participante

- Página edición: hitos del timeline ACTIVE (o “horario a confirmar”)
- Wizard: sin reescritura (ya funcional)
- Confirmación postpago: mensaje oficial solo si `displayAsApproved` del backend
- Dashboard `/mi-cuenta/inscripciones/[id]`: inscripción, perfil, kit, evento, FotoRank, consignas seguras, QR

---

## 7. Notificaciones y Social Publisher

- Intents durables vía `ClickatonTimelineAudit` (`NOTIFY_INTENT_*`); sin WhatsApp LIVE
- Al desplazar: cancelar futuros + reprogramar en DRAFT
- `social-guard.ts`: no publicar entity PROMPT ni caption con título/instrucciones

---

## 8. FotoRank

Clickatón es fuente de verdad temporal. FotoRank consume sync postpago existente; ventanas/prompts se expondrán por snapshot/API en etapas posteriores (sin duplicar motor).

---

## 9. Seed Argentina 2026

- timezone → `America/Argentina/Cordoba`
- timeline DRAFT con eventos base **sin** `startsAt`
- 3 prompts DRAFT vacíos (sin textos reales)
- grants timeline/release a Daniel (+ Tammy/Rodrigo si existen users)
- sync OFF, registration OFF, timeline **no** ACTIVE

---

## 10. Tests

```bash
pnpm --filter clickaton selfcheck:timeline
```

---

## 11. Pendientes

- **Etapa 11 (hecha):** upload por consigna + EXIF/GPS + entry FR — ver `CLICKATON_PHOTO_UPLOAD_EXIF_GPS.md`
- **Etapa 12 (hecha):** acreditación presencial / QR / check-in / kit — ver `CLICKATON_ACCREDITATION_AND_CHECKIN.md` (`ACCREDITATION_OPEN` + `ACCREDITATION_CLOSE`; ops LIVE off por defecto)
- **Etapa 13 (hecha):** admisión técnica / batch / freeze — ver `CLICKATON_TECHNICAL_ADMISSION.md` (`JUDGING_OPEN`/`CLOSE`; sin scores LIVE)
- **Etapa 14 (hecha):** jurado / rúbricas / scoring anónimo — ver `CLICKATON_JURY_SCORING.md` (sesión DRAFT/OFF por defecto)
- **Etapa 15 (hecha):** ranking privado / desempates / batch — ver `CLICKATON_RANKING_AND_RESULTS.md` (`RESULTS_RELEASE` no publica automáticamente)
- Ranking / desempates / resultados (Etapa 15)
- Notificaciones push/WhatsApp gated por timeline
- Extracción a `@repo/event-timeline` si un segundo producto lo necesita
- UI avanzada de contingencia (extender ventanas con preview rich)
