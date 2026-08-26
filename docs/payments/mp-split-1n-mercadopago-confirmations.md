# DNX Payments — Definiciones oficiales de Mercado Pago (Orders + Card Brick + Split 1:N)

**Fecha:** 2026-08-26
**Alcance:** Checkout API / Orders API · Split de Pagos (1 a N) · MLA
**Estado global:** EN HOMOLOGACIÓN. No se declara homologación aprobada. Producción NO activada.

Documentos relacionados:
[Paquete de homologación](./mp-split-1n-homologation-package.md) ·
[Contrato de Order](./mp-split-1n-order-contract.md) ·
[Evidencia sandbox](./mp-split-1n-sandbox-evidence.md) ·
[Prueba live del webhook `order`](./mp-split-1n-webhook-order-live-test.md) ·
[FotOffice — Split 1:N desactivado](./fotoffice-split-1n-disabled.md)

---

## 1. CONFIRMED BY MERCADO PAGO

| # | Definición | Impacto en nuestro código |
| --- | --- | --- |
| 1 | `items[]` va en el **nivel superior** del body de Orders. | Ya era así. `buildMercadoPagoSplitOrderRequest` arma `body.items`. |
| 2 | `additional_info.items` está **deprecado** para Orders API. | Nunca lo generamos. Test de regresión: `mapper.test.ts` → «items[] va top-level y el payload nunca contiene additional_info.items». |
| 3 | `category_id: "others"` es **válido**. | Sin cambios. Ver §3. |
| 4 | `virtual_goods` es **sugerido** (no obligatorio) para fotografías digitales. | Evaluado, **no** aplicado globalmente. Ver §3. |
| 5 | El tópico de webhook para Orders es **`order`**, no `payment`. | El router ya deriva por tipo: `order` / `order.*` → pipeline observe; el resto → ruta legacy `payment`. |
| 6 | El webhook **no** debe ser fuente de verdad para decisiones de negocio. | Corregido un caso que sí lo era. Ver §5. |
| 7 | El flujo correcto es: webhook → `data.id` → `GET /v1/orders/{order_id}` → validar estado real → decidir. | Es exactamente nuestra secuencia `observeOrdersWebhook` → `fetchCanonicalOrder` → `reconcileWebhookAgainstGet`. |
| 8 | Nuestra estrategia GET Order + reconciliación es correcta. | Se mantiene como contingencia y como fuente de verdad. |
| 9 | Conviene revisar las señales antifraude de la industria **«Aplicaciones y plataformas online»**. | Gap analysis en §4. Nuestra documentación previa asumía «Otros intangibles». |

### Confirmaciones preliminares (no definitivas)

- Checkout Pro y Checkout API deben tratarse como **productos distintos**.
- Dentro de Checkout API, MP ve **conceptualmente posible** centralizar los flujos.
- MP mencionó `integrator_id`, **no** `platform_id`.
- `external_reference` sigue siendo adecuado para trazabilidad interna por producto.

---

## 2. PENDING MERCADO PAGO

| Tema | Estado |
| --- | --- |
| ¿Una única aplicación habilitada para Split (1 a N) puede representar a DNX Payments para varios productos? | **PENDING MERCADO PAGO CONFIRMATION** — MP está consultando internamente. |
| `integrator_id` como agrupador formal | **PENDING MERCADO PAGO CONFIRMATION** — NO implementado, NO enviado, NO configurado. Ver §6. |
| Política definitiva de homologación por aplicación | **PENDING MERCADO PAGO CONFIRMATION** |

**Decisión mientras tanto:** no se crean, renombran ni borran aplicaciones en Mercado Pago; no se mueven consentimientos; no se cambian credenciales; no se unifican App IDs.
Estado: `ARCHITECTURE DECISION PENDING MERCADO PAGO`.

---

## 3. `category_id` — auditoría y recomendación

### Cómo está modelado hoy

`category_id` **ya es item-specific**, no global:

- `OrderItemInput.categoryId?: string` — `packages/payments/src/providers/mercado-pago/orders/order-items.ts`
- `mapOrderItemsToMercadoPago` lo copia por ítem a `items[].category_id`, y lo omite si viene vacío.
- Cada consumidor decide el valor en su propio call site. Hoy todos los call sites pasan `"others"`.

Es decir: **no hace falta ningún cambio estructural** para soportar valores distintos por consumidor o por ítem. Alcanza con que cada consumidor pase el suyo.

### Recomendación (no aplicada)

| Consumidor | Qué vende | Recomendación |
| --- | --- | --- |
| Comprame la Foto | Fotografías digitales descargables | **Evaluar `virtual_goods`.** Es el caso que MP describió textualmente. Requiere una Order sandbox de verificación antes de adoptarlo. |
| Clickatón | Inscripciones a un evento (acceso, acreditación, merchandising incluido) | **Mantener `others`.** No es un bien virtual descargable; parte del valor es presencial. |
| FotoRank | Inscripciones a concursos | **Mantener `others`.** Mismo razonamiento que Clickatón. Además hoy no hay cobro. |
| FotOffice | Cursos, cuotas, reservas, alquileres, tienda | **No aplica a Orders/Split.** FotOffice cobra por Checkout Pro. Ver [FotOffice — Split 1:N desactivado](./fotoffice-split-1n-disabled.md). |

**No se cambió ningún comportamiento.** `others` sigue vigente en todos los call sites hasta que se decida producto por producto.

---

## 4. Antifraude — gap analysis

**Industria de referencia:** «Aplicaciones y plataformas online» (indicada por Mercado Pago).
**Payload auditado:** `buildMercadoPagoSplitOrderRequest` + headers de `MercadoPagoHttpClient`.

### Qué enviamos hoy

| Campo / señal | Estado | Dónde |
| --- | --- | --- |
| `items[]` top-level (`title`, `quantity`, `unit_price`) | **PASS** | `order-items.ts` → `mapper.ts` |
| `items[].category_id` | **PASS** | por ítem, hoy `others` |
| `items[].description` | **PARTIAL** | soportado, ningún consumidor lo llena |
| `payer.email` | **PASS** | obligatorio y validado (`normalizePayerEmail`) |
| `external_reference` opaco (anti-PII) | **PASS** | `assertOpaqueExternalReference` |
| `statement_descriptor` | **PASS** | sanitizado, máx. 22, sin PII |
| Device / session (`X-Meli-Session-Id`) | **PASS** | capturado del Brick oficial, header en create |
| Tokenización de tarjeta (sin PAN/CVV en backend) | **PASS** | Card Payment Brick |
| `X-Idempotency-Key` | **PASS** | create y refund |
| `processing_mode`, `type: online` | **PASS** | `mapper.ts` |

### Qué NO enviamos

| Campo / señal | Estado | Motivo / decisión requerida |
| --- | --- | --- |
| `payer.first_name` / `payer.last_name` | **MISSING** | Tipado en `MpOrderPayer`, no mapeado. **Decisión de producto**: son datos que ya tenemos en la inscripción. Bajo riesgo legal. |
| `payer.identification` (tipo + número) | **MISSING** | **LEGAL REVIEW REQUIRED.** Es PII sensible (DNI). No se agrega sin decisión legal/producto expresa. |
| `payer.phone` | **MISSING** | **LEGAL REVIEW REQUIRED.** PII. No siempre lo tenemos. |
| `payer.address` | **MISSING** | **NOT APPLICABLE** para intangibles sin envío. |
| `payer.registration_date` (antigüedad del usuario en la plataforma) | **MISSING** | Señal de alto valor antifraude y **sin PII adicional**: ya tenemos `createdAt` del usuario. **Es el candidato #1 a implementar.** |
| Señales de historial (primera compra, compras previas, usuario recurrente) | **MISSING** | Derivables de nuestra propia base, sin PII nueva. Requiere definir el contrato con MP. |
| IP del comprador | **MISSING** | No reenviamos `X-Forwarded-For`. Requiere confirmar con MP si aplica a Orders API y qué campo/header espera. |
| `shipment` / dirección de envío | **N/A** | **NOT APPLICABLE** — productos intangibles. |
| `items[].picture_url` | **MISSING** | Sin PII. Barato de agregar si MP lo pide. |
| `integration_data.integrator_id` | **MISSING (deliberado)** | Ver §6. |

### Conclusión del gap analysis

Las señales de **transacción y dispositivo** están completas (PASS). El hueco está en el **enriquecimiento del `payer`**.

Recomendación priorizada, **no implementada**:

1. `payer.registration_date` y señales de historial — alto valor antifraude, cero PII nueva.
2. `payer.first_name` / `payer.last_name` — decisión de producto, no legal.
3. `items[].picture_url` y `items[].description` — cosmético/antifraude, sin PII.
4. `payer.identification` / `payer.phone` — **bloqueados hasta revisión legal**. No se implementan.

Ningún campo PII se agregó automáticamente. No se amplió el almacenamiento de datos personales.

---

## 5. Webhook `order` — el webhook no decide

### Cómo debe ser

```
webhook order
  → validar firma (x-signature / x-request-id)
  → extraer sólo data.id
  → GET /v1/orders/{data.id}
  → estado real
  → reconciliar contra el snapshot local
  → recién entonces, efecto de negocio
```

### Cómo está en el código

`observeOrdersWebhook` (`packages/payments/src/application/services/orders-1n-observe/observe-orders-webhook.ts`)
cumple la secuencia: firma → rechazo de `live_mode` en sandbox → inbox durable con dedupe → `fetchCanonicalOrder` (GET) → `reconcileWebhookAgainstGet` → auditoría. Del payload sólo toma `data.id`, `type`, `action` y `live_mode`. **Ningún efecto de negocio sale de ahí.**

### Hallazgo corregido

`fulfillRegistrationFromOrdersObserve` tenía una ruta que **sí** producía un efecto de negocio sin GET: cuando el observe devolvía `outcome: "duplicate"` (reintento del mismo evento), el observe corta antes del GET y entrega `canonical: null`. En ese caso el código buscaba la orden en la base y **asumía `status: "APPROVED"`**, acreditando la inscripción sin confirmar el estado real contra Mercado Pago.

**Corrección aplicada:** esa ruta ya no infiere el estado. Ahora ejecuta su propio `GET /v1/orders/{id}` y decide sobre el resultado; si no tiene con qué hacer el GET, falla cerrado (`CANONICAL_REQUIRED`), y si el GET falla devuelve `GET_ORDER_FAILED`. La capacidad de acreditar en un reintento duplicado **no se perdió**: el cliente de Clickatón le pasa el `fetchCanonicalOrder` que ya tenía.

Tests de regresión en `checkout-dnx-h.test.ts`:
- «no fulfilla un reintento duplicado sin GET Order disponible»
- «decide con el GET Order, no con el payload del webhook duplicado»

---

## 6. `integrator_id`

**Estado: `PENDING MERCADO PAGO CONFIRMATION`.**

- **NO** implementado como comportamiento.
- **NO** enviado en ningún payload — ningún call site pasa `integratorId`.
- **NO** configurado — no existe variable de entorno que lo alimente.
- **NO** sustituye a `platform_id`.
- El tipo `integration_data.integrator_id` existe en `contracts.ts` desde antes y queda tal cual, inerte.

No se toca hasta la confirmación formal de Mercado Pago.

---

## 7. Aplicaciones en Mercado Pago

Estado: `ARCHITECTURE DECISION PENDING MERCADO PAGO`.

No se borraron, renombraron ni crearon aplicaciones. No se creó una «DNX Payments App». No se habilitó Split en FotOffice. No se cambiaron credenciales, no se movieron consentimientos, no se unificaron App IDs.

---

## 8. Semántica de tópicos — separación explícita

| Arquitectura | Tópico | Handler |
| --- | --- | --- |
| Checkout Pro / legacy (Comprame la Foto, FotOffice cursos) | `payment` | `parseMercadoPagoPaymentNotification` → GET `/v1/payments/{id}` → efecto |
| Orders API / Split (1 a N) | **`order`** | `parseMercadoPagoOrdersNotification` → `observeOrdersWebhook` → GET `/v1/orders/{id}` → reconcile → efecto |

El soporte de `payment` **no se eliminó**: sigue siendo necesario para Checkout Pro. Las dos semánticas están separadas en el router de `durable-dnx-payments-client.ts`: si el tipo es `order` / `order.*` va al pipeline de Orders; en cualquier otro caso va a la ruta legacy.

**A qué tópicos estamos suscriptos en el panel de Mercado Pago: UNKNOWN.** No está en el repositorio y no debe afirmarse ante MP.
