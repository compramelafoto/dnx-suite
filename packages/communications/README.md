# @repo/communications — DNX Communications

Paquete compartido de comunicaciones multi-canal de la DNX Suite.

**Etapa 03 / Implementación 07 — Resend Webhook Staging Activation.**
Endpoint temporal + `verify_only` + filtro server-side de eventos técnicos + readiness/migración protegida. Opens/clicks **no se persisten**.

> Guía operativa: `docs/clickaton/RESEND_WEBHOOK_STAGING_ACTIVATION_IMP07.md`

---

## Propósito

```ts
const rendered = await communications.render({
  templateId: "system.test",
  brandId: "clickaton",
  locale: "es-AR",
  data: { recipientName: "Usuario de prueba", message: "…" },
});

await communications.send({
  channel: "email",
  to: [{ email: "test@example.com" }],
  from: { email: "noreply@example.com", name: "Clickatón" },
  subject: rendered.subject,
  html: rendered.html,
  text: rendered.text,
});
```

---

## Arquitectura Resend (SDK fuera del dominio)

```text
SDK oficial `resend`
        ↓
ResendSdkClientAdapter  (@repo/communications/email/resend-sdk)
        ↓
ResendClientLike
        ↓
ResendProvider
        ↓
createResendEmailRuntime  (@repo/communications/email/resend-runtime)
        ↓
communications.send()
```

- El **entrypoint raíz** no exporta el SDK ni `createResendEmailRuntime`.
- El dominio / Template Engine / registry **no importan** `resend`.
- El SDK solo se carga al usar subpaths `email/resend-runtime`, `email/resend-sdk` o `tracking/resend` (verifier).

### Dependencia

- `resend@^6.9.1` en `packages/communications` (misma línea que ComprameLaFoto).
- No es peerDependency: el script smoke vive en este package.

---

## Arquitectura de tracking (webhooks)

```text
Resend
→ POST /api/webhooks/resend  (Clickatón — TEMPORARY_WEBHOOK_HOST)
→ body crudo + headers svix-*
→ ResendWebhookProcessor (@repo/communications)
→ verificación oficial / parse / normalize
→ CommunicationWebhookReceiptRepository (unique durable)
→ verify_only: persist VERIFIED (sin efectos de negocio)
→ HTTP mínimo { received, status }
```

**Diferencia clave:** el dominio trabaja con `CommunicationTrackingEvent`, no con el objeto completo del SDK ni el payload crudo. El host solo traduce HTTP ↔ processor.

| Capa | Ubicación |
|------|-----------|
| Contratos / fake verifier / in-memory | `@repo/communications` / `tracking` |
| Persistencia (puertos + in-memory) | `@repo/communications/tracking/persistence` |
| Adapter Resend (parser, processor, verifier SDK) | `@repo/communications/tracking/resend` |
| Adapter Prisma + route HTTP | `apps/clickaton` (temporal) |
| Modelo durable | `@repo/db` → `DnxCommunicationWebhookEvent` |

### Host

| Campo | Valor |
|-------|-------|
| Estado | `TEMPORARY_WEBHOOK_HOST` |
| App | Clickatón |
| Runtime | Node.js (`export const runtime = "nodejs"`) |
| URL staging | `https://clickaton-staging.vercel.app/api/webhooks/resend` |
| URL prod (prevista) | `https://maratonfotografica.com/api/webhooks/resend` |
| Canónico futuro | App/servicio DNX Communications (inexistente) — misma path relativa |

**Por qué Clickatón:** mismo patrón que `/api/webhooks/dnx-payments` (raw body + nodejs), dominio staging/prod estable, sin acoplar a CLF email marketing. Migración posterior: mover route + adapter Prisma sin cambiar contrato externo (secret + path + Svix).

### Eventos externos soportados (Resend email.*)

`email.sent` · `email.delivered` · `email.delivery_delayed` · `email.bounced` · `email.complained` · `email.opened` · `email.clicked` · `email.failed` · `email.suppressed`

Otros eventos del proveedor (`email.scheduled`, `email.received`, `domain.*`, `contact.*`) → **`ignored`** con `rawEventType` sanitizado. No se finge un tipo interno.

### Mapping Resend → DNX

1:1 para los nueve eventos email.* listados arriba. Catálogo tipado: `COMMUNICATION_TRACKING_EVENT_TYPES`.

### Verificación de firma

- Abstracción: `WebhookSignatureVerifier`.
- Adapter real: `createResendSdkWebhookSignatureVerifier` — usa **`resend.webhooks.verify`** (Svix / `standardwebhooks`).
- Tests / smoke: `createFakeWebhookSignatureVerifier`.
- Secreto **inyectado** (`RESEND_WEBHOOK_SECRET`); no se lee en import time.
- La firma requiere **body crudo**. No parsear el body a objeto antes de verificar si el runtime del endpoint reescribe el stream.

> **Advertencia:** en un futuro endpoint HTTP, conservar `request.text()` / buffer crudo. Un `request.json()` prematuro puede invalidar la verificación.

### Feature flag + modos

```env
COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=false   # default — flag OFF → HTTP 404
COMMUNICATIONS_WEBHOOK_MODE=disabled          # default
```

| Combinación | HTTP |
|-------------|------|
| Flag OFF | **404** (no exponer endpoint) |
| Flag ON + `disabled` | **503** |
| Flag ON + `verify_only` | verifica + persiste `verified` / `ignored` — **sin** efectos de negocio |
| Flag ON + `process` | soportado técnicamente; **no habilitar** todavía |

### Deduplicación durable

- Clave: `(provider, providerEventId)` con `providerEventId = svix-id`.
- Unique constraint en Prisma `DnxCommunicationWebhookEvent`.
- Reserva atómica (`reserve`) con manejo de `P2002` → `duplicate`.
- Estados: `received` · `verified` · `processed` · `ignored` · `duplicate` · `failed`.
- `failed` permite retry (Resend reintenta con HTTP 500).
- In-memory: **solo tests**.

### Política HTTP

| Resultado | HTTP |
|-----------|-----:|
| processed / verify_only ok | 200 |
| ignored (evento no soportado) | 200 |
| duplicate | 200 |
| firma inválida / ausente / vencida | 401 |
| schema / vacío / oversized | 400 |
| flag OFF | 404 |
| mode disabled / misconfig | 503 |
| fallo temporal DB | 500 |

Body: `{ "received": true|false, "status"?: "…" }` — sin IDs, email ni errores internos.

### Persistencia (mínima)

Persiste: provider, event IDs, tipos, status, timestamps, email enmascarado, hash opcional (HMAC), host/path de link seguro, categoría de fallo, attempts.

**No** persiste: body crudo, firma, secreto, HTML, asunto, email completo, IP, UA, headers, query sensibles.

Opens/clicks: pueden guardarse como evento técnico (`productEffectsEnabled=false`); **no** alimentan producto.

Bounce/complaint: se preservan; `CommunicationDeliveryPolicyHandler` es stub (sin suppression list todavía).

### Logging y privacidad

Se puede loguear: requestId, provider, modo, tipo, resultado, duración, duplicado, código interno.

**No** loguear: firma, secreto, body, email completo, URL completa, IP, UA, headers completos.

### Ejemplo verify_only + recibo in-memory

```ts
import {
  createFakeWebhookSignatureVerifier,
  createInMemoryWebhookReceiptRepository,
} from "@repo/communications";
import { createResendWebhookProcessor } from "@repo/communications/tracking/resend";

const processor = createResendWebhookProcessor({
  verifier: createFakeWebhookSignatureVerifier({ valid: true }),
  receiptRepository: createInMemoryWebhookReceiptRepository(),
  mode: "verify_only",
});
```

---

## Variables de entorno

Ver `.env.example`:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=
RESEND_ALLOWED_RECIPIENTS=
COMMUNICATIONS_LIVE_SEND=false
COMMUNICATIONS_ENVIRONMENT=development

RESEND_WEBHOOK_SECRET=
COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=false
COMMUNICATIONS_WEBHOOK_MODE=disabled
COMMUNICATIONS_WEBHOOK_TOLERANCE_SECONDS=300
COMMUNICATIONS_WEBHOOK_MAX_BYTES=65536
COMMUNICATIONS_RECIPIENT_HASH_SECRET=
```

- La sola presencia de secretos **no** habilita envíos ni tracking.
- No se leen envs al importar módulos de dominio.

---

## Protecciones de live send

Deben cumplirse **todas**:

1. `RESEND_API_KEY`
2. `RESEND_FROM_EMAIL` + `RESEND_FROM_NAME` válidos
3. `COMMUNICATIONS_LIVE_SEND=true`
4. destinatario en `RESEND_ALLOWED_RECIPIENTS` (dirección exacta; sin wildcards)
5. CLI `--confirm-live-send`
6. provider con `dryRun: false` (lo aplica el runtime)

---

## Smoke scripts

### Email dry run

```bash
pnpm --filter @repo/communications smoke:resend -- \
  --to test@example.com --template system.test --brand clickaton
```

### Webhook fixtures (package, sin red)

```bash
pnpm --filter @repo/communications smoke:resend-webhook -- --event delivered
```

### Ingress HTTP local (Clickatón handler, sin servidor público)

```bash
pnpm --filter clickaton smoke:resend-webhook-ingress
pnpm --filter clickaton smoke:resend-webhook-ingress -- --duplicate
pnpm --filter clickaton smoke:resend-webhook-ingress -- --invalid-signature
pnpm --filter clickaton smoke:resend-webhook-ingress -- --unknown
pnpm --filter clickaton smoke:resend-webhook-ingress -- --db-fail
```

---

## Migración Prisma

Modelo: `DnxCommunicationWebhookEvent` en `@repo/db`.

```bash
# Generar client tras pull
pnpm --filter @repo/db db:generate

# Aplicar en local/staging (NUNCA prod sin autorización)
pnpm --filter @repo/db db:migrate:deploy
```

Migración: `packages/db/prisma/migrations/20260801120000_dnx_communication_webhook_events/`.
**No aplicada en producción por esta implementación.**

---

## STAGING ACTIVATION CHECKLIST

Ver guía completa: `docs/clickaton/RESEND_WEBHOOK_STAGING_ACTIVATION_IMP07.md`

- [ ] `pnpm --filter @repo/db communications:migrate:webhook-staging` (identity)
- [ ] Migración con `--confirm-staging-migration` solo si identity=staging
- [ ] `pnpm --filter clickaton communications:webhook:readiness` → READY / warnings
- [ ] Vars Fase C en Vercel `clickaton-staging`
- [ ] Allowlist técnica (sin opened/clicked) + filtro server-side
- [ ] Registro **manual** webhook en Resend (solo eventos técnicos)
- [ ] Smoke email autorizado + `communications:webhook:recent`
- [ ] Duplicado / logs / rollback
- [ ] `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION`

---

## ROLLBACK

1. `COMMUNICATIONS_RESEND_WEBHOOK_ENABLED=false` (404)
2. o `COMMUNICATIONS_WEBHOOK_MODE=disabled` (503)
3. Retirar webhook del dashboard Resend si estaba registrado
4. Mantener filas en `DnxCommunicationWebhookEvent` (no borrar)
5. **No** revertir migración de forma destructiva
6. Diagnosticar con IDs enmascarados / status — sin payloads

---

## PRODUCTION WEBHOOK CHECKLIST

Antes de tracking real / `process` / opens-clicks de producto:

- [ ] Host canónico o aceptación formal del temporal
- [ ] Rate limiting durable (hoy: pendiente; firma + unique + max bytes)
- [ ] Retención / borrado
- [ ] Suppression list desde bounce/complaint
- [ ] `LEGAL_REVIEW REQUIRED BEFORE PRODUCTION`
- [ ] Webhook registrado en dashboard productivo Resend

**Estado actual:** endpoint existe pero **flag OFF**; sin registro en Resend; sin deploy de esta etapa.

---

## FIRST LIVE SEND CHECKLIST

- [ ] Dominio / remitente verificado en Resend
- [ ] API key correcta (no commiteada)
- [ ] Allowlist + `COMMUNICATIONS_LIVE_SEND=true` + `--confirm-live-send`
- [ ] Template / branding revisados
- [ ] Un solo destinatario autorizado

---

## Templates / brandings

| Templates | Brandings |
|-----------|-----------|
| `system.test`, `user.welcome` | `dnx`, `clickaton`, `compramelafoto` |

Locale: `es-AR`. Preview local: `pnpm --filter @repo/communications preview:email`.

---

## Scripts

```bash
pnpm --filter @repo/communications check-types
pnpm --filter @repo/communications test
pnpm --filter @repo/communications lint
pnpm --filter @repo/communications preview:email
pnpm --filter @repo/communications smoke:resend -- --to test@example.com --template system.test --brand dnx
pnpm --filter @repo/communications smoke:resend-webhook -- --event delivered
```

---

## Estado / límites

| Capacidad | Estado |
|-----------|--------|
| Templates + branding | ✅ |
| Resend adapter + runtime controlado | ✅ |
| Smoke dry / live gates | ✅ |
| Contratos webhook + processor | ✅ |
| Persistencia durable mínima | ✅ |
| Endpoint HTTPS (flag OFF) | ✅ TEMPORARY en Clickatón |
| Modo `verify_only` | ✅ |
| Modo `process` / analytics | ❌ |
| Registro en Resend / deploy | ❌ |
| Campañas / suppression list | ❌ |

---

## LEGAL

| Escenario | Estado |
|-----------|--------|
| Código + migración + endpoint desactivado | `NO ACTION REQUIRED NOW` |
| Staging `verify_only` recibiendo delivered/bounce/complaint | `LEGAL REVIEW RECOMMENDED BEFORE STAGING DATA COLLECTION` |
| Opens/clicks o uso producto | `LEGAL REVIEW REQUIRED BEFORE PRODUCTION` |

---

## Rate limiting

No hay rate limit durable compartido en el monorepo. Defensa actual: firma Svix, max bytes, unique durable, costo acotado. Pendiente para staging/prod.
