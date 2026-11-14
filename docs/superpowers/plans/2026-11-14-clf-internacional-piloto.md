# CLF internacional · Piloto: cobro con Mercado Pago del fotógrafo y saldo en PayPal. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un fotógrafo del exterior que esté en la lista del piloto vende fotos digitales en su moneda con su propio Mercado Pago. Cobra el 100 % y CLF le descuenta el 15 % de comisión, pasado a dólares, de un saldo que arranca con un adelanto de 25 USD y se recarga por PayPal a la cuenta de DNX.

**Architecture:** Toda la lógica nueva vive en `apps/compramelafoto/lib/international/` como funciones puras con pruebas (node:test + `tsx`), más servicios finos con Prisma. Hay dos tablas nuevas: el libro de movimientos del saldo (`ClfIntlWalletMovement`) y las cotizaciones (`ClfFxRate`). El circuito argentino recibe solo **desvíos tempranos** del tipo `if (order.currency !== "ARS")`, en la creación del pedido, la preferencia y la confirmación. Con moneda `ARS` el código argentino corre exactamente igual que hoy.

**Tech Stack:** Next.js (`apps/compramelafoto`), Prisma (`packages/db`), node:test con `tsx` (`pnpm --filter compramelafoto test:international`), API REST de Mercado Pago y de PayPal por `fetch` (sin SDK nuevo), Neon.

**Spec:** `docs/superpowers/specs/2026-11-04-clf-cobro-internacional-saldo-prepago-design.md`. **La sección 11 (cambios del 14/11) manda sobre el resto.**

## Global Constraints

- El sistema que funciona hoy no puede verse interrumpido en ningún momento. Los cambios de base son solo aditivos: tablas nuevas, nunca renombrar ni borrar.
- Todo lo del piloto se activa solo para los ids de `CLF_INTL_PILOT_USER_IDS` (lista separada por comas). Vacía o ausente = nadie.
- Un pedido con `currency = "ARS"` recorre exactamente el mismo código que hoy: precio, comisión, `marketplace_fee`, split, referidos, correos.
- Comisión internacional: **15 %** sumado al precio del fotógrafo (`INTL_COMMISSION_PERCENT = 15`). No usa `resolvePlatformCommissionPercent` ni sus excepciones.
- Adelanto: **2500** centavos de USD, **una vez por `User.mpUserId`**. Se devuelve completo en la primera recarga.
- Recarga mínima: **1000** centavos de USD, sin contar el adelanto. Opciones sugeridas: **2500, 5000 y 10000**.
- Aviso de saldo bajo: por debajo de **500** centavos de USD. Con saldo ≤ 0 no se aceptan compras nuevas.
- Montos: los de moneda local se guardan en la unidad que fija `lib/international/money.ts` (`minorUnitDigits`) y los de dólares en **centavos de USD**, como enteros. La comisión pasada a USD se redondea **hacia arriba** (a favor de DNX, regla 6.8 bis).
- Solo países con medio `MERCADOPAGO_OWN` (CL, CO, MX, PE, UY, BR) y solo fotos digitales. Sin impresiones, preventas, packs, videos, organizador de evento ni referidos.
- Mercado Pago del fotógrafo: se usa la conexión OAuth existente (`User.mpAccessToken`, renovada por `/api/cron/refresh-mp-oauth-tokens`). No se piden claves pegadas.
- PayPal de DNX: `PAYPAL_DNX_CLIENT_ID`, `PAYPAL_DNX_CLIENT_SECRET` y `PAYPAL_DNX_ENV` (`sandbox` | `live`; sin valor = `sandbox`).
- No se agregan dependencias ni se modifica `packages/payments`.
- Las migraciones se aplican a mano en las 6 bases y se registran en `_prisma_migrations` con el sha256 **antes** de fusionar (práctica del repo).
- Los textos van en español y como frases completas. Se dice "dinero", nunca "plata". El fotógrafo ve cada movimiento en su moneda y en dólares.

## Review Focus

1. **Webhook de Mercado Pago repetido o fuera de orden.** El descuento de comisión se hace una sola vez por pedido (índice único `orderId + type`). Una segunda confirmación no descuenta de nuevo. La prueba va en la Tarea 6.
2. **El cliente paga en otra moneda o por otro monto** (preferencia vieja, cuenta del fotógrafo de otro país). Si `pay.currency_id ≠ order.currency` o el monto difiere en más de 1 unidad, el pedido **no** pasa a `PAID` y queda registrado para revisión. La prueba va en la Tarea 6.
3. **El retorno de PayPal se recarga o llega dos veces.** La captura se registra una sola vez por `captureId`, y una captura ya hecha devuelve el estado sin duplicar saldo. La prueba va en la Tarea 7.
4. **Sin cotización guardada o vieja.** Sin ninguna cotización para la moneda, el pedido no se crea ("La venta está pausada momentáneamente"). Si tiene más de 48 h, se usa igual y se avisa al administrador. La prueba va en la Tarea 2.
5. **Pedido argentino de un fotógrafo del piloto** (por ejemplo, un álbum viejo en ARS). Sigue el circuito argentino completo, con `marketplace_fee` y referidos. La prueba va en la Tarea 4.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` + `migrations/20270210090000_clf_intl_wallet_fx/migration.sql` | Tablas `ClfIntlWalletMovement` y `ClfFxRate` |
| `lib/international/pilot.ts` | Lista del piloto, constantes, moneda por sitio de MP |
| `lib/international/fx.ts` · `fx-store.ts` | Lectura de cotizaciones, conversión a USD, guardado y consulta |
| `lib/international/wallet.ts` · `wallet-store.ts` | Cálculo del saldo, deuda, sugerencias y recargas; servicio con Prisma |
| `lib/international/intl-order.ts` | Totales del pedido internacional y "¿puede vender?" |
| `lib/international/intl-preference.ts` | Preferencia de MP en moneda local, sin `marketplace_fee` |
| `lib/international/intl-finalize.ts` | Control de pago y descuento de comisión al confirmarse |
| `lib/international/paypal-dnx.ts` | Token, orden y captura de PayPal de DNX |
| `app/api/cron/intl-fx-rates/route.ts` | Tarea diaria de cotizaciones |
| `app/api/fotografo/saldo-internacional/**` | Saldo, recarga y retorno de PayPal |
| `components/fotografo/SaldoInternacionalSection.tsx` | Panel del fotógrafo |
| `app/admin/clf-internacional/page.tsx` | Vista mínima del administrador con ajuste manual |

Todas las rutas son relativas a `apps/compramelafoto/` salvo las de `packages/db`. Cada `*.ts` puro lleva su `*.test.ts` al lado, y el script `test:international` ya toma `lib/international/*.test.ts`.

---

### Task 1: Tablas, configuración del piloto y moneda del álbum

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (después de `model ClfIntlCollectionAccount`)
- Create: `packages/db/prisma/migrations/20270210090000_clf_intl_wallet_fx/migration.sql`
- Create: `lib/international/pilot.ts`, `lib/international/pilot.test.ts`
- Modify: `lib/international/album-currency.ts`

**Interfaces:**
- Produces:
  - `model ClfIntlWalletMovement { id String @id @default(cuid()); userId Int; type String; amountUsdCents Int; orderId Int?; externalRef String?; localCurrency String?; localAmount Int?; fxUnitsPerUsd String?; fxRateId String?; note String?; createdByUserId Int?; createdAt DateTime @default(now()) }`, con `@@unique([orderId, type])`, `@@unique([externalRef])` y `@@index([userId, createdAt])`. `type` puede ser `ADVANCE` | `TOPUP` | `ADVANCE_REPAID` | `COMMISSION` | `ADJUSTMENT`. Sin relación Prisma con `User` ni `Order`, para que publicar el código antes del SQL no rompa nada.
  - `model ClfFxRate { id String @id @default(cuid()); currency String; unitsPerUsdBuy String; unitsPerUsdSell String; source String; effectiveDate String; fetchedAt DateTime @default(now()) }`, con `@@unique([currency, effectiveDate, source])`. `effectiveDate` va como `YYYY-MM-DD`, en hora argentina.
  - `parsePilotUserIds(raw: string | undefined): Set<number>`
  - `isIntlPilotUser(userId: number | null | undefined, env?: NodeJS.ProcessEnv): boolean`
  - Constantes: `INTL_COMMISSION_PERCENT = 15`, `ADVANCE_USD_CENTS = 2500`, `MIN_TOPUP_USD_CENTS = 1000`, `TOPUP_OPTIONS_USD_CENTS = [2500, 5000, 10000] as const`, `LOW_BALANCE_USD_CENTS = 500`, `MAX_TOPUP_USD_CENTS = 100000`
  - `currencyForMpSite(siteId: string | null | undefined): string | null`: `MLC→CLP`, `MCO→COP`, `MLM→MXN`, `MPE→PEN`, `MLU→UYU`, `MLB→BRL` y cualquier otro valor → `null`.

- [ ] **Step 1: Write the failing tests** en `pilot.test.ts`:
  - `parsePilotUserIds(" 1038, x ,5,,")` → `Set {1038, 5}`; `parsePilotUserIds(undefined)` → vacío.
  - `isIntlPilotUser(1038, { CLF_INTL_PILOT_USER_IDS: "1038" })` → `true`; `isIntlPilotUser(1038, {})` → `false`; `isIntlPilotUser(null, {…"1038"})` → `false`.
  - `currencyForMpSite("MCO")` → `"COP"`; `currencyForMpSite("MLA")` → `null`.
  - En `album-currency.test.ts`: `currencyForNewAlbum("CO", false, true)` → `"COP"` (piloto) y `currencyForNewAlbum("CO", false, false)` → `"ARS"`.
- [ ] **Step 2: Run** `pnpm --filter compramelafoto test:international`. Expected: FAIL (`pilot.ts` no existe).
- [ ] **Step 3: Implement** `pilot.ts`. Cambiar la firma a `currencyForNewAlbum(ownerCountryCode, enabled, pilot = false)`, que devuelve la moneda del país si `enabled || pilot`. En `resolveNewAlbumCurrency(userId)` pasar `pilot = isIntlPilotUser(userId)` y consultar la base si `enabled || pilot`.
- [ ] **Step 4: Run** `pnpm --filter compramelafoto test:international`. Expected: PASS.
- [ ] **Step 5: Write the SQL.** Usar `CREATE TABLE IF NOT EXISTS` y `CREATE UNIQUE INDEX IF NOT EXISTS` para las dos tablas, con los mismos nombres de índice que generaría Prisma. Tiene que poder repetirse sin efectos. Verificar con `pnpm --filter @repo/db exec prisma validate`. Expected: `The schema … is valid`.
- [ ] **Step 6: Commit** — `git commit -m "CLF internacional piloto: tablas de saldo y cotizaciones y lista del piloto"`

---

### Task 2: Cotizaciones diarias

**Files:**
- Create: `lib/international/fx.ts`, `lib/international/fx.test.ts`, `lib/international/fx-store.ts`
- Create: `app/api/cron/intl-fx-rates/route.ts`
- Modify: `vercel.json` (agregar `{ "path": "/api/cron/intl-fx-rates", "schedule": "15 10 * * *" }`)

**Interfaces:**
- Consumes: `ClfFxRate` (Task 1), `minorUnitDigits` / `storedToMajor` (`money.ts`).
- Produces:
  - `FX_SOURCE = "open.er-api.com"` y `FX_URL = "https://open.er-api.com/v6/latest/USD"` (gratuito, sin clave, un solo valor por moneda).
  - `parseErApiRates(json: unknown, currencies: readonly string[]): Record<string, number>`: devuelve cuántas unidades locales vale 1 USD. Ignora las monedas que faltan o que no traen un número positivo.
  - `pickRate(rate: { unitsPerUsdBuy: string; unitsPerUsdSell: string }, side: "BUY" | "SELL"): number`
  - `localStoredToUsdCentsCeil(stored: number, currency: string, unitsPerUsd: number): number` = `Math.ceil(storedToMajor(stored, currency) / unitsPerUsd * 100)`.
  - `isStale(fetchedAt: Date, now: Date): boolean` (más de 48 h).
  - `fx-store.ts`: `refreshFxRates(fetchImpl?: typeof fetch): Promise<{ saved: string[]; missing: string[] }>` guarda las monedas `MERCADOPAGO_OWN` de `SUPPORTED_COUNTRIES` (con upsert por la clave única). `latestFxRate(currency: string): Promise<ClfFxRate | null>`.

- [ ] **Step 1: Write the failing tests:**
  - `parseErApiRates({ result: "success", rates: { COP: 3950.5, MXN: 18.2, CLP: -1 } }, ["COP","MXN","CLP","PEN"])` → `{ COP: 3950.5, MXN: 18.2 }`.
  - `parseErApiRates({ result: "error" }, ["COP"])` → `{}`.
  - `localStoredToUsdCentsCeil(150000, "COP", 4000)` → `38` (1500,00 COP / 4000 = 0,375 USD → 38 centavos).
  - `localStoredToUsdCentsCeil(1500, "CLP", 950)` → `158`.
  - `isStale(new Date("2026-11-12T09:00:00Z"), new Date("2026-11-14T10:00:00Z"))` → `true`; con 47 h de diferencia → `false`.
- [ ] **Step 2: Run** `pnpm --filter compramelafoto test:international`. Expected: FAIL.
- [ ] **Step 3: Implement** `fx.ts` y `fx-store.ts`. Guardar el mismo valor en compra y venta (`String(value)`, regla "un solo valor, sin margen"). `effectiveDate` va como fecha argentina (`America/Argentina/Buenos_Aires`).
- [ ] **Step 4: Implement the cron route.** Autorización `Bearer CRON_SECRET` igual que `app/api/cron/daily-report/route.ts`. Responde `{ ok, saved, missing }`. Si `missing` no está vacío, deja un `console.warn("[intl-fx] faltan cotizaciones", missing)`.
- [ ] **Step 5: Run** `pnpm --filter compramelafoto test:international`. Expected: PASS.
- [ ] **Step 6: Commit** — `"CLF internacional piloto: cotizaciones diarias contra el dólar"`

---

### Task 3: Libro de saldo, adelanto y recarga

**Files:**
- Create: `lib/international/wallet.ts`, `lib/international/wallet.test.ts`, `lib/international/wallet-store.ts`

**Interfaces:**
- Consumes: constantes de `pilot.ts`, `ClfIntlWalletMovement`.
- Produces (puras, en `wallet.ts`):
  - `type WalletMovementLike = { type: string; amountUsdCents: number; createdAt: Date }`
  - `computeWallet(movements: WalletMovementLike[]): { balanceUsdCents: number; advanceDebtUsdCents: number }`. El saldo es la suma de `amountUsdCents`. La deuda es `ADVANCE` (positivo) menos `ADVANCE_REPAID`. **`ADVANCE_REPAID` se guarda con `amountUsdCents = 0`** y el monto devuelto va en `note` como JSON `{"repaidUsdCents":2500}`: no cambia el saldo. La deuda se lee de ese campo.
  - `validateTopUp(chosenUsdCents: number): { ok: true } | { ok: false; message: string }`. Rechaza montos menores a `MIN_TOPUP_USD_CENTS` ("La recarga mínima es de 10 USD."), mayores a `MAX_TOPUP_USD_CENTS` y los que no son enteros.
  - `topUpCharge(chosenUsdCents: number, advanceDebtUsdCents: number): number` = elegido + deuda.
  - `suggestTopUp(last30DaysCommissionUsdCents: number): { options: number[]; recommended: number }`. Las opciones son siempre `TOPUP_OPTIONS_USD_CENTS`. Recomienda la menor que sea ≥ lo consumido en 30 días; si ninguna alcanza, `10000`; sin historial (0), `2500`.
  - `crossedLowBalance(before: number, after: number): boolean` = `before >= LOW_BALANCE_USD_CENTS && after < LOW_BALANCE_USD_CENTS`.
- Produces (servicio, en `wallet-store.ts`):
  - `getWalletState(userId: number): Promise<{ balanceUsdCents; advanceDebtUsdCents; last30DaysCommissionUsdCents; movements: ClfIntlWalletMovement[] }>`
  - `ensureAdvanceGranted(userId: number): Promise<"GRANTED" | "ALREADY" | "NOT_ELIGIBLE">`. Es elegible con piloto + `mpUserId` no nulo, y si **ningún** usuario con el mismo `mpUserId` tiene ya un `ADVANCE`.
  - `recordCommission(params: { userId; orderId; localCurrency; localAmount; fxRateId; fxUnitsPerUsd; amountUsdCents }): Promise<{ created: boolean; balanceBefore: number; balanceAfter: number }>`. Guarda `amountUsdCents` en negativo. Si choca con el índice único (`P2002`), devuelve `created: false`.
  - `recordTopUp(params: { userId; captureId: string; paidUsdCents: number; chosenUsdCents: number; advanceRepaidUsdCents: number }): Promise<{ created: boolean }>`. En una transacción guarda `TOPUP` (+elegido, `externalRef = captureId`) y, si hay deuda, `ADVANCE_REPAID` (`externalRef = captureId + ":advance"`).
  - `recordAdjustment(params: { userId; amountUsdCents; note: string; createdByUserId: number }): Promise<void>`

- [ ] **Step 1: Write the failing tests:**
  - `computeWallet([{type:"ADVANCE",amountUsdCents:2500}, {type:"COMMISSION",amountUsdCents:-38}])` → `{ balanceUsdCents: 2462, advanceDebtUsdCents: 2500 }`.
  - Con un `ADVANCE_REPAID` (`amountUsdCents: 0`, nota `{"repaidUsdCents":2500}`) y un `TOPUP` de +1000 → la deuda queda en 0 y el saldo suma solo 1000.
  - `validateTopUp(999)` → `ok:false` con el mensaje exacto; `validateTopUp(1000)` → `ok:true`; `validateTopUp(1000.5)` → `ok:false`.
  - `topUpCharge(1000, 2500)` → `3500`; `topUpCharge(5000, 0)` → `5000`.
  - `suggestTopUp(0).recommended` → `2500`; `suggestTopUp(3000).recommended` → `5000`; `suggestTopUp(20000).recommended` → `10000`.
  - `crossedLowBalance(600, 450)` → `true`; `crossedLowBalance(450, 300)` → `false`.
- [ ] **Step 2: Run** `pnpm --filter compramelafoto test:international`. Expected: FAIL.
- [ ] **Step 3: Implement** `wallet.ts` y `wallet-store.ts`.
- [ ] **Step 4: Run** `pnpm --filter compramelafoto test:international`. Expected: PASS.
- [ ] **Step 5: Commit** — `"CLF internacional piloto: libro de saldo con adelanto de 25 USD"`

---

### Task 4: Crear el pedido internacional

**Files:**
- Create: `lib/international/intl-order.ts`, `lib/international/intl-order.test.ts`
- Modify: `app/api/a/[id]/orders/route.ts` (desvío antes de `computeCheckoutTotals`, línea ~324)

**Interfaces:**
- Consumes: `isIntlPilotUser`, `getWalletState`, `ensureAdvanceGranted`, `latestFxRate`, `INTL_COMMISSION_PERCENT`.
- Produces:
  - `computeIntlDigitalTotals(params: { unitPriceStored: number; photoCount: number }): { subtotalStored: number; commissionStored: number; totalStored: number }`. Comisión = `Math.round(subtotal * 15 / 100)`.
  - `type IntlSaleBlock = "NOT_PILOT" | "NO_MP" | "MP_COUNTRY_MISMATCH" | "NO_BALANCE" | "NO_FX" | "NOT_DIGITAL_ONLY" | "NO_PRICE"`
  - `canSellIntl(input: { pilot: boolean; mpConnected: boolean; mpCurrency: string | null; albumCurrency: string; balanceUsdCents: number; hasFx: boolean; allDigital: boolean; unitPriceStored: number | null }): { ok: true } | { ok: false; block: IntlSaleBlock }`
  - `intlBlockMessage(block: IntlSaleBlock): string`. Mensaje para el cliente: en todos los casos "La venta de este álbum está pausada momentáneamente. Probá de nuevo más tarde." (no se le explica al cliente el motivo interno).
  - `INTL_SNAPSHOT_KEY = "intlV1"`. En el `pricingSnapshot` se guarda `{ intlV1: { commissionPercent: 15, subtotalStored, commissionStored, currency } }`.

- [ ] **Step 1: Write the failing tests:**
  - `computeIntlDigitalTotals({ unitPriceStored: 1000000, photoCount: 1 })` → `{ subtotalStored: 1000000, commissionStored: 150000, totalStored: 1150000 }` (10.000,00 COP → 11.500,00).
  - `canSellIntl` con todo bien → `ok`. Con `balanceUsdCents: 0` → `NO_BALANCE`. Con `mpCurrency: "MXN"` y `albumCurrency: "COP"` → `MP_COUNTRY_MISMATCH`. Con `allDigital: false` → `NOT_DIGITAL_ONLY`.
  - **Review Focus 5:** prueba en `intl-order.test.ts` de `shouldUseIntlFlow("ARS")` → `false` y `shouldUseIntlFlow("COP")` → `true`. Agregar `shouldUseIntlFlow(albumCurrency: string): boolean` = `albumCurrency !== "ARS"`. Ser del piloto **no** entra en esta condición: un álbum no-ARS de alguien fuera del piloto también cae en el desvío y se bloquea con `NOT_PILOT`, nunca va al circuito argentino.
- [ ] **Step 2: Run** los tests. Expected: FAIL.
- [ ] **Step 3: Implement** `intl-order.ts`.
- [ ] **Step 4: Wire the route.** Con `shouldUseIntlFlow(album.currency)`:
  1. Llamar a `ensureAdvanceGranted(album.userId)`.
  2. Armar la entrada de `canSellIntl`. La moneda de MP sale de `currencyForMpSite`, consultando `GET /users/me` con el token del dueño (timeout 10 s, guardado 24 h en memoria del proceso). Ante un bloqueo, responder `409 { error: intlBlockMessage(block), code: "INTL_SALE_PAUSED" }`.
  3. Si puede vender, crear el `Order` con `currency: album.currency`, `totalCents: totalStored`, `platformCommissionCents: commissionStored`, `checkoutPaymentSource: MERCADO_PAGO` y el snapshot `intlV1`, más los `OrderItem` digitales con `subtotalCents` en la unidad guardada.
  4. Seguir con `ensureAlbumOrderMpPreference` como hoy. Todo lo demás del archivo queda intacto para `ARS`.
- [ ] **Step 5: Run** `pnpm --filter compramelafoto test:international` y `pnpm --filter compramelafoto exec tsc --noEmit -p tsconfig.json`. Expected: PASS y sin errores. Si `tsc` se corta por memoria, ver `NODE_OPTIONS=--max-old-space-size=7168`: un `tsc` que muere también puede devolver éxito, así que hay que leer la salida.
- [ ] **Step 6: Commit** — `"CLF internacional piloto: crear pedidos en moneda local con 15 % de comisión"`

---

### Task 5: Preferencia de Mercado Pago en moneda local

**Files:**
- Modify: `lib/mercadopago.ts` (`createPreference`, línea ~104/169)
- Create: `lib/international/intl-preference.ts`, `lib/international/intl-preference.test.ts`
- Modify: `lib/mercadopago/album-order-mp-preference.ts` (desvío al inicio de `ensureAlbumOrderMpPreference`, después del bloqueo de simulación)

**Interfaces:**
- Consumes: `storedToMajor`, `resolveAlbumOrderMpAccessToken` (ya usado en el archivo), `buildMercadoPagoUnauthorizedRefresher`.
- Produces:
  - `createPreference(params, opts)` acepta `params.currencyId?: string`. Si viene, usa `currency_id: params.currencyId` y toma `params.total` como **monto mayor** (puede tener decimales). Sin `currencyId`, el comportamiento y el cuerpo enviado quedan idénticos a hoy.
  - `buildIntlPreferenceInput(order: { id: number; totalCents: number; currency: string }): { title: string; total: number; currencyId: string; externalReference: string; marketplaceFee: undefined }`. El título es `Compra de fotos - Pedido #<id>` y el total, `storedToMajor(totalCents, currency)`.

- [ ] **Step 1: Write the failing tests:**
  - `buildIntlPreferenceInput({ id: 7, totalCents: 1150000, currency: "COP" })` → `total: 11500`, `currencyId: "COP"`, `marketplaceFee: undefined`.
  - Para `CLP` con `totalCents: 11500` → `total: 11500`.
- [ ] **Step 2: Run** los tests. Expected: FAIL.
- [ ] **Step 3: Implement.** En `ensureAlbumOrderMpPreference`, si `order.currency !== "ARS"`:
  1. Obtener el token con el mismo `resolveAlbumOrderMpAccessToken`.
  2. Llamar a `createPreference({ ...buildIntlPreferenceInput(order), metadata: { orderType: "ALBUM_ORDER", orderId, component: "DIGITAL", intl: true } }, { accessTokenOverride, refreshAccessTokenOnUnauthorized })`.
  3. Guardar `mpInitPoint` y `mpPreferenceId` y salir.
  
  Este camino **no** llama a `applyAndPersistSellerReferralDiscount`, `buildAlbumOrderMercadoPagoCheckoutSplit` ni `scheduleCheckoutFeeShadowCompare`. El "reusar link si ya existe" queda igual.
- [ ] **Step 4: Run** los tests y `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** — `"CLF internacional piloto: preferencia en moneda local sin marketplace_fee"`

---

### Task 6: Confirmación del pago y descuento de la comisión

**Files:**
- Create: `lib/international/intl-finalize.ts`, `lib/international/intl-finalize.test.ts`
- Modify: `lib/mercadopago/finalize-album-order-mp-approved.ts` (en `finalizeAlbumOrderMercadoPagoApproved`, después de validar `pay.status === "approved"` (~271) y antes de pasar a `PAID`; y en la creación de referidos)

**Interfaces:**
- Consumes: `latestFxRate`, `pickRate`, `localStoredToUsdCentsCeil`, `recordCommission`, `crossedLowBalance`, `queueEmail` (`lib/email-queue.ts`).
- Produces:
  - `checkIntlPayment(order: { totalCents: number; currency: string }, pay: { currency_id: string; transaction_amount: number }): { ok: true } | { ok: false; reason: "CURRENCY" | "AMOUNT" }`. Tolera una diferencia de hasta 1 unidad mayor.
  - `commissionForOrder(snapshot: unknown): { commissionStored: number; currency: string } | null` (lee `intlV1`).
  - `applyIntlCommission(orderId: number): Promise<{ created: boolean; lowBalanceCrossed: boolean }>`. Usa `pickRate(rate, "BUY")` (regla 6.8 bis, primera fila). Si no hay cotización, usa la última sin importar la fecha y registra `console.warn`; nunca deja de descontar.

- [ ] **Step 1: Write the failing tests:**
  - `checkIntlPayment({ totalCents: 1150000, currency: "COP" }, { currency_id: "COP", transaction_amount: 11500 })` → `ok`.
  - Con `currency_id: "ARS"` → `{ ok:false, reason:"CURRENCY" }`. Con `transaction_amount: 11000` → `AMOUNT`.
  - `commissionForOrder({ intlV1: { commissionStored: 150000, currency: "COP" } })` → ese objeto; `commissionForOrder({})` → `null`.
  - **Review Focus 1:** prueba con un `recordCommission` falso que la segunda vez devuelve `created:false`. Verificar que `applyIntlCommission` no manda el correo de saldo bajo dos veces. Inyectar el store y el mailer como parámetros opcionales para poder probarlo.
- [ ] **Step 2: Run** los tests. Expected: FAIL.
- [ ] **Step 3: Implement and wire.** En `finalizeAlbumOrderMercadoPagoApproved`, si `order.currency !== "ARS"`:
  - Correr `checkIntlPayment`. Si falla, devolver `{ ok:false, error: "intl_payment_mismatch:<reason>" }` sin tocar el estado, con `console.error` que incluya `orderId` y `paymentId`.
  - Si pasa, seguir por el camino normal a `PAID`. Después del cambio de estado, llamar a `applyIntlCommission(order.id)`.
  - **Saltar** `createReferralEarningsForPaidSale`, `consumeReferralEarningsForDiscount` y la comisión de organizador para estos pedidos.
  - Si `lowBalanceCrossed`, mandar con `queueEmail` al fotógrafo: asunto "Tu saldo de CompraMeLaFoto está por terminarse"; cuerpo con el saldo actual en USD, el aviso de que con saldo 0 se pausan las ventas y el enlace al panel de saldo.
- [ ] **Step 4: Check the paid-order emails.** Revisar los correos que dispara `runAlbumOrderPaidSideEffects` y los montos que muestran. Donde se formatee el total con `formatPurchaseArs`, pasar a `formatMoney(total, order.currency)`. Con `ARS` el resultado es idéntico, porque `formatMoney` delega en `formatPurchaseArs`.
- [ ] **Step 5: Run** los tests, `test:referrals` y `test:split-1n-piloto`. Expected: todo PASS (el circuito argentino no cambió).
- [ ] **Step 6: Commit** — `"CLF internacional piloto: descontar la comisión en dólares al confirmarse el pago"`

---

### Task 7: Recarga por PayPal de DNX

**Files:**
- Create: `lib/international/paypal-dnx.ts`, `lib/international/paypal-dnx.test.ts`
- Create: `app/api/fotografo/saldo-internacional/route.ts` (GET: estado), `app/api/fotografo/saldo-internacional/recargar/route.ts` (POST), `app/api/fotografo/saldo-internacional/paypal-retorno/route.ts` (GET)

**Interfaces:**
- Consumes: `validateTopUp`, `topUpCharge`, `getWalletState`, `recordTopUp`, `suggestTopUp`, `isIntlPilotUser`; la sesión del fotógrafo como en `app/api/fotografo/cobros-internacionales/route.ts`.
- Produces:
  - `paypalBaseUrl(env: string | undefined): string`. `live` → `https://api-m.paypal.com`; cualquier otro valor → `https://api-m.sandbox.paypal.com`.
  - `getPaypalToken(fetchImpl?): Promise<string>`, con el mismo `client_credentials` que `collection-check.ts`.
  - `createTopUpOrder(params: { amountUsdCents: number; userId: number; chosenUsdCents: number; returnUrl: string; cancelUrl: string }, fetchImpl?): Promise<{ paypalOrderId: string; approveUrl: string }>`. Usa `intent: "CAPTURE"`, `USD`, `custom_id: "<userId>:<chosenUsdCents>"` y la descripción "Recarga de saldo CompraMeLaFoto".
  - `captureTopUpOrder(paypalOrderId: string, fetchImpl?): Promise<{ status: "COMPLETED" | "ALREADY_CAPTURED" | "FAILED"; captureId: string | null; paidUsdCents: number; customId: string | null }>`. Una respuesta `422 ORDER_ALREADY_CAPTURED` se resuelve con `GET /v2/checkout/orders/{id}` y devuelve el `captureId` existente.
  - `parseCustomId(customId: string | null): { userId: number; chosenUsdCents: number } | null`
  - GET estado → `{ balanceUsdCents, advanceDebtUsdCents, suggestion: suggestTopUp(...), movements: [...últimos 50] }`.
  - POST recargar `{ chosenUsdCents }` → `{ approveUrl }`. Valida y cobra `topUpCharge(chosen, debt)`.
  - GET retorno `?token=<paypalOrderId>`: captura y verifica que `customId.userId` sea el usuario de la sesión y que `paidUsdCents == topUpCharge(chosen, deudaActual)`. Después llama a `recordTopUp` y redirige a `/fotografo/configuracion?tab=saldo&recarga=ok`. Si algo falla, redirige con `recarga=error`.

- [ ] **Step 1: Write the failing tests** (con `fetch` falso):
  - `paypalBaseUrl("live")` y `paypalBaseUrl(undefined)`.
  - `createTopUpOrder` manda `amount.value: "35.00"` para `3500` y devuelve el link `rel: "payer-action"` o `"approve"`.
  - `captureTopUpOrder`: `COMPLETED` → `captureId` y `paidUsdCents: 3500`. **Review Focus 3:** un 422 `ORDER_ALREADY_CAPTURED` seguido del GET → `ALREADY_CAPTURED` con el mismo `captureId`.
  - `parseCustomId("1038:1000")` → `{ userId:1038, chosenUsdCents:1000 }`; `parseCustomId("x")` → `null`.
- [ ] **Step 2: Run** los tests. Expected: FAIL.
- [ ] **Step 3: Implement** el módulo y las tres rutas. Todas responden `404` si `!isIntlPilotUser(sessionUserId)`. Con `PAYPAL_DNX_CLIENT_ID` vacío responden `503` con "Las recargas todavía no están disponibles."
- [ ] **Step 4: Run** los tests y `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** — `"CLF internacional piloto: recarga de saldo por PayPal de DNX"`

---

### Task 8: Pantallas del fotógrafo

**Files:**
- Create: `components/fotografo/SaldoInternacionalSection.tsx`
- Modify: `app/fotografo/configuracion/ConfiguracionClient.tsx` (pestaña "Saldo", solo si la ruta GET de saldo responde 200)
- Modify: `components/fotografo/CobrosInternacionalesSection.tsx`
- Modify: el formulario de precio digital del álbum (buscar dónde se edita `digitalPhotoPriceCents` en `components/dashboard/albums/`)

**Interfaces:**
- Consumes: las rutas de la Task 7, `formatMoney`, `currencyForMpSite`.

- [ ] **Step 1: Saldo.** Arriba, el saldo en USD; si hay deuda, la línea "Adelanto a devolver: 25 USD (se cobra en tu próxima recarga)". Debajo:
  - Botones 25 / 50 / 100, con la etiqueta "Recomendado" en `suggestion.recommended`, y un campo "Otro monto" (mínimo 10).
  - El texto "Vas a pagar X USD" = elegido + deuda.
  - El botón "Recargar con PayPal" lleva a `approveUrl`.
  - La lista de movimientos: "Venta pedido #123 · 11.500 COP · comisión 0,38 USD", "Recarga 10 USD", "Adelanto 25 USD", "Devolución del adelanto 25 USD", "Ajuste: <nota>".
  - Si el saldo es ≤ 0, un aviso rojo: "Tus ventas están pausadas hasta que recargues saldo." Si es menor a 5 USD, un aviso amarillo.
- [ ] **Step 2: Cobros internacionales.** Para un fotógrafo del piloto en un país `MERCADOPAGO_OWN`, mostrar el estado de la conexión de Mercado Pago que ya tiene (`mpUserId` y el resultado de `/users/me`: país de la cuenta), con un aviso si la cuenta no es de su país. Ocultar el formulario de pegar claves. Para el resto, la sección queda como está.
- [ ] **Step 3: Precio del álbum.** En álbumes con `currency !== "ARS"`, la etiqueta del precio digital muestra la moneda ("Precio por foto (COP)"). El valor se guarda con `majorToStored` y se muestra con `storedToMajor`. Se agrega la nota "El cliente paga este precio más 15 % de comisión; vos recibís el total en tu Mercado Pago."
- [ ] **Step 4: Verify in the browser** con un usuario de prueba del piloto contra una base de prueba, nunca contra producción. Recordar que el `.env.local` de CLF apunta a una rama de auditoría. Expected: se ven el saldo, las sugerencias y el aviso de pausa. Un fotógrafo argentino no ve la pestaña "Saldo".
- [ ] **Step 5: Commit** — `"CLF internacional piloto: panel de saldo y precio en moneda local"`

---

### Task 9: Lo que ve el cliente

**Files:**
- Modify: `components/photo/ClientAlbumView.tsx`, `app/a/[id]/comprar/ComprarClient.tsx`, `app/a/[id]/comprar/resumen/page.tsx` y `app/pago/success/SuccessClient.tsx`

**Interfaces:**
- Consumes: `formatMoney(stored, currency)`, `album.currency`, `order.currency`.

- [ ] **Step 1:** Pasar `album.currency` desde el servidor a `ClientAlbumView`. En cada formateo de **precio digital y total del carrito** (`formatPurchaseArs(...)`), usar `formatMoney(valor, currency)`. Con `ARS` es idéntico.
- [ ] **Step 2:** En álbumes no-ARS, ocultar las opciones de impresión, packs, combos de reconocimiento facial y videos. Para eso alcanza con no ofrecerlas si `currency !== "ARS"`.
- [ ] **Step 3:** Si `POST /api/a/[id]/orders` responde `INTL_SALE_PAUSED`, mostrar el mensaje en el carrito sin perder lo elegido.
- [ ] **Step 4: Verify in the browser.** Un álbum `COP` del piloto muestra "$ 10.000,00" (o el formato de `Intl` para COP), el total "11.500,00" y el botón de Mercado Pago. Un álbum argentino se ve idéntico a antes. Comparar una captura antes y después de la misma galería argentina.
- [ ] **Step 5: Commit** — `"CLF internacional piloto: precios en la moneda del álbum para el cliente"`

---

### Task 10: Vista mínima del administrador

**Files:**
- Create: `app/admin/clf-internacional/page.tsx` y `app/api/admin/clf-internacional/ajuste/route.ts`

**Interfaces:**
- Consumes: `getWalletState`, `recordAdjustment`, `latestFxRate`, `isStale`; la verificación de administrador que usan las otras rutas de `app/api/admin/`.

- [ ] **Step 1:** La tabla de fotógrafos del piloto muestra id, nombre, país, saldo USD, deuda de adelanto, comisión de los últimos 30 días y última venta. Debajo, la última cotización de cada moneda, con un aviso si tiene más de 48 h.
- [ ] **Step 2:** El formulario de ajuste pide usuario, monto en USD (positivo o negativo) y un motivo obligatorio, y llama a `recordAdjustment` con `createdByUserId` del administrador. Así se registran a mano las devoluciones del piloto.
- [ ] **Step 3:** La lista de recargas (`TOPUP`) del período, con `captureId`, para que el contador emita la factura E.
- [ ] **Step 4: Verify** en el navegador como administrador. Expected: el ajuste aparece en el panel del fotógrafo.
- [ ] **Step 5: Commit** — `"CLF internacional piloto: vista del administrador con ajustes"`

---

### Task 11: Puesta en marcha del piloto

Sin código nuevo: es la lista de pasos para encenderlo. La ejecuta quien fusiona, con el dueño.

- [ ] **Step 1:** Aplicar la migración de la Task 1 en las 6 bases y registrarla con el sha256. Verificar con `select count(*) from "ClfIntlWalletMovement"` → `0` en la base de producción de CLF (`divine-hall-10689679`, rama `production`).
- [ ] **Step 2:** En Vercel (`compramelafoto-dnxsuite`, Production) cargar `PAYPAL_DNX_CLIENT_ID`, `PAYPAL_DNX_CLIENT_SECRET` y `PAYPAL_DNX_ENV=sandbox`, con `CLF_INTL_PILOT_USER_IDS` vacío. Desplegar solo CLF.
- [ ] **Step 3:** Correr a mano `GET /api/cron/intl-fx-rates` con `CRON_SECRET`. Expected: `saved` incluye `COP`, `MXN`, `CLP`, `PEN`, `UYU` y `BRL`.
- [ ] **Step 4: Prueba completa en sandbox.**
  1. Crear usuarios de prueba de Mercado Pago de Colombia (vendedor y comprador) con la herramienta de usuarios de prueba de MP.
  2. Crear un fotógrafo de prueba en CLF con país `CO`, conectarle el MP de prueba y poner su id en `CLF_INTL_PILOT_USER_IDS`.
  3. Crear un álbum y comprar una foto.
  
  Verificar: pedido `PAID` en `COP`, movimiento `COMMISSION` negativo y saldo `25 - comisión`. Recargar 10 USD con PayPal sandbox y verificar que se cobraron 35 USD, que la deuda quedó en 0 y que el saldo subió 10.
- [ ] **Step 5:** Pasar `PAYPAL_DNX_ENV=live` con las credenciales Live de la cuenta Business de DNX. Poner `CLF_INTL_PILOT_USER_IDS=1038` (Wilson Lozada, Colombia) y avisarle con el instructivo. Su primera venta real confirma el circuito. Una compra real necesita un comprador con medio de pago en Colombia: no puede pagarse a sí mismo.
- [ ] **Step 6:** Después de la primera venta real, revisar en el panel de administrador el movimiento y la cotización usada, y anotar el resultado en la memoria del proyecto.
