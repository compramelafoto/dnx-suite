# Prueba live del webhook `order` (Orders API + Split 1:N)

**Estado: NO EJECUTADA.** Este documento es el procedimiento, no la evidencia.

**No se puede declarar PASS hasta recibir un webhook `order` real emitido por Mercado Pago
a una URL pública registrada.** Hasta entonces la contingencia vigente sigue siendo
reconciliación por `GET /v1/orders/{id}`, que dio PASS en sandbox.

Dos afirmaciones que **no** deben hacerse ante Mercado Pago:

1. A qué tópicos estamos suscriptos — es **UNKNOWN**, no está en el repositorio.
2. Que Mercado Pago no envió una notificación — nunca expusimos una URL pública registrada,
   así que la ausencia de notificaciones no prueba nada del lado de MP.

---

## Giro de superficie (2026-08-26) — la evidencia se hace en Comprame la Foto

La prueba se había preparado sobre `clickaton-staging` sólo porque ahí ya existía un
endpoint público. **Eso se abandonó.** La homologación se cierra con una única historia
técnica coherente:

```
App de Mercado Pago de Comprame la Foto
  → Comprame la Foto / monorepo CLF
  → DNX Payments (@repo/payments)
  → Card Payment Brick
  → Orders API + Split (1 a N)
  → webhook `order`
  → GET /v1/orders/{id}
  → reconciliación
```

Clickatón queda fuera de esta homologación. No se borró nada suyo, y el fix de seguridad
que separó el secreto interno DNX del secreto de Mercado Pago se conservó porque es una
mejora real e independiente de esta prueba.

### Por qué no se podía seguir con Clickatón

Clickatón staging usa el token de otra cuenta de prueba (`TESTUSER4103032905602596705`).
La app habilitada para split es la de Comprame la Foto, y un `GET /v1/orders/{id}` sólo
encuentra Orders de la cuenta dueña del token. Habría hecho falta cargar credenciales de
CLF dentro de Clickatón sólo para homologar: complejidad innecesaria y evidencia mezclada.

---

## Endpoint CLF — creado

`apps/compramelafoto/app/api/webhooks/dnx-payments/route.ts`
→ delega en `lib/homologation/mp-split-1n/orders-webhook.ts`
→ delega en `observeOrdersWebhook` de `@repo/payments`.

Sin lógica de negocio propia. Esta superficie **no produce ningún efecto**: observa y
reconcilia. Devuelve evidencia sanitizada con `BUSINESS_EFFECT: "NONE_OBSERVE_ONLY"` y
`BUSINESS_DECISION_SOURCE: "GET_ORDER"`.

| Control | Implementación |
| --- | --- |
| Sólo POST | `GET` → `405 METHOD_NOT_ALLOWED` |
| Flag de observación | `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED`, OFF por defecto |
| Bloqueo de producción | `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true` ⇒ deniega |
| Firma de MP | `MERCADOPAGO_WEBHOOK_SECRET`, separado del HMAC interno DNX |
| `live_mode` | rechazado en circuito sandbox |
| Dedupe | inbox durable Prisma (`DnxPaymentWebhookInbox`) |
| GET Order | credenciales TEST de la **misma** app de MP que creó la Order |
| Sin token sandbox | no arma el GET y marca `GET_ORDER_NOT_CONFIGURED` |

El Checkout Pro productivo de CLF (`/api/payments/mp/webhook`, `marketplace_fee`) **no se
tocó**: corre en otro proyecto de Vercel (`compramelafoto`, dominios comerciales) y sigue
respondiendo normalmente.

---

## El obstáculo de infraestructura

Los dominios públicos del monorepo CLF y el entorno donde la homologación está permitida
no coinciden:

| Superficie CLF | Alcanzable por MP | `VERCEL_ENV` | Brick de homologación |
| --- | --- | --- | --- |
| `compramelafoto.staging.dnxsuite.com` | **sí** | `production` | bloqueado por el guard |
| `compramelafoto-dnxsuite.vercel.app` | **sí** | `production` | bloqueado por el guard |
| preview de rama (`…-git-…`) | **no** — SSO 302 | `preview` | permitido |

Los tres dominios tienen `gitBranch=None`, es decir apuntan al target `production` del
proyecto `compramelafoto-dnxsuite`. Y los previews están detrás de Vercel Authentication:
devuelven `302` hacia `vercel.com/sso-api`, así que Mercado Pago no puede entregar ahí.

**Importante:** `compramelafoto-dnxsuite` **no** es la producción comercial. El sitio
comercial vive en el proyecto `compramelafoto` (`www.compramelafoto.com.ar`), que ni
siquiera tiene la ruta de homologación (devuelve 404). `compramelafoto-dnxsuite` es el
despliegue interno del monorepo.

### Solución sin tocar el guard de producción

**La Order no necesita crearse desde el mismo host que recibe el webhook — sólo desde la
misma cuenta de Mercado Pago.** Por lo tanto:

1. El **webhook** se recibe en `https://compramelafoto.staging.dnxsuite.com/api/webhooks/dnx-payments`.
   El receptor no crea Orders, así que no depende del guard del Brick.
2. La **Order** se crea desde el Card Brick corriendo en local (`next dev`,
   `NODE_ENV=development`), que es exactamente como se produjo la evidencia previa
   (`PASS REAL SANDBOX`, Owner+2, `PROCESSED_ACCREDITED`).
3. Ambas puntas usan las credenciales TEST de la **misma** app de Mercado Pago ⇒
   `SAME_MP_IDENTITY = true`.

No hace falta relajar `assertClfMpSplit1nHomologationSafe` ni desactivar la protección de
previews.

---

## PASO HUMANO REQUERIDO

### 1. Desplegar CLF con la ruta nueva

La ruta `/api/webhooks/dnx-payments` **no existe en ningún deploy todavía** (los dominios
devuelven 404). Requiere push + deploy, y por eso la ejecución se detiene acá:

| | |
| --- | --- |
| Repo | `dnx-suite` |
| Rama actual | `feat/fotorank-el-pais-que-miramos` |
| Proyecto Vercel | `compramelafoto-dnxsuite` (root `apps/compramelafoto`) |
| Environment | target `production` de ese proyecto — **no** es la producción comercial |
| URL resultante | `https://compramelafoto.staging.dnxsuite.com/api/webhooks/dnx-payments` |
| Por qué | es la única superficie CLF pública que Mercado Pago puede alcanzar: los previews están detrás de Vercel Authentication (302 a `vercel.com/sso-api`) |

La producción comercial (`www.compramelafoto.com.ar`, proyecto `compramelafoto`) no se
toca: es otro proyecto de Vercel y no contiene esta ruta.

### 2. Variables en `compramelafoto-dnxsuite`

| Variable | Valor |
| --- | --- |
| `MERCADOPAGO_WEBHOOK_SECRET` | clave de firma del webhook, del panel de MP |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | access token TEST de la app de CLF |
| `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` | `true` |
| `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | ausente o `false` |

### 3. Cambiar la URL en el panel de Mercado Pago

```
=== CAMBIO HUMANO EN MP DASHBOARD ===

1. Abrir la App de Comprame la Foto.
2. Webhooks / Notificaciones, en MODO PRUEBA / TEST.
3. Reemplazar la URL de Clickatón por:
   https://compramelafoto.staging.dnxsuite.com/api/webhooks/dnx-payments
4. Dejar seleccionado únicamente: order
5. NO seleccionar payment.
6. Guardar y confirmar la clave secreta.
7. Volver y escribir: WEBHOOK CLF ORDER REGISTRADO
```

**No crear ninguna Order antes de completar los tres pasos.**

---

## Precondiciones

| # | Precondición | Cómo se verifica |
| --- | --- | --- |
| 1 | Entorno **sandbox**. Token TEST. | `assertSandboxToken` en el cliente HTTP |
| 2 | `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` ausente o distinto de `true` | Guard de producción |
| 3 | `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED=true` en `compramelafoto-dnxsuite` | `isOrders1nWebhookObserveEnabled()` |
| 4 | `MERCADOPAGO_WEBHOOK_SECRET` = la clave del panel de MP | separado del HMAC interno DNX |
| 4b | `MERCADOPAGO_TEST_ACCESS_TOKEN` de la app de CLF en `compramelafoto-dnxsuite` | misma cuenta que crea la Order |
| 5 | Existe una Order sandbox TEST con `providerOrderId` conocido | Creada por el CLI de staging |
| 6 | URL pública de staging registrada en MP con tópico **`order`** | Panel de Mercado Pago (paso externo) |
| 7 | Base de datos de staging accesible (inbox de webhooks + auditoría) | `persistence.webhooks` |

---

## Procedimiento

1. **Registrar el endpoint** en el panel de Mercado Pago:
   URL pública de staging → `POST /api/webhooks/dnx-payments`, tópico **`order`**.
   Guardar el secreto de firma que MP entrega.
2. **Generar una Order sandbox** que cambie de estado (por ejemplo, pasar a `processed`/`accredited`).
3. **Esperar la notificación real.** No simular. No reemplazar por un replay firmado localmente:
   un replay firmado prueba la firma y el pipeline, **no** prueba la entrega de MP.
4. **Verificar la recepción** en el inbox durable: debe existir un registro con
   `eventType` = `order` (o `order.*`) y `providerResourceId` = el `data.id` recibido.
5. **Verificar que se ejecutó el GET**: la auditoría debe registrar
   `orders_1n.webhook.processed` con `status` y `statusDetail` provenientes de
   `GET /v1/orders/{id}`, no del payload.
6. **Verificar la reconciliación**: `mismatchCount` = 0 contra el snapshot local
   (monto total, cantidad de receivers, montos por receiver, `external_reference`).
7. **Verificar la idempotencia**: reenviar el mismo evento debe dar `outcome: "duplicate"`
   y no producir un segundo efecto de negocio.
8. **Verificar el rechazo de `live_mode`**: un evento con `live_mode: true` en circuito
   sandbox debe rechazarse con `LIVE_MODE_FORBIDDEN`.

---

## Criterios de aceptación

| # | Criterio | Resultado |
| --- | --- | --- |
| 0 | Endpoint público HTTPS, sólo POST, rechaza unsigned | **PASS** (preflight 2026-08-26) |
| 1 | Webhook `order` recibido por HTTP desde Mercado Pago (no replay local) | **PENDING** |
| 2 | Firma `x-signature` válida | **PENDING** |
| 3 | Del payload se usa únicamente `data.id` | **PENDING** |
| 4 | `GET /v1/orders/{id}` ejecutado y con respuesta | **PENDING** |
| 5 | Estado de negocio derivado del GET, no del payload | **PENDING** |
| 6 | Reconciliación sin mismatches | **PENDING** |
| 7 | Reintento del mismo evento → `duplicate`, sin doble efecto | **PENDING** |
| 8 | `live_mode: true` rechazado en sandbox | **PENDING** |
| 9 | Auditoría sin PII (sólo prefijos y hashes) | **PENDING** |

**Clasificación de la entrega:** hasta cumplir el criterio 1, cualquier evidencia debe
etiquetarse `SIGNED_REPLAY_OF_SANDBOX_ORDER` y **nunca** `HTTP_DELIVERED_FROM_MP`.

---

## Qué NO hace esta prueba

- No activa producción.
- No crea pagos reales.
- No ejecuta refunds.
- No modifica la configuración de aplicaciones en Mercado Pago más allá de registrar
  la URL de staging y su tópico.


---

## Registro de ejecución

| Fecha | Acción | Resultado |
| --- | --- | --- |
| 2026-08-26 | Preflight del endpoint público de staging | **PASS** — HTTPS, 405 en GET, 400 en unsigned, 401 en firma inválida |
| 2026-08-26 | Diagnóstico del flag de observación | **OFF** — `ORDERS_OBSERVE_FLAG_OFF` |
| 2026-08-26 | Separación del secreto de firma de MP | **APLICADA** — `MERCADOPAGO_WEBHOOK_SECRET` |
| 2026-08-26 | Registro en panel de Mercado Pago | **HECHO** — app de Comprame la Foto, tópico `order` |
| 2026-08-26 | Detección del cruce de cuentas (app de split ≠ cuenta del endpoint) | **CORREGIDO** — `MERCADOPAGO_SPLIT_TEST_*` |
| 2026-08-26 | Detección del GET Order faltante como falso éxito | **CORREGIDO** — `GET_ORDER_NOT_CONFIGURED` |
| 2026-08-26 | Giro de superficie a Comprame la Foto | **APLICADO** — Clickatón queda fuera de esta homologación |
| 2026-08-26 | Endpoint CLF `/api/webhooks/dnx-payments` | **CREADO** — sin desplegar |
| 2026-08-26 | Reversión del workaround `MERCADOPAGO_SPLIT_TEST_*` en Clickatón | **HECHO** |
| 2026-08-26 | Deploy de CLF con la ruta nueva | **PENDIENTE — REQUIERE AUTORIZACIÓN** |
| 2026-08-26 | Cambio de URL en el panel de MP | **PENDIENTE — PASO HUMANO** |
| 2026-08-26 | Order sandbox para la prueba | **NO CREADA** — gated hasta confirmar el registro |
| 2026-08-26 | Entrega HTTP real desde MP | **NO OBSERVADA** |
