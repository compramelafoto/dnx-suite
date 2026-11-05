# CLF internacional · Etapa 2: conectar la cuenta de cobro. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un fotógrafo del exterior puede pegar sus credenciales de Mercado Pago (su propia aplicación) o de PayPal (su app Live), probarlas, verlas enmascaradas y desconectarlas. Todo queda guardado cifrado, y nada de esto se ve mientras el interruptor siga apagado.

**Architecture:** Hay una tabla nueva, `ClfIntlCollectionAccount`, que guarda los datos públicos de la cuenta y un puntero a `DnxEncryptedCredential`, donde va el secreto cifrado con las piezas de `@repo/payments/credential-vault`. El paquete compartido no se toca.
- **Lógica pura:** forma de las credenciales, prueba de conexión con `fetch` inyectable y acceso según país e interruptor. Vive en `lib/international/` y tiene pruebas con node:test.
- **Rutas:** `/api/fotografo/cobros-internacionales` responden `404` con el interruptor apagado.
- **Pantalla:** se dibuja en la pestaña "Mercado Pago" de Configuración solo si la ruta dice `available: true`. Si no, la pestaña sigue mostrando exactamente lo de hoy.

**Tech Stack:** Next.js (app `apps/compramelafoto`), Prisma (`packages/db`), node:test con `tsx`, Neon.

**Spec:** `docs/superpowers/specs/2026-11-04-clf-cobro-internacional-saldo-prepago-design.md` (secciones 6.2, 6.3, 6.6 "Desconectar o cambiar la cuenta de cobro", 8).

## Global Constraints

- El sistema que funciona hoy no puede verse interrumpido en ningún momento. Los cambios de base son solo aditivos: tablas nuevas, nunca renombrar ni borrar.
- Todo lo internacional queda detrás de `CLF_INTERNATIONAL_ENABLED` (encendido solo con el valor exacto `"true"`, vía `isInternationalEnabled()`).
- La pestaña "Mercado Pago" de un fotógrafo argentino, o con el interruptor apagado, se ve y funciona idéntica a hoy (`MercadoPagoIntegration`).
- Las credenciales se guardan **cifradas** y nunca se vuelven a mostrar completas: solo los últimos 4 caracteres.
- No se agregan dependencias. No se modifica `packages/payments`.
- La migración se aplica a mano en las 6 bases y se registra en `_prisma_migrations` con el sha256 (práctica del repo) **antes** de fusionar.
- Textos en español, como frases completas (traducibles después). Dinero, nunca "plata".
- Las credenciales desconectadas no se borran: quedan `INACTIVE` y cifradas (la purga a los 30 días queda para la etapa 5, que es la que las usa).

## Review Focus

1. **Fotógrafo que cambió de país sin álbumes y tiene una cuenta del medio anterior.** Por ejemplo, conectó Mercado Pago como México y ahora figura en EE. UU. La vista debe avisar que la cuenta conectada no corresponde a su país y ofrecer conectar la correcta, no mostrarla como válida.
2. **Credenciales pegadas con espacios o saltos de línea** (copiar y pegar desde la web). Se recortan antes de validar y de cifrar.
3. **Token de prueba (`TEST-…`) de Mercado Pago en producción.** Se rechaza con un mensaje claro, sin intentar la llamada.
4. **Mercado Pago o PayPal caídos o lentos al probar.** El límite es de 10 s y el mensaje es "no pudimos comprobar", distinto de "credenciales inválidas". No se guarda nada.
5. **Clave de cifrado ausente en el servidor.** Responde `503` con "Los cobros internacionales todavía no están disponibles". Nunca se guarda en claro.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` | modelo `ClfIntlCollectionAccount` y relación inversa en `User` |
| `packages/db/prisma/migrations/20270127090000_clf_intl_collection_account/migration.sql` | tabla e índices |
| `apps/compramelafoto/lib/international/collection-secret.ts` (+ `.test.ts`) | tipos del secreto, limpieza, validación de forma, últimos 4, entorno |
| `apps/compramelafoto/lib/international/collection-vault.ts` (+ `.test.ts`) | cifrar y descifrar con el vault |
| `apps/compramelafoto/lib/international/collection-check.ts` (+ `.test.ts`) | "Probar conexión" contra Mercado Pago y PayPal |
| `apps/compramelafoto/lib/international/collection-access.ts` (+ `.test.ts`) | quién puede ver la pantalla, qué medio le toca, vista pública |
| `apps/compramelafoto/lib/international/collection-account-service.ts` | conectar, desconectar, probar y leer (Prisma) |
| `apps/compramelafoto/app/api/fotografo/cobros-internacionales/route.ts` | GET, POST, DELETE |
| `apps/compramelafoto/app/api/fotografo/cobros-internacionales/probar/route.ts` | POST |
| `apps/compramelafoto/components/fotografo/CobrosInternacionalesSection.tsx` | la pantalla |
| `apps/compramelafoto/components/fotografo/IntlCollectionInstructions.tsx` | instructivo paso a paso |
| `apps/compramelafoto/app/fotografo/configuracion/ConfiguracionClient.tsx` | elegir qué mostrar en la pestaña "Mercado Pago" |

---

### Task 1: Tabla de cuentas de cobro internacionales

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo nuevo y campo inverso en `model User`)
- Create: `packages/db/prisma/migrations/20270127090000_clf_intl_collection_account/migration.sql`

**Interfaces:**
- Produces: `prisma.clfIntlCollectionAccount`, con los campos:
  - `id String @id @default(cuid())`
  - `userId Int`
  - `provider String` (`"MERCADOPAGO_OWN"` | `"PAYPAL_OWN"`)
  - `environment String` (`"TEST"` | `"PROD"`)
  - `credentialId String` (id de `DnxEncryptedCredential`, sin relación Prisma)
  - `secretLast4 String`, `accountId String?`, `accountLabel String?`, `accountCountryCode String?`
  - `status String @default("ACTIVE")` (`"ACTIVE"` | `"INACTIVE"`)
  - `connectedAt DateTime @default(now())`, `disconnectedAt DateTime?`, `lastCheckedAt DateTime?`
  - `createdAt`, `updatedAt @updatedAt`
  - Relación con `User` (`onDelete: Cascade`), `@@index([userId, status])`.
  - En `User` se agrega `clfIntlCollectionAccounts ClfIntlCollectionAccount[]`.

- [ ] **Step 1: Agregar el modelo** con doc-comment `/// CLF internacional: cuenta de cobro propia del fotógrafo (MP de su país o PayPal). El secreto vive cifrado en DnxEncryptedCredential.`
- [ ] **Step 2: Escribir la migración** con `CREATE TABLE IF NOT EXISTS`, la FK a `"User"("id")` `ON DELETE CASCADE`, `CREATE INDEX IF NOT EXISTS` sobre (`userId`,`status`) y un índice único parcial:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS "ClfIntlCollectionAccount_one_active_per_user"
    ON "ClfIntlCollectionAccount"("userId") WHERE "status" = 'ACTIVE';
  ```
  La FK va en un bloque `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ...) ...` para que la migración se pueda repetir.
- [ ] **Step 3: Verificar**
  - Run: `cd packages/db && npx prisma validate && npx prisma generate`
  - Expected: "The schema … is valid" y cliente generado.
- [ ] **Step 4: Commit** `Agregar la tabla de cuentas de cobro internacionales`

(La migración **no** se aplica en esta tarea. Se aplica en la Task 7, con el OK ya dado para etapas aditivas.)

---

### Task 2: Secreto: forma, limpieza y últimos 4

**Files:**
- Create: `apps/compramelafoto/lib/international/collection-secret.ts`
- Test: `apps/compramelafoto/lib/international/collection-secret.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type IntlCollectionProvider = "MERCADOPAGO_OWN" | "PAYPAL_OWN";
  export type IntlPaymentsEnvironment = "TEST" | "PROD";
  export type IntlCollectionSecret =
    | { provider: "MERCADOPAGO_OWN"; accessToken: string }
    | { provider: "PAYPAL_OWN"; clientId: string; clientSecret: string };
  export function cleanCollectionSecret(raw: unknown): IntlCollectionSecret | null; // recorta espacios/saltos; null si falta algo o provider desconocido
  export function validateCollectionSecret(s: IntlCollectionSecret, env: IntlPaymentsEnvironment): string | null; // mensaje de error o null
  export function collectionSecretLast4(s: IntlCollectionSecret): string; // MP: últimos 4 del token; PayPal: últimos 4 del clientId
  export function resolveIntlPaymentsEnvironment(env?: NodeJS.ProcessEnv): IntlPaymentsEnvironment; // CLF_INTL_PAYMENTS_ENV "TEST"/"PROD"; si no, PROD solo con NODE_ENV==="production"
  ```

- [ ] **Step 1: Escribir las pruebas fallidas**
  - `cleanCollectionSecret({provider:"MERCADOPAGO_OWN", accessToken:"  APP_USR-123\n"})` → `{provider:"MERCADOPAGO_OWN", accessToken:"APP_USR-123"}`.
  - `cleanCollectionSecret({provider:"PAYPAL_OWN", clientId:"a", clientSecret:""})` → `null`; `cleanCollectionSecret({provider:"STRIPE"})` → `null`.
  - En `PROD`, `validateCollectionSecret` con `accessToken:"TEST-1234567890"` devuelve `"Ese es un token de prueba. Pegá el Access Token de producción, que empieza con APP_USR-."`
  - En `PROD`, `"abc"` → `"El Access Token no tiene el formato de Mercado Pago (empieza con APP_USR-)."`
  - En `TEST`, `"TEST-1234567890"` → `null`.
  - PayPal con `clientId` o `clientSecret` de menos de 20 caracteres → `"El Client ID y el Secret de PayPal parecen incompletos. Copialos de nuevo desde tu app Live."`
  - `collectionSecretLast4` sobre `"APP_USR-abcd9876"` → `"9876"`.
  - `resolveIntlPaymentsEnvironment({CLF_INTL_PAYMENTS_ENV:"TEST", NODE_ENV:"production"})` → `"TEST"`; `{NODE_ENV:"development"}` → `"TEST"`; `{NODE_ENV:"production"}` → `"PROD"`.
- [ ] **Step 2: Correr y ver que fallan.** Run: `cd apps/compramelafoto && npm run test:international`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** en `collection-secret.ts`.
- [ ] **Step 4: Correr de nuevo.** Expected: PASS (todas, también las de la etapa 1).
- [ ] **Step 5: Commit** `Validar las credenciales de cobro internacional`

---

### Task 3: Cifrar y descifrar el secreto

**Files:**
- Create: `apps/compramelafoto/lib/international/collection-vault.ts`
- Test: `apps/compramelafoto/lib/international/collection-vault.test.ts`

**Interfaces:**
- Consumes: `IntlCollectionSecret`, `IntlPaymentsEnvironment` (Task 2). De `@repo/payments/credential-vault`: `encryptUtf8`, `decryptUtf8`, `decodeMasterKey`, `loadCredentialVaultKeyConfig`, `createMemoryCredentialStore`, `UNIT_TEST_MASTER_KEY_BASE64`, `type CredentialRecordStore`, `CredentialVaultError`. De `@repo/payments/infrastructure/prisma/credential-store`: `createPrismaCredentialStore`.
- Produces:
  ```ts
  export type CollectionVaultDeps = { store: CredentialRecordStore; env?: NodeJS.ProcessEnv };
  export async function encryptCollectionSecret(secret: IntlCollectionSecret, environment: IntlPaymentsEnvironment, deps: CollectionVaultDeps): Promise<{ credentialId: string }>;
  export async function decryptCollectionSecret(credentialId: string, deps: CollectionVaultDeps): Promise<IntlCollectionSecret>;
  export function isCollectionVaultConfigured(environment: IntlPaymentsEnvironment, env?: NodeJS.ProcessEnv): boolean;
  export function defaultCollectionVaultDeps(): CollectionVaultDeps; // usa createPrismaCredentialStore(prisma)
  ```
  El registro guardado lleva:
  - `provider`: `"MERCADOPAGO"` o `"PAYPAL"`
  - `purpose`: `"clf_intl_collection"`
  - id con el mismo formato `dnxcred_` + 20 hex, como el vault existente

- [ ] **Step 1: Pruebas fallidas** con `createMemoryCredentialStore()` y `env = { DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST: UNIT_TEST_MASTER_KEY_BASE64 }`:
  - Ida y vuelta: un secreto de PayPal cifrado y descifrado vuelve igual.
  - El `ciphertext` guardado no contiene el `clientSecret` ni el `accessToken` en texto.
  - El `provider` guardado es `"PAYPAL"` (PayPal) o `"MERCADOPAGO"` (MP), con `purpose === "clf_intl_collection"`.
  - Sin clave, `encryptCollectionSecret` rechaza con un `CredentialVaultError` de código `MASTER_KEY_MISSING` y el store queda vacío.
  - `isCollectionVaultConfigured("PROD", {})` da `false`.
  - Descifrar un id revocado (`store.markRevoked`) rechaza con código `CREDENTIAL_REVOKED`.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.**
  - El texto cifrado es `JSON.stringify(secret)`.
  - `decryptCollectionSecret` valida el resultado con `cleanCollectionSecret` y, si da `null`, lanza `CredentialVaultError("INVALID_PAYLOAD", ...)`.
- [ ] **Step 4: Correr de nuevo.** Expected: PASS.
- [ ] **Step 5: Commit** `Cifrar las credenciales de cobro internacional`

---

### Task 4: "Probar conexión"

**Files:**
- Create: `apps/compramelafoto/lib/international/collection-check.ts`
- Test: `apps/compramelafoto/lib/international/collection-check.test.ts`

**Interfaces:**
- Consumes: `IntlCollectionSecret`, `IntlPaymentsEnvironment` (Task 2); `getCountry` (etapa 1, `countries.ts`).
- Produces:
  ```ts
  export type CollectionCheckResult =
    | { ok: true; accountId: string | null; accountLabel: string; accountCountryCode: string | null }
    | { ok: false; reason: "INVALID_CREDENTIALS" | "PROVIDER_UNAVAILABLE" };
  export async function checkCollectionSecret(secret: IntlCollectionSecret, environment: IntlPaymentsEnvironment, fetchImpl?: typeof fetch): Promise<CollectionCheckResult>;
  export const MP_SITE_TO_COUNTRY: Record<string, string>; // MLA AR, MLB BR, MLM MX, MLC CL, MCO CO, MPE PE, MLU UY, MLV VE
  export function countryMismatchMessage(userCountryCode: string, accountCountryCode: string | null): string | null;
  export function checkFailureMessage(reason: "INVALID_CREDENTIALS" | "PROVIDER_UNAVAILABLE", provider: IntlCollectionProvider): string;
  ```
- **Mercado Pago:** `GET https://api.mercadopago.com/users/me` con `Authorization: Bearer <token>`.
  - Si responde 200, el resultado se arma así:
    - `accountId`: `String(id)`
    - `accountLabel`: `nickname` o, si no hay, `email`
    - `accountCountryCode`: `MP_SITE_TO_COUNTRY[site_id] ?? country_id ?? null`
  - 401 o 403 → `INVALID_CREDENTIALS`. Cualquier otra respuesta, error de red o demora mayor a 10 s (`AbortSignal.timeout(10_000)`) → `PROVIDER_UNAVAILABLE`.
- **PayPal:** `POST {base}/v1/oauth2/token`, con `Authorization: Basic base64(clientId:clientSecret)` y cuerpo `grant_type=client_credentials`.
  - `base` es `https://api-m.paypal.com` en `PROD` y `https://api-m.sandbox.paypal.com` en `TEST`.
  - Si responde 200, el resultado se arma así:
    - `accountId`: `app_id` o `null`
    - `accountLabel`: `"App de PayPal ···" + last4 del clientId`
    - `accountCountryCode`: `null`
  - 401 → `INVALID_CREDENTIALS`. El resto se trata igual que en Mercado Pago.
- Mensajes exactos:
  - `countryMismatchMessage("MX","BR")` → `"Esta cuenta de Mercado Pago es de Brasil y tu país es México. Conectá la cuenta del país donde vendés."` (nombres desde `getCountry`). Si el país de la cuenta es `null` o coincide → `null`.
  - `checkFailureMessage("INVALID_CREDENTIALS","MERCADOPAGO_OWN")` → `"Mercado Pago rechazó esas credenciales. Revisá que sea el Access Token de producción de tu aplicación."`
  - Para PayPal: `"PayPal rechazó esas credenciales. Revisá el Client ID y el Secret de tu app Live."`
  - `PROVIDER_UNAVAILABLE` → `"No pudimos comprobar la conexión ahora. Probá de nuevo en unos minutos."`

- [ ] **Step 1: Pruebas fallidas** con un `fetchImpl` falso que registra la URL y los headers y devuelve `new Response(JSON.stringify(...), {status})`:
  - MP 200 con `{id:123, nickname:"FOTOMX", site_id:"MLM"}` → `{ok:true, accountId:"123", accountLabel:"FOTOMX", accountCountryCode:"MX"}`, y el header `Authorization` es `"Bearer APP_USR-..."`.
  - MP 401 → `INVALID_CREDENTIALS`. MP 500 → `PROVIDER_UNAVAILABLE`. Un `fetchImpl` que lanza → `PROVIDER_UNAVAILABLE`.
  - PayPal `PROD` llama a `https://api-m.paypal.com/v1/oauth2/token`; `TEST` llama a la URL de sandbox. 200 con `{app_id:"APP-80W"}` → `accountId:"APP-80W"`. 401 → `INVALID_CREDENTIALS`.
  - Las tres frases de `checkFailureMessage` y de `countryMismatchMessage` de arriba, más los dos casos que dan `null`.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr de nuevo.** Expected: PASS.
- [ ] **Step 5: Commit** `Probar la conexión con Mercado Pago o PayPal del fotógrafo`

---

### Task 5: Acceso, vista pública, servicio y rutas

**Files:**
- Create: `apps/compramelafoto/lib/international/collection-access.ts`
- Test: `apps/compramelafoto/lib/international/collection-access.test.ts`
- Create: `apps/compramelafoto/lib/international/collection-account-service.ts`
- Create: `apps/compramelafoto/app/api/fotografo/cobros-internacionales/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/cobros-internacionales/probar/route.ts`

**Interfaces:**
- Consumes:
  - `getCountry`, `isInternationalCountry` e `isInternationalEnabled` (etapa 1)
  - Tasks 2–4
  - `requireAuth` de `@/lib/auth`, `Role` de `@/lib/prisma`
- Produces:
  ```ts
  // collection-access.ts (puro)
  export type CollectionAccess =
    | { available: false }
    | { available: true; provider: IntlCollectionProvider; countryCode: string; countryName: string };
  export function resolveCollectionAccess(input: { enabled: boolean; countryCode: string | null }): CollectionAccess;
  export type CollectionAccountView = {
    provider: IntlCollectionProvider; secretLast4: string; accountLabel: string | null;
    accountCountryCode: string | null; connectedAt: string; lastCheckedAt: string | null;
    warning: string | null;
  };
  export function toCollectionAccountView(row: { provider: string; secretLast4: string; accountLabel: string | null; accountCountryCode: string | null; connectedAt: Date; lastCheckedAt: Date | null }, access: Extract<CollectionAccess, { available: true }>): CollectionAccountView;

  // collection-account-service.ts (Prisma)
  export type CollectionServiceError = { status: 400 | 404 | 502 | 503; error: string };
  export async function getCollectionState(userId: number): Promise<{ access: CollectionAccess; account: CollectionAccountView | null }>;
  export async function connectCollectionAccount(userId: number, raw: unknown): Promise<{ account: CollectionAccountView } | CollectionServiceError>;
  export async function disconnectCollectionAccount(userId: number): Promise<{ ok: true } | CollectionServiceError>;
  export async function recheckCollectionAccount(userId: number): Promise<{ account: CollectionAccountView } | CollectionServiceError>;
  /** Para la etapa 5: cuenta ACTIVA con el id de credencial. Nunca sale por una ruta. */
  export async function getActiveCollectionAccount(userId: number): Promise<{ id: string; provider: IntlCollectionProvider; environment: IntlPaymentsEnvironment; credentialId: string } | null>;
  ```
- **Reglas de `resolveCollectionAccess`:** `available` es `true` solo si `enabled` está encendido y `isInternationalCountry(countryCode)`. El `provider` sale de `getCountry(code).provider`. En cualquier otro caso, incluidos `null` y `"AR"`, devuelve `{available:false}`.
- **Reglas de `toCollectionAccountView`:** el `warning` es, en este orden:
  1. Si `row.provider !== access.provider`: `"La cuenta conectada es de otro medio de cobro y no corresponde a {countryName}. Conectá la cuenta correcta."` Para el nombre del medio en el texto: MP es "Mercado Pago" y PayPal es "PayPal".
  2. Si no, `countryMismatchMessage(access.countryCode, row.accountCountryCode)`.
- **`connectCollectionAccount`**, en este orden:
  1. Calcula el acceso. Si no está disponible → `404 "No disponible."`.
  2. `cleanCollectionSecret(raw)`. Si da `null` o `provider !== access.provider` → `400 "Completá las credenciales."`.
  3. `validateCollectionSecret`. Si da mensaje → 400 con ese mensaje.
  4. `isCollectionVaultConfigured`. Si es falso → `503 "Los cobros internacionales todavía no están disponibles."`.
  5. `checkCollectionSecret`. Si `!ok` → 400 con `checkFailureMessage` cuando es `INVALID_CREDENTIALS`, o 502 con `checkFailureMessage` cuando es `PROVIDER_UNAVAILABLE`.
  6. `encryptCollectionSecret`.
  7. `prisma.$transaction`: la cuenta `ACTIVE` anterior pasa a `INACTIVE` con `disconnectedAt = now`, y se crea la nueva `ACTIVE` con `lastCheckedAt = now`.
- **`disconnectCollectionAccount`:** marca `INACTIVE` y `disconnectedAt`, y no borra ni revoca la credencial. Sin cuenta activa también devuelve `{ok:true}`.
- **`recheckCollectionAccount`:** descifra la credencial activa, vuelve a correr `checkCollectionSecret` y actualiza `lastCheckedAt`, `accountLabel` y `accountCountryCode` si salió bien. Si no hay cuenta → `404 "No hay una cuenta conectada."`.
- **Rutas** (todas con `requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER])`; si no hay usuario → 401 con `{error}`):
  - `GET /api/fotografo/cobros-internacionales` → `200 {available:false}` o `200 {available:true, provider, countryCode, countryName, account}`. **Nunca 404**, para que la pantalla pueda decidir.
  - `POST` (cuerpo = el secreto) → `200 {account}` o `{error}` con el status del servicio.
  - `DELETE` → `200 {ok:true}` o el error.
  - `POST /probar` → `200 {account}` o el error.
  - Ninguna respuesta ni log incluye el token, el secret ni el `credentialId`.

- [ ] **Step 1: Pruebas fallidas de `collection-access.ts`.**
  - `resolveCollectionAccess({enabled:false, countryCode:"MX"})` → `{available:false}`.
  - `{enabled:true, countryCode:"AR"}` y `{enabled:true, countryCode:null}` → `{available:false}`.
  - `{enabled:true, countryCode:"MX"}` → `provider:"MERCADOPAGO_OWN"`, `countryName:"México"`.
  - `{enabled:true, countryCode:"US"}` → `provider:"PAYPAL_OWN"`.
  - `toCollectionAccountView` de una cuenta `MERCADOPAGO_OWN` con acceso de EE. UU. → `warning` `"La cuenta conectada es de Mercado Pago y no corresponde a Estados Unidos. Conectá la cuenta correcta."`.
  - Misma prueba con una cuenta MP de `accountCountryCode:"BR"` y acceso de México → el mensaje de país distinto de la Task 4.
  - La vista no tiene ninguna propiedad `credentialId`, `accessToken` ni `clientSecret` (`Object.keys`).
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** `collection-access.ts`, el servicio y las dos rutas.
  - Seguir el patrón de rutas de `app/api/fotografo/update/route.ts`.
  - Leer `countryCode` del usuario con `prisma.user.findUnique({ select: { countryCode: true } })`.
- [ ] **Step 4: Verificar**
  - Run: `npm run test:international`. Expected: PASS.
  - Run: `rm -rf .next/types && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json; echo EXIT=$?`. Expected: `EXIT=0`, y que la salida no muestre un corte por memoria.
- [ ] **Step 5: Commit** `Conectar, probar y desconectar la cuenta de cobro internacional`

---

### Task 6: Pantalla "Cobros" con instructivo

**Files:**
- Create: `apps/compramelafoto/components/fotografo/CobrosInternacionalesSection.tsx`
- Create: `apps/compramelafoto/components/fotografo/IntlCollectionInstructions.tsx`
- Modify: `apps/compramelafoto/app/fotografo/configuracion/ConfiguracionClient.tsx` (bloque `activeTab === "mercadopago"`, hoy cerca de la línea 1674)

**Interfaces:**
- Consumes: las rutas de la Task 5.
- Produces: `CobrosInternacionalesSection({ onAvailability }: { onAvailability: (available: boolean) => void })`. Llama a `GET` al montarse y avisa si está disponible.

**Comportamiento:**
- **En `ConfiguracionClient`:**
  - En la pestaña "Mercado Pago" se monta `CobrosInternacionalesSection`.
  - Mientras el GET no respondió, o si respondió `available:false` o con error, se muestra **lo de hoy sin cambios**: el `<h2>Mercado Pago</h2>` y `MercadoPagoIntegration` con las mismas props.
  - Solo con `available:true` se reemplaza ese contenido por la sección.
  - La lista `tabs` y el menú lateral no cambian.
- **Sin cuenta:**
  - Título "Cobros con Mercado Pago" o "Cobros con PayPal", según el `provider`.
  - Texto: "Tus clientes te pagan directo a tu cuenta. Pegá las credenciales de tu propia aplicación; las guardamos cifradas y nunca se vuelven a mostrar completas."
  - Campos: MP lleva uno solo, "Access Token de producción" (`type="password"`). PayPal lleva dos: "Client ID" y "Secret" (`type="password"`).
  - Botón "Guardar y probar conexión" que hace POST.
  - Mientras espera, el botón queda deshabilitado con "Probando conexión…". Si hay error, el texto `error` se muestra en rojo.
- **Con cuenta:**
  - Una tarjeta con `accountLabel`, "Termina en ···{secretLast4}", "Conectada el {fecha}" y "Última comprobación {fecha}". Las fechas van en hora argentina, `toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })`.
  - El `warning`, si hay, en un recuadro ámbar.
  - Botón "Probar conexión" (POST `/probar`).
  - Botón "Cambiar credenciales", que muestra el formulario otra vez.
  - Botón "Desconectar", que pide confirmación con `confirm("¿Desconectar esta cuenta? Tus álbumes no van a poder vender hasta que conectes otra.")` y después hace DELETE.
- **Debajo, siempre:** `IntlCollectionInstructions provider={…}`, desplegable `<details>` "Cómo conseguir las credenciales".
- **Instructivo de Mercado Pago:**
  1. Entrá a mercadopago.com/developers con tu cuenta de Mercado Pago de tu país.
  2. Tocá "Tus integraciones" y "Crear aplicación". Elegí "Pagos online" y "CheckoutPro".
  3. En la aplicación, abrí "Credenciales de producción" y completá los datos que te pida.
  4. Copiá el "Access Token" (empieza con APP_USR-) y pegalo acá.
- **Instructivo de PayPal:**
  1. Necesitás una cuenta PayPal Business.
  2. Entrá a developer.paypal.com con esa cuenta y elegí el modo "Live".
  3. En "Apps & Credentials" tocá "Create App".
  4. Copiá el "Client ID" y el "Secret" y pegalos acá.
- Estilo: el mismo de las tarjetas de la pantalla (`Card`, clases de `PerfilDatosSection`), que se lea bien en modo oscuro y no se desborde a 375 px de ancho.

- [ ] **Step 1: Implementar los dos componentes y el cambio en `ConfiguracionClient`.**
- [ ] **Step 2: Typecheck** (mismo comando de la Task 5). Expected: `EXIT=0`.
- [ ] **Step 3: Commit** `Mostrar la pantalla de cobros internacionales al fotógrafo del exterior`

---

### Task 7: Base de datos, prueba en navegador y PR

- [ ] **Step 1: Verificar las bases.** En las 6 bases (CLF producción `br-autumn-rain-ad18wq7y`, FOTOFFICE `br-old-rain-adwthzng`, Clickatón, InfoSpot, dnx-suite-staging, compramelafoto-staging), confirmar que `ClfIntlCollectionAccount` no existe y que `DnxEncryptedCredential` sí existe.
  - Si falta `DnxEncryptedCredential` en alguna, la FK no aplica (no hay FK a esa tabla) y no bloquea; solo se anota.
- [ ] **Step 2: Aplicar el SQL** de la migración con `SET LOCAL lock_timeout='5s'`.
  - En producción, una sentencia por llamada.
  - Registrar en `_prisma_migrations` con el sha256 del archivo.
  - Verificar con `information_schema.tables` y `pg_indexes` (índice único parcial presente).
- [ ] **Step 3: Probar en el navegador.**
  - Base local descartable creada desde el schema, `CLF_INTERNATIONAL_ENABLED=true`, `CLF_INTL_PAYMENTS_ENV=TEST`, una clave TEST generada en el momento (no se guarda en archivos del repo) y un fotógrafo con `countryCode` `MX`.
  - Comprobar:
    - La pestaña muestra "Cobros con Mercado Pago".
    - Un token inventado da el error de Mercado Pago.
    - Con el interruptor apagado se ve la pantalla de hoy.
    - Con un fotógrafo `AR` se ve la pantalla de hoy.
    - Con `US` aparecen los dos campos de PayPal.
    - Con un token de prueba real de MP (`MERCADOPAGO_TEST_ACCESS_TOKEN` del entorno local, si está) la conexión queda guardada, se ve "Termina en ···" y "Desconectar" la saca.
  - Al terminar, borrar la base descartable.
- [ ] **Step 4: Correr las pruebas.** `npm run test:international`, `npm run test:referrals`, `npm run test:album-config-form` y `next build`. Expected: todo bien.
- [ ] **Step 5: PR y fusión.**
  - Abrir el PR contra `main`, con el resumen y lo que queda para después.
  - Fusionar cuando la CI esté en verde.

**Queda para después (no es de esta etapa):**
- Cargar `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` en Vercel de CLF. Hoy no existe; sin esa clave la pantalla responde 503. Se hace antes de encender el interruptor (etapa 7) y con OK del owner.
- Purgar las credenciales `INACTIVE` de más de 30 días (etapa 5).
- Capturas en el instructivo.
- Bloquear la venta sin cuenta conectada (etapa 5).
