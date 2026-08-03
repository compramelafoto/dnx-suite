# Template Render Worker

**Paquete:** `services/template-render-worker` (`@repo/template-render-worker`)  
**Uso:** render remoto de Template V2 → PNG (Playwright Chromium) para Clickatón en Vercel.

---

## Endpoints

| Método | Path | Auth |
|--------|------|------|
| GET | `/internal/health` | no (solo estado agregado) |
| POST | `/internal/template-render` | HMAC service-to-service |

Health (sin secretos):

```json
{ "ok": true, "rendererVersion": "…", "browserAvailable": true }
```

No ejecuta un render completo; valida proceso + Chromium lanzable + página create/close.

---

## Autenticación

Headers:

```text
X-DNX-Request-Id
X-DNX-Timestamp
X-DNX-Signature
X-DNX-Idempotency-Key
```

Firma HMAC-SHA256 sobre timestamp + requestId + idempotencyKey + body hash.  
Rechaza: firma inválida, timestamp vencido, nonce/requestId reutilizado, body alterado, payload > 2MB.

Secreto compartido: `DNX_TEMPLATE_RENDER_HMAC_SECRET` (Clickatón + worker).

---

## Variables

| Variable | Descripción |
|----------|-------------|
| `DNX_TEMPLATE_RENDER_HMAC_SECRET` | Secreto HMAC |
| `TEMPLATE_RENDER_WORKER_PORT` | Default `8787` |
| `TEMPLATE_RENDER_MAX_BODY_BYTES` | Default 2MB |
| `TEMPLATE_RENDER_TIMESTAMP_SKEW_MS` | Ventana de replay |

Clickatón:

```text
CLICKATON_CARD_RENDER_PROVIDER=remote
CLICKATON_CARD_REMOTE_RENDER_URL=http://127.0.0.1:8787/internal/template-render
DNX_TEMPLATE_RENDER_HMAC_SECRET=…
```

---

## Retries (cliente Clickatón)

- Connect 3s / total 25s / 2 retries
- Solo 502/503/504/timeout/conexión
- Misma idempotency key
- Circuit breaker CLOSED → OPEN → HALF_OPEN

---

## Privacidad del payload

Enviar solo datos de plantilla resuelta necesarios para PNG.  
Preferir URLs de asset de corta duración.  
No enviar email, estados de pago, consentimientos ni campos admin.

---

## Local

```bash
export DNX_TEMPLATE_RENDER_HMAC_SECRET=dev-local-hmac-secret
pnpm --filter @repo/template-render-worker dev
pnpm --filter @repo/template-render-worker test
```

---

## Despliegue staging

1. Runtime Node 20+ con Chromium/Playwright deps del sistema.
2. Secrets vía vault (nunca git).
3. Red privada o allowlist; no exponer sin firma.
4. Healthcheck en orquestador.
5. Rollback: apuntar `CLICKATON_CARD_RENDER_PROVIDER=unavailable` o URL anterior.

---

## Observabilidad

Logs sin PII: requestId, duración, códigos de error, versión renderer/browser.  
Contador de renders para validar concurrencia (un solo render por hash).

---

## Seguridad

- Contextos Playwright aislados
- Sin navegación externa arbitraria
- Temp files eliminados tras render
- Tests: firma inválida + replay
