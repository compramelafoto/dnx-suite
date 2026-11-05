# CLF internacional · Etapa 1: país del fotógrafo y moneda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar a CLF sabiendo el país (código ISO) de cada fotógrafo y la moneda de cada álbum y pedido, sin que ninguna compra argentina cambie.

**Architecture:** Un módulo nuevo `apps/compramelafoto/lib/international/` concentra el catálogo de países, el manejo de montos por moneda y el interruptor general. La base recibe tres columnas aditivas con valor por defecto (`User.countryCode`, `Album.currency`, `Order.currency`). Con el interruptor apagado (por defecto) todo álbum nuevo nace en `ARS` y nada de la pantalla cambia salvo el selector de país.

**Tech Stack:** Next.js (leer `node_modules/next/dist/docs/` antes de tocar rutas, ver `AGENTS.md`), Prisma (`packages/db/prisma/schema.prisma`, compartido por toda la suite), tests con `node:test` vía `tsx --test` (mismo patrón que `test:referrals` en `apps/compramelafoto/package.json`).

**Spec:** `docs/superpowers/specs/2026-11-04-clf-cobro-internacional-saldo-prepago-design.md` (secciones 6.1, 6.2, 6.4, 6.4 ter, 7 etapa 1, 8).

Esta es la primera de siete etapas; cada etapa siguiente tendrá su propio plan.

## Global Constraints

- **El sistema que funciona hoy no puede verse interrumpido en ningún momento** (requisito del owner, 2026-11-05).
- Cambios de base **solo aditivos**: columnas nuevas nulas o con `DEFAULT`, nunca renombrar ni borrar.
- **El SQL se aplica en todas las bases que tienen las tablas `User`/`Album`/`Order` ANTES de fusionar el PR.** Una columna declarada en Prisma que falta en una base rompe toda lectura de ese modelo (`P2022`) en esa app. Las bases candidatas: `divine-hall-10689679` ramas `production` (`br-autumn-rain-ad18wq7y`) y `development` (`br-old-rain-adwthzng`), `bitter-math-56019731`, `wandering-pine-79918137`, `fragrant-union-80829821`, `cold-silence-10115969`. Preguntar a cada una si tiene la tabla antes de aplicar.
- Las migraciones se aplican a mano; ningún deploy corre `prisma migrate deploy`. Registrar en `_prisma_migrations` con el checksum `sha256` del `migration.sql`.
- No usar `apps/compramelafoto/.env.local` para verificar producción (apunta a una rama de auditoría).
- Interruptor: `CLF_INTERNATIONAL_ENABLED`, apagado salvo que valga exactamente `"true"`. En esta etapa no se enciende en producción.
- Álbumes `ARS` guardan pesos enteros (como hoy). Otras monedas guardan la unidad mínima (centavos; CLP sin decimales).
- Fotógrafo sin país cargado = argentino.
- Textos de pantalla en español; decir "dinero", nunca "plata".
- No agregar dependencias nuevas.

## Review Focus

1. **Texto libre raro en `User.country`** ("Mexico" sin tilde, "CABA", "Bs As", "Colombia " con espacio, mayúsculas): la normalización tiene que reconocer variantes comunes y dejar en `null` (y reportar) lo que no reconoce, nunca adivinar un país extranjero. → test en Task 1.
2. **Un fotógrafo argentino que guarda su perfil sin tocar el país** no debe terminar con `countryCode` distinto de `AR`/`null` ni perder su texto `country`. → test en Task 4.
3. **Cambiar el país teniendo álbumes**: tiene que rechazarse con un mensaje claro (lo hace un administrador), salvo que el país estuviera vacío. → test en Task 4.
4. **Interruptor con valores tipo `"TRUE"`, `"1"`, vacío**: solo `"true"` lo enciende. → test en Task 1.
5. **Formato de pesos idéntico al actual** (incluido `1500` → mismo texto que `formatPurchaseArs(1500)` y sin decimales donde hoy no hay). → test en Task 2.

---

### Task 1: Catálogo de países e interruptor

**Files:**
- Create: `apps/compramelafoto/lib/international/countries.ts`
- Create: `apps/compramelafoto/lib/international/flag.ts`
- Test: `apps/compramelafoto/lib/international/countries.test.ts`
- Modify: `apps/compramelafoto/package.json` (script `test:international`)

**Interfaces:**
- Produces:
  - `type CountryCode = string` (ISO 3166-1 alfa-2, mayúsculas)
  - `type CollectionProvider = "MERCADOPAGO_AR_SPLIT" | "MERCADOPAGO_OWN" | "PAYPAL_OWN"`
  - `type SupportedCountry = { code: CountryCode; name: string; currency: string; provider: CollectionProvider }`
  - `SUPPORTED_COUNTRIES: readonly SupportedCountry[]` (orden alfabético por `name`, Argentina primero)
  - `getCountry(code: string | null | undefined): SupportedCountry | null`
  - `normalizeCountryInput(text: string | null | undefined): CountryCode | null`
  - `currencyForCountry(code: CountryCode | null): string` (`null` → `"ARS"`)
  - `isInternationalCountry(code: CountryCode | null): boolean` (`null` y `"AR"` → `false`)
  - `isInternationalEnabled(env?: Record<string, string | undefined>): boolean` en `flag.ts`

Valores fijados por el spec (6.2):

| code | name | currency | provider |
|---|---|---|---|
| AR | Argentina | ARS | MERCADOPAGO_AR_SPLIT |
| BR | Brasil | BRL | MERCADOPAGO_OWN |
| MX | México | MXN | MERCADOPAGO_OWN |
| CL | Chile | CLP | MERCADOPAGO_OWN |
| CO | Colombia | COP | MERCADOPAGO_OWN |
| PE | Perú | PEN | MERCADOPAGO_OWN |
| UY | Uruguay | UYU | MERCADOPAGO_OWN |
| VE | Venezuela | USD | PAYPAL_OWN |
| US | Estados Unidos | USD | PAYPAL_OWN |
| CA | Canadá | CAD | PAYPAL_OWN |
| GB | Reino Unido | GBP | PAYPAL_OWN |
| ES, IT, FR, DE, PT | España, Italia, Francia, Alemania, Portugal | EUR | PAYPAL_OWN |
| BO, PY, EC, HN, SV, GT, CR, PA, DO, NI, CU | Bolivia, Paraguay, Ecuador, Honduras, El Salvador, Guatemala, Costa Rica, Panamá, República Dominicana, Nicaragua, Cuba | USD | PAYPAL_OWN |

- [ ] **Step 1: Write the failing tests** in `countries.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCountryInput, currencyForCountry, isInternationalCountry, getCountry } from "./countries";
import { isInternationalEnabled } from "./flag";

test("normaliza variantes de texto libre", () => {
  for (const v of ["Argentina", "argentina", "ARGENTINA", " Argentina ", "AR"]) assert.equal(normalizeCountryInput(v), "AR");
  for (const v of ["México", "Mexico", "mexico", "MX"]) assert.equal(normalizeCountryInput(v), "MX");
  assert.equal(normalizeCountryInput("chile"), "CL");
  assert.equal(normalizeCountryInput("United States"), "US");
  assert.equal(normalizeCountryInput("Perú"), "PE");
  assert.equal(normalizeCountryInput("Peru"), "PE");
});
test("no adivina: vacío o desconocido da null", () => {
  for (const v of [null, undefined, "", "  ", "CABA", "Bs As", "Narnia"]) assert.equal(normalizeCountryInput(v as any), null);
});
test("moneda y carácter internacional", () => {
  assert.equal(currencyForCountry(null), "ARS");
  assert.equal(currencyForCountry("AR"), "ARS");
  assert.equal(currencyForCountry("MX"), "MXN");
  assert.equal(currencyForCountry("VE"), "USD");
  assert.equal(currencyForCountry("HN"), "USD");
  assert.equal(isInternationalCountry(null), false);
  assert.equal(isInternationalCountry("AR"), false);
  assert.equal(isInternationalCountry("CO"), true);
  assert.equal(getCountry("co")?.provider, "MERCADOPAGO_OWN");
});
test("interruptor solo con 'true'", () => {
  assert.equal(isInternationalEnabled({}), false);
  for (const v of ["TRUE", "1", "", "yes"]) assert.equal(isInternationalEnabled({ CLF_INTERNATIONAL_ENABLED: v }), false);
  assert.equal(isInternationalEnabled({ CLF_INTERNATIONAL_ENABLED: "true" }), true);
});
```

- [ ] **Step 2: Add script and run to verify it fails**

En `package.json`: `"test:international": "../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.json --test lib/international/*.test.ts"`.
Run: `cd apps/compramelafoto && pnpm run test:international`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement** `countries.ts` y `flag.ts` con las firmas de arriba. `normalizeCountryInput` compara sin tildes, sin mayúsculas y sin espacios extremos contra `code`, `name` y un pequeño mapa de alias en inglés (`mexico`, `peru`, `brazil`, `spain`, `united states`, `usa`, `uk`). `isInternationalEnabled` lee `process.env` por defecto.

- [ ] **Step 4: Run tests** — `pnpm run test:international` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/international apps/compramelafoto/package.json
git commit -m "Agregar catálogo de países e interruptor de CLF internacional"
```

### Task 2: Montos por moneda

**Files:**
- Create: `apps/compramelafoto/lib/international/money.ts`
- Test: `apps/compramelafoto/lib/international/money.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `minorUnitDigits(currency: string): number` — `ARS` → `0` (pesos enteros, convención de CLF), `CLP` → `0`, resto → `2`.
  - `storedToMajor(stored: number, currency: string): number`
  - `majorToStored(major: number, currency: string): number` (redondea al entero más cercano)
  - `formatMoney(stored: number, currency: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney, storedToMajor, majorToStored } from "./money";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";

test("ARS idéntico al formateador actual", () => {
  for (const n of [0, 1, 1500, 12999, 1000000]) assert.equal(formatMoney(n, "ARS"), formatPurchaseArs(n));
});
test("centavos en USD y MXN", () => {
  assert.equal(storedToMajor(250, "USD"), 2.5);
  assert.equal(majorToStored(2.5, "USD"), 250);
  assert.equal(formatMoney(250, "USD"), new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(2.5));
  assert.equal(storedToMajor(50000, "MXN"), 500);
});
test("CLP sin decimales", () => {
  assert.equal(storedToMajor(5000, "CLP"), 5000);
  assert.equal(majorToStored(4999.6, "CLP"), 5000);
});
```

- [ ] **Step 2: Run** `pnpm run test:international` → FAIL.
- [ ] **Step 3: Implement** `money.ts`. Para `ARS`, `formatMoney` delega en `formatPurchaseArs` (no duplicar el formato). Para el resto usa `Intl.NumberFormat("es-AR", { style: "currency", currency, minimumFractionDigits: d, maximumFractionDigits: d })`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Agregar manejo de montos por moneda para CLF internacional"`.

### Task 3: Columnas aditivas en la base (antes de cualquier código que las use)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`model User` ~l.36, `model Album` ~l.2218, `model Order` ~l.3714)
- Create: `packages/db/prisma/migrations/20261105090000_clf_country_currency/migration.sql`

**Interfaces:**
- Produces (Prisma): `User.countryCode String?`, `Album.currency String @default("ARS")`, `Order.currency String @default("ARS")`.

- [ ] **Step 1: Escribir el SQL** (idempotente; en Postgres un `ADD COLUMN ... DEFAULT` constante no reescribe la tabla):

```sql
ALTER TABLE "User"  ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ARS';
```

- [ ] **Step 2: Agregar los tres campos al schema** junto a `country` (User), los precios (Album) y `totalCents` (Order), con un comentario `///` corto: "ISO 3166-1; null = Argentina" / "ARS = pesos enteros; otras = unidad mínima".
- [ ] **Step 3: Regenerar y compilar** — `pnpm --filter @repo/db run db:generate && cd apps/compramelafoto && pnpm run typecheck`. Expected: sin errores (verificar que el proceso no murió por memoria: revisar que imprima el final y el código de salida sea 0).
- [ ] **Step 4: Por cada base candidata** (ver Global Constraints), consultar `select to_regclass('"Album"'), to_regclass('"Order"'), to_regclass('"User"')`. En cada base donde existan, ejecutar el SQL del Step 1 y verificar con `select column_name from information_schema.columns where table_name in ('User','Album','Order') and column_name in ('countryCode','currency')`.
- [ ] **Step 5: Registrar la migración** en `_prisma_migrations` de cada base donde se aplicó, con `shasum -a 256 packages/db/prisma/migrations/20261105090000_clf_country_currency/migration.sql` como checksum.
- [ ] **Step 6: Commit** — `git commit -m "Agregar país ISO al usuario y moneda a álbum y pedido (aditivo)"`. En la descripción del PR: "SQL ya aplicado en <lista de bases>".

### Task 4: Selector de país en registro y perfil

**Files:**
- Create: `apps/compramelafoto/lib/international/profile-country.ts`
- Test: `apps/compramelafoto/lib/international/profile-country.test.ts`
- Modify: `apps/compramelafoto/app/api/fotografo/update/route.ts:108-110`
- Modify: `apps/compramelafoto/components/fotografo/PerfilDatosSection.tsx:383-385`
- Modify: `apps/compramelafoto/app/api/auth/register-photographer/route.ts:64-71` y su formulario de registro (buscar el componente que hace `POST` a esa ruta)

**Interfaces:**
- Consumes: `getCountry`, `normalizeCountryInput` (Task 1).
- Produces: `resolveProfileCountryUpdate(input: { requestedCode: string | undefined; currentCode: string | null; albumCount: number }): { ok: true; countryCode: string | null; countryName: string | null } | { ok: false; status: 400 | 409; error: string }`

Reglas: `requestedCode` `undefined` → no cambia (`ok` con los valores actuales; la ruta no escribe). Código no soportado → `400`, "País no válido". `currentCode` no nulo, distinto del pedido y `albumCount > 0` → `409`, "Para cambiar el país con álbumes creados, escribinos y lo hacemos nosotros." En los demás casos `ok` con el código y `getCountry(code).name`.

- [ ] **Step 1: Write the failing tests** cubriendo: sin cambio; AR→AR con álbumes (ok); null→MX con álbumes (ok); AR→MX con 3 álbumes (409 con el texto exacto); AR→MX sin álbumes (ok, nombre "México"); "XX" (400).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `resolveProfileCountryUpdate`. En `update/route.ts`, si `body.countryCode !== undefined`, contar `prisma.album.count({ where: { userId } })`, aplicar la función y escribir `countryCode` y `country` (el nombre); si no viene `countryCode`, el manejo actual de `body.country` queda **igual**.
- [ ] **Step 4: Pantallas.** En `PerfilDatosSection` reemplazar el `Input` de "País" por un `select` de `SUPPORTED_COUNTRIES` (valor inicial: `countryCode` del usuario, o `normalizeCountryInput(country)`, o vacío con la opción "Elegí tu país") que manda `countryCode`. En el registro de fotógrafo, agregar el mismo `select`, obligatorio en el formulario; la ruta acepta `countryCode` opcional (las otras vías de alta, como Google, no lo mandan) y, si es válido, guarda `countryCode` y `country`.
- [ ] **Step 5: Run** `pnpm run test:international && pnpm run typecheck` → PASS. Probar en el navegador local: perfil de un fotógrafo argentino guarda sin cambiar nada; registro nuevo con México guarda `MX`/"México".
- [ ] **Step 6: Commit** — `git commit -m "Pedir el país del fotógrafo en registro y perfil"`.

### Task 5: Normalizar los países ya cargados

**Files:**
- Create: `apps/compramelafoto/scripts/international/backfill-country-code.ts`

**Interfaces:**
- Consumes: `normalizeCountryInput` (Task 1).

- [ ] **Step 1: Implement** el script: lee usuarios con `countryCode` nulo y `country` no vacío; por defecto **solo informa** (`--apply` para escribir). Imprime un resumen por código y la lista de textos no reconocidos. Escribe únicamente `countryCode`, nunca `country`. Recibe la cadena de conexión por variable `DATABASE_URL` explícita.
- [ ] **Step 2: Run en modo informe** contra la rama `production` de CLF. Expected (al 2026-11-04): ~382 `AR`, 5 `MX`, 4 `CO`, 3 `UY`, 2 `CL`, 2 `HN`, 2 `VE`, 1 `US`, 1 `SV`, 1 `PE`. Mostrar el resumen al owner antes de aplicar.
- [ ] **Step 3: Run con `--apply`** y repetir el informe: no debe quedar ningún texto reconocible sin código.
- [ ] **Step 4: Commit** — `git commit -m "Script para normalizar el país de los fotógrafos"`.

### Task 6: Moneda al crear álbumes (detrás del interruptor)

**Files:**
- Create: `apps/compramelafoto/lib/international/album-currency.ts`
- Test: `apps/compramelafoto/lib/international/album-currency.test.ts`
- Modify: `apps/compramelafoto/app/api/dashboard/albums/route.ts` y `apps/compramelafoto/app/api/dashboard/albums/create-confirm/route.ts` (las dos llamadas a `prisma.album.create`)

**Interfaces:**
- Consumes: `currencyForCountry`, `isInternationalEnabled`.
- Produces: `currencyForNewAlbum(ownerCountryCode: string | null, enabled: boolean): string`

- [ ] **Step 1: Write the failing tests**: `(null,false)→"ARS"`, `("MX",false)→"ARS"`, `("MX",true)→"MXN"`, `("AR",true)→"ARS"`, `(null,true)→"ARS"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** y en las dos rutas pasar `currency: currencyForNewAlbum(user.countryCode, isInternationalEnabled())` en el `data` del `create` (leer `countryCode` del usuario que ya se consulta en la ruta; si la ruta no lo trae, agregarlo al `select`).
- [ ] **Step 4: Run** `pnpm run test:international && pnpm run typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Fijar la moneda del álbum al crearlo (apagado por defecto)"`.

### Task 7: Verificación de que Argentina no cambió

- [ ] **Step 1: Run** `cd apps/compramelafoto && pnpm run test:international && pnpm run test:referrals && pnpm run test:album-config-form && pnpm run typecheck` → todo PASS.
- [ ] **Step 2: Compilación de producción local** — `pnpm --filter compramelafoto build` (el CI no la corre). Expected: termina sin errores.
- [ ] **Step 3: Prueba manual local** con el interruptor apagado: crear un álbum argentino, ver la galería y llegar al pago de Mercado Pago de prueba: mismos precios, misma comisión, `currency_id: "ARS"`. Verificar en la base que el álbum y el pedido quedaron con `currency = 'ARS'`.
- [ ] **Step 4:** Abrir el PR con la lista de bases donde se aplicó el SQL y la salida del script de la Task 5.
