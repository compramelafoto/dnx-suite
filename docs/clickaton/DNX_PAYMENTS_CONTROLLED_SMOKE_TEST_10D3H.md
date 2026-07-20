# Clickatón — Etapa 10D3H — Smoke test controlado de checkout (entorno TEST)

## Objetivo

Ejecutar y documentar un smoke controlado del flujo:

```text
Edición pública → sede → entrada → inscripción → reserva
→ orden durable DNX Payments → checkout TEST → retorno
→ webhook/sync → estado normalizado → confirmación → holds
```

Determinar si la integración está lista para Mercado Pago TEST externo.

## Fecha / commit

- **Fecha:** 2026-07-20
- **Commit de documentación:** `e21c26c`
- **Commits smoke:** `2a7611b`, `f340f05`, `e21c26c`
- **Base previa:** `ac13be0` (10D3G-B)
- **Selfcheck:** `selfcheck:dnx-payments-smoke`

## Entorno y nivel ejecutado

| Nivel | Descripción | Ejecutado | Resultado |
| ----- | ----------- | --------: | --------- |
| A | Local + fake provider durable | Sí | OK (45 pasos + PG descartable) |
| B | Staging + fake durable | No | Bloqueado: preview desplegado en `e7b6d5c` (anterior a 10D3G/G-B) |
| C | Staging + Mercado Pago TEST | No | Bloqueado: adapter Clickatón = `manual`; credenciales TEST no en shell local; sin URL staging con código 10D3G-B |
| D | Producción / dinero real | Prohibido | No ejecutado |

## Variables verificadas (presencia, sin valores)

| Variable / capacidad | Presente en shell smoke | Entorno | Observación |
| -------------------- | ----------------------: | ------- | ----------- |
| `DATABASE_URL` | Sí | local | Solo localhost en selfchecks |
| `DNX_PAYMENTS_WEBHOOK_SECRET` | No | — | Default dev en runtime; smoke usa secret de fixture |
| `CLICKATON_DNX_PAYMENTS_MODE` | No | default `prisma` | Runtime default durable |
| `CLICKATON_PUBLIC_URL` | No | — | Requerido para Nivel C |
| `CLICKATON_FAKE_CHECKOUT_BASE_URL` | No | default `payments.test` | Allowlist built-in |
| `CLICKATON_CHECKOUT_ALLOWED_HOSTS` | No | — | Opcional |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | No (shell) | MCP sandbox: present | MCP reportó credenciales sandbox; `isTestPrefix=false` |
| Adapter Clickatón checkout | — | `manual` | Fake; no Orders MP cableado |
| Webhook HMAC | Sí (fixture) | local | `x-dnx-payments-signature` |

## Base de datos utilizada

- PostgreSQL local descartable: `clickaton_10d3h_*` / `clickaton_catalog_*`
- Host: `127.0.0.1` (puerto detectado, tip. 5432)
- Migraciones existentes vía `prisma migrate deploy`
- DB destruida al finalizar
- **No Neon. No `db push`. No migraciones nuevas.**

## Fixtures

- Edición publicada `REGISTRATION_OPEN`
- Sede activa
- Entrada TEST con precio `1500_00` ARS
- Variante con stock
- Cupo reducido / cupo 1 en concurrencia
- Participante ficticio `@example.test`

## Recorrido Nivel A (fake)

1. Inscripción → `PENDING_PAYMENT` + holds `ACTIVE`
2. Checkout → orden durable + URL allowlisted
3. Retorno → **no** confirma
4. Evento `PENDING` → inscripción pendiente
5. Evento `APPROVED` → `CONFIRMED` + holds `CONSUMED`
6. Evento duplicado → idempotente
7. Reinicio de cliente → orden recuperada
8. Reconcile → `CONSISTENT`
9. Rechazo → `FAILED`, holds activos, retry sin duplicar inscripción
10. Expiración → cancel/expired + holds liberados + checkout inelegible
11. Approved tardío → `MANUAL_REVIEW` / conflicto (sin confirmación silenciosa)
12. Capacidad 1 → una reserva + `CAPACITY_EXCEEDED`
13. Checkout paralelo → una orden durable
14. Seguridad token/webhook/URL/mismatches/logs
15. Prisma PG descartable → create/recover/approve

## Smoke staging fake (Nivel B)

- Proyecto Vercel: `clickaton-dnxsuite` healthy
- Preview URL accesible; **commit desplegado `e7b6d5c`** ≠ HEAD con persistencia 10D3G-B
- Dominios prod (`maratonfotografica.com`) **no usados**
- No se desplegó automáticamente (sin autorización)
- **Falta:** deploy preview del HEAD actual + variables no productivas explícitas

## Smoke Mercado Pago TEST (Nivel C)

**Estado: No soportado por adapter / bloqueado por credenciales y deployment.**

Evidencia:

- `createClickatonCheckoutService` usa `PROVIDER = "manual"`
- `MercadoPagoOrdersAdapter` existe en `@repo/payments` (Orders/Split) pero **no** está cableado al checkout Clickatón
- Script `smoke:dnx-payments-test` dry-run: checklist sin secretos; `--execute` aborta mientras provider=manual
- Documentación MP vigente: credenciales TEST en panel Developers; webhooks con URL de test y firma HMAC; no usar producción

Tareas manuales para 10D3H-B:

1. Cablear adapter MP TEST (no improvisar desde Clickatón)
2. Credenciales `TEST-` claramente separadas
3. Buyer/collector TEST
4. Staging HTTPS con código ≥ 10D3G-B
5. Webhook público firmado alcanzable
6. `--execute --confirm-test-only`

## Webhook externo

No ejercitado contra MP. Localmente: unsigned/invalid signature rechazados; GET 405; eventId duplicado idempotente.

## Estados verificados

| Escenario | Estado DNX | Estado inscripción | Holds |
| --------- | ---------- | ------------------ | ----- |
| Post-checkout | CREATED/PENDING | PENDING_PAYMENT | ACTIVE |
| PENDING event | PENDING | PENDING_PAYMENT | ACTIVE |
| APPROVED | APPROVED | CONFIRMED | CONSUMED |
| REJECTED | REJECTED | PENDING_PAYMENT / FAILED | ACTIVE |
| EXPIRED | EXPIRED/CANCELLED | CANCELLED/EXPIRED | liberados |
| Late APPROVED | APPROVED (DNX) | no CONFIRMED / MANUAL_REVIEW | no consolidados |

## Seguridad

- Token vacío/alterado/vencido/slug/id → rechazo
- Webhook sin firma / firma inválida → rechazo
- Host checkout no allowlist / `javascript:` → rechazo
- Amount/currency mismatch → conflicto
- Logs/DTO sin secretos ni email de fixture en sink sanitizado
- Redirect no confirma

## Hallazgos

| Hallazgo | Tipo | Impacto | Corrección |
| -------- | ---- | ------- | ---------- |
| Staging preview en commit anterior a 10D3G-B | deployment | Nivel B/C bloqueados | Deploy autorizado del HEAD |
| Checkout Clickatón = `manual` | adapter | Nivel C no ejecutable | Cablear MP TEST en 10D3H-B |
| `admin-catalog-prisma` dependía de DB fija | test | Selfcheck frágil | DB descartable (este release) |
| Credenciales MP en MCP sin prefijo TEST estricto | config | Riesgo de confusión | Validar `TEST-` antes de execute |

## Reparación selfcheck Prisma

`selfcheck:admin-catalog-prisma` ahora:

- crea `clickaton_catalog_*` local
- aplica migraciones existentes
- ejecuta fixtures
- limpia y destruye DB
- rechaza Neon / hosts remotos
- no usa `clickaton_10d3fb_tmp`

## Tests / selfchecks

- `selfcheck:dnx-payments-smoke` — Nivel A automatizado
- `smoke:dnx-payments-test` — dry-run Nivel C checklist
- Suite `@repo/payments` + selfchecks Clickatón previos

## Riesgos pendientes

- Checkout URL en JSON (gap schema no bloqueante)
- Webhook aún en Clickatón (adapter temporal)
- Staging desactualizado
- MP Orders adapter orientado a split, no a checkout inscripción simple

## Decisiones diferidas

Cobros reales, MP prod, split 1:N, payouts, refunds, Neon writes, deploy automático.

## Veredicto

**SMOKE LOCAL APROBABLE — MERCADO PAGO TEST BLOQUEADO**

## Próximo paso

**CLICKATÓN — ETAPA 10D3H-B — CONFIGURACIÓN Y EJECUCIÓN DE MERCADO PAGO TEST**

No iniciado.
