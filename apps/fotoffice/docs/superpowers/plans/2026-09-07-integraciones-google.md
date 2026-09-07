# Integraciones con Google — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño de un workspace vincule la cuenta de Google de su institución desde una sola pantalla, y que cualquier módulo pueda pedir un token de acceso vigente sin saber nada de OAuth.

**Architecture:** Un catálogo declarativo dice qué integraciones existen y qué permisos pide cada una. Un flujo de OAuth propio —separado del "Ingresar con Google", porque ese no obtiene permiso duradero— guarda el refresh token cifrado con AES-256-GCM en `WorkspaceIntegration`. Los consumidores piden `getGoogleAccessToken(workspaceId)` y reciben un token de una hora, renovado en el momento; nunca ven el refresh token.

**Tech Stack:** Next.js 16 (App Router, Server Components y Server Actions), Prisma sobre Postgres (Neon), vitest, TypeScript, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-09-07-reservas-e-integraciones-design.md` (Parte 1)

## Global Constraints

- **Directorio de trabajo:** `apps/fotoffice`. Todas las rutas de este plan son relativas a ahí, salvo `packages/db/prisma/schema.prisma`.
- **Tests:** `pnpm test` corre `vitest run --config vitest.config.ts`. Solo levanta `lib/**/*.test.ts` y `app/**/*.test.ts`. Un test en otro lado **no se ejecuta**.
- **Idioma:** comentarios, mensajes de error, textos de pantalla y mensajes de commit en castellano rioplatense. Los identificadores en inglés cuando ya lo son en el repo.
- **Nunca en los registros:** el refresh token, el access token, el `code` de OAuth y el `state`. Los errores se sanitizan con `sanitizeError` de `lib/payments/connect/log.ts`.
- **Falla cerrado:** sin `DNX_INTEGRATIONS_VAULT_MASTER_KEY` no se guarda ni se lee ninguna credencial. Jamás hay camino alternativo en texto plano.
- **Dinero:** este módulo no toca plata. Si un cambio lo lleva a tocarla, se detiene y se replantea.
- **Zona horaria:** `America/Argentina/Buenos_Aires` para todo lo que se muestre.
- **Commits:** una oración en castellano que dice qué queda funcionando, en el estilo de los commits recientes del repo (`Queda fijado que…`, `El socio tiene su enlace…`). Firma:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

---

### Task 1: Catálogo de integraciones

Módulo puro: dice qué integraciones existen, qué permisos pide cada una y qué módulos las necesitan. No consulta la base. Es el gemelo de `lib/modules/registry.ts`.

**Files:**
- Create: `lib/integrations/registry.ts`
- Test: `lib/integrations/registry.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type IntegrationProvider = "GOOGLE"`
  - `type IntegrationStatus = "AVAILABLE" | "PLANNED"`
  - `type IntegrationDefinition = { key: string; provider: IntegrationProvider; label: string; description: string; scopes: readonly string[]; requiredByModules: readonly string[]; status: IntegrationStatus }`
  - `INTEGRATION_REGISTRY: readonly IntegrationDefinition[]`
  - `GOOGLE_CALENDAR_INTEGRATION_KEY = "google-calendar"`
  - `getIntegrationDefinition(key: string): IntegrationDefinition | undefined`
  - `listIntegrations(options?: { status?: IntegrationStatus }): IntegrationDefinition[]`
  - `listAvailableIntegrationKeys(): string[]`
  - `integrationsRequiredByModule(moduleKey: string): IntegrationDefinition[]`
  - `findDuplicateIntegrationKeys(): string[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/integrations/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_INTEGRATION_KEY,
  findDuplicateIntegrationKeys,
  getIntegrationDefinition,
  integrationsRequiredByModule,
  listAvailableIntegrationKeys,
  listIntegrations,
} from "./registry";

describe("catálogo de integraciones", () => {
  it("ninguna clave se repite", () => {
    expect(findDuplicateIntegrationKeys()).toEqual([]);
  });

  it("Google Calendar es la única implementada hoy", () => {
    expect(listAvailableIntegrationKeys()).toEqual([GOOGLE_CALENDAR_INTEGRATION_KEY]);
  });

  it("Calendar pide permiso de eventos y la necesita el módulo de reservas", () => {
    const calendar = getIntegrationDefinition(GOOGLE_CALENDAR_INTEGRATION_KEY);
    expect(calendar).toBeDefined();
    expect(calendar!.scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(calendar!.requiredByModules).toContain("bookings");
  });

  it("las integraciones previstas existen en el catálogo pero no se ofrecen", () => {
    const previstas = listIntegrations({ status: "PLANNED" }).map((i) => i.key);
    expect(previstas).toContain("google-classroom");
    expect(previstas).toContain("google-drive");
    expect(previstas).toContain("google-contacts");
    for (const key of previstas) {
      expect(listAvailableIntegrationKeys()).not.toContain(key);
    }
  });

  it("se puede preguntar qué integraciones necesita un módulo", () => {
    expect(integrationsRequiredByModule("bookings").map((i) => i.key)).toEqual([
      GOOGLE_CALENDAR_INTEGRATION_KEY,
    ]);
    expect(integrationsRequiredByModule("members-inexistente")).toEqual([]);
  });

  it("toda integración declara al menos un permiso", () => {
    for (const integration of listIntegrations()) {
      expect(integration.scopes.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/registry.test.ts
```

Esperado: FALLA con `Failed to resolve import "./registry"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/integrations/registry.ts`:

```ts
/**
 * Catálogo central de integraciones con terceros.
 *
 * Única fuente de verdad de qué integraciones EXISTEN (metadata: nombre, permisos, qué
 * módulos las necesitan). No confundir con `WorkspaceIntegration` (en `packages/db`), que
 * es la fuente de verdad de qué cuentas tiene CONECTADAS cada workspace puntual.
 *
 * Mismo criterio que `lib/modules/registry.ts`: solo las `AVAILABLE` se le ofrecen a
 * alguien. Una `PLANNED` es una clave reservada para más adelante — aparece acá para que
 * la documentación y las dependencias entre módulos sean legibles, nunca como botón.
 */

export type IntegrationProvider = "GOOGLE";
export type IntegrationStatus = "AVAILABLE" | "PLANNED";

export type IntegrationDefinition = {
  /** Clave técnica y estable. Es el mismo valor que se usa en las rutas de conexión. */
  key: string;
  provider: IntegrationProvider;
  label: string;
  /** Qué habilita, en una línea, en el idioma del dueño del workspace. */
  description: string;
  /** Permisos que se le piden a Google. Se piden todos juntos o ninguno. */
  scopes: readonly string[];
  /** Claves de `lib/modules/registry.ts` que no funcionan sin esta integración. */
  requiredByModules: readonly string[];
  status: IntegrationStatus;
};

export const GOOGLE_CALENDAR_INTEGRATION_KEY = "google-calendar";

export const INTEGRATION_REGISTRY: readonly IntegrationDefinition[] = [
  {
    key: GOOGLE_CALENDAR_INTEGRATION_KEY,
    provider: "GOOGLE",
    label: "Google Calendar",
    description:
      "Espeja las reservas de espacios en el calendario de la institución, y toma de ahí lo que se cargue a mano.",
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
    requiredByModules: ["bookings"],
    status: "AVAILABLE",
  },

  // --- Reservadas para etapas futuras. Claves fijadas, SIN implementar. ---
  {
    key: "google-classroom",
    provider: "GOOGLE",
    label: "Google Classroom",
    description: "Crea las aulas de los cursos y mantiene la lista de alumnos.",
    scopes: [
      "https://www.googleapis.com/auth/classroom.courses",
      "https://www.googleapis.com/auth/classroom.rosters",
    ],
    requiredByModules: ["courses-sales"],
    status: "PLANNED",
  },
  {
    key: "google-drive",
    provider: "GOOGLE",
    label: "Google Drive",
    description: "Guarda documentación institucional en la unidad de la institución.",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    requiredByModules: [],
    status: "PLANNED",
  },
  {
    key: "google-contacts",
    provider: "GOOGLE",
    label: "Google Contacts",
    description: "Agenda a cada socio nuevo en los contactos de la institución.",
    scopes: ["https://www.googleapis.com/auth/contacts"],
    requiredByModules: ["members"],
    status: "PLANNED",
  },
] as const;

export function getIntegrationDefinition(key: string): IntegrationDefinition | undefined {
  return INTEGRATION_REGISTRY.find((i) => i.key === key);
}

export function listIntegrations(options?: { status?: IntegrationStatus }): IntegrationDefinition[] {
  return INTEGRATION_REGISTRY.filter(
    (i) => options?.status === undefined || i.status === options.status,
  ).slice();
}

/** Claves ofrecibles hoy. Es la whitelist real de las rutas de conexión. */
export function listAvailableIntegrationKeys(): string[] {
  return listIntegrations({ status: "AVAILABLE" }).map((i) => i.key);
}

/** Qué integraciones necesita un módulo para funcionar. Vacío es una respuesta válida. */
export function integrationsRequiredByModule(moduleKey: string): IntegrationDefinition[] {
  return INTEGRATION_REGISTRY.filter((i) => i.requiredByModules.includes(moduleKey)).slice();
}

/** Invariante de catálogo: ninguna clave puede repetirse. Usado por tests. */
export function findDuplicateIntegrationKeys(): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const i of INTEGRATION_REGISTRY) {
    if (seen.has(i.key)) dupes.add(i.key);
    seen.add(i.key);
  }
  return [...dupes];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/registry.test.ts
```

Esperado: PASA, 6 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/integrations/registry.ts lib/integrations/registry.test.ts
git commit -m "$(cat <<'MSG'
El catálogo dice qué cuentas de terceros se pueden conectar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Cifrado de credenciales

AES-256-GCM con clave maestra propia. Se copia el patrón probado de `packages/social-publisher/src/vault.ts` en lugar de importarlo: son dominios distintos y atarlos obliga a rotar las dos claves juntas.

**Files:**
- Create: `lib/integrations/vault.ts`
- Test: `lib/integrations/vault.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type EncryptedBlob = { ciphertext: string; nonce: string; authTag: string; keyVersion: string }`
  - `class IntegrationsVaultError extends Error` (con `code: "MISSING_MASTER_KEY" | "INVALID_MASTER_KEY" | "DECRYPT_FAILED"`)
  - `INTEGRATIONS_MASTER_KEY_ENV = "DNX_INTEGRATIONS_VAULT_MASTER_KEY"`
  - `decodeIntegrationsMasterKey(base64: string): Buffer`
  - `requireIntegrationsMasterKey(env?: NodeJS.ProcessEnv): Buffer`
  - `encryptIntegrationSecret(plaintext: string, masterKey: Buffer): EncryptedBlob`
  - `decryptIntegrationSecret(blob: EncryptedBlob, masterKey: Buffer): string`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/integrations/vault.test.ts`:

```ts
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  INTEGRATIONS_MASTER_KEY_ENV,
  IntegrationsVaultError,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  requireIntegrationsMasterKey,
} from "./vault";

const masterKey = randomBytes(32);

describe("cifrado de credenciales de integraciones", () => {
  it("lo que se cifra se recupera igual", () => {
    const secreto = "1//0abcdefgHIJKLmnop-refresh-token";
    const blob = encryptIntegrationSecret(secreto, masterKey);
    expect(decryptIntegrationSecret(blob, masterKey)).toBe(secreto);
  });

  it("el texto cifrado no contiene el secreto", () => {
    const secreto = "token-secretisimo";
    const blob = encryptIntegrationSecret(secreto, masterKey);
    expect(blob.ciphertext).not.toContain(secreto);
    expect(JSON.stringify(blob)).not.toContain(secreto);
  });

  it("dos cifrados del mismo texto dan resultados distintos", () => {
    const a = encryptIntegrationSecret("mismo", masterKey);
    const b = encryptIntegrationSecret("mismo", masterKey);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("con otra clave no se puede descifrar", () => {
    const blob = encryptIntegrationSecret("token", masterKey);
    expect(() => decryptIntegrationSecret(blob, randomBytes(32))).toThrow(IntegrationsVaultError);
  });

  it("un texto cifrado alterado no se acepta", () => {
    const blob = encryptIntegrationSecret("token", masterKey);
    const alterado = { ...blob, authTag: Buffer.from(randomBytes(16)).toString("base64") };
    expect(() => decryptIntegrationSecret(alterado, masterKey)).toThrow(IntegrationsVaultError);
  });

  it("sin clave maestra configurada se corta, y el error nombra la variable", () => {
    try {
      requireIntegrationsMasterKey({} as NodeJS.ProcessEnv);
      throw new Error("tendría que haber fallado");
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationsVaultError);
      expect((error as IntegrationsVaultError).code).toBe("MISSING_MASTER_KEY");
      expect((error as Error).message).toContain(INTEGRATIONS_MASTER_KEY_ENV);
    }
  });

  it("una clave maestra de largo equivocado se rechaza", () => {
    const env = { [INTEGRATIONS_MASTER_KEY_ENV]: randomBytes(16).toString("base64") };
    expect(() => requireIntegrationsMasterKey(env as NodeJS.ProcessEnv)).toThrow(
      IntegrationsVaultError,
    );
  });

  it("con la clave bien configurada devuelve 32 bytes", () => {
    const env = { [INTEGRATIONS_MASTER_KEY_ENV]: masterKey.toString("base64") };
    expect(requireIntegrationsMasterKey(env as NodeJS.ProcessEnv)).toHaveLength(32);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/vault.test.ts
```

Esperado: FALLA con `Failed to resolve import "./vault"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/integrations/vault.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado local AES-256-GCM para las credenciales de integraciones con terceros.
 *
 * Clave maestra propia (`DNX_INTEGRATIONS_VAULT_MASTER_KEY`), distinta de la de social y
 * de la de pagos: una clave por dominio, para que rotar una no obligue a rotar las otras.
 *
 * El código es deliberadamente parecido a `packages/social-publisher/src/vault.ts`. No se
 * importa de ahí: son dominios que no deben quedar atados por una dependencia.
 *
 * Módulo PURO: sin base y sin red.
 */

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

/** Versión de esquema de cifrado. Cambia solo si cambia el algoritmo. */
export const INTEGRATIONS_KEY_VERSION = "v1";
export const INTEGRATIONS_MASTER_KEY_ENV = "DNX_INTEGRATIONS_VAULT_MASTER_KEY";

export type IntegrationsVaultErrorCode =
  | "MISSING_MASTER_KEY"
  | "INVALID_MASTER_KEY"
  | "DECRYPT_FAILED";

export class IntegrationsVaultError extends Error {
  readonly code: IntegrationsVaultErrorCode;
  constructor(code: IntegrationsVaultErrorCode, message: string) {
    super(message);
    this.name = "IntegrationsVaultError";
    this.code = code;
  }
}

export type EncryptedBlob = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
};

export function decodeIntegrationsMasterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new IntegrationsVaultError(
      "INVALID_MASTER_KEY",
      `${INTEGRATIONS_MASTER_KEY_ENV} tiene que ser de 32 bytes en base64.`,
    );
  }
  return key;
}

/**
 * Sin clave maestra no hay dónde cifrar: se corta acá.
 *
 * El mensaje nombra la variable que falta, nunca su valor. No existe camino alternativo
 * que guarde el secreto en claro.
 */
export function requireIntegrationsMasterKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env[INTEGRATIONS_MASTER_KEY_ENV]?.trim();
  if (!raw) {
    throw new IntegrationsVaultError(
      "MISSING_MASTER_KEY",
      `Falta configurar ${INTEGRATIONS_MASTER_KEY_ENV}: no se puede guardar la credencial.`,
    );
  }
  return decodeIntegrationsMasterKey(raw);
}

export function encryptIntegrationSecret(plaintext: string, masterKey: Buffer): EncryptedBlob {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, masterKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: INTEGRATIONS_KEY_VERSION,
  };
}

/**
 * Descifra. Cualquier fallo —clave equivocada, texto alterado, nonce corrupto— sale como
 * un único error sin detalle: distinguirlos le daría información a quien esté probando.
 */
export function decryptIntegrationSecret(blob: EncryptedBlob, masterKey: Buffer): string {
  try {
    const decipher = createDecipheriv(ALGO, masterKey, Buffer.from(blob.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new IntegrationsVaultError(
      "DECRYPT_FAILED",
      "No se pudo descifrar la credencial de la integración.",
    );
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/vault.test.ts
```

Esperado: PASA, 8 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/integrations/vault.ts lib/integrations/vault.test.ts
git commit -m "$(cat <<'MSG'
Las credenciales de terceros se guardan cifradas o no se guardan

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Modelo de datos

Dos tablas nuevas, puramente aditivas. No tocan ninguna columna existente, así que no pueden romper las escrituras de las otras aplicaciones de la suite.

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar dos modelos y una relación en `Workspace`)
- Create: `packages/db/prisma/migrations/20260908000000_workspace_integrations/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: los modelos Prisma `WorkspaceIntegration` y `WorkspaceIntegrationOAuthState`, disponibles como `prisma.workspaceIntegration` y `prisma.workspaceIntegrationOAuthState`.

- [ ] **Step 1: Agregar los modelos al schema**

En `packages/db/prisma/schema.prisma`, dentro del modelo `Workspace` (cerca de `moduleFees`), agregar la relación:

```prisma
  integrations                WorkspaceIntegration[]
```

Y al final del bloque de modelos de workspace (justo después de `WorkspaceModuleFee`), agregar:

```prisma
/// Cuenta de un tercero vinculada a un workspace (Google hoy).
///
/// El refresh token va cifrado con AES-256-GCM — ver `apps/fotoffice/lib/integrations/vault.ts`.
/// Nunca en claro y nunca en logs. Las tres columnas del cifrado son inseparables: sin las
/// tres no hay nada que descifrar.
model WorkspaceIntegration {
  id                String    @id @default(cuid())
  workspaceId       String
  /// "GOOGLE". Texto y no enum: agregar un proveedor no debería migrar un tipo en cinco bases.
  provider          String
  /// Clave del catálogo (`lib/integrations/registry.ts`), p. ej. "google-calendar".
  integrationKey    String
  /// La cuenta concreta. Sirve para que el dueño reconozca cuál conectó.
  accountEmail      String
  accountExternalId String?
  /// Permisos efectivamente OTORGADOS por Google, no los pedidos: Google puede dar menos.
  grantedScopes     String[]
  ciphertext        String
  nonce             String
  authTag           String
  keyVersion        String
  /// ACTIVE | REVOKED | NEEDS_RECONSENT
  status            String    @default("ACTIVE")
  connectedByUserId Int?
  connectedAt       DateTime  @default(now())
  lastUsedAt        DateTime?
  revokedAt         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, integrationKey])
  @@index([workspaceId, status])
}

/// Estado anti-CSRF del ida y vuelta con Google. Se borra al usarse.
model WorkspaceIntegrationOAuthState {
  id             String   @id @default(cuid())
  state          String   @unique
  workspaceId    String
  integrationKey String
  userId         Int
  /// Path relativo interno al que volver. Nunca una URL absoluta.
  redirectPath   String?
  createdAt      DateTime @default(now())
  expiresAt      DateTime

  @@index([expiresAt])
  @@index([workspaceId])
}
```

- [ ] **Step 2: Escribir la migración a mano**

En este repositorio ningún build corre `prisma migrate deploy`, así que la migración se escribe y se aplica a mano. Crear `packages/db/prisma/migrations/20260908000000_workspace_integrations/migration.sql`:

```sql
-- Integraciones con terceros por workspace. Puramente aditiva: dos tablas nuevas,
-- ninguna columna existente modificada.

CREATE TABLE "WorkspaceIntegration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "integrationKey" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "accountExternalId" TEXT,
    "grantedScopes" TEXT[],
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "connectedByUserId" INTEGER,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceIntegration_workspaceId_integrationKey_key"
    ON "WorkspaceIntegration"("workspaceId", "integrationKey");
CREATE INDEX "WorkspaceIntegration_workspaceId_status_idx"
    ON "WorkspaceIntegration"("workspaceId", "status");

ALTER TABLE "WorkspaceIntegration" ADD CONSTRAINT "WorkspaceIntegration_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkspaceIntegrationOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "integrationKey" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "redirectPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceIntegrationOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceIntegrationOAuthState_state_key"
    ON "WorkspaceIntegrationOAuthState"("state");
CREATE INDEX "WorkspaceIntegrationOAuthState_expiresAt_idx"
    ON "WorkspaceIntegrationOAuthState"("expiresAt");
CREATE INDEX "WorkspaceIntegrationOAuthState_workspaceId_idx"
    ON "WorkspaceIntegrationOAuthState"("workspaceId");
```

- [ ] **Step 3: Regenerar el cliente de Prisma y verificar que compila**

```bash
cd ../../packages/db && npx prisma generate && cd ../../apps/fotoffice && npx tsc --noEmit
```

Esperado: `prisma generate` termina bien y `tsc` no reporta errores nuevos. Si `tsc` ya fallaba antes por `packages/cuanto-cobro-core` (deuda conocida, ver `ESTADO-ACTUAL.md`), ese fallo no cuenta: verificar que no aparezca ninguno nuevo relacionado con `WorkspaceIntegration`.

- [ ] **Step 4: Aplicar la migración a la base de FOTOFFICE**

**Antes de correr nada, confirmar a qué base apunta la conexión.** `packages/db/.env` de este repositorio ha apuntado a bases de otras aplicaciones; escribir en la equivocada es un problema difícil de deshacer.

```bash
cd ../../packages/db && npx prisma migrate resolve --applied 20260908000000_workspace_integrations
```

Si la base está alineada con el historial de migraciones, alcanza con `npx prisma migrate deploy`. Si no lo está —que es el caso conocido de este proyecto— ejecutar el `migration.sql` a mano contra la base de FOTOFFICE y después marcarlo como aplicado con el comando de arriba.

Verificación:

```sql
SELECT to_regclass('"WorkspaceIntegration"'), to_regclass('"WorkspaceIntegrationOAuthState"');
```

Esperado: las dos columnas devuelven el nombre de la tabla, no `NULL`.

- [ ] **Step 5: Commitear**

```bash
git add ../../packages/db/prisma/schema.prisma ../../packages/db/prisma/migrations/20260908000000_workspace_integrations
git commit -m "$(cat <<'MSG'
El workspace tiene dónde guardar la cuenta de Google que conectó

Dos tablas nuevas, puramente aditivas: no tocan ninguna columna existente,
así que no pueden romper las escrituras de las otras aplicaciones de la suite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: OAuth de Google con acceso sin conexión

Las funciones de `@repo/auth` no sirven acá: `buildGoogleAuthorizationUrl` fija `access_type: "online"` y `exchangeGoogleAuthCode` **descarta el refresh token**. Este módulo tiene las suyas. Las partes puras —armar la URL, interpretar la respuesta— se prueban sin red.

**Files:**
- Create: `lib/integrations/google-oauth.ts`
- Test: `lib/integrations/google-oauth.test.ts`

**Interfaces:**
- Consumes: `getIntegrationDefinition` de Task 1.
- Produces:
  - `INTEGRATIONS_GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback"`
  - `class GoogleIntegrationError extends Error` (con `code: "CONFIG" | "EXCHANGE_FAILED" | "NO_REFRESH_TOKEN" | "INVALID_GRANT"`)
  - `buildIntegrationAuthorizationUrl(params: { clientId: string; redirectUri: string; state: string; scopes: readonly string[]; loginHint?: string }): string`
  - `parseTokenResponse(payload: unknown): { accessToken: string; refreshToken: string | null; expiresInSeconds: number; grantedScopes: string[] }`
  - `hasAllScopes(granted: readonly string[], required: readonly string[]): boolean`
  - `exchangeIntegrationCode(params: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<TokenResult>`
  - `refreshIntegrationAccessToken(params: { refreshToken: string; clientId: string; clientSecret: string }): Promise<TokenResult>`
  - `revokeIntegrationToken(refreshToken: string): Promise<void>`
  - `fetchGoogleAccountEmail(accessToken: string): Promise<{ email: string; externalId: string }>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/integrations/google-oauth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  GoogleIntegrationError,
  buildIntegrationAuthorizationUrl,
  hasAllScopes,
  parseTokenResponse,
} from "./google-oauth";

describe("URL de autorización", () => {
  const base = {
    clientId: "cliente-123",
    redirectUri: "https://app.fotoffice.ar/api/integrations/google/callback",
    state: "estado-opaco",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  };

  it("pide acceso sin conexión: sin eso Google no entrega refresh token", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("fuerza la pantalla de consentimiento, para que reconectar devuelva un refresh token nuevo", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("NO acumula permisos ya otorgados: cada integración pide lo suyo", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
  });

  it("lleva los permisos pedidos, el estado y la URL de retorno", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("state")).toBe("estado-opaco");
    expect(url.searchParams.get("redirect_uri")).toBe(base.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("sugiere la cuenta cuando se está reconectando una ya conocida", () => {
    const url = new URL(buildIntegrationAuthorizationUrl({ ...base, loginHint: "sfpr@gmail.com" }));
    expect(url.searchParams.get("login_hint")).toBe("sfpr@gmail.com");
  });
});

describe("respuesta de token", () => {
  it("lee token, refresh, vencimiento y permisos otorgados", () => {
    const parsed = parseTokenResponse({
      access_token: "ya29.token",
      refresh_token: "1//refresh",
      expires_in: 3599,
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
    });
    expect(parsed.accessToken).toBe("ya29.token");
    expect(parsed.refreshToken).toBe("1//refresh");
    expect(parsed.expiresInSeconds).toBe(3599);
    expect(parsed.grantedScopes).toHaveLength(2);
  });

  it("una renovación no trae refresh token, y eso es normal", () => {
    const parsed = parseTokenResponse({ access_token: "ya29.nuevo", expires_in: 3599 });
    expect(parsed.refreshToken).toBeNull();
    expect(parsed.grantedScopes).toEqual([]);
  });

  it("sin access_token la respuesta no sirve", () => {
    expect(() => parseTokenResponse({ expires_in: 3599 })).toThrow(GoogleIntegrationError);
    expect(() => parseTokenResponse(null)).toThrow(GoogleIntegrationError);
  });

  it("si no dice cuánto dura, se asume una hora", () => {
    expect(parseTokenResponse({ access_token: "ya29.x" }).expiresInSeconds).toBe(3600);
  });
});

describe("permisos otorgados", () => {
  it("Google puede dar menos de lo pedido, y hay que darse cuenta", () => {
    const pedidos = ["a", "b"];
    expect(hasAllScopes(["a"], pedidos)).toBe(false);
    expect(hasAllScopes(["a", "b"], pedidos)).toBe(true);
    expect(hasAllScopes(["a", "b", "c"], pedidos)).toBe(true);
    expect(hasAllScopes([], pedidos)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/google-oauth.test.ts
```

Esperado: FALLA con `Failed to resolve import "./google-oauth"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/integrations/google-oauth.ts`:

```ts
/**
 * OAuth de Google para integraciones. NO es el login.
 *
 * `@repo/auth` tiene funciones de Google, pero sirven para identificar a una persona:
 * `buildGoogleAuthorizationUrl` fija `access_type: "online"` y `exchangeGoogleAuthCode`
 * descarta el refresh token. Acá hace falta lo contrario — un permiso duradero para actuar
 * en nombre de la institución cuando nadie está mirando la pantalla.
 *
 * Nada de este archivo escribe el `code`, el `state` ni ningún token en los registros.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const INTEGRATIONS_GOOGLE_CALLBACK_PATH = "/api/integrations/google/callback";

export type GoogleIntegrationErrorCode =
  | "CONFIG"
  | "EXCHANGE_FAILED"
  | "NO_REFRESH_TOKEN"
  | "INVALID_GRANT";

export class GoogleIntegrationError extends Error {
  readonly code: GoogleIntegrationErrorCode;
  constructor(code: GoogleIntegrationErrorCode, message: string) {
    super(message);
    this.name = "GoogleIntegrationError";
    this.code = code;
  }
}

export type TokenResult = {
  accessToken: string;
  /** Solo viene en el primer consentimiento. En una renovación es null, y está bien. */
  refreshToken: string | null;
  expiresInSeconds: number;
  grantedScopes: string[];
};

/**
 * `access_type=offline` + `prompt=consent` es lo que hace que Google entregue un refresh
 * token. Sin las dos cosas, reconectar devuelve un permiso que sirve una hora y nada más.
 *
 * `include_granted_scopes=false` a propósito: cada integración pide exactamente sus
 * permisos. Acumularlos haría que el token de Calendar cargue también los de Classroom,
 * y un permiso que nadie pidió es un permiso que nadie controla.
 */
export function buildIntegrationAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
  loginHint?: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: params.state,
  });
  if (params.loginHint) q.set("login_hint", params.loginHint);
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

/** Una hora, que es lo que dura un access token de Google cuando no lo dice. */
const DEFAULT_EXPIRES_IN = 3600;

export function parseTokenResponse(payload: unknown): TokenResult {
  if (typeof payload !== "object" || payload === null) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "Google devolvió una respuesta vacía.");
  }
  const row = payload as Record<string, unknown>;
  const accessToken = typeof row.access_token === "string" ? row.access_token : "";
  if (!accessToken) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "Google no devolvió un token de acceso.");
  }
  return {
    accessToken,
    refreshToken: typeof row.refresh_token === "string" ? row.refresh_token : null,
    expiresInSeconds:
      typeof row.expires_in === "number" && row.expires_in > 0
        ? row.expires_in
        : DEFAULT_EXPIRES_IN,
    grantedScopes:
      typeof row.scope === "string" ? row.scope.split(" ").filter((s) => s.length > 0) : [],
  };
}

/** Google puede otorgar menos permisos de los pedidos. Hay que darse cuenta y avisar. */
export function hasAllScopes(granted: readonly string[], required: readonly string[]): boolean {
  const set = new Set(granted);
  return required.every((scope) => set.has(scope));
}

async function postToGoogleToken(body: URLSearchParams): Promise<TokenResult> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : "";
    // `invalid_grant` es "el permiso ya no vale": lo revocaron desde la cuenta de Google.
    // No es un error transitorio y no tiene sentido reintentarlo.
    if (error === "invalid_grant") {
      throw new GoogleIntegrationError(
        "INVALID_GRANT",
        "El permiso de Google ya no es válido. Hay que volver a conectar la cuenta.",
      );
    }
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "Google rechazó el pedido de token.");
  }
  return parseTokenResponse(data);
}

export async function exchangeIntegrationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenResult> {
  const result = await postToGoogleToken(
    new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  );
  if (!result.refreshToken) {
    // Pasa cuando la cuenta ya había dado el permiso y Google no lo vuelve a entregar.
    // Sin refresh token la integración serviría una hora: mejor fallar y pedir de nuevo.
    throw new GoogleIntegrationError(
      "NO_REFRESH_TOKEN",
      "Google no entregó un permiso duradero. Quitá el acceso desde tu cuenta de Google y volvé a conectar.",
    );
  }
  return result;
}

export async function refreshIntegrationAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResult> {
  return postToGoogleToken(
    new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

/** Le avisa a Google que el permiso ya no se usa. Un fallo acá no bloquea desconectar. */
export async function revokeIntegrationToken(refreshToken: string): Promise<void> {
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function fetchGoogleAccountEmail(
  accessToken: string,
): Promise<{ email: string; externalId: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok || typeof data !== "object" || data === null) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "No se pudo leer la cuenta de Google.");
  }
  const row = data as Record<string, unknown>;
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  const externalId = typeof row.id === "string" ? row.id : "";
  if (!email || !externalId) {
    throw new GoogleIntegrationError("EXCHANGE_FAILED", "La cuenta de Google no expuso su email.");
  }
  return { email, externalId };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/google-oauth.test.ts
```

Esperado: PASA, 10 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/integrations/google-oauth.ts lib/integrations/google-oauth.test.ts
git commit -m "$(cat <<'MSG'
Pedirle permiso a Google para actuar cuando nadie está mirando

El login de Google identifica a una persona y no sirve para esto: hace falta
acceso sin conexión, que es lo único que devuelve un permiso renovable.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Almacén de integraciones

Guardar, leer, marcar y borrar. Es la única puerta a la tabla: ninguna pantalla ni ruta consulta `prisma.workspaceIntegration` por su cuenta.

**Files:**
- Create: `lib/integrations/store.ts`
- Test: `lib/integrations/store.test.ts`

**Interfaces:**
- Consumes: `EncryptedBlob`, `encryptIntegrationSecret`, `decryptIntegrationSecret`, `requireIntegrationsMasterKey` (Task 2).
- Produces:
  - `type IntegrationStatusValue = "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT"`
  - `type IntegrationSummary = { integrationKey: string; accountEmail: string; grantedScopes: string[]; status: IntegrationStatusValue; connectedAt: Date; lastUsedAt: Date | null }`
  - `saveIntegration(input: { workspaceId: string; integrationKey: string; provider: string; accountEmail: string; accountExternalId: string; grantedScopes: string[]; refreshToken: string; connectedByUserId: number | null }): Promise<void>`
  - `getIntegrationSummary(workspaceId: string, integrationKey: string): Promise<IntegrationSummary | null>`
  - `listIntegrationSummaries(workspaceId: string): Promise<IntegrationSummary[]>`
  - `readRefreshToken(workspaceId: string, integrationKey: string): Promise<string | null>`
  - `markIntegrationNeedsReconsent(workspaceId: string, integrationKey: string): Promise<void>`
  - `touchIntegrationUsed(workspaceId: string, integrationKey: string): Promise<void>`
  - `deleteIntegration(workspaceId: string, integrationKey: string): Promise<string | null>` (devuelve el refresh token descifrado para poder revocarlo, o null)

- [ ] **Step 1: Escribir el test que falla**

El almacén habla con la base, así que se prueba contra un doble de `prisma`. Crear `lib/integrations/store.test.ts`:

```ts
import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const masterKeyBase64 = randomBytes(32).toString("base64");

const db = {
  rows: [] as Record<string, unknown>[],
};

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceIntegration: {
      upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
        db.rows = db.rows.filter(
          (r) =>
            r.workspaceId !== create.workspaceId || r.integrationKey !== create.integrationKey,
        );
        db.rows.push({ ...create, connectedAt: new Date(), lastUsedAt: null });
        return create;
      }),
      findUnique: vi.fn(async ({ where }: { where: { workspaceId_integrationKey: { workspaceId: string; integrationKey: string } } }) => {
        const key = where.workspaceId_integrationKey;
        return (
          db.rows.find(
            (r) => r.workspaceId === key.workspaceId && r.integrationKey === key.integrationKey,
          ) ?? null
        );
      }),
      findMany: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
        db.rows.filter((r) => r.workspaceId === where.workspaceId),
      ),
      update: vi.fn(async ({ where, data }: { where: { workspaceId_integrationKey: { workspaceId: string; integrationKey: string } }; data: Record<string, unknown> }) => {
        const key = where.workspaceId_integrationKey;
        const row = db.rows.find(
          (r) => r.workspaceId === key.workspaceId && r.integrationKey === key.integrationKey,
        );
        if (row) Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { workspaceId_integrationKey: { workspaceId: string; integrationKey: string } } }) => {
        const key = where.workspaceId_integrationKey;
        db.rows = db.rows.filter(
          (r) => r.workspaceId !== key.workspaceId || r.integrationKey !== key.integrationKey,
        );
        return null;
      }),
    },
  },
}));

import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readRefreshToken,
  saveIntegration,
} from "./store";

const entrada = {
  workspaceId: "ws-1",
  integrationKey: "google-calendar",
  provider: "GOOGLE",
  accountEmail: "sfpr@gmail.com",
  accountExternalId: "10293",
  grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
  refreshToken: "1//refresh-secretisimo",
  connectedByUserId: 7,
};

describe("almacén de integraciones", () => {
  beforeEach(() => {
    db.rows = [];
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = masterKeyBase64;
  });

  it("guarda la credencial cifrada: el token no queda en ninguna columna", async () => {
    await saveIntegration(entrada);
    const guardado = JSON.stringify(db.rows[0]);
    expect(guardado).not.toContain(entrada.refreshToken);
    expect(guardado).toContain("sfpr@gmail.com");
  });

  it("lo guardado se recupera igual", async () => {
    await saveIntegration(entrada);
    expect(await readRefreshToken("ws-1", "google-calendar")).toBe(entrada.refreshToken);
  });

  it("el resumen no expone la credencial", async () => {
    await saveIntegration(entrada);
    const resumen = await getIntegrationSummary("ws-1", "google-calendar");
    expect(resumen?.accountEmail).toBe("sfpr@gmail.com");
    expect(resumen?.status).toBe("ACTIVE");
    expect(JSON.stringify(resumen)).not.toContain(entrada.refreshToken);
    expect(Object.keys(resumen ?? {})).not.toContain("ciphertext");
  });

  it("reconectar la misma integración reemplaza la credencial, no acumula filas", async () => {
    await saveIntegration(entrada);
    await saveIntegration({ ...entrada, refreshToken: "1//nuevo" });
    expect(db.rows).toHaveLength(1);
    expect(await readRefreshToken("ws-1", "google-calendar")).toBe("1//nuevo");
  });

  it("un workspace no ve la integración de otro", async () => {
    await saveIntegration(entrada);
    expect(await getIntegrationSummary("ws-2", "google-calendar")).toBeNull();
    expect(await readRefreshToken("ws-2", "google-calendar")).toBeNull();
  });

  it("marcar que necesita reconexión no borra la fila", async () => {
    await saveIntegration(entrada);
    await markIntegrationNeedsReconsent("ws-1", "google-calendar");
    expect((await getIntegrationSummary("ws-1", "google-calendar"))?.status).toBe(
      "NEEDS_RECONSENT",
    );
  });

  it("desconectar devuelve la credencial para poder revocarla, y borra la fila", async () => {
    await saveIntegration(entrada);
    expect(await deleteIntegration("ws-1", "google-calendar")).toBe(entrada.refreshToken);
    expect(db.rows).toHaveLength(0);
    expect(await deleteIntegration("ws-1", "google-calendar")).toBeNull();
  });

  it("sin clave maestra no se guarda nada", async () => {
    delete process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY;
    await expect(saveIntegration(entrada)).rejects.toThrow();
    expect(db.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/store.test.ts
```

Esperado: FALLA con `Failed to resolve import "./store"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/integrations/store.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  requireIntegrationsMasterKey,
} from "./vault";

/**
 * Única puerta a `WorkspaceIntegration`.
 *
 * Ninguna pantalla, ruta ni acción consulta esa tabla por su cuenta: si lo hicieran,
 * tarde o temprano alguna leería el token cifrado y lo pasaría a un lugar donde no
 * corresponde. Acá el refresh token sale por una sola función, `readRefreshToken`, y
 * los resúmenes que van a las pantallas no lo incluyen jamás.
 *
 * Toda consulta lleva `workspaceId`: una institución no puede leer la cuenta de otra.
 */

export type IntegrationStatusValue = "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT";

export type IntegrationSummary = {
  integrationKey: string;
  accountEmail: string;
  grantedScopes: string[];
  status: IntegrationStatusValue;
  connectedAt: Date;
  lastUsedAt: Date | null;
};

type IntegrationRow = {
  integrationKey: string;
  accountEmail: string;
  grantedScopes: string[];
  status: string;
  connectedAt: Date;
  lastUsedAt: Date | null;
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
};

function toSummary(row: IntegrationRow): IntegrationSummary {
  return {
    integrationKey: row.integrationKey,
    accountEmail: row.accountEmail,
    grantedScopes: row.grantedScopes,
    status: row.status as IntegrationStatusValue,
    connectedAt: row.connectedAt,
    lastUsedAt: row.lastUsedAt,
  };
}

export async function saveIntegration(input: {
  workspaceId: string;
  integrationKey: string;
  provider: string;
  accountEmail: string;
  accountExternalId: string;
  grantedScopes: string[];
  refreshToken: string;
  connectedByUserId: number | null;
}): Promise<void> {
  // Primero cifrar: si falta la clave maestra, se corta antes de escribir nada.
  const blob = encryptIntegrationSecret(input.refreshToken, requireIntegrationsMasterKey());
  const datos = {
    provider: input.provider,
    accountEmail: input.accountEmail,
    accountExternalId: input.accountExternalId,
    grantedScopes: input.grantedScopes,
    ciphertext: blob.ciphertext,
    nonce: blob.nonce,
    authTag: blob.authTag,
    keyVersion: blob.keyVersion,
    status: "ACTIVE",
    connectedByUserId: input.connectedByUserId,
    revokedAt: null,
  };
  await prisma.workspaceIntegration.upsert({
    where: {
      workspaceId_integrationKey: {
        workspaceId: input.workspaceId,
        integrationKey: input.integrationKey,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      integrationKey: input.integrationKey,
      ...datos,
    },
    update: { ...datos, connectedAt: new Date() },
  });
}

export async function getIntegrationSummary(
  workspaceId: string,
  integrationKey: string,
): Promise<IntegrationSummary | null> {
  const row = (await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  })) as IntegrationRow | null;
  return row ? toSummary(row) : null;
}

export async function listIntegrationSummaries(workspaceId: string): Promise<IntegrationSummary[]> {
  const rows = (await prisma.workspaceIntegration.findMany({
    where: { workspaceId },
  })) as IntegrationRow[];
  return rows.map(toSummary);
}

/**
 * La única función que devuelve la credencial en claro. Quien la llame es responsable de
 * no propagarla: no se loguea, no se devuelve por HTTP y no se guarda en ningún lado.
 */
export async function readRefreshToken(
  workspaceId: string,
  integrationKey: string,
): Promise<string | null> {
  const row = (await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  })) as IntegrationRow | null;
  if (!row) return null;
  return decryptIntegrationSecret(
    {
      ciphertext: row.ciphertext,
      nonce: row.nonce,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    },
    requireIntegrationsMasterKey(),
  );
}

/**
 * El permiso dejó de valer (lo revocaron desde la cuenta de Google). No se borra la fila:
 * el dueño tiene que ver que la integración existía y que hay que volver a conectarla.
 */
export async function markIntegrationNeedsReconsent(
  workspaceId: string,
  integrationKey: string,
): Promise<void> {
  await prisma.workspaceIntegration.update({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
    data: { status: "NEEDS_RECONSENT" },
  });
}

export async function touchIntegrationUsed(
  workspaceId: string,
  integrationKey: string,
): Promise<void> {
  await prisma.workspaceIntegration.update({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
    data: { lastUsedAt: new Date() },
  });
}

/** Devuelve la credencial para poder revocarla contra Google, y borra la fila. */
export async function deleteIntegration(
  workspaceId: string,
  integrationKey: string,
): Promise<string | null> {
  const refreshToken = await readRefreshToken(workspaceId, integrationKey).catch(() => null);
  const existe = await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  });
  if (!existe) return null;
  await prisma.workspaceIntegration.delete({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey } },
  });
  return refreshToken;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/store.test.ts
```

Esperado: PASA, 8 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/integrations/store.ts lib/integrations/store.test.ts
git commit -m "$(cat <<'MSG'
La credencial de Google entra y sale por una sola puerta

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Token de acceso vigente para los consumidores

Lo único que un módulo necesita saber. Pide un token y lo recibe listo, o recibe un motivo claro por el que no hay.

**Files:**
- Create: `lib/integrations/access-token.ts`
- Test: `lib/integrations/access-token.test.ts`

**Interfaces:**
- Consumes: `readRefreshToken`, `markIntegrationNeedsReconsent`, `touchIntegrationUsed` (Task 5); `refreshIntegrationAccessToken`, `GoogleIntegrationError` (Task 4); `getIntegrationDefinition` (Task 1).
- Produces:
  - `type AccessTokenResult = { ok: true; accessToken: string } | { ok: false; reason: "NOT_CONNECTED" | "NEEDS_RECONSENT" | "CONFIG" | "UNAVAILABLE" }`
  - `getGoogleAccessToken(workspaceId: string, integrationKey: string): Promise<AccessTokenResult>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/integrations/access-token.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const readRefreshToken = vi.fn();
const markIntegrationNeedsReconsent = vi.fn();
const touchIntegrationUsed = vi.fn();
const refreshIntegrationAccessToken = vi.fn();

vi.mock("./store", () => ({
  readRefreshToken: (...a: unknown[]) => readRefreshToken(...a),
  markIntegrationNeedsReconsent: (...a: unknown[]) => markIntegrationNeedsReconsent(...a),
  touchIntegrationUsed: (...a: unknown[]) => touchIntegrationUsed(...a),
}));

vi.mock("./google-oauth", async () => {
  const actual = await vi.importActual<typeof import("./google-oauth")>("./google-oauth");
  return {
    ...actual,
    refreshIntegrationAccessToken: (...a: unknown[]) => refreshIntegrationAccessToken(...a),
  };
});

import { GoogleIntegrationError } from "./google-oauth";
import { getGoogleAccessToken } from "./access-token";

describe("token de acceso para los consumidores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "cliente";
    process.env.GOOGLE_CLIENT_SECRET = "secreto";
  });

  it("sin integración conectada lo dice, no explota", async () => {
    readRefreshToken.mockResolvedValue(null);
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "NOT_CONNECTED",
    });
  });

  it("con integración conectada devuelve un token nuevo", async () => {
    readRefreshToken.mockResolvedValue("1//refresh");
    refreshIntegrationAccessToken.mockResolvedValue({
      accessToken: "ya29.nuevo",
      refreshToken: null,
      expiresInSeconds: 3599,
      grantedScopes: [],
    });
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: true,
      accessToken: "ya29.nuevo",
    });
    expect(touchIntegrationUsed).toHaveBeenCalledWith("ws-1", "google-calendar");
  });

  it("si el permiso fue revocado, la integración queda marcada para reconectar", async () => {
    readRefreshToken.mockResolvedValue("1//viejo");
    refreshIntegrationAccessToken.mockRejectedValue(
      new GoogleIntegrationError("INVALID_GRANT", "ya no vale"),
    );
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "NEEDS_RECONSENT",
    });
    expect(markIntegrationNeedsReconsent).toHaveBeenCalledWith("ws-1", "google-calendar");
  });

  it("si Google está caído, no se marca nada: el permiso sigue siendo válido", async () => {
    readRefreshToken.mockResolvedValue("1//refresh");
    refreshIntegrationAccessToken.mockRejectedValue(new Error("network"));
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "UNAVAILABLE",
    });
    expect(markIntegrationNeedsReconsent).not.toHaveBeenCalled();
  });

  it("sin credenciales de la aplicación configuradas lo dice sin llamar a Google", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    readRefreshToken.mockResolvedValue("1//refresh");
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "CONFIG",
    });
    expect(refreshIntegrationAccessToken).not.toHaveBeenCalled();
  });

  it("una clave desconocida del catálogo no consulta la base", async () => {
    expect(await getGoogleAccessToken("ws-1", "no-existe")).toEqual({
      ok: false,
      reason: "NOT_CONNECTED",
    });
    expect(readRefreshToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/access-token.test.ts
```

Esperado: FALLA con `Failed to resolve import "./access-token"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `lib/integrations/access-token.ts`:

```ts
import "server-only";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getIntegrationDefinition } from "./registry";
import { GoogleIntegrationError, refreshIntegrationAccessToken } from "./google-oauth";
import { markIntegrationNeedsReconsent, readRefreshToken, touchIntegrationUsed } from "./store";

/**
 * Lo único que un módulo consumidor necesita saber de las integraciones.
 *
 * El access token de Google dura una hora, así que se pide uno nuevo en el momento de
 * usarlo y no se persiste: guardar algo que vence en una hora obliga a manejar su
 * vencimiento, y no hay nada que ganar a cambio.
 *
 * **Nunca lanza.** Un módulo que no puede espejar en el calendario tiene que seguir
 * funcionando: una falla de Google no puede impedir una reserva. Por eso el resultado es
 * un valor con su motivo, no una excepción.
 */

export type AccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "NOT_CONNECTED" | "NEEDS_RECONSENT" | "CONFIG" | "UNAVAILABLE" };

export async function getGoogleAccessToken(
  workspaceId: string,
  integrationKey: string,
): Promise<AccessTokenResult> {
  const definition = getIntegrationDefinition(integrationKey);
  if (!definition || definition.status !== "AVAILABLE") {
    return { ok: false, reason: "NOT_CONNECTED" };
  }

  const refreshToken = await readRefreshToken(workspaceId, integrationKey).catch(() => null);
  if (!refreshToken) return { ok: false, reason: "NOT_CONNECTED" };

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { ok: false, reason: "CONFIG" };

  try {
    const result = await refreshIntegrationAccessToken({ refreshToken, clientId, clientSecret });
    await touchIntegrationUsed(workspaceId, integrationKey).catch(() => undefined);
    return { ok: true, accessToken: result.accessToken };
  } catch (error) {
    // Distinguir "el permiso ya no vale" de "Google no contesta" es la decisión importante
    // de este archivo: la primera necesita que una persona reconecte; la segunda se arregla
    // sola y marcarla asustaría al dueño sin motivo.
    if (error instanceof GoogleIntegrationError && error.code === "INVALID_GRANT") {
      await markIntegrationNeedsReconsent(workspaceId, integrationKey).catch(() => undefined);
      return { ok: false, reason: "NEEDS_RECONSENT" };
    }
    console.error("[fotoffice][integraciones] no se pudo renovar el token", {
      workspaceId,
      integrationKey,
      detalle: sanitizeError(error),
    });
    return { ok: false, reason: "UNAVAILABLE" };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/access-token.test.ts
```

Esperado: PASA, 6 tests.

- [ ] **Step 5: Commitear**

```bash
git add lib/integrations/access-token.ts lib/integrations/access-token.test.ts
git commit -m "$(cat <<'MSG'
Un módulo pide token y sigue andando aunque Google no conteste

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: Las dos rutas del ida y vuelta con Google

`connect` manda a Google; `callback` recibe el código y guarda la credencial. El `state` se guarda en la base —y no solo en una cookie— porque tiene que llevar a qué workspace y a qué integración pertenece el retorno.

**Files:**
- Create: `lib/integrations/oauth-state.ts`
- Create: `lib/integrations/oauth-state.test.ts`
- Create: `app/api/integrations/google/connect/route.ts`
- Create: `app/api/integrations/google/callback/route.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `createOAuthState(input: { workspaceId: string; integrationKey: string; userId: number; redirectPath?: string }): Promise<string>`
  - `consumeOAuthState(state: string, now?: Date): Promise<{ workspaceId: string; integrationKey: string; userId: number; redirectPath: string | null } | null>`
  - Las rutas `GET /api/integrations/google/connect?integration=<key>` y `GET /api/integrations/google/callback`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/integrations/oauth-state.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: Record<string, unknown>[] = [];

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceIntegrationOAuthState: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return data;
      }),
      findUnique: vi.fn(async ({ where }: { where: { state: string } }) =>
        rows.find((r) => r.state === where.state) ?? null,
      ),
      delete: vi.fn(async ({ where }: { where: { state: string } }) => {
        const i = rows.findIndex((r) => r.state === where.state);
        if (i >= 0) rows.splice(i, 1);
        return null;
      }),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

import { consumeOAuthState, createOAuthState } from "./oauth-state";

describe("estado anti-CSRF del OAuth", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("el estado es opaco y suficientemente largo para no adivinarse", async () => {
    const state = await createOAuthState({
      workspaceId: "ws-1",
      integrationKey: "google-calendar",
      userId: 7,
    });
    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(state).not.toContain("ws-1");
  });

  it("dos estados seguidos son distintos", async () => {
    const a = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    const b = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    expect(a).not.toBe(b);
  });

  it("consumirlo devuelve a qué workspace y a qué integración pertenece", async () => {
    const state = await createOAuthState({
      workspaceId: "ws-1",
      integrationKey: "google-calendar",
      userId: 7,
      redirectPath: "/workspace/configuracion/integraciones",
    });
    expect(await consumeOAuthState(state)).toEqual({
      workspaceId: "ws-1",
      integrationKey: "google-calendar",
      userId: 7,
      redirectPath: "/workspace/configuracion/integraciones",
    });
  });

  it("un estado se usa una sola vez", async () => {
    const state = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    expect(await consumeOAuthState(state)).not.toBeNull();
    expect(await consumeOAuthState(state)).toBeNull();
  });

  it("un estado inventado no vale", async () => {
    expect(await consumeOAuthState("inventado")).toBeNull();
  });

  it("un estado vencido no vale", async () => {
    const state = await createOAuthState({ workspaceId: "ws-1", integrationKey: "k", userId: 1 });
    const dentroDeUnaHora = new Date(Date.now() + 60 * 60 * 1000);
    expect(await consumeOAuthState(state, dentroDeUnaHora)).toBeNull();
  });

  it("un redirectPath que no sea interno se descarta", async () => {
    const state = await createOAuthState({
      workspaceId: "ws-1",
      integrationKey: "k",
      userId: 1,
      redirectPath: "https://sitio-malicioso.example/robar",
    });
    expect((await consumeOAuthState(state))?.redirectPath).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/oauth-state.test.ts
```

Esperado: FALLA con `Failed to resolve import "./oauth-state"`.

- [ ] **Step 3: Escribir el estado**

Crear `lib/integrations/oauth-state.ts`:

```ts
import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

/**
 * El `state` del ida y vuelta con Google.
 *
 * Va en la base y no solo en una cookie porque tiene que llevar información: a qué
 * workspace y a qué integración corresponde el retorno. Un valor opaco en la URL más una
 * fila que solo el servidor puede leer es lo que impide que alguien arme un retorno falso.
 *
 * Se usa una sola vez y vence a los diez minutos.
 */

const STATE_BYTES = 24;
const TTL_MINUTES = 10;

/** Solo paths relativos internos (anti open-redirect). Mismo criterio que `google-login.ts`. */
function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.includes("\\")) return null;
  return value.slice(0, 512);
}

export async function createOAuthState(input: {
  workspaceId: string;
  integrationKey: string;
  userId: number;
  redirectPath?: string;
}): Promise<string> {
  const state = randomBytes(STATE_BYTES).toString("base64url");
  await prisma.workspaceIntegrationOAuthState.create({
    data: {
      state,
      workspaceId: input.workspaceId,
      integrationKey: input.integrationKey,
      userId: input.userId,
      redirectPath: safeInternalPath(input.redirectPath),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });
  return state;
}

export async function consumeOAuthState(
  state: string,
  now: Date = new Date(),
): Promise<{
  workspaceId: string;
  integrationKey: string;
  userId: number;
  redirectPath: string | null;
} | null> {
  const row = (await prisma.workspaceIntegrationOAuthState.findUnique({
    where: { state },
  })) as {
    workspaceId: string;
    integrationKey: string;
    userId: number;
    redirectPath: string | null;
    expiresAt: Date;
  } | null;
  if (!row) return null;

  // Se borra siempre, valga o no: un estado leído ya no puede volver a usarse.
  await prisma.workspaceIntegrationOAuthState.delete({ where: { state } }).catch(() => undefined);

  if (row.expiresAt.getTime() <= now.getTime()) return null;

  return {
    workspaceId: row.workspaceId,
    integrationKey: row.integrationKey,
    userId: row.userId,
    redirectPath: safeInternalPath(row.redirectPath),
  };
}

/** Limpieza de estados vencidos. La puede llamar cualquier proceso; es idempotente. */
export async function purgeExpiredOAuthStates(now: Date = new Date()): Promise<number> {
  const r = await prisma.workspaceIntegrationOAuthState.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return r.count;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/oauth-state.test.ts
```

Esperado: PASA, 7 tests.

- [ ] **Step 5: Escribir la ruta de conexión**

Crear `app/api/integrations/google/connect/route.ts`:

```ts
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import {
  INTEGRATIONS_GOOGLE_CALLBACK_PATH,
  buildIntegrationAuthorizationUrl,
} from "@/lib/integrations/google-oauth";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { createOAuthState } from "@/lib/integrations/oauth-state";
import { getIntegrationSummary } from "@/lib/integrations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANTALLA = "/workspace/configuracion/integraciones";

function volverConError(origin: string, codigo: string) {
  return NextResponse.redirect(`${origin}${PANTALLA}?error=${codigo}`);
}

/**
 * Manda al dueño a darle permiso a Google.
 *
 * No es el login: pide acceso sin conexión para poder actuar en nombre de la institución
 * cuando nadie está mirando la pantalla. Ver `lib/integrations/google-oauth.ts`.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!canManageWorkspaceSettings(role)) return volverConError(origin, "sin_permiso");

  const key = url.searchParams.get("integration")?.trim() ?? "";
  const definition = getIntegrationDefinition(key);
  if (!definition || definition.status !== "AVAILABLE") {
    return volverConError(origin, "integracion_desconocida");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return volverConError(origin, "falta_configuracion");

  const state = await createOAuthState({
    workspaceId: workspace.id,
    integrationKey: definition.key,
    userId: user.id,
    redirectPath: PANTALLA,
  });

  // Al reconectar, sugerirle la cuenta que ya había usado evita que conecte otra por error.
  const anterior = await getIntegrationSummary(workspace.id, definition.key);

  return NextResponse.redirect(
    buildIntegrationAuthorizationUrl({
      clientId,
      redirectUri: `${origin}${INTEGRATIONS_GOOGLE_CALLBACK_PATH}`,
      state,
      scopes: definition.scopes,
      ...(anterior ? { loginHint: anterior.accountEmail } : {}),
    }),
  );
}
```

- [ ] **Step 6: Escribir la ruta de retorno**

Crear `app/api/integrations/google/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/payments/connect/log";
import {
  INTEGRATIONS_GOOGLE_CALLBACK_PATH,
  exchangeIntegrationCode,
  fetchGoogleAccountEmail,
  hasAllScopes,
} from "@/lib/integrations/google-oauth";
import { consumeOAuthState } from "@/lib/integrations/oauth-state";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { saveIntegration } from "@/lib/integrations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PANTALLA = "/workspace/configuracion/integraciones";

/**
 * Recibe el código de Google y guarda la credencial cifrada.
 *
 * Ningún camino de este archivo escribe el `code`, el `state` ni ningún token: ni en un
 * log, ni en la URL de vuelta, ni en un mensaje de error visible.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const volver = (params: string) => NextResponse.redirect(`${origin}${PANTALLA}?${params}`);

  // El usuario apretó "Cancelar" en la pantalla de Google. No es un error del sistema.
  if (url.searchParams.get("error")) return volver("error=cancelado");

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code) return volver("error=respuesta_incompleta");

  const transito = await consumeOAuthState(state);
  if (!transito) return volver("error=estado_vencido");

  const definition = getIntegrationDefinition(transito.integrationKey);
  if (!definition || definition.status !== "AVAILABLE") {
    return volver("error=integracion_desconocida");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return volver("error=falta_configuracion");

  try {
    const token = await exchangeIntegrationCode({
      code,
      clientId,
      clientSecret,
      redirectUri: `${origin}${INTEGRATIONS_GOOGLE_CALLBACK_PATH}`,
    });

    // Google puede otorgar menos permisos de los pedidos. Guardar una integración que no
    // puede hacer su trabajo sería peor que no guardarla: se vería conectada y fallaría después.
    if (!hasAllScopes(token.grantedScopes, definition.scopes)) {
      return volver("error=permisos_incompletos");
    }

    const cuenta = await fetchGoogleAccountEmail(token.accessToken);

    await saveIntegration({
      workspaceId: transito.workspaceId,
      integrationKey: definition.key,
      provider: definition.provider,
      accountEmail: cuenta.email,
      accountExternalId: cuenta.externalId,
      grantedScopes: token.grantedScopes,
      refreshToken: token.refreshToken as string,
      connectedByUserId: transito.userId,
    });

    return volver(`ok=conectado&integracion=${encodeURIComponent(definition.key)}`);
  } catch (error) {
    console.error("[fotoffice][integraciones] falló la conexión con Google", {
      workspaceId: transito.workspaceId,
      integrationKey: transito.integrationKey,
      detalle: sanitizeError(error),
    });
    return volver("error=no_se_pudo_conectar");
  }
}
```

- [ ] **Step 7: Verificar que compila y que la suite sigue verde**

```bash
npx tsc --noEmit && pnpm test
```

Esperado: sin errores de tipos nuevos, y la suite entera pasa.

- [ ] **Step 8: Commitear**

```bash
git add lib/integrations/oauth-state.ts lib/integrations/oauth-state.test.ts app/api/integrations
git commit -m "$(cat <<'MSG'
El dueño le da permiso a Google y la credencial queda guardada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: La pantalla de Integraciones

Una tarjeta por integración ofrecible, con su estado y su botón. Incluye la acción de desconectar.

**Files:**
- Create: `lib/integrations/messages.ts`
- Create: `lib/integrations/messages.test.ts`
- Create: `app/workspace/configuracion/integraciones/page.tsx`
- Create: `app/workspace/configuracion/integraciones/actions.ts`
- Create: `app/workspace/configuracion/integraciones/disconnect-button.tsx`

**Interfaces:**
- Consumes: `listIntegrationSummaries`, `deleteIntegration` (Task 5); `listIntegrations`, `integrationsRequiredByModule` (Task 1); `revokeIntegrationToken` (Task 4).
- Produces:
  - `integrationErrorMessage(code: string | null): string | null`
  - `integrationOkMessage(code: string | null): string | null`
  - Server action `disconnectIntegrationAction(formData: FormData): Promise<void>`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/integrations/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { integrationErrorMessage, integrationOkMessage } from "./messages";

describe("mensajes de la pantalla de integraciones", () => {
  it("cada código de error tiene un texto en castellano", () => {
    for (const code of [
      "sin_permiso",
      "integracion_desconocida",
      "falta_configuracion",
      "cancelado",
      "respuesta_incompleta",
      "estado_vencido",
      "permisos_incompletos",
      "no_se_pudo_conectar",
    ]) {
      const mensaje = integrationErrorMessage(code);
      expect(mensaje, code).toBeTruthy();
      expect(mensaje!.length).toBeGreaterThan(10);
    }
  });

  it("sin código no hay mensaje", () => {
    expect(integrationErrorMessage(null)).toBeNull();
    expect(integrationOkMessage(null)).toBeNull();
  });

  it("un código desconocido da un mensaje genérico, nunca el código crudo", () => {
    const mensaje = integrationErrorMessage("algo_raro_123");
    expect(mensaje).toBeTruthy();
    expect(mensaje).not.toContain("algo_raro_123");
  });

  it("el mensaje de éxito confirma la conexión", () => {
    expect(integrationOkMessage("conectado")).toContain("conect");
  });

  it("ningún mensaje nombra una variable de entorno ni un token", () => {
    for (const code of ["falta_configuracion", "no_se_pudo_conectar", "permisos_incompletos"]) {
      const mensaje = integrationErrorMessage(code)!;
      expect(mensaje).not.toContain("GOOGLE_CLIENT");
      expect(mensaje).not.toContain("token");
    }
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
pnpm test lib/integrations/messages.test.ts
```

Esperado: FALLA con `Failed to resolve import "./messages"`.

- [ ] **Step 3: Escribir los mensajes**

Crear `lib/integrations/messages.ts`:

```ts
/**
 * Lo que lee el dueño cuando algo sale bien o mal al conectar una cuenta.
 *
 * Un mensaje nunca nombra una variable de entorno ni menciona tokens: quien está mirando
 * esta pantalla no puede hacer nada con esa información, y a quien no debería estar
 * mirándola le estaría contando cómo está armado el sistema. El detalle técnico va al log
 * del servidor, sanitizado.
 *
 * Módulo PURO: sin base y sin red.
 */

const ERRORES: Record<string, string> = {
  sin_permiso: "No tenés permiso para conectar cuentas de esta institución.",
  integracion_desconocida: "Esa integración no está disponible.",
  falta_configuracion:
    "La conexión con Google todavía no está habilitada en la plataforma. Escribinos y lo resolvemos.",
  cancelado: "Cancelaste la conexión con Google. No se guardó nada.",
  respuesta_incompleta: "Google devolvió una respuesta incompleta. Probá conectar de nuevo.",
  estado_vencido:
    "La conexión tardó demasiado y venció por seguridad. Volvé a empezar desde el botón Conectar.",
  permisos_incompletos:
    "Google no otorgó todos los permisos necesarios. Volvé a conectar y aceptá todos los pedidos.",
  no_se_pudo_conectar: "No se pudo completar la conexión con Google. Probá de nuevo en un rato.",
  no_se_pudo_desconectar: "No se pudo desconectar la cuenta. Probá de nuevo en un rato.",
};

const GENERICO = "No se pudo completar la operación. Probá de nuevo en un rato.";

export function integrationErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return ERRORES[code] ?? GENERICO;
}

const EXITOS: Record<string, string> = {
  conectado: "Cuenta conectada. Ya podés usar lo que depende de ella.",
  desconectado: "Cuenta desconectada. Lo que dependía de ella deja de sincronizar.",
};

export function integrationOkMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return EXITOS[code] ?? null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
pnpm test lib/integrations/messages.test.ts
```

Esperado: PASA, 5 tests.

- [ ] **Step 5: Escribir la acción de desconectar**

Crear `app/workspace/configuracion/integraciones/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { sanitizeError } from "@/lib/payments/connect/log";
import { deleteIntegration } from "@/lib/integrations/store";
import { revokeIntegrationToken } from "@/lib/integrations/google-oauth";
import { getIntegrationDefinition } from "@/lib/integrations/registry";

const PANTALLA = "/workspace/configuracion/integraciones";

/**
 * Desconecta una cuenta.
 *
 * Borra la credencial primero y recién después le avisa a Google. Si el aviso falla, el
 * permiso queda vivo del lado de Google pero la plataforma ya no lo tiene: es el orden
 * correcto, porque el error que importa evitar es quedarse con una credencial que el dueño
 * pidió borrar.
 *
 * Lo ya creado con esa cuenta (por ejemplo, eventos en el calendario) NO se toca.
 */
export async function disconnectIntegrationAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!canManageWorkspaceSettings(role)) redirect(`${PANTALLA}?error=sin_permiso`);

  const key = String(formData.get("integrationKey") ?? "").trim();
  if (!getIntegrationDefinition(key)) redirect(`${PANTALLA}?error=integracion_desconocida`);

  try {
    const refreshToken = await deleteIntegration(workspace.id, key);
    if (refreshToken) await revokeIntegrationToken(refreshToken);
  } catch (error) {
    console.error("[fotoffice][integraciones] falló la desconexión", {
      workspaceId: workspace.id,
      integrationKey: key,
      detalle: sanitizeError(error),
    });
    redirect(`${PANTALLA}?error=no_se_pudo_desconectar`);
  }

  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?ok=desconectado`);
}
```

- [ ] **Step 6: Escribir el botón de desconectar**

Crear `app/workspace/configuracion/integraciones/disconnect-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { disconnectIntegrationAction } from "./actions";

/**
 * Desconectar es una acción difícil de deshacer —hay que volver a pedirle permiso a
 * Google—, así que pide confirmación y dice con todas las letras qué deja de funcionar.
 */
export function DisconnectButton({
  integrationKey,
  label,
  consequence,
}: {
  integrationKey: string;
  label: string;
  consequence: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-red-700 underline underline-offset-4 hover:text-red-800"
      >
        Desconectar
      </button>
    );
  }

  return (
    <form action={disconnectIntegrationAction} className="flex flex-col gap-2">
      <input type="hidden" name="integrationKey" value={integrationKey} />
      <p className="text-sm text-red-800">
        Al desconectar {label}, {consequence}
      </p>
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
        >
          Sí, desconectar
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm text-slate-600 underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Escribir la pantalla**

Crear `app/workspace/configuracion/integraciones/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { getModuleDefinition } from "@/lib/modules/registry";
import { listIntegrations } from "@/lib/integrations/registry";
import { listIntegrationSummaries } from "@/lib/integrations/store";
import { integrationErrorMessage, integrationOkMessage } from "@/lib/integrations/messages";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

/**
 * Las cuentas de terceros de la institución, en un solo lugar.
 *
 * Vive acá y no dentro de cada módulo porque la misma cuenta de Google sirve a Calendar
 * (Reservas), Classroom (Cursos) y Contacts (Socios). Repartir la conexión entre las
 * pantallas de cada módulo obligaría a conectar la misma cuenta tres veces y dejaría al
 * dueño sin un lugar donde ver qué le dio a la plataforma.
 *
 * Ver la enmienda a `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` §4.6.
 */
export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const params = await searchParams;
  const [role, conectadas] = await Promise.all([
    resolveWorkspaceRole(user.id, workspace.id),
    listIntegrationSummaries(workspace.id),
  ]);
  if (!canManageWorkspaceSettings(role)) redirect("/workspace/configuracion");

  const porClave = new Map(conectadas.map((c) => [c.integrationKey, c]));
  const disponibles = listIntegrations({ status: "AVAILABLE" });

  const error = integrationErrorMessage(params.error ?? null);
  const ok = integrationOkMessage(params.ok ?? null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integraciones"
        description="Cuentas de servicios externos que la institución vincula a FotoOffice."
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {disponibles.map((integration) => {
          const conectada = porClave.get(integration.key);
          const modulos = integration.requiredByModules
            .map((key) => getModuleDefinition(key)?.label)
            .filter((label): label is string => Boolean(label));

          return (
            <section
              key={integration.key}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="text-base font-semibold text-slate-900">{integration.label}</h2>
                  <p className="mt-1 text-sm text-slate-600">{integration.description}</p>
                  {modulos.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      La usa: {modulos.join(", ")}.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {conectada?.status === "ACTIVE" ? (
                    <>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                        Conectada
                      </span>
                      <span className="text-sm text-slate-700">{conectada.accountEmail}</span>
                      <DisconnectButton
                        integrationKey={integration.key}
                        label={integration.label}
                        consequence="lo que depende de esta cuenta deja de sincronizar. Lo ya creado no se borra."
                      />
                    </>
                  ) : conectada?.status === "NEEDS_RECONSENT" ? (
                    <>
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
                        Necesita reconexión
                      </span>
                      <span className="text-sm text-slate-700">{conectada.accountEmail}</span>
                      <Link
                        href={`/api/integrations/google/connect?integration=${integration.key}`}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Volver a conectar
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/api/integrations/google/connect?integration=${integration.key}`}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Conectar
                    </Link>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verificar que compila y que la suite sigue verde**

```bash
npx tsc --noEmit && pnpm test
```

Esperado: sin errores nuevos, suite verde. `PageHeader` ya existe en `components/page-header.tsx` y lo usan las otras pantallas de configuración.

- [ ] **Step 9: Commitear**

```bash
git add lib/integrations/messages.ts lib/integrations/messages.test.ts app/workspace/configuracion/integraciones
git commit -m "$(cat <<'MSG'
La institución ve y maneja sus cuentas de Google en un solo lugar

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Menú, documentación y variable de entorno

Lo que hace que la pantalla exista para alguien que no conoce la URL.

**Files:**
- Modify: `components/shell/shell-nav.tsx` (agregar el ítem en la sección INSTITUCIÓN)
- Modify: `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` (§4.1, §4.6 y §4.10)
- Modify: `docs/fotoffice/ESTADO-ACTUAL.md` (registrar la migración pendiente en las otras bases)

**Interfaces:**
- Consumes: la pantalla de Task 8.
- Produces: nada de código.

- [ ] **Step 1: Agregar el ítem al menú**

Abrir `components/shell/shell-nav.tsx` y buscar la sección INSTITUCIÓN (la que tiene "Datos de la institución" con ruta `/workspace/configuracion` y "Cobros" con `/workspace/configuracion/cobros`). Agregar entre las dos, respetando exactamente la forma que tengan los ítems vecinos en ese archivo:

- Etiqueta: `Integraciones`
- Ruta: `/workspace/configuracion/integraciones`
- Ícono: `Plug` de `lucide-react`
- Rol: el mismo que usan "Datos de la institución" y "Cobros" (ADMIN+)

Verificar que `Plug` quede importado junto a los demás íconos del archivo.

- [ ] **Step 2: Verificar el menú en el navegador**

```bash
pnpm dev
```

Entrar como dueño de la SFPR, abrir el panel y confirmar: en INSTITUCIÓN aparece "Integraciones" entre "Datos de la institución" y "Cobros", el enlace abre la pantalla, y la tarjeta de Google Calendar muestra el botón Conectar.

Entrar como STAFF y confirmar que la sección no aparece, y que escribir la URL a mano redirige a `/workspace/configuracion`.

- [ ] **Step 3: Actualizar el documento de navegación**

En `docs/fotoffice/ARQUITECTURA-NAVEGACION.md`:

1. En §4.10 INSTITUCIÓN, agregar la fila:

```markdown
| 25 | Integraciones | `/workspace/configuracion/integraciones` | `Plug` | ADMIN+ | ✅ |
```

2. En §4.6 RESERVAS, reemplazar el párrafo *«La conexión con el Google Calendar de la institución es un ajuste dentro de "Tarifas y reglas", no un ítem propio»* por:

```markdown
La conexión con el Google Calendar de la institución **no vive acá**: es una cuenta de la
organización entera y vive en Integraciones (§4.10). La misma cuenta sirve a Calendar
(Reservas), Classroom (Cursos) y Contacts (Socios), y repartir la conexión entre los módulos
obligaría a conectarla tres veces. "Tarifas y reglas" muestra el estado de la conexión y
enlaza a Integraciones: informa, no conecta.
```

3. En §4.1 SOCIOS, en la tabla de "Sección llena", cambiar la fila de Google Contacts:

```markdown
| Sincronización con Google Contacts ⬜ | La cuenta se conecta en Integraciones (§4.10); el interruptor de sincronizar va dentro de Padrón |
```

- [ ] **Step 4: Registrar la deuda de base de datos**

En `docs/fotoffice/ESTADO-ACTUAL.md`, en la lista de pendientes operativos, agregar:

```markdown
- **Migración `20260908000000_workspace_integrations`.** Aplicada a mano en la base de
  FOTOFFICE. Es aditiva —dos tablas nuevas, ninguna columna existente modificada— así que no
  afecta a las otras aplicaciones de la suite, que quedan sin ella hasta que la necesiten.
- **Variable `DNX_INTEGRATIONS_VAULT_MASTER_KEY`.** Sin ella no se puede conectar ninguna
  cuenta de Google. Se genera con `openssl rand -base64 32` y se carga en Vercel.
```

- [ ] **Step 5: Configurar la variable y la consola de Google**

Generar la clave maestra:

```bash
openssl rand -base64 32
```

Cargarla como `DNX_INTEGRATIONS_VAULT_MASTER_KEY` en el `.env.local` de desarrollo y en las variables de entorno de Vercel (Production y Preview).

En la consola de Google Cloud, en las credenciales OAuth de la aplicación, agregar la URL de retorno nueva **sin quitar la del login**:

```
https://<dominio-de-fotoffice>/api/integrations/google/callback
http://localhost:3010/api/integrations/google/callback
```

Y habilitar la Google Calendar API en el proyecto.

- [ ] **Step 6: Probar el circuito completo en desarrollo**

```bash
pnpm dev
```

1. Entrar como dueño, ir a Integraciones, apretar Conectar en Google Calendar.
2. Aceptar los permisos en la pantalla de Google.
3. Confirmar que vuelve a la pantalla con el aviso verde y la cuenta a la vista.
4. Confirmar en la base que la fila existe y que **el refresh token no está en claro**:

```sql
SELECT "accountEmail", "status", "keyVersion", left("ciphertext", 20) FROM "WorkspaceIntegration";
```

5. Apretar Desconectar, confirmar, y verificar que la fila desapareció.

- [ ] **Step 7: Correr la suite completa**

```bash
pnpm test && npx tsc --noEmit && pnpm lint
```

Esperado: los 1.209 tests previos más los ~50 nuevos, todos en verde. Sin errores de tipos nuevos. Sin avisos de lint nuevos.

- [ ] **Step 8: Commitear**

```bash
git add components/shell/shell-nav.tsx docs/fotoffice/ARQUITECTURA-NAVEGACION.md docs/fotoffice/ESTADO-ACTUAL.md
git commit -m "$(cat <<'MSG'
Integraciones entra al menú y el mapa de navegación queda al día

La conexión con Google deja de ser un ajuste dentro de cada módulo: la misma
cuenta sirve a Calendar, Classroom y Contacts, así que vive en Institución.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Qué queda funcionando al terminar

El dueño de la SFPR entra a Configuración → Integraciones, conecta la cuenta de Google de la institución, y la ve conectada con su email. La credencial queda cifrada en la base. Cualquier módulo puede pedir `getGoogleAccessToken(workspaceId, "google-calendar")` y recibir un token vigente, o un motivo claro por el que no hay uno.

**No hay ninguna pantalla que use eso todavía.** Ese es el plan de Reservas.
