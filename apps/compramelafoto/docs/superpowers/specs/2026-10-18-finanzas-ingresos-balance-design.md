# Finanzas DNX — Ingresos reales y balance

**Fecha:** 18/10/2026 · **Estado:** aprobado en charla (opción A) · **Pedido por:** Daniel Cuart

## 1. Objetivo

Mostrar en Finanzas DNX lo que **realmente le queda a DNX** de cada venta (la comisión neta de cada
plataforma) por mes, y compararlo con los gastos ya cargados, para ver el resultado mes a mes y por plataforma.

## 2. Decisiones (18/10/2026)

| Tema | Decisión |
|---|---|
| Cómo se calcula | **Opción A:** un cálculo diario guarda el resultado en `PlatformRevenueSnapshot` (tabla ya existente, nunca usada). La pantalla lee esa tabla. |
| Clickatón | **Fuera del balance.** |
| Neto o bruto | **Neto:** comisión menos lo que se reparte a terceros desde la comisión (referidos). |
| Desde | **Enero de 2026.** |
| Comisión de Mercado Pago | Sólo se descuenta donde la paga DNX (FotoRank cobra todo en la cuenta de DNX): **estimada** con un porcentaje fijo y marcada como estimada. En CompraMeLaFoto, FOTOFFICE y SubiLaFoto la plataforma recibe su `marketplace_fee`; la comisión de MP la paga el cobrador. |
| Momento | El ingreso cuenta en el mes en que se cobró (CompraMeLaFoto: `createdAt` de la orden pagada, no hay fecha de pago). |

## 3. Reglas por plataforma

Todo en pesos. `grossArs` = total cobrado al cliente; `payoutToThirdPartiesArs` = lo que sale de la
comisión hacia terceros; `processorFeeArs` = comisión de MP que paga DNX; `netArs` = lo que queda.

**CompraMeLaFoto** (base de CLF, rama `production`; los "Cents" son **pesos enteros**):
- Órdenes `Order` con `status = PAID` e `isTest = false`: bruto `totalCents`, comisión `platformCommissionCents`
  (ya incluye el recargo por extensión; la parte de organizadores sale de la parte del fotógrafo y no se resta).
- Menos `referralFeeDiscountCents` de esas órdenes (descuento del fee por saldo de referido del vendedor).
- Impresiones `PrintOrder` con `paymentStatus = PAID`: bruto `total`, comisión `platformCommission`.
- Menos referidos: `ReferralEarning.referralAmountCents` sin `reversedAt`, por mes de `createdAt`.
- No se suma `VideoOrderItem.feeArs`: los videos van dentro de `Order` y su comisión ya está en `platformCommissionCents`.

**SubiLaFoto** (misma base de CLF; **centavos reales**): `SubilafotoOrder` con `status = PAID` y sin `refundedAt`,
por `paidAt`: bruto `amountCents`, comisión `platformFeeCents`.

**FOTOFFICE** (base de FOTOFFICE/FotoRank, rama `development`; pesos Decimal), por `paidAt`/`createdAt`:
- Cuotas `MembershipPayment` con `status = ACREDITADO` y método de Mercado Pago (`MERCADOPAGO` o `MERCADO_PAGO`):
  comisión `platformFeeArs`, que ya incluye la comisión arrastrada de cobros en efectivo que se retuvo en ese pago.
- Cuotas en efectivo, transferencia u "otro": su comisión queda **adeudada** (`WorkspaceFeeLedgerEntry` `DEVENGADO`) y
  **no** se cuenta hasta que se retiene (ya incluida arriba) o se salda a mano (`SALDADO_MANUAL`, se suma su valor absoluto).
- Cursos `CourseEnrollment` `APPROVED` con `paymentMethod = MERCADO_PAGO`: `platformFeeArs`.
- Reservas `Booking` `PAID` y tienda `StoreOrder` `PAID/READY/DELIVERED`: `feeArs`.
- Se informa aparte la **comisión adeudada** (saldo del libro) para que se vea, sin sumarla al ingreso.

**FotoRank** (misma base de FOTOFFICE; centavos): `FotorankContestRegistration` con `paymentStatus = PAID`:
bruto `registrationPriceSnapshot`, comisión = bruto × `platformFeeBpsSnapshot` / 10000, MP estimado = bruto × 6,29%
(constante `FOTORANK_MP_FEE_ESTIMATE`), neto = comisión − MP estimado (la parte del organizador se le transfiere: no es de DNX).

**Clickatón, InfoSpot:** no se calculan.

## 4. Cálculo y guardado

- Funciones puras por plataforma que reciben filas y devuelven `{ periodYear, periodMonth, grossArs, processorFeeArs, payoutToThirdPartiesArs, netArs, operationsCount }` por mes.
- Puertos de lectura: CLF con el `prisma` de la app; FOTOFFICE/FotoRank con un cliente Prisma de **sólo lectura**
  (variable nueva `FOTOFFICE_READONLY_DATABASE_URL`, con guarda que bloquea escrituras como `clf-readonly-client.ts`).
- Se recalculan **todos los meses desde 01/2026** en cada corrida (son pocos) y se hace upsert por `(platformKey, periodYear, periodMonth)`. `sourceNote` dice qué se incluyó.
- Corre todos los días después de la lectura de Gmail (mismo cron, mismo candado) y con el botón "Recalcular ahora".
- Si una base falla, esa plataforma conserva el último cálculo y la pantalla muestra la fecha (`computedAt`) y el error.

## 5. Pantalla — solapa "Balance"

`/admin/finanzas-dnx/balance`, enlazada desde el Resumen de Finanzas DNX:
- Tabla por mes: ingresos netos, gastos pagados (en pesos, de `ExpenseEntry`), resultado y acumulado del año.
- Por plataforma (selector de mes o año): ingreso neto vs. gasto asignado según el reparto (`ExpenseEntryAllocation`).
- Detalle de ingresos: operaciones, bruto, a terceros, MP, neto. FotoRank marca "MP estimado". FOTOFFICE muestra la comisión adeudada.
- Fecha del último cálculo y botón "Recalcular ahora".

## 6. Pruebas

- Funciones puras: casos por plataforma (referidos que restan, órdenes de prueba excluidas, efectivo que no suma, retenido que sí, reembolsos excluidos, meses).
- Verificación en producción contra consultas SQL directas a cada base.

## 7. Fuera de alcance

- Clickatón e InfoSpot. Comisión real de MP (sólo estimada en FotoRank). Base vieja de CLF (`CLF_READONLY_DATABASE_URL`). Ingresos anteriores a 2026.
