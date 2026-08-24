# Conexión de cobro de la institución — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una institución conecte su propia cuenta de MercadoPago a su workspace de FotoOffice y quede habilitada para recibir pagos por split, con su plata yendo directo a ella.

**Architecture:** Se reutiliza la capa financiera que ya existe (`DnxFinancialIdentity`, `DnxPaymentAccount`, `DnxEncryptedCredential`) y las primitivas OAuth de `@repo/payments` que ya son genéricas (PKCE, cliente de MercadoPago, bóveda de credenciales). **No se toca `ClickatonOwnerOAuthService`**: FotoOffice escribe su propio servicio delgado con autorización por membresía de workspace.

**Tech Stack:** Next.js 15 (App Router, Route Handlers), Prisma, `@repo/payments`, MercadoPago OAuth (Connect) con PKCE S256, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-fotoffice-alta-socios-cobros-design.md` (§4.2, §5.1)

## Global Constraints

- **No modificar `service.ts` ni `config.ts` de `owner-oauth`.** Son de Clickatón y mueven dinero en producción. Este plan solo renombra `mp-client.ts` (dejando alias) y parametriza un valor en `prisma-store.ts`.
- **La batería de tests de Clickatón queda en verde antes y después de cada tarea.** Es la red de seguridad de todo el plan.
- **El token de MercadoPago nunca se guarda en claro.** Se cifra con la bóveda (`DnxEncryptedCredential`) y en `DnxPaymentAccount` solo queda `credentialReference`.
- **El verificador PKCE tampoco.** Se guarda cifrado en `DnxMercadoPagoOAuthState` (`codeVerifierCiphertext` / `nonce` / `authTag`).
- **`productKey` de FotoOffice: `"fotoffice"`.** Nunca `"clickaton"`.
- **`organizationRef`: `fotoffice-workspace:<workspaceId>`.** Formato opaco, consistente con el ejemplo `lab:123` documentado en el esquema.
- **Autorización: membresía de workspace** (`canManageWorkspaceSettings`), NO el modelo de `FinanceActor` / `DNX_FINANCE_OWNER` de Clickatón.
- **Nunca loguear tokens, códigos de autorización ni verificadores.** Solo referencias enmascaradas.
- Tests: Vitest, `*.test.ts` al lado del fuente. Comentarios y textos de interfaz **en español**.

## Prerrequisito externo (bloqueante para la Tarea 5 en adelante)

Hace falta **una aplicación de MercadoPago para FotoOffice**, creada en el panel de
desarrolladores de MercadoPago, con:

- `FOTOFFICE_MP_CLIENT_ID`
- `FOTOFFICE_MP_CLIENT_SECRET`
- `FOTOFFICE_MP_REDIRECT_URI` = `https://fotoffice.com/api/payments/mercadopago/connect/callback`

La URL de redirección debe coincidir **byte a byte** con la cargada en el panel de
MercadoPago; si difiere en una barra final, el intercambio falla con un error opaco.

Las tareas 1 a 4 se pueden hacer sin esto. **Confirmar con el titular antes de empezar la 5.**

---

## File Structure

**Modificados en `@repo/payments` (cambios mínimos y compatibles):**

| Archivo | Cambio |
|---|---|
| `packages/payments/src/partner-onboarding/owner-oauth/mp-client.ts` | Renombrar los exports a nombres neutrales, dejando alias deprecados |
| `packages/payments/src/partner-onboarding/owner-oauth/prisma-store.ts:139` | `originApp` pasa a ser parámetro con default `"clickaton"` |

**Nuevos en FotoOffice:**

| Archivo | Responsabilidad |
|---|---|
| `apps/fotoffice/lib/payments/connect/constants.ts` | `productKey`, formato de `organizationRef`, nombres de variables de entorno |
| `apps/fotoffice/lib/payments/connect/config.ts` | Lectura y validación de la configuración de entorno |
| `apps/fotoffice/lib/payments/connect/service.ts` | Iniciar conexión y completar callback |
| `apps/fotoffice/lib/payments/connect/status.ts` | Estado de conexión para la pantalla |
| `apps/fotoffice/app/api/payments/mercadopago/connect/start/route.ts` | Redirige a MercadoPago |
| `apps/fotoffice/app/api/payments/mercadopago/connect/callback/route.ts` | Recibe el código y completa |
| `apps/fotoffice/app/(shell)/configuracion/cobros/page.tsx` | Pantalla de conexión |
| `apps/fotoffice/components/payments/connect-card.tsx` | Tarjeta de estado y acción |

**Por qué así:** `constants.ts` y `config.ts` se separan de `service.ts` porque son lo único que cambiaría si mañana otro producto del monorepo quisiera lo mismo — y porque probar la lectura de entorno sin arrastrar el servicio entero es más simple.

---

## Task 1: Renombrar el cliente OAuth de MercadoPago a nombres neutrales

Las funciones ya son genéricas —reciben `clientId`, `redirectUri`, `state` y `codeChallenge`
por parámetro y no leen nada de Clickatón—. Solo el **nombre** dice Clickatón, y eso es lo que
impide que otro producto las use sin que el código mienta.

**Files:**
- Modify: `packages/payments/src/partner-onboarding/owner-oauth/mp-client.ts`

**Interfaces:**
- Produces (nombres nuevos):
  - `type MercadoPagoOAuthHttpClient` (antes `ClickatonMpOAuthHttpClient`)
  - `buildMercadoPagoAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge?: string | null }): string`
  - `createLiveMercadoPagoOAuthHttpClient(fetchImpl?: typeof fetch): MercadoPagoOAuthHttpClient`
  - `createFakeMercadoPagoOAuthHttpClient(opts?: { … }): MercadoPagoOAuthHttpClient`
- Mantiene (alias deprecados, para que Clickatón no cambie ni una línea):
  - `ClickatonMpOAuthHttpClient`, `buildClickatonMpAuthorizeUrl`, `createLiveClickatonMpOAuthHttpClient`, `createFakeClickatonMpOAuthHttpClient`

- [ ] **Step 1: Correr los tests de Clickatón y anotar el resultado**

```bash
cd packages/payments && npx vitest run src/partner-onboarding/
```

Anotar cuántos pasan. **Ese número no puede bajar en ningún paso de este plan.**

- [ ] **Step 2: Escribir el test de los nombres nuevos**

Crear `packages/payments/src/partner-onboarding/owner-oauth/mp-client-naming.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildMercadoPagoAuthorizeUrl,
  buildClickatonMpAuthorizeUrl,
  createFakeMercadoPagoOAuthHttpClient,
  createFakeClickatonMpOAuthHttpClient,
} from "./mp-client.js";

describe("nombres neutrales del cliente OAuth", () => {
  it("buildMercadoPagoAuthorizeUrl arma la URL de autorización", () => {
    const url = buildMercadoPagoAuthorizeUrl({
      clientId: "cid-1",
      redirectUri: "https://fotoffice.com/cb",
      state: "st-1",
      codeChallenge: "ch-1",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("client_id")).toBe("cid-1");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://fotoffice.com/cb");
    expect(parsed.searchParams.get("state")).toBe("st-1");
    expect(parsed.searchParams.get("code_challenge")).toBe("ch-1");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("response_type")).toBe("code");
  });

  it("sin codeChallenge no manda los parámetros de PKCE", () => {
    const url = buildMercadoPagoAuthorizeUrl({
      clientId: "cid-1",
      redirectUri: "https://fotoffice.com/cb",
      state: "st-1",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("code_challenge")).toBeNull();
    expect(parsed.searchParams.get("code_challenge_method")).toBeNull();
  });

  /**
   * El alias existe para que Clickatón no tenga que cambiar. Si alguien lo borra,
   * este test lo avisa antes de que rompa el build de otra app.
   */
  it("el alias de Clickatón sigue existiendo y es la misma función", () => {
    expect(buildClickatonMpAuthorizeUrl).toBe(buildMercadoPagoAuthorizeUrl);
    expect(createFakeClickatonMpOAuthHttpClient).toBe(createFakeMercadoPagoOAuthHttpClient);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
cd packages/payments && npx vitest run src/partner-onboarding/owner-oauth/mp-client-naming.test.ts
```

Esperado: FAIL — `buildMercadoPagoAuthorizeUrl` no existe.

- [ ] **Step 4: Renombrar en `mp-client.ts`**

Renombrar las cuatro declaraciones quitándoles `Clickaton` del nombre:

```ts
export type MercadoPagoOAuthHttpClient = { /* … cuerpo sin cambios … */ };

export function buildMercadoPagoAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string | null;
}): string { /* … cuerpo sin cambios … */ }

export function createFakeMercadoPagoOAuthHttpClient(opts?: {
  /* … misma firma … */
}): MercadoPagoOAuthHttpClient { /* … cuerpo sin cambios … */ }

export function createLiveMercadoPagoOAuthHttpClient(
  fetchImpl: typeof fetch = fetch,
): MercadoPagoOAuthHttpClient { /* … cuerpo sin cambios … */ }
```

Y agregar al final del archivo los alias, para que Clickatón siga compilando sin tocar nada:

```ts
/**
 * Alias históricos. El cliente OAuth nunca tuvo nada de Clickatón —recibe todo por
 * parámetro—, pero su nombre lo sugería e impedía que otro producto lo usara sin que el
 * código mintiera. Se conservan para no tocar Clickatón, que hoy mueve dinero real.
 *
 * @deprecated Usar las versiones sin `Clickaton` en el nombre.
 */
export type ClickatonMpOAuthHttpClient = MercadoPagoOAuthHttpClient;
export const buildClickatonMpAuthorizeUrl = buildMercadoPagoAuthorizeUrl;
export const createFakeClickatonMpOAuthHttpClient = createFakeMercadoPagoOAuthHttpClient;
export const createLiveClickatonMpOAuthHttpClient = createLiveMercadoPagoOAuthHttpClient;
```

**Cuidado:** `ClickatonMpOAuthHttpClient` se usa como *tipo* en `service.ts`. El alias con
`export type` lo cubre. No cambiar `service.ts`.

- [ ] **Step 5: Correr el test nuevo y toda la batería de Clickatón**

```bash
cd packages/payments && npx vitest run src/partner-onboarding/
```

Esperado: PASS, y el total **igual o mayor** al anotado en el Step 1 (sube por los 3 tests nuevos).

- [ ] **Step 6: Verificar que Clickatón compila sin cambios**

```bash
cd apps/clickaton && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add packages/payments/src/partner-onboarding/owner-oauth/mp-client.ts packages/payments/src/partner-onboarding/owner-oauth/mp-client-naming.test.ts
git commit -m "refactor(payments): product-neutral names for the MercadoPago OAuth client"
```

---

## Task 2: Parametrizar `originApp` en el store de Prisma

`prisma-store.ts:139` escribe `originApp: "clickaton"` fijo al guardar la cuenta de pago.
Es el único valor de producto cableado en toda la capa de guardado.

**Files:**
- Modify: `packages/payments/src/partner-onboarding/owner-oauth/prisma-store.ts`

**Interfaces:**
- Consumes: nada nuevo
- Produces: `createPrismaOwnerOAuthStore(prisma, opts?: { originApp?: string })` — `originApp` por defecto `"clickaton"`, para que la llamada actual de Clickatón siga funcionando idéntica.

- [ ] **Step 1: Escribir el test que falla**

Crear `packages/payments/src/partner-onboarding/owner-oauth/prisma-store-origin.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createPrismaOwnerOAuthStore } from "./prisma-store.js";

function fakePrisma() {
  const upsert = vi.fn(async (args: Record<string, unknown>) => ({
    id: "acc-1",
    financialIdentityId: "fi-1",
    provider: "MERCADOPAGO",
    environment: "PROD",
    providerUserId: "mp-1",
    credentialReference: null,
    originApp: (args.create as Record<string, unknown>)?.originApp ?? null,
    externalReference: null,
    tokenFingerprint: null,
    capabilities: [],
    status: "ACTIVE",
    connectedAt: new Date(),
    verifiedAt: null,
    lastHealthCheckAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  return { prisma: { dnxPaymentAccount: { upsert } }, upsert };
}

describe("originApp del store", () => {
  it("sin opción usa clickaton, para no cambiar el comportamiento actual", async () => {
    const { prisma, upsert } = fakePrisma();
    const store = createPrismaOwnerOAuthStore(prisma as never);
    await store.upsertOwnerPaymentAccount({
      financialIdentityId: "fi-1",
      provider: "MERCADOPAGO",
      environment: "PROD",
      providerUserId: "mp-1",
      capabilities: ["SPLIT_RECEIVER"],
      status: "ACTIVE",
    } as never);
    expect((upsert.mock.calls[0]?.[0].create as Record<string, unknown>).originApp).toBe("clickaton");
  });

  it("con opción usa el producto indicado", async () => {
    const { prisma, upsert } = fakePrisma();
    const store = createPrismaOwnerOAuthStore(prisma as never, { originApp: "fotoffice" });
    await store.upsertOwnerPaymentAccount({
      financialIdentityId: "fi-1",
      provider: "MERCADOPAGO",
      environment: "PROD",
      providerUserId: "mp-1",
      capabilities: ["SPLIT_RECEIVER"],
      status: "ACTIVE",
    } as never);
    expect((upsert.mock.calls[0]?.[0].create as Record<string, unknown>).originApp).toBe("fotoffice");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
cd packages/payments && npx vitest run src/partner-onboarding/owner-oauth/prisma-store-origin.test.ts
```

Esperado: FAIL en el segundo caso — devuelve `"clickaton"` porque está cableado.

- [ ] **Step 3: Implementar**

En `prisma-store.ts`, agregar el parámetro opcional a la firma:

```ts
export function createPrismaOwnerOAuthStore(
  prisma: OwnerOAuthPrismaDelegate,
  opts: {
    /**
     * Producto que origina la conexión. Default `"clickaton"` para no cambiar el
     * comportamiento de quien ya llamaba a esta función sin el parámetro.
     */
    originApp?: string;
  } = {},
): OwnerOAuthStore {
  const originApp = opts.originApp ?? "clickaton";
  // … resto igual …
```

Y en la línea 139, reemplazar el literal por la variable:

```ts
          originApp,
```

- [ ] **Step 4: Correr el test y toda la batería**

```bash
cd packages/payments && npx vitest run src/partner-onboarding/
```

Esperado: PASS, total igual o mayor al de la Tarea 1.

- [ ] **Step 5: Commit**

```bash
git add packages/payments/src/partner-onboarding/owner-oauth/prisma-store.ts packages/payments/src/partner-onboarding/owner-oauth/prisma-store-origin.test.ts
git commit -m "refactor(payments): parameterize originApp in the owner OAuth store"
```

---

## Task 3: Constantes y configuración de FotoOffice

**Files:**
- Create: `apps/fotoffice/lib/payments/connect/constants.ts`
- Create: `apps/fotoffice/lib/payments/connect/config.ts`
- Test: `apps/fotoffice/lib/payments/connect/config.test.ts`

**Interfaces:**
- Produces:
  - `FOTOFFICE_PRODUCT_KEY = "fotoffice"`
  - `FOTOFFICE_MP_ENV = { clientId: "FOTOFFICE_MP_CLIENT_ID"; clientSecret: "FOTOFFICE_MP_CLIENT_SECRET"; redirectUri: "FOTOFFICE_MP_REDIRECT_URI" }`
  - `workspaceOrganizationRef(workspaceId: string): string`
  - `parseWorkspaceOrganizationRef(ref: string): string | null`
  - `readMpConnectConfig(env?): { configured: boolean; missing: string[]; clientId: string | null; clientSecret: string | null; redirectUri: string | null }`

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/lib/payments/connect/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FOTOFFICE_PRODUCT_KEY,
  parseWorkspaceOrganizationRef,
  workspaceOrganizationRef,
} from "./constants";
import { readMpConnectConfig } from "./config";

describe("identidad del producto", () => {
  it("la clave de producto es fotoffice, nunca clickaton", () => {
    expect(FOTOFFICE_PRODUCT_KEY).toBe("fotoffice");
  });

  it("la referencia de organización incluye el workspace", () => {
    expect(workspaceOrganizationRef("ws-sfpr")).toBe("fotoffice-workspace:ws-sfpr");
  });

  it("se puede volver del ref al workspace", () => {
    expect(parseWorkspaceOrganizationRef("fotoffice-workspace:ws-sfpr")).toBe("ws-sfpr");
  });

  /** Un ref de otro producto no debe interpretarse como propio. */
  it.each(["lab:123", "clickaton:partners-production:mp-owner", "ws-sfpr", ""])(
    "no reconoce %s como ref de FotoOffice",
    (ref) => {
      expect(parseWorkspaceOrganizationRef(ref)).toBeNull();
    },
  );
});

describe("readMpConnectConfig", () => {
  const full = {
    FOTOFFICE_MP_CLIENT_ID: "cid",
    FOTOFFICE_MP_CLIENT_SECRET: "csec",
    FOTOFFICE_MP_REDIRECT_URI: "https://fotoffice.com/api/payments/mercadopago/connect/callback",
  };

  it("con todo presente queda configurado", () => {
    const c = readMpConnectConfig(full as NodeJS.ProcessEnv);
    expect(c.configured).toBe(true);
    expect(c.missing).toEqual([]);
    expect(c.clientId).toBe("cid");
  });

  it.each([
    ["FOTOFFICE_MP_CLIENT_ID"],
    ["FOTOFFICE_MP_CLIENT_SECRET"],
    ["FOTOFFICE_MP_REDIRECT_URI"],
  ])("sin %s no queda configurado y lo nombra", (key) => {
    const env = { ...full, [key]: "" } as NodeJS.ProcessEnv;
    const c = readMpConnectConfig(env);
    expect(c.configured).toBe(false);
    expect(c.missing).toContain(key);
  });

  it("ignora espacios en blanco alrededor", () => {
    const c = readMpConnectConfig({ ...full, FOTOFFICE_MP_CLIENT_ID: "  cid  " } as NodeJS.ProcessEnv);
    expect(c.clientId).toBe("cid");
  });

  it("con el entorno vacío nombra las tres variables faltantes", () => {
    const c = readMpConnectConfig({} as NodeJS.ProcessEnv);
    expect(c.missing).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run lib/payments/connect/config.test.ts
```

Esperado: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar `constants.ts`**

```ts
/** Clave de producto en `DnxMercadoPagoOAuthState.productKey`. Nunca "clickaton". */
export const FOTOFFICE_PRODUCT_KEY = "fotoffice" as const;

/** Nombres de las variables de entorno de la aplicación de MercadoPago de FotoOffice. */
export const FOTOFFICE_MP_ENV = {
  clientId: "FOTOFFICE_MP_CLIENT_ID",
  clientSecret: "FOTOFFICE_MP_CLIENT_SECRET",
  redirectUri: "FOTOFFICE_MP_REDIRECT_URI",
} as const;

const ORG_REF_PREFIX = "fotoffice-workspace:";

/**
 * Referencia opaca de la institución dentro de la capa financiera.
 *
 * Sigue el formato que el esquema documenta con el ejemplo `lab:123`: prefijo de producto
 * más identificador propio. El prefijo evita que la identidad financiera de un workspace
 * de FotoOffice se confunda con la de otro producto del monorepo.
 */
export function workspaceOrganizationRef(workspaceId: string): string {
  return `${ORG_REF_PREFIX}${workspaceId}`;
}

/** Inversa de `workspaceOrganizationRef`. Devuelve null si el ref no es de FotoOffice. */
export function parseWorkspaceOrganizationRef(ref: string): string | null {
  if (!ref.startsWith(ORG_REF_PREFIX)) return null;
  const id = ref.slice(ORG_REF_PREFIX.length).trim();
  return id ? id : null;
}
```

- [ ] **Step 4: Implementar `config.ts`**

```ts
import { FOTOFFICE_MP_ENV } from "./constants";

export type MpConnectConfig = {
  configured: boolean;
  /** Nombres de las variables que faltan, para poder decírselo al operador. */
  missing: string[];
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
};

/**
 * Lee la configuración de la aplicación de MercadoPago de FotoOffice.
 *
 * `redirectUri` tiene que coincidir **byte a byte** con la cargada en el panel de
 * MercadoPago: una barra final de más y el intercambio del código falla con un error
 * opaco que cuesta horas de diagnosticar.
 */
export function readMpConnectConfig(env: NodeJS.ProcessEnv = process.env): MpConnectConfig {
  const read = (key: string): string | null => env[key]?.trim() || null;

  const clientId = read(FOTOFFICE_MP_ENV.clientId);
  const clientSecret = read(FOTOFFICE_MP_ENV.clientSecret);
  const redirectUri = read(FOTOFFICE_MP_ENV.redirectUri);

  const missing: string[] = [];
  if (!clientId) missing.push(FOTOFFICE_MP_ENV.clientId);
  if (!clientSecret) missing.push(FOTOFFICE_MP_ENV.clientSecret);
  if (!redirectUri) missing.push(FOTOFFICE_MP_ENV.redirectUri);

  return { configured: missing.length === 0, missing, clientId, clientSecret, redirectUri };
}
```

- [ ] **Step 5: Correr y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run lib/payments/connect/config.test.ts
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/payments/connect/
git commit -m "feat(fotoffice): MercadoPago connect constants and env config"
```

---

## Task 4: Estado de conexión del workspace

Antes del flujo OAuth conviene tener la lectura: qué estado tiene hoy la conexión de un
workspace. La pantalla la necesita, y el servicio la usa para no reconectar de más.

**Files:**
- Create: `apps/fotoffice/lib/payments/connect/status.ts`
- Test: `apps/fotoffice/lib/payments/connect/status.test.ts`

**Interfaces:**
- Consumes: `workspaceOrganizationRef` (Task 3), `prisma` de `@repo/db`
- Produces:
  - `type WorkspaceCollectionStatus = "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "NEEDS_REAUTH" | "REVOKED"`
  - `type WorkspaceCollectionView = { status: WorkspaceCollectionStatus; accountLabel: string | null; connectedAt: Date | null; canReceiveSplit: boolean }`
  - `getWorkspaceCollectionStatus(workspaceId: string): Promise<WorkspaceCollectionView>`
  - `mapAccountToCollectionStatus(account: { status: string; capabilities: string[] } | null): WorkspaceCollectionStatus` (pura, testeable sin base)

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/fotoffice/lib/payments/connect/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapAccountToCollectionStatus } from "./status";

describe("mapAccountToCollectionStatus", () => {
  it("sin cuenta, no conectado", () => {
    expect(mapAccountToCollectionStatus(null)).toBe("NOT_CONNECTED");
  });

  it("cuenta activa con capacidad de split, conectada", () => {
    expect(
      mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: ["SPLIT_RECEIVER"] }),
    ).toBe("CONNECTED");
  });

  /**
   * Una cuenta activa SIN capacidad de split no sirve para cobrar cuotas: se conectó, pero
   * no puede recibir su parte. Mostrarla como "conectada" haría que la institución creyera
   * que puede cobrar cuando no puede.
   */
  it("cuenta activa sin capacidad de split queda pendiente, no conectada", () => {
    expect(mapAccountToCollectionStatus({ status: "ACTIVE", capabilities: [] })).toBe("PENDING");
  });

  it.each([
    ["PENDING", "PENDING"],
    ["NEEDS_REAUTH", "NEEDS_REAUTH"],
    ["REVOKED", "REVOKED"],
    ["DISABLED", "REVOKED"],
  ])("cuenta en %s se muestra como %s", (accountStatus, expected) => {
    expect(
      mapAccountToCollectionStatus({ status: accountStatus, capabilities: ["SPLIT_RECEIVER"] }),
    ).toBe(expected);
  });

  it("un estado desconocido no se muestra como conectada", () => {
    expect(
      mapAccountToCollectionStatus({ status: "LO_QUE_SEA", capabilities: ["SPLIT_RECEIVER"] }),
    ).not.toBe("CONNECTED");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd apps/fotoffice && npx vitest run lib/payments/connect/status.test.ts
```

Esperado: FAIL — no existe `./status`.

- [ ] **Step 3: Implementar**

Crear `apps/fotoffice/lib/payments/connect/status.ts`:

```ts
import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "./constants";

export type WorkspaceCollectionStatus =
  | "NOT_CONNECTED"
  | "PENDING"
  | "CONNECTED"
  | "NEEDS_REAUTH"
  | "REVOKED";

export type WorkspaceCollectionView = {
  status: WorkspaceCollectionStatus;
  /** Identificador enmascarado de la cuenta. Nunca el token ni el id completo. */
  accountLabel: string | null;
  connectedAt: Date | null;
  canReceiveSplit: boolean;
};

/**
 * Traduce el estado técnico de la cuenta al estado que se le muestra a la institución.
 *
 * Una cuenta ACTIVE sin `SPLIT_RECEIVER` NO es "conectada": se vinculó, pero no puede
 * recibir su parte de un cobro. Mostrarla como conectada haría que la institución creyera
 * que ya puede cobrar cuotas cuando todavía no.
 */
export function mapAccountToCollectionStatus(
  account: { status: string; capabilities: string[] } | null,
): WorkspaceCollectionStatus {
  if (!account) return "NOT_CONNECTED";
  switch (account.status) {
    case "ACTIVE":
      return account.capabilities.includes("SPLIT_RECEIVER") ? "CONNECTED" : "PENDING";
    case "PENDING":
      return "PENDING";
    case "NEEDS_REAUTH":
      return "NEEDS_REAUTH";
    case "REVOKED":
    case "DISABLED":
      return "REVOKED";
    default:
      // Estado que no conocemos: se trata como pendiente, nunca como conectado.
      return "PENDING";
  }
}

function maskProviderUser(providerUserId: string | null): string | null {
  if (!providerUserId) return null;
  const v = providerUserId.trim();
  if (v.length <= 4) return "****";
  return `****${v.slice(-4)}`;
}

/** Estado de cobro de un workspace. Devuelve NOT_CONNECTED si todavía no hay identidad. */
export async function getWorkspaceCollectionStatus(
  workspaceId: string,
): Promise<WorkspaceCollectionView> {
  const notConnected: WorkspaceCollectionView = {
    status: "NOT_CONNECTED",
    accountLabel: null,
    connectedAt: null,
    canReceiveSplit: false,
  };

  const identity = await prisma.dnxFinancialIdentity.findUnique({
    where: { organizationRef: workspaceOrganizationRef(workspaceId) },
    select: { id: true },
  });
  if (!identity) return notConnected;

  const account = await prisma.dnxPaymentAccount.findFirst({
    where: { financialIdentityId: identity.id, provider: "MERCADOPAGO", environment: "PROD" },
    select: {
      status: true,
      capabilities: true,
      providerUserId: true,
      connectedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!account) return notConnected;

  const status = mapAccountToCollectionStatus({
    status: account.status,
    capabilities: account.capabilities as string[],
  });

  return {
    status,
    accountLabel: maskProviderUser(account.providerUserId),
    connectedAt: account.connectedAt,
    canReceiveSplit: status === "CONNECTED",
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
cd apps/fotoffice && npx vitest run lib/payments/connect/status.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/payments/connect/status.ts apps/fotoffice/lib/payments/connect/status.test.ts
git commit -m "feat(fotoffice): workspace collection connection status"
```

---

## Tareas 5 a 7 — pendientes del prerrequisito externo

Las tareas siguientes **necesitan la aplicación de MercadoPago de FotoOffice** (ver
*Prerrequisito externo* arriba). Sin `FOTOFFICE_MP_CLIENT_ID`, `FOTOFFICE_MP_CLIENT_SECRET`
y `FOTOFFICE_MP_REDIRECT_URI` no se puede probar el flujo de punta a punta, y escribir el
código sin poder ejercitarlo es la forma más rápida de que quede mal.

**Lo que cubren, para dimensionar:**

**Tarea 5 — El servicio de conexión.** `startConnection(workspaceId, userId)` crea la
identidad financiera de la institución si no existe, genera el estado OAuth con PKCE
(verificador cifrado), y devuelve la URL de autorización. `completeCallback(code, state)`
valida el estado contra la base, lo marca usado —una sola vez—, intercambia el código por
el token, lo guarda en la bóveda cifrada y crea la `DnxPaymentAccount` con capacidad
`SPLIT_RECEIVER`. Autorización por membresía de workspace.

**Tarea 6 — Las rutas.** `/api/payments/mercadopago/connect/start` y `/callback`.

**Tarea 7 — La pantalla.** `/configuracion/cobros` con la tarjeta de estado, el botón de
conectar, y el aviso cuando falta reconectar.

**Cuando estén las credenciales, se escribe el detalle de estas tres con el mismo nivel que
las anteriores.** Se decidió no escribirlas ahora para no producir código que no se puede
verificar.

---

## Verificación final (tareas 1 a 4)

- [ ] `cd packages/payments && npx vitest run` — toda la batería en verde
- [ ] `cd apps/clickaton && npx tsc --noEmit` — Clickatón compila sin cambios
- [ ] `cd apps/fotoffice && npx vitest run && npx tsc --noEmit`
- [ ] `pnpm --filter fotoffice build` — exit 0
- [ ] Confirmar que **no se modificaron** `owner-oauth/service.ts` ni `owner-oauth/config.ts`:

```bash
git diff --name-only origin/release/sponsor-global-technical-deploy..HEAD | grep owner-oauth
```

Esperado: solo `mp-client.ts`, `prisma-store.ts` y los archivos de test nuevos.
