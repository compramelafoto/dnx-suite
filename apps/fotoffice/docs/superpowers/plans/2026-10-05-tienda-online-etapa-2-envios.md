# Tienda online — Etapa 2 (envíos con costo calculado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar a la tienda de FOTOFFICE envío a domicilio y a sucursal con costo calculado (tabla propia de la institución o Correo Argentino MiCorreo) más un recargo de logística, despacho con número de seguimiento y correo al comprador.

**Architecture:** Cálculo puro en `lib/store/shipping/*` (paquete, zona/escalón, recargo); cliente HTTP de MiCorreo con `fetch` inyectable en `lib/integrations/correo-argentino/*` y credenciales cifradas en `WorkspaceIntegration`; una puerta `quoteShipping()` que elige la fuente y el respaldo; el checkout y `createStoreOrder` re-cotizan en el servidor; `finalizePaidOrder` agrega el renglón de envío a la `Sale`.

**Tech Stack:** Next.js del repo (leer `node_modules/next/dist/docs/` antes de tocar rutas), Prisma 6 (`@repo/db`), Vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-05-tienda-online-etapa-2-envios-design.md`
**API de MiCorreo:** `apps/fotoffice/docs/integraciones/correo-argentino-micorreo-api.md`

## Global Constraints

- Plata: centavos enteros en código (`Minor`), `Decimal(12,2)` en base (`Ars`), conversión sólo con `lib/membership/money.ts`. Porcentaje en bps (10000 = 100 %), redondeo al centavo con `Math.round`.
- Nunca catch de P2002 dentro de una transacción interactiva. Toda consulta con `workspaceId`. Logs sin datos personales ni credenciales.
- Migración: `packages/db/prisma/migrations/20261005120000_store_shipping/migration.sql`, sólo aditiva (tablas, columnas nulas, `ALTER TYPE "StoreOrderStatus" ADD VALUE 'SHIPPED'`). Se aplica a mano antes del deploy.
- Credenciales de MiCorreo: cifradas con `lib/integrations/vault.ts` en `WorkspaceIntegration` (provider `"CORREO_ARGENTINO"`, integrationKey `"correo-argentino"`). Nunca se devuelven al navegador.
- URLs base MiCorreo: pruebas `https://apitest.correoargentino.com.ar/micorreo/v1`, producción `https://api.correoargentino.com.ar/micorreo/v1`.
- Límites MiCorreo: peso 1–25000 g, cada lado ≤ 150 cm, enteros.
- Comisión de DNX sobre los productos, no sobre el envío.
- Textos en español rioplatense, sin jerga. Horas en hora argentina.
- Pruebas: `cd apps/fotoffice && npx vitest run <ruta>`; suite completa y `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .` antes de cada commit final de tarea. Commits en español terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Esquema y migración
**Files:** `packages/db/prisma/schema.prisma`; `packages/db/prisma/migrations/20261005120000_store_shipping/migration.sql`
**Produces:** modelos `StoreShippingSettings`, `StoreShippingZone`, `StoreShippingRate` y columnas nuevas de `StoreOrder` exactamente como el §3 del spec (relaciones: settings y zonas → `Workspace` en cascada; rates → zona en cascada); valor `SHIPPED` en `StoreOrderStatus`.
- [ ] Copiar los modelos del spec §3 con tipos Prisma reales (`Decimal @db.Decimal(12,2)`, `String[]`, `Json?`), índices `@@index([workspaceId, sortOrder])` en zonas.
- [ ] `prisma validate` + `generate` (con `DATABASE_URL`/`DIRECT_URL` ficticias).
- [ ] Migración con `prisma migrate diff --from-schema-datamodel <origin/main> --to-schema-datamodel prisma/schema.prisma --script`; revisar que sólo sea aditiva; el `ALTER TYPE ... ADD VALUE` va primero y fuera de cualquier `BEGIN` explícito.
- [ ] Reexportar enums/tipos nuevos desde `packages/db/src/client.ts` si hace falta (como `StoreOrderStatus`).
- [ ] Suite FOTOFFICE en verde; commit "Tienda: esquema de envíos".

### Task 2: Cálculo puro de envío
**Files:** crear `lib/store/shipping/{package.ts,table.ts,surcharge.ts,provinces.ts}` + tests.
**Produces:**
- `PROVINCES: readonly { code: string; name: string }[]` — códigos de provincia de Correo Argentino (A Salta, B Buenos Aires, C CABA, D San Luis, E Entre Ríos, F La Rioja, G Santiago del Estero, H Chaco, J San Juan, K Catamarca, L La Pampa, M Mendoza, N Misiones, P Formosa, Q Neuquén, R Río Negro, S Santa Fe, T Tucumán, U Chubut, V Tierra del Fuego, W Corrientes, X Córdoba, Y Jujuy, Z Santa Cruz); `isProvinceCode(c)`.
- `normalizePostalCode(raw): string | null` — acepta "2000", " 2000 ", "S2000ABC" (CPA → 4 dígitos), rechaza lo demás.
- `buildPackage(items: { qty: number; weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null }[], cfg: { packagingGrams; defaultUnitGrams; boxLengthCm; boxWidthCm; boxHeightCm }): { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number }` — reglas E4/E5 del spec; todos enteros ≥ 1.
- `pickZone(zones: { id; postalCodes: string[]; provinceCodes: string[]; isRestOfCountry: boolean; sortOrder: number }[], dest: { postalCode: string; provinceCode: string }): string | null` — CP exacto > provincia > resto del país; empate por `sortOrder`.
- `pickRate(rates: { maxGrams: number; priceMinor: number }[], weightGrams): number | null` — primer `maxGrams >= peso` ordenando por `maxGrams`.
- `applySurcharge(baseMinor, { kind: "NONE"|"PERCENT"|"FIXED"; value: number }): number`.
- `exceedsCorreoLimits(pkg): boolean` (peso > 25000 o lado > 150).
- [ ] TDD con casos borde (peso exacto en el límite del escalón, sin zonas, provincia y CP a la vez, recargo 0, porcentaje con redondeo, productos sin peso, medidas de producto mayores que la caja).
- [ ] Commit "Tienda: cálculo de paquete, zona y recargo".

### Task 3: Cliente de MiCorreo y credenciales cifradas
**Files:** crear `lib/integrations/correo-argentino/{client.ts,credentials.ts,errors.ts}` + tests; modificar `lib/integrations/registry.ts` (+test) para el proveedor `CORREO_ARGENTINO` (scopes vacíos, `requiredByModules: []`, status AVAILABLE) sin romper la UI de integraciones de Google (si la UI lista todas, filtrar las que no son OAuth o mostrarla sin botón de Google).
**Produces:**
- `createMiCorreoClient({ env: "TEST"|"PROD", apiUser, apiPassword, fetchImpl?, now? })` con métodos `getToken()` (cache hasta `expires − 60 s`), `validateUser(email, password): Promise<{ customerId: string }>`, `rates({ customerId, postalCodeOrigin, postalCodeDestination, deliveredType?: "D"|"S", dimensions: { weight, height, width, length } }): Promise<{ deliveredType: "D"|"S"; productName: string; priceMinor: number; raw: unknown }[]>`, `agencies({ customerId, provinceCode }): Promise<{ id: string; name: string; address: string; city: string; postalCode: string }[]>`. Errores tipados `MiCorreoError` con `kind: "AUTH"|"BUSINESS"|"RATE_LIMIT"|"NETWORK"|"UNEXPECTED"`. Timeout 8 s.
- `saveCorreoArgentinoCredentials(workspaceId, userId, input: { env; apiUser; apiPassword; accountEmail; accountPassword })`: valida (token + validateUser), cifra `{ env, apiUser, apiPassword, customerId }` (la contraseña de la cuenta MiCorreo NO se guarda: sólo sirve para obtener el `customerId`), guarda en `WorkspaceIntegration` (accountEmail = email MiCorreo, status ACTIVE). `loadCorreoArgentinoClient(workspaceId)` → `{ client, customerId } | null`. `markCorreoNeedsReconsent(workspaceId)`. `deleteCorreoArgentinoCredentials(workspaceId)`.
- Seguir exactamente los nombres de campos de la referencia de la API; donde la doc es ambigua (moneda, formato de `price`, nombre de campos de `/agencies`), parsear defensivamente y cubrirlo con tests sobre fixtures tomados de la doc.
- [ ] TDD con `fetchImpl` falso; ningún test sale a la red. Commit "Tienda: cliente de MiCorreo y credenciales cifradas".

### Task 4: Cotizador
**Files:** crear `lib/store/shipping/quote.ts` + test; `lib/store/shipping/repository.ts` (lecturas de settings/zonas/rates con `workspaceId`).
**Produces:** `quoteShipping({ workspaceId, method: "HOME"|"BRANCH", destination: { postalCode; provinceCode }, items: { productId; variantId; qty }[], db? , deps? }): Promise<{ ok: true; quote: ShippingQuote } | { ok: false; reason: "DISABLED"|"NO_COVERAGE"|"TOO_BIG"|"UNAVAILABLE" }>` con `ShippingQuote = { method; source: "TABLE"|"CORREO_ARGENTINO"; baseMinor; surchargeMinor; totalMinor; serviceName: string; package: {...}; raw: unknown }`. Lee pesos y medidas de `ProductStoreListing` (por producto; las variantes heredan). BRANCH sólo con Correo. Respaldo a la tabla según `tableAsFallback`; cuando Correo falla por AUTH marca `NEEDS_RECONSENT`. Nunca lanza por la red.
- [ ] TDD (tabla, correo, respaldo, sin cobertura, demasiado grande, método apagado). Commit "Tienda: cotizador de envíos".

### Task 5: Configuración de envíos en el panel
**Files:** `app/(shell)/ventas/tienda/envios/{page.tsx,actions.ts,*.tsx}`; `lib/store/shipping/settings-form.ts` + test; submenú en `lib/modules/submodules.ts` ("Envíos" → `/ventas/tienda/envios`, mismo permiso que Configuración: `requireStoreConfigurer`).
**Produces:** formulario de settings (spec §4), editor de zonas con escalones (alta/edición/baja, validación: maxGrams únicos y > 0, precio ≥ 0, al menos un escalón, un solo "resto del país"), conexión de Correo Argentino con "Probar conexión" (cotiza al CP de origen con la caja por defecto), lista de productos online sin peso con enlace a su ficha. Activar domicilio/sucursal exige CP de origen y, para sucursal, Correo conectado. Los formularios con `onSubmit` (no `action`) como en la etapa 1 para no perder lo escrito.
- [ ] TDD del parseo; typecheck de la UI. Commit "Tienda: configuración de envíos".

### Task 6: Checkout con envío
**Files:** `app/w/[workspaceSlug]/tienda/(abierta)/checkout/*`; `lib/store/checkout-input.ts` (+test) para `delivery: { method: "PICKUP" } | { method: "HOME"; address: {...} } | { method: "BRANCH"; agency: {...}; provinceCode }`; acciones `quoteShippingAction` y `listAgenciesAction` con límite por IP (reusar el limitador en memoria existente) y que sólo devuelven precio/servicio (nunca datos internos).
**Produces:** selector de método según settings, formulario de dirección (calle, número, piso/depto opcional, localidad, provincia de `PROVINCES`, CP), lista de sucursales por provincia, cotización en vivo, total productos + envío. Si la cotización falla: mensaje del spec E14 y sólo retiro.
- [ ] Tests del input. Commit "Tienda: elegir envío en el checkout".

### Task 7: Pedido, cobro y acreditación con envío
**Files:** `lib/store/create-order.ts`, `lib/store/payment.ts`, `lib/store/credit-payment.ts` (+tests).
**Produces:** `createStoreOrder` re-cotiza con `quoteShipping` ANTES de abrir la transacción (fuera del lock), y guarda `deliveryMethod: "SHIPPING"`, `shippingMethod`, `shippingSource`, `shippingArs`, `shippingQuoteJson`, `shippingAddressJson`/`shippingAgencyJson`, `totalArs = subtotal + envío`. Si la re-cotización falla → error "No pudimos calcular el envío. Probá de nuevo o elegí retiro." La idempotencia compara también el método y destino. `startStoreCheckout`: monto = total; comisión sobre el subtotal de productos (E11). `finalizePaidOrder`: si `shippingArs > 0` agrega el renglón suelto "Envío a domicilio" / "Envío a sucursal" (productId null, qty 1, costo null). El control de monto de la acreditación usa el total con envío.
- [ ] TDD. Commit "Tienda: pedidos con envío".

### Task 8: Despacho, seguimiento y correos
**Files:** `lib/store/transitions.ts` (+test) con `SHIPPED`; `lib/store/constants.ts` (etiqueta "Despachado"); `lib/store/order-admin.ts` (+test); `app/(shell)/ventas/tienda/**` (mostrar dirección/sucursal/paquete/fuente; botón "Marcar despachado" con número de seguimiento); `lib/store/emails.ts` + `email-render.ts` (+test) correo "Tu pedido está en camino"; correos existentes muestran envío y dirección en lugar de retiro cuando corresponde; página pública del pedido igual.
**Produces:** transiciones: pedidos con envío PAID→SHIPPED→DELIVERED y PAID/SHIPPED→CANCELLED (con nota, anula la venta como hoy); READY sólo para retiro. `changeOrderStatus(... to: "SHIPPED", trackingNumber?)` guarda `trackingNumber`, `shippedAt`, evento, correo después del commit. Pestaña "Para despachar" en el panel.
- [ ] TDD. Commit "Tienda: despacho con seguimiento".

### Task 9: Verificación final
- [ ] Suite completa, typecheck y `pnpm --filter fotoffice build` (con `DATABASE_URL` ficticia) en verde.
- [ ] Commit de arreglos si hiciera falta. No abrir PR (lo hace el controlador).
