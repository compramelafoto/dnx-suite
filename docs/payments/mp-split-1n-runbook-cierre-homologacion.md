# Runbook — cerrar la homologación de Split 1:N

**Fecha:** 2026-09-03
**Ticket MP:** `IXFS-16376`
**Base:** [checklist auditado](./mp-split-1n-checklist-oficial-auditoria.md) · [plan de implementación](./mp-split-1n-plan-implementacion.md)

Los bloques van en orden de dependencia. Dentro de cada bloque, los pasos también.
**Ningún paso mueve dinero hasta el bloque F**, que está separado a propósito.

---

## Bloque A — Ahora mismo, sin depender de nadie

### A1. Commitear el trabajo del 2026-09-03
El árbol tiene los cambios sin commitear, mezclados con trabajo de referidos y registro.
Corresponde una rama propia con **sólo** lo de pagos: port del webhook, `payer-profile.ts`,
limpieza de `integration_data`, `external_code` y los cinco documentos.

### A2. Responder a Marilyn
Una sola cosa pendiente de nuestro lado en el ticket: confirmar `processing_mode`.
**Respuesta:** correcto, es `automatic` fijo; no manejamos captura manual.
Conviene aprovechar el mismo mensaje para avisar que vamos a renombrar la app (B1).

---

## Bloque B — Panel de Mercado Pago *(lo hacés vos)*

### B1. Renombrar la aplicación
`Comprame la Foto` → **`DNX Suite`**. MP ya confirmó que no tiene impacto: su tracking va por
ID de aplicación, que no cambia. En el checklist ya nos registran con ese nombre.

### B2. Elegir la notification URL única
No se puede declarar más de una. **Recomendación: `https://compramelafoto.com/api/webhooks/dnx-payments`.**

Por qué ese host:
- Es el dominio más estable de la suite.
- Es donde vive la superficie de homologación, y MP nos registra como integrador ahí.
- El endpoint ya existe en `main` (portado el 2026-09-03).

**Aclaración importante, para no asustarse:** esta URL única aplica **sólo al tópico `order` de
la app DNX Suite**. Clickatón sigue recibiendo sus notificaciones de Checkout Pro en su propio
endpoint y su propia app, sin cambios. Recién cuando algún producto además de CLF empiece a
crear Orders 1:N habrá que hacer que este endpoint despache al producto correcto según el
`external_reference` — hoy es observe-only y no produce efectos.

### B3. Configurar la notificación
- Cargar la URL de B2.
- Suscribir **únicamente** el tópico `order`. No `payment`.
- Separar credenciales TEST y PROD.

### B4. Copiar el webhook secret
Es el de la app que firma. **No confundir el del panel con el del flujo por API** — el checklist
avisa expresamente sobre esa confusión.

---

## Bloque C — Variables de entorno *(Vercel, proyecto de Comprame la Foto)*

Para que el endpoint funcione y no falle cerrado:

| Variable | Valor | Para qué |
|---|---|---|
| `DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED` | `true` | Sin esto el endpoint responde 200 e ignora todo |
| `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` | **`false`** | Si está en `true`, el guard bloquea el receptor |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Token TEST de la app DNX Suite | Sin esto no hay `GET` y el pipeline marca `GET_ORDER_NOT_CONFIGURED` |
| `MERCADOPAGO_TEST_PUBLIC_KEY` | Public key TEST | Card Payment Brick |
| `DNX_PAYMENTS_WEBHOOK_SECRET` | El de B4 | Validación de firma |
| `DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED` | `true` | Habilita la superficie del Brick |

**El token del `GET` tiene que ser el de la misma app que creó la Order.** Un `GET` con el token
de otra cuenta devuelve `Order not found`: eso fue exactamente lo que rompió la prueba de agosto.

---

## Bloque D — Prueba punta a punta del webhook

Produce la evidencia **"GET a la orden post-webhook"** del checklist.

1. Entrar a `/admin/homologacion-mp-split-1n` en el entorno configurado.
2. Correr el escenario `OWNER_PLUS_2` (owner + 2 partners = 3 receptores). Cubre de una vez la evidencia **"Split con múltiples partners"**.
3. Pagar con tarjeta de prueba. El `payer.email` debe terminar en `@testuser.com` — los fixtures ya cumplen.
4. Verificar en los logs del endpoint que la respuesta traiga:
   - `WEBHOOK_RECEIVED: true`
   - `SIGNATURE_VALID: true`
   - `GET_ORDER_CALLED: true`
   - `GET_ORDER_ID_MATCHES_WEBHOOK: true`
   - `RECONCILIATION: "PASS"`
   - `BUSINESS_EFFECT: "NONE_OBSERVE_ONLY"`
5. Guardar la captura o el snippet del `GET /v1/orders/{id}` posterior a la notificación.

**Si aparece `GET_ORDER_NOT_CONFIGURED`:** falta el token de C. No es un fallo de Mercado Pago.
**Si no llega ninguna notificación:** recién ahí corresponde reportarle el `order_id` a Marilyn,
que es lo que quedó comprometido en el ticket.

---

## Bloque E — Video del flujo de pago aprobado

El checklist pide un video **continuo y sin cortes**, desde la perspectiva del comprador:
selección del producto → checkout con Card Payment Brick → carga de la tarjeta → confirmación →
**retorno al comercio** con el mensaje de resultado final, y que se vea la orden en
`processed / accredited`.

**El problema:** la superficie actual vive en `/admin/...` y se ve administrativa. Tiene el Brick,
pero le faltan los dos extremos del recorrido.

### E1. Construir la vista de comprador
Una ruta pública, detrás del mismo flag y **sólo sandbox**, que envuelva el Brick que ya existe
con: una pantalla de selección del producto, y una pantalla de resultado con el retorno al
comercio. No es una tienda nueva: es envolver lo que ya funciona.

### E2. Grabar
Una sola toma, sin cortar, mostrando el recorrido completo.

---

## Bloque F — Orden productiva *(decisión tuya, mueve dinero real)*

MP exige **al menos un Order ID real con `live_mode: true`** para cerrar. No hay forma de
evitarlo: es el último requisito de la lista de evidencias.

**Nada de este bloque se ejecuta sin tu autorización expresa.**

### F1. Decidir el caso
- Qué producto crea la Order.
- Qué monto — conviene el mínimo que Mercado Pago acepte.
- Quiénes son los receptores: owner + al menos un partner real.
- **Quién paga:** tiene que ser una persona distinta del collector. No podés pagarte a vos mismo.

### F2. Consentimientos en producción
Cada receptor necesita su `split-consent` en estado `ACTIVE` **antes** de crear la Order.
Requiere `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED=true`.

### F3. Ventana controlada
1. Encender `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true`.
2. Crear **una** Order.
3. Guardar el Order ID y verificar `live_mode: true`.
4. **Apagar el flag de nuevo.**

### F4. Revertir
Reembolso total vía `POST /v1/orders/{id}/refund`, que ya está implementado y probado.

---

## Bloque G — Entrega a Mercado Pago

Paquete final con las cuatro evidencias que pide el checklist:

| Evidencia | De dónde sale |
|---|---|
| Video del flujo de pago aprobado | Bloque E |
| Split con múltiples partners (owner + 2) | Bloque D, paso 2 |
| GET a la orden post-webhook | Bloque D, paso 5 |
| Order ID productivo con `live_mode: true` | Bloque F |

---

## Resumen de quién hace qué

| Bloque | Quién |
|---|---|
| A1 commit · E1 vista de comprador | Yo, con tu OK |
| A2 responder · B1–B4 panel · C variables | Vos |
| D prueba punta a punta | Vos ejecutás, yo verifico la evidencia |
| E2 grabar | Vos |
| F orden productiva | **Vos decidís y autorizás** |
| G entrega | Vos, con el paquete que armo |

### El camino más corto

B → C → D te deja con **dos de las cuatro evidencias** y sin gastar un peso. E suma la tercera.
F es la única que requiere dinero real, y conviene dejarla para el final, cuando todo lo demás
ya esté verificado.
