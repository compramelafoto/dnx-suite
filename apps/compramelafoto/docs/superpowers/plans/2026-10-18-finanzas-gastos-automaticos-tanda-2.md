# Finanzas DNX — Gastos automáticos, Tanda 2 (lectores y reglas) Implementation Plan

> **For agentic workers:** ejecución inline (superpowers:executing-plans). Pasos con TDD: prueba que falla → código → prueba que pasa → commit.

**Goal:** Convertir los mails de proveedores guardados en la Tanda 1 en gastos de Finanzas DNX, con estado real (facturado, pagado, rechazado, reembolsado), sin inventar importes.

**Architecture:** Lectores puros por formato (`lib/finance-dnx/mail/readers/*`) devuelven un `ParsedMail` o `{ ignore }` o `null`. Una función pura de decisión (`decide.ts`) compara lo leído contra los gastos del proveedor y devuelve crear / completar / revisar / ignorar. Un aplicador Prisma (`apply.ts`) ejecuta la decisión en una transacción con el dólar tarjeta del día. Corre después de cada sincronización.

**Spec:** `apps/compramelafoto/docs/superpowers/specs/2026-10-18-finanzas-gastos-automaticos-design.md` (§4.3, §5, §5.1).

**Fixtures:** mails reales guardados en producción el 18/10/2026 (cuerpos recortados y sin enlaces firmados).

## Decisiones del 18/10/2026 (Daniel)

- Se suman **AfterShoot, LinkedIn Premium y Starlink** (cuart.daniel@), "indirectamente usados por CLF".
- **ChatGPT:** cobro fijo de USD 20 por mes (no manda recibo mensual). Desde 09/2026 (resuscripción del 29/09).
- **Cursor:** recuperar el gasto real de meses anteriores. Los mails de reembolso traen "Amount paid" de la factura original.
- **Vercel:** los recibos (`invoice+statements@vercel.com`) llegan a compramelafoto@.

## Global Constraints

- Nunca se inventa un importe: sin importe, moneda y mes → "Para revisar".
- Nunca se pisa un gasto `MANUAL` o `IMPORTADO` sin número de factura que no coincida exacto: el mail va a revisar.
- Un estado nunca retrocede (`PAGADO` no vuelve a `RECHAZADO`).
- Dólar tarjeta del día del documento (`api.argentinadatos.com/v1/cotizaciones/dolares/tarjeta/AAAA/MM/DD`, respaldo `dolarapi.com` para hoy), `taxPercent = 0`. Sin cotización → el mail queda para reintentar.
- Mails que no son cobros (avisos, promociones, códigos) → `DESCARTADO` con motivo "Automático: …".
- Telegram por pago fallido sólo si el mail tiene menos de 7 días (no avisar por el historial).
- Sin dependencias nuevas.

## Tareas

1. **Cuerpo HTML cuando el texto plano no sirve** (`gmail.ts`): si la parte `text/plain` tiene menos de 300 caracteres y hay `text/html`, usar el HTML pasado a texto. Prueba con el caso Neon (plano = sólo el asunto).
2. **Registro de remitentes** (`vendors.ts`): Vercel también en compramelafoto@ (`invoice+statements@vercel.com`); AfterShoot, LinkedIn y Starlink en cuart.daniel@. Para los que llegan desde Stripe sin `acct_` conocido o desde dominios genéricos, `MailVendor.query` (fragmento de búsqueda propio de Gmail, por ejemplo `from:stripe.com subject:"receipt from AfterShoot"`) y `subjectHint`.
3. **Lectores** (`readers/*.ts` + `readers/index.ts` con `readMail(vendorKey, mail)`):
   - `stripe.ts`: recibo (`Receipt from X $N Paid <fecha>`, `Invoice number`) y reembolso (`Refund from X $N Refunded on <fecha>`, `Amount paid $N`). Anthropic API vs suscripción por el concepto.
   - `aws.ts`: `Invoice N - Billing Date AAAA-MM-DD - Charge Amount: X USD` (una línea por factura).
   - `neon.ts`: factura del asunto (`#SWURZY-…`), tipo por "Payment failed/received", importe del cuerpo (`$127.31` o `127,31 $`).
   - `cloudflare.ts`: factura disponible (ID, importe, vencimiento), compra confirmada (importe, sin factura), renovación con método de reserva (importe + factura), pago fallido (factura), alerta de uso (estimado del período), resto de `notify@` y todo `em@` → ignorar.
   - `ignore.ts`: ChatGPT, CapCut → ignorar (ChatGPT se cubre con el cobro fijo).
4. **Decisión pura** (`decide.ts`): reglas de §5 y §5.1 con pruebas por caso (crear, completar por número, completar por mes+importe, revisar por choque con manual, no retroceder estado, reembolso suma `amountRefunded`, compra confirmada busca factura impaga del mismo importe, estimado único por período reemplazado por la factura).
5. **Cotización histórica** (`fx.ts`): fecha → pesos por dólar tarjeta, con caché por fecha dentro de la corrida.
6. **Aplicador** (`apply.ts` + `process.ts`): procesa los mensajes `PARA_REVISAR` con proveedor, aplica la decisión en transacción (gasto `source = MAIL`, reparto del proveedor, `invoiceNumber`, `paidAt`, mensaje `CARGADO` con `entryId`), Telegram por pago fallido reciente. Se llama al final de `runMailSync`.
7. **Cobro fijo de ChatGPT** (`fixed-charges.ts`): por cada mes desde 09/2026 hasta el actual sin gasto de ChatGPT, crear USD 20 `PAGADO` con nota "Cobro fijo: ChatGPT no manda recibo mensual".
8. **Pantalla:** etiqueta "Automático" y número de factura en la tabla de gastos.
9. **Producción:** proveedores `aftershoot`, `linkedin`, `starlink`; volver a bajar los mails de Neon con cuerpo corto (borrar esas filas en caché y reiniciar el historial de esa cuenta); correr la lectura y revisar el resultado contra los 17 gastos existentes.
