# PRICING Y FEES UNIFICADOS

## Objetivo
Unificar el cálculo de precios y fees en backend para todos los flujos de venta, manteniendo el precio final visible al cliente y cobrando el fee vía `marketplace_fee` absorbido dentro del total.

## Principios no negociables
- El cliente SIEMPRE ve el precio final.
- El fee de plataforma se cobra vía `marketplace_fee` dentro del precio final.
- El backend es la fuente de verdad.
- El frontend NO recalcula precios (solo muestra datos calculados).
- Se mantienen pagos secuenciales cuando existan (sin alterar UX).

## Motor único
Archivo: `lib/pricing/pricing-engine.ts`

Función principal:
`computeCheckoutTotals({ flow, albumId?, photographerId?, labId?, items[] })`

Devuelve:
- `displayTotalCents`: total final mostrado al cliente.
- `mpTotalCents`: total enviado a MP (igual a display).
- `marketplaceFeeCents`: fee a descontar por MP.
- `components`: totales por componente (DIGITAL/PRINT).
- `items`: precios unitarios/subtotales por item (mismo orden de entrada).
- `snapshot`: payload serializable con contexto de pricing.

## Modos de pricing válidos
1. **FIXED_MARKUP_TABLE**
   - Lista fija del fotógrafo (PhotographerProduct).
   - El markup ya está incorporado en esa lista.
2. **MARKUP_OVER_LAB (%)**
   - `precio final = labWholesale * (1 + photographerMarkupPct)`.
3. **LAB_RETAIL + recargo (%)**
   - `precio final = labRetail * (1 + photographerMarkupPct)`.

> **Nota:** `PHOTOGRAPHER_RETAIL_FIXED` NO se implementa por requerimiento.

## Reglas aplicadas
- Cálculos íntegramente con enteros (pesos).
- `marketplace_fee` se calcula sobre el `displayTotalCents` y se descuenta dentro del mismo precio final.
- Si no hay lab preferido y no se envía `labId`, no se asigna laboratorio automáticamente.

## Flujos cubiertos
- **Compra de álbum (digital/impresión/combos)**  
  Endpoint: `POST /api/a/[id]/orders` y `POST /api/a/[id]/quote`.
- **Imprimir público (cliente sube archivos)**  
  Endpoint: `POST /api/print-quote` y `POST /api/print-orders` con `flow: "PUBLIC"`.
- **Impresión iniciada por fotógrafo**  
  Endpoint: `POST /api/print-quote` y `POST /api/print-orders` con `flow: "PRINT_PHOTOGRAPHER"`.
- **Checkout Mercado Pago**  
  Endpoint: `POST /api/payments/mp/create-preference` (usa `marketplace_fee`).

## Snapshot de pricing
Se guarda en:
- `Order.pricingSnapshot`
- `PrintOrder.pricingSnapshot`

El snapshot incluye:
- `flow`, `labId`, `photographerId`
- `marketplaceFeePercent`
- `extensionSurchargeCents` (si aplica en álbum)
- `items` con precios unitarios/subtotales

## Frontend
Todas las pantallas de resumen/confirmación muestran:
- Total exacto devuelto por backend (`displayTotalCents`)
- Subtotales por item desde `quote.items`

No se recalculan precios localmente.

## Entrega digital post‑pago
- Se dispara cuando el pago DIGITAL queda aprobado (webhook o confirm).
- Se crea token de descarga y se envía email una sola vez.
- `Order.digitalDeliveredAt` evita duplicados.
- `/pago/success` muestra link si está confirmado.

## QA checklist
- [ ] Quote álbum: total mostrado coincide con backend.
- [ ] Quote impresión pública: total mostrado coincide con backend.
- [ ] Quote impresión fotógrafo: total mostrado coincide con backend.
- [ ] `marketplace_fee` enviado a MP y absorbido en el total.
- [ ] Pago digital aprobado por webhook envía email una sola vez.
- [ ] Pago digital aprobado por confirm manual envía email una sola vez.
- [ ] Webhook duplicado no reenvía email.
- [ ] `/pago/success` muestra link si digital confirmado.
- [ ] Usuario cierra el navegador antes de volver de MP y recibe email.
