# Checklist oficial de homologación — auditoría contra nuestro código

**Recibido:** 2026-09-03 de Mercado Pago (Marilyn Urrego Vasco)
**Ticket:** `IXFS-16376`
**Documento fuente:** `checklist-homologacion-CHAPI-OU-MLA-CompramelaFoto.pdf`
**Alcance:** Checkout API — Orden Unificada (Orders API) · Card Payment Brick · Web · MLA
**Modelo:** Marketplace — vinculación de partners vía `split-consent`, **no** OAuth tradicional

> En el encabezado del checklist Mercado Pago ya nos registra como
> **"Comprame la Foto (capa DNX Payments, app `DNX Suite`)"**. El nombre nuevo quedó adoptado
> de su lado antes de que lo cambiemos en el panel.

---

## 1. Resumen

**La integración cumple prácticamente todos los requisitos técnicos (`API`) del checklist.**
Lo que falta no es código de la Order: son evidencias, una decisión de negocio y una deuda ya
identificada.

| | Cantidad | Detalle |
|---|---|---|
| ✅ Ya cumplido | La totalidad de los requisitos `API` mandatorios | §2 |
| ✅ Implementado el 2026-09-03 | 4 puntos | §3 |
| 🟡 Recomendado sin implementar | 2 | §3 |
| 🔴 Bloqueante real | 2 | §4 |
| ❓ MP nos pregunta | 1 | §5 |

---

## 2. Requisitos técnicos — ya cumplidos

Verificado contra `packages/payments/src/providers/mercado-pago/`.

| Requisito del checklist | Nuestro estado | Dónde |
|---|---|---|
| `type: "online"` | ✅ | `orders/mapper.ts` |
| `processing_mode: "automatic"` | ✅ Se envía fijo | `orders/mapper.ts:194` |
| `external_reference` único y sin PII | ✅ **MP validó nuestra convención** `<producto>-<entidad>-<idOpaco>` | `orders/external-reference.ts` |
| `total_amount` (string) = suma de `splits[].amount` en `fixed` | ✅ Validado antes de enviar | `orders/validator.ts` |
| Header `x-idempotency-key` único por intento | ✅ | `client/mercado-pago-http-client.ts:182` |
| `transactions.payments[].payment_method.id` y `.type` | ✅ | `orders/mapper.ts` |
| `payer.email` | ✅ | `orders/mapper.ts` |
| `items[].unit_price` y `.quantity` en nivel superior | ✅ Nunca usamos `additional_info.items` | `orders/order-items.ts` |
| `splits[].receiver_type` `owner` / `partner` | ✅ Valida exactamente un owner y máximo de partners | `orders/validator.ts:83` |
| `config.split_rules.amount_type` único por orden | ✅ No se mezclan modos | `orders/mapper.ts` |
| Header `x-meli-session-id` (Device ID) | ✅ | `orders/mapper.ts` |
| `statement_descriptor` en `payment_method` | ✅ | `orders/mapper.ts:207` |
| `split-consent` ACTIVE previo a la Order | ✅ `POST /v1/split-consent` | `split-consent/adapter.ts:78` |
| Webhook: tópico `order` únicamente | ✅ | `webhooks/orders-notification.ts` |
| Contingencia `GET /v1/orders/{id}` | ✅ Fuente de verdad | `application/services/` |
| Reembolsos vía API | ✅ Total y parcial, con idempotencia | `refunds/client.ts` |

### Un punto delicado que ya está bien resuelto

El checklist advierte que al calcular la firma `x-signature` **el `data.id` debe usarse en
minúsculas**, y que hay que comparar en tiempo constante. Ambas cosas ya están implementadas:
`normalizeMercadoPagoDataId()` baja a minúsculas los ids alfanuméricos y la verificación usa
`timingSafeEqual` (`webhooks/signature.ts`). Es el error clásico de esta integración y no lo
tenemos.

---

## 3. Recomendados

### Implementados el 2026-09-03

| Recomendado | Cómo quedó |
|---|---|
| **Datos ampliados del pagador** — `payer.first_name`, `last_name`, `identification`, `phone` | `orders/payer-profile.ts` → `buildMercadoPagoPayer()`. Todo opcional: se omite el campo cuando el producto no tiene el dato, y una identificación incompleta no se manda a medias |
| **`additional_info.payer.*`** — `address`, `registration_date`, `is_prime_user`, `is_first_purchase_online`, `authentication_type`, `last_purchase` | `buildMercadoPagoAdditionalInfoPayer()`. Devuelve `undefined` si no hay nada que informar, para no agregar un nodo vacío. Los booleanos en `false` sí se envían: son información válida |
| **`items[].external_code`** | `orders/order-items.ts` |
| **Limpieza de `integrator_id` / `platform_id`** | El nodo `integration_data` salió del payload. `platformId` queda sólo como etiqueta del User-Agent, sin viajar como identificador |

Para usarlos, cada producto pasa `payerProfile` al construir la Order. **No es obligatorio:**
sin ese objeto el payload es idéntico al de antes.

### Sin implementar, a propósito

| Recomendado | Por qué |
|---|---|
| **SDK de backend de MP** | Nuestro cliente HTTP ya tiene idempotencia, reintentos y sanitizado de logs. Cambiarlo sería un retroceso |
| **`category_id: "virtual_goods"`** | Enviamos `"others"`, que MP confirma válido. El campo ya es configurable por ítem: es cambiar el valor en los call sites cuando se decida |
| **`POST /v1/orders/{id}/cancel`** | El checklist lo marca "no puntúa" y no hay caso de uso todavía |

---

## 4. Los tres bloqueantes

### 4.1 🔴 Order ID productivo con `live_mode: true`

El checklist lo exige como evidencia: *"Compartir al menos un Order ID real (`live_mode: true`)
para el cierre de homologación"*.

**Choca de frente con nuestro estado actual:** `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` está en
`false` y todo el diseño es fail-closed. Cerrar la homologación exige **una ventana controlada
de producción con dinero real**, con un pagador distinto del collector.

Es una decisión de negocio, no técnica: hay que elegir qué producto, qué monto y qué receptores
se usan para esa orden, y cómo se revierte. **Nada de esto se ejecuta sin autorización expresa.**

### 4.2 🔴 Video del flujo de pago aprobado

Video **continuo y sin cortes**, desde la perspectiva del comprador: selección del producto →
checkout con Card Payment Brick → carga de datos de la tarjeta → confirmación → **retorno al
comercio** con el mensaje de resultado final. Debe verse que la orden queda en
`processed / accredited`.

Hoy la superficie de homologación vive en `/admin/homologacion-mp-split-1n` de Comprame la Foto,
que es **administrativa**. Para grabar "desde la perspectiva del comprador" hace falta un
recorrido que se vea como una compra real, incluido el retorno al comercio.

### 4.3 ✅ El endpoint receptor del webhook — RESUELTO 2026-09-03

Portado desde `feat/clf-mp-webhook-order-v2` a `main`. Ver §6.

### Otros requisitos de evidencia, ya cubiertos

- **Split con múltiples partners** (owner + al menos 2): ya validado en sandbox.
- **TLS 1.2+ y SSL no autofirmado en el sitio propio**: cubierto por Vercel.
- **Brick con la public key de la aplicación**, y `product_id` del `card_token` correspondiente a Checkout Bricks: es una verificación interna del equipo de IX; usamos `@mercadopago/sdk-react`.

---

## 5. Lo que Mercado Pago nos pregunta

Una sola cosa, en la sección "Pendientes con este seller":

> *"Confirmar `processing_mode` — asumido `automatic`, validar que no manejan captura manual."*

**Respuesta:** correcto. Enviamos `processing_mode: "automatic"` fijo en el mapper y no
existe captura manual en ningún flujo. Se puede confirmar sin reservas.

---

## 6. Webhooks — confirmación definitiva

Marilyn cerró el punto que quedaba abierto: **no existe la capacidad de configurar varias URLs
en una misma app**, ni siquiera por request. Centralizando el flujo, todos los productos operan
con **la misma URL**.

Esto ratifica el diseño de §5.1 del plan: un endpoint receptor único para toda la suite, con
ruteo interno por el `external_reference` leído del `GET` de la Order.

---

## 7. Notas del checklist que conviene no perder

- **`config.split_rules.amount_type` es un solo valor por orden.** No se mezcla `fixed` con `percentage` dentro de la misma. MP entendió bien nuestro caso: `percentage` para comisiones de referidos y `fixed` para premios de concursos, ambos válidos.
- **En sandbox, `payer.email` debe terminar en `@testuser.com`.** Verificar los fixtures antes de la próxima corrida de evidencia.
- **Máximo 10 partners** por orden, más el owner.
- **`integrator_id` y `platform_id`: descartados.** Ya eliminados del payload (§3).
- **En sandbox, `payer.email` debe terminar en `@testuser.com`:** verificado, todos los fixtures ya cumplen (`buyer.clf.homolog@testuser.com`, `buyer.imp05@`, `buyer.imp06@`, `test_buyer@`).

---

## 8. Trabajo realizado el 2026-09-03

Todo lo que no dependía de Mercado Pago.

### Port del webhook `order` desde la rama

| Archivo | Qué es |
|---|---|
| `apps/compramelafoto/app/api/webhooks/dnx-payments/route.ts` | Endpoint receptor de CLF (nuevo) |
| `apps/compramelafoto/lib/homologation/mp-split-1n/orders-webhook.ts` | Handler: guard, `GET` de reconciliación, evidencia (nuevo) |
| `apps/compramelafoto/lib/homologation/mp-split-1n/orders-webhook-guards.test.ts` | 4 tests del guard (nuevo) |
| `application/services/orders-1n-observe/observe-orders-webhook.ts` | **Corrección fail-closed:** sin callback de `GET` configurado ahora alerta `GET_ORDER_NOT_CONFIGURED` y audita `FAILED`, en vez de devolver "processed" con `SUCCEEDED` |
| `application/services/clickaton-checkout/fulfill-from-orders-observe.ts` | **Corrección fail-closed:** un reintento duplicado ya no asume `APPROVED` desde el estado persistido; hace su propio `GET` y si no puede, falla |
| `application/services/orders-1n-observe/types.ts` | Código de alerta `GET_ORDER_NOT_CONFIGURED` |

Las dos correcciones son de seguridad: ambas hacían que algo sin verificar pareciera verificado.

### Verificación

| Comprobación | Resultado |
|---|---|
| Suite de `@repo/payments` | **346 de 347 pasan.** El fallo restante (`detect-payment-refund-state.test.ts`, export faltante en `map-status.js`) **ya fallaba en `main` antes de estos cambios** — verificado con el árbol limpio |
| Tests del guard de CLF | 4 de 4 |
| Tests nuevos de `payer-profile` | 7 de 7 |
| `tsc --noEmit` del paquete | **260 errores antes y 260 después:** cero errores nuevos. Son un problema preexistente de configuración (`TS2835`, extensiones de import) que conviene atacar por separado |

### Lo que quedó sin hacer, y por qué

- **Renombrar la app en el panel de MP** — es una acción tuya en el panel, no del repo.
- **Elegir el host de la notification URL única** — decisión pendiente (§5.1 del plan).
- **La orden productiva y el video** — §4.1 y §4.2: requieren tu autorización y dinero real.

---

## Docs relacionados

- [`mp-split-1n-runbook-cierre-homologacion.md`](./mp-split-1n-runbook-cierre-homologacion.md) — **el paso a paso para cerrar**
- [`mp-split-1n-mercadopago-confirmations.md`](./mp-split-1n-mercadopago-confirmations.md) — definiciones y arquitectura
- [`mp-split-1n-plan-implementacion.md`](./mp-split-1n-plan-implementacion.md) — plan de ejecución
- [`mp-split-1n-homologation-package.md`](./mp-split-1n-homologation-package.md) — paquete de homologación previo
