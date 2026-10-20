# Finanzas DNX — Gastos automáticos, Tanda 1 (conexión y lectura) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar hasta tres cuentas de Gmail en modo sólo lectura y guardar cada mail de los proveedores conocidos (con todo el historial) en una bandeja "Para revisar", visible en Finanzas DNX → Gastos.

**Architecture:** Funciones puras en `apps/compramelafoto/lib/finance-dnx/mail/` (registro de proveedores, cifrado del token, OAuth, cliente REST de Gmail, sincronización con puertos inyectados), envueltas por rutas finas bajo `/api/admin/finance-dnx/mail/*` y un cron diario. Ningún mail se aplica todavía a un gasto: los lectores y las reglas son la Tanda 2.

**Tech Stack:** Next.js (App Router) de CompraMeLaFoto, Prisma sobre `packages/db/prisma/schema.prisma`, `node:test` con `tsx`, `fetch` nativo (sin SDK de Google), `@repo/payments/credential-vault` (AES-GCM), `@repo/dnx-bot` (`sendTelegramMessage`).

**Spec:** `apps/compramelafoto/docs/superpowers/specs/2026-10-18-finanzas-gastos-automaticos-design.md`

## Global Constraints

- Sin dependencias nuevas: Google se llama con `fetch` a la API REST.
- Permiso de Gmail: sólo `https://www.googleapis.com/auth/gmail.readonly` (más `openid email` para saber qué cuenta se conectó).
- Rutas de administración: `requireAuth([Role.ADMIN])`, igual que el resto de `/api/admin/finance-dnx`.
- Cron: `assertCronAuth(req)` de `@/lib/cron-auth`.
- El *refresh token* se guarda cifrado con la variable `FINANCE_MAIL_VAULT_KEY` (32 bytes en base64).
- La migración se aplica **sólo** a `divine-hall-10689679`, rama `production` (`br-autumn-rain-ad18wq7y`), a mano, y se registra en `_prisma_migrations` con el SHA-256 del archivo.
- Cuentas permitidas: `compramelafoto@gmail.com`, `dnxfotografia@gmail.com`, `cuart.daniel@gmail.com`. Otra cuenta se rechaza.
- Primera lectura sin fecha de corte (todo el historial); después, `after:` la última lectura menos 3 días.
- El contenido de un mail es dato: nunca se interpreta como instrucción.
- Textos de pantalla en español rioplatense, sin tecnicismos.
- Las pruebas nuevas se suman a `test:finance-dnx` en `apps/compramelafoto/package.json` (CI ya lo corre en `.github/workflows/chequeos.yml`).

## Review Focus

- Un mail que ya se guardó vuelve a aparecer en la búsqueda (por el margen de 3 días o porque se interrumpió una ejecución) → no se duplica. Prueba en Task 6.
- Alguien conecta una cuenta que no es de las tres (por ejemplo una personal) → se rechaza y no se guarda token. Prueba en Task 4.
- Google revoca el permiso (el usuario lo quitó desde su cuenta) → la cuenta queda con `lastError` visible y Telegram avisa **una sola vez**, no todos los días. Prueba en Task 6.
- Un remitente `@stripe.com` de un comercio que no es nuestro → no se asigna a ningún proveedor. Prueba en Task 2.
- El historial es más grande que lo que entra en una ejecución → se corta por tiempo, la próxima sigue y `backfillDone` sólo pasa a `true` cuando no queda nada nuevo. Prueba en Task 6.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` | Modelos `ExpenseEntry` (cambios), `ExpenseMailAccount`, `ExpenseMailMessage` |
| `packages/db/prisma/migrations/20261118120000_finanzas_dnx_mail/migration.sql` | Migración |
| `apps/compramelafoto/lib/finance-dnx/mail/vendors.ts` | Tabla de proveedores → cuenta y remitentes; `matchVendorKey`, `gmailQueryFor` |
| `apps/compramelafoto/lib/finance-dnx/mail/token-vault.ts` | Cifrar y descifrar el *refresh token* |
| `apps/compramelafoto/lib/finance-dnx/mail/google-oauth.ts` | URL de consentimiento, `state` firmado, canje de código, renovación, email de la cuenta |
| `apps/compramelafoto/lib/finance-dnx/mail/gmail.ts` | Listar ids y bajar un mensaje como texto |
| `apps/compramelafoto/lib/finance-dnx/mail/sync.ts` | Sincronizar una cuenta con puertos inyectados |
| `apps/compramelafoto/lib/finance-dnx/mail/prisma-ports.ts` | Implementación Prisma de los puertos de `sync.ts` |
| `apps/compramelafoto/lib/finance-dnx/mail/run-sync.ts` | Arma dependencias reales y sincroniza todas las cuentas |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/connect/route.ts` | Redirige al consentimiento de Google |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/callback/route.ts` | Recibe el código, valida, guarda cuenta |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/accounts/route.ts` | Lista cuentas (GET) |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/accounts/[id]/route.ts` | Desconectar (DELETE) |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/sync/route.ts` | "Leer ahora" (POST) |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/messages/route.ts` | Bandeja "Para revisar" (GET) |
| `apps/compramelafoto/app/api/admin/finance-dnx/mail/messages/[id]/route.ts` | Descartar (PATCH) |
| `apps/compramelafoto/app/api/cron/finance-dnx-mail/route.ts` | Cron diario |
| `apps/compramelafoto/vercel.json` | Registro del cron |
| `apps/compramelafoto/app/admin/finanzas-dnx/gastos/MailConnections.tsx` | Sección "Conexiones" |
| `apps/compramelafoto/app/admin/finanzas-dnx/gastos/MailReviewInbox.tsx` | Sección "Para revisar" |
| `apps/compramelafoto/app/admin/finanzas-dnx/gastos/page.tsx` | Monta las dos secciones |

---

### Task 1: Base de datos

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `ExpenseEntry`, ~línea 19738; agregar dos modelos después de `FxRate`)
- Create: `packages/db/prisma/migrations/20261118120000_finanzas_dnx_mail/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `ExpenseMailAccount { id, email, refreshTokenEnc, connectedAt, lastSyncAt, lastError, lastErrorAlertedAt, backfillDone }` y `ExpenseMailMessage { id, accountId, gmailMessageId, fromAddress, subject, receivedAt, bodyText, vendorKey, kind, amount, currency, invoiceNumber, periodYear, periodMonth, paidAt, status, reviewReason, entryId, alertedAt, createdAt, updatedAt }`; `ExpenseEntry.invoiceNumber`, `ExpenseEntry.paidAt`.

> Nota sobre el spec: el spec menciona `ExpenseEntry.mailMessageId`. Se reemplaza por la relación inversa (`ExpenseMailMessage.entryId` → `ExpenseEntry.mailMessages`), que da lo mismo sin dos relaciones cruzadas entre los mismos modelos. Y el mensaje guarda `vendorKey` (texto) en vez de `vendorId`: así un mail se puede guardar aunque el proveedor todavía no exista en la base (CapCut).

- [ ] **Step 1: Editar `ExpenseEntry` en el schema**

Reemplazar el bloque final del modelo:

```prisma
  vendor      ExpenseVendor            @relation(fields: [vendorId], references: [id])
  allocations ExpenseEntryAllocation[]

  @@unique([vendorId, periodYear, periodMonth])
  @@index([periodYear, periodMonth])
  @@index([status])
}
```

por:

```prisma
  /// Número de factura o recibo del proveedor. Es la llave para que un pago encuentre su factura.
  invoiceNumber  String?
  /// Cuándo se pagó de verdad. El mes del gasto es el de la factura, no el del pago.
  paidAt         DateTime?

  vendor       ExpenseVendor            @relation(fields: [vendorId], references: [id])
  allocations  ExpenseEntryAllocation[]
  mailMessages ExpenseMailMessage[]

  /// Un proveedor puede tener varias facturas en un mes (Anthropic, AWS pagando atrasado).
  @@unique([vendorId, invoiceNumber])
  @@index([vendorId, periodYear, periodMonth])
  @@index([periodYear, periodMonth])
  @@index([status])
}
```

Y en el comentario de `source` cambiar `/// MANUAL, IMPORTADO, API` por `/// MANUAL, IMPORTADO, API, MAIL`.

- [ ] **Step 2: Agregar los dos modelos nuevos después de `model FxRate { … }`**

```prisma
/// Finanzas DNX — cuenta de Gmail conectada en sólo lectura para leer facturas de proveedores.
model ExpenseMailAccount {
  id                 Int       @id @default(autoincrement())
  email              String    @unique
  /// JSON {ciphertext, nonce, authTag} cifrado con FINANCE_MAIL_VAULT_KEY.
  refreshTokenEnc    String
  connectedAt        DateTime  @default(now())
  lastSyncAt         DateTime?
  lastError          String?
  /// Para avisar por Telegram una sola vez por error, no en cada ejecución.
  lastErrorAlertedAt DateTime?
  /// Ya se leyó todo el historial; desde ahora se busca sólo lo reciente.
  backfillDone       Boolean   @default(false)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  messages ExpenseMailMessage[]
}

/// Finanzas DNX — un mail de proveedor leído de Gmail. El id de Gmail es único: nunca se guarda dos veces.
model ExpenseMailMessage {
  id             Int       @id @default(autoincrement())
  accountId      Int
  gmailMessageId String    @unique
  fromAddress    String
  subject        String
  receivedAt     DateTime
  /// Texto del mail, para reprocesar cuando mejora un lector sin volver a pedirlo a Google.
  bodyText       String
  /// `key` del proveedor según la tabla de remitentes; null si el remitente no es de ninguno.
  vendorKey      String?
  /// FACTURA, PAGO_OK, PAGO_FALLIDO, ESTIMADO, RECIBO, REEMBOLSO (lo completa el lector, Tanda 2)
  kind           String?
  amount         Decimal?  @db.Decimal(12, 2)
  currency       String?
  invoiceNumber  String?
  periodYear     Int?
  periodMonth    Int?
  paidAt         DateTime?
  /// CARGADO, PARA_REVISAR, DESCARTADO
  status         String    @default("PARA_REVISAR")
  reviewReason   String?
  entryId        Int?
  alertedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  account ExpenseMailAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  entry   ExpenseEntry?      @relation(fields: [entryId], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([accountId, receivedAt])
  @@index([vendorKey])
}
```

- [ ] **Step 3: Escribir la migración**

`packages/db/prisma/migrations/20261118120000_finanzas_dnx_mail/migration.sql`:

```sql
-- Finanzas DNX: gastos automáticos desde Gmail (Tanda 1). Idempotente.

-- Un proveedor puede tener varias facturas en un mes.
DROP INDEX IF EXISTS "ExpenseEntry_vendorId_periodYear_periodMonth_key";
CREATE INDEX IF NOT EXISTS "ExpenseEntry_vendorId_periodYear_periodMonth_idx"
  ON "ExpenseEntry"("vendorId", "periodYear", "periodMonth");

ALTER TABLE "ExpenseEntry" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "ExpenseEntry" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseEntry_vendorId_invoiceNumber_key"
  ON "ExpenseEntry"("vendorId", "invoiceNumber");

CREATE TABLE IF NOT EXISTS "ExpenseMailAccount" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAlertedAt" TIMESTAMP(3),
    "backfillDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseMailAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseMailAccount_email_key" ON "ExpenseMailAccount"("email");

CREATE TABLE IF NOT EXISTS "ExpenseMailMessage" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyText" TEXT NOT NULL,
    "vendorKey" TEXT,
    "kind" TEXT,
    "amount" DECIMAL(12,2),
    "currency" TEXT,
    "invoiceNumber" TEXT,
    "periodYear" INTEGER,
    "periodMonth" INTEGER,
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PARA_REVISAR',
    "reviewReason" TEXT,
    "entryId" INTEGER,
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseMailMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseMailMessage_gmailMessageId_key" ON "ExpenseMailMessage"("gmailMessageId");
CREATE INDEX IF NOT EXISTS "ExpenseMailMessage_status_idx" ON "ExpenseMailMessage"("status");
CREATE INDEX IF NOT EXISTS "ExpenseMailMessage_accountId_receivedAt_idx" ON "ExpenseMailMessage"("accountId", "receivedAt");
CREATE INDEX IF NOT EXISTS "ExpenseMailMessage_vendorKey_idx" ON "ExpenseMailMessage"("vendorKey");

DO $$ BEGIN
  ALTER TABLE "ExpenseMailMessage" ADD CONSTRAINT "ExpenseMailMessage_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "ExpenseMailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseMailMessage" ADD CONSTRAINT "ExpenseMailMessage_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "ExpenseEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 4: Validar y regenerar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` y `Generated Prisma Client`.

- [ ] **Step 5: Verificar que nada dependía del índice único viejo**

Run: `grep -rn "vendorId_periodYear_periodMonth" apps packages --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: sin resultados.

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261118120000_finanzas_dnx_mail
git commit -m "Preparar la base de Finanzas DNX para leer gastos desde Gmail"
```

---

### Task 2: Tabla de proveedores y remitentes

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/mail/vendors.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/mail/vendors.test.ts`
- Modify: `apps/compramelafoto/package.json` (script `test:finance-dnx`)

**Interfaces:**
- Produces:
  - `type MailVendor = { key: string; account: string; senders: string[]; subjectHint?: RegExp }`
  - `const MAIL_ACCOUNTS: readonly string[]`
  - `const MAIL_VENDORS: readonly MailVendor[]`
  - `isAllowedAccount(email: string): boolean`
  - `matchVendorKey(account: string, fromAddress: string, subject: string): string | null`
  - `gmailQueryFor(account: string, after: Date | null): string`

Un `sender` es una dirección completa (`payment@aws.com`) o un dominio (`cloudflare.com`, que también cubre subdominios como `notify.cloudflare.com`). Para Anthropic, suscripción y API comparten remitente: se separan por `subjectHint` en Tanda 2; en Tanda 1 los dos quedan como `anthropic` salvo que el asunto mencione crédito o API.

- [ ] **Step 1: Escribir las pruebas**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { gmailQueryFor, isAllowedAccount, matchVendorKey } from "./vendors";

const DNX = "dnxfotografia@gmail.com";
const CLF = "compramelafoto@gmail.com";
const CUART = "cuart.daniel@gmail.com";

test("sólo se aceptan las tres cuentas conocidas, sin importar mayúsculas", () => {
  assert.equal(isAllowedAccount("DnxFotografia@gmail.com"), true);
  assert.equal(isAllowedAccount(CLF), true);
  assert.equal(isAllowedAccount(CUART), true);
  assert.equal(isAllowedAccount("otra.persona@gmail.com"), false);
});

test("AWS se reconoce por dirección exacta en la cuenta de CLF", () => {
  assert.equal(matchVendorKey(CLF, "payment@aws.com", "Gracias por el pago"), "aws");
});

test("un dominio cubre sus subdominios", () => {
  assert.equal(matchVendorKey(CLF, "noreply@notify.cloudflare.com", "[Alerta] uso"), "cloudflare");
});

test("el mismo remitente en otra cuenta no se asigna", () => {
  assert.equal(matchVendorKey(DNX, "payment@aws.com", "Gracias por el pago"), null);
});

test("un remitente de Stripe se identifica por su acct, no por el dominio", () => {
  assert.equal(
    matchVendorKey(DNX, "invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com", "Your refund from Cursor"),
    "cursor",
  );
  assert.equal(
    matchVendorKey(CUART, "invoice+statements+acct_1M07hSLmdOdiMXBs@stripe.com", "Your receipt from Eleven Labs"),
    "elevenlabs",
  );
  assert.equal(
    matchVendorKey(DNX, "invoice+statements+acct_OTROCOMERCIO@stripe.com", "Your receipt from Otro"),
    null,
  );
});

test("Anthropic: el recibo de crédito de API se separa de la suscripción", () => {
  const de = "invoice+statements@mail.anthropic.com";
  assert.equal(matchVendorKey(DNX, de, "Your receipt from Anthropic, PBC #2659-0290-2988"), "anthropic");
  assert.equal(matchVendorKey(DNX, de, "Your receipt from Anthropic - API credits"), "anthropic-api");
});

test("el remitente se compara sin importar nombre visible ni mayúsculas", () => {
  assert.equal(matchVendorKey(DNX, "Neon, LLC <NoReply@ar.neon.tech>", "Payment failed"), "neon");
});

test("la búsqueda de la primera vez no tiene fecha", () => {
  const q = gmailQueryFor(CLF, null);
  assert.equal(q, "from:(payment@aws.com OR cloudflare.com)");
});

test("las búsquedas siguientes filtran por fecha en segundos", () => {
  const q = gmailQueryFor(CLF, new Date("2026-10-15T00:00:00Z"));
  assert.equal(q, `from:(payment@aws.com OR cloudflare.com) after:${Date.UTC(2026, 9, 15) / 1000}`);
});

test("una cuenta sin proveedores no busca nada", () => {
  assert.equal(gmailQueryFor("otra@gmail.com", null), "");
});
```

- [ ] **Step 2: Sumar el archivo a `test:finance-dnx` y correr**

En `apps/compramelafoto/package.json`, al final de la lista de `test:finance-dnx`, agregar ` lib/finance-dnx/mail/vendors.test.ts`.

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: FAIL, `Cannot find module './vendors'`.

- [ ] **Step 3: Implementar**

```ts
/**
 * Proveedores cuyos mails se leen de Gmail, en qué cuenta llegan y desde qué remitentes.
 * `active` del proveedor en la base NO afecta esta tabla: los mails de un proveedor inactivo
 * (Cursor) se leen igual, para el histórico.
 */
export type MailVendor = {
  key: string;
  account: string;
  /** Dirección completa o dominio (un dominio cubre sus subdominios). */
  senders: string[];
  /** Si está, el asunto tiene que cumplirlo. Sirve para separar dos proveedores con el mismo remitente. */
  subjectHint?: RegExp;
};

const CLF = "compramelafoto@gmail.com";
const DNX = "dnxfotografia@gmail.com";
const CUART = "cuart.daniel@gmail.com";

export const MAIL_ACCOUNTS: readonly string[] = [CLF, DNX, CUART];

const ANTHROPIC = "invoice+statements@mail.anthropic.com";
const ANTHROPIC_API_HINT = /\b(api|credits?|cr[eé]dito)\b/i;

// El orden importa: la primera coincidencia gana (anthropic-api antes que anthropic).
export const MAIL_VENDORS: readonly MailVendor[] = [
  { key: "aws", account: CLF, senders: ["payment@aws.com"] },
  { key: "cloudflare", account: CLF, senders: ["cloudflare.com"] },
  { key: "anthropic-api", account: DNX, senders: [ANTHROPIC], subjectHint: ANTHROPIC_API_HINT },
  { key: "anthropic", account: DNX, senders: [ANTHROPIC] },
  { key: "resend", account: DNX, senders: ["invoice+statements@invoicing.resend.com"] },
  { key: "chatgpt", account: DNX, senders: ["openai.com"] },
  { key: "neon", account: DNX, senders: ["noreply@ar.neon.tech"] },
  { key: "vercel", account: DNX, senders: ["notifications@vercel.com"] },
  { key: "cursor", account: DNX, senders: ["invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com"] },
  // CapCut todavía no cobró: se confirma el remitente con el primer mail.
  { key: "capcut", account: DNX, senders: ["capcut.com"] },
  { key: "elevenlabs", account: CUART, senders: ["invoice+statements+acct_1M07hSLmdOdiMXBs@stripe.com"] },
];

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/** "Neon, LLC <noreply@ar.neon.tech>" → "noreply@ar.neon.tech" */
function bareAddress(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return norm(m ? m[1] : from);
}

function senderMatches(address: string, sender: string): boolean {
  const s = norm(sender);
  if (s.includes("@")) return address === s;
  const domain = address.split("@")[1] ?? "";
  return domain === s || domain.endsWith(`.${s}`);
}

export function isAllowedAccount(email: string): boolean {
  return MAIL_ACCOUNTS.includes(norm(email));
}

export function matchVendorKey(account: string, fromAddress: string, subject: string): string | null {
  const acc = norm(account);
  const address = bareAddress(fromAddress);
  for (const v of MAIL_VENDORS) {
    if (v.account !== acc) continue;
    if (!v.senders.some((s) => senderMatches(address, s))) continue;
    if (v.subjectHint && !v.subjectHint.test(subject)) continue;
    return v.key;
  }
  return null;
}

/** Búsqueda de Gmail para una cuenta. `after` null = todo el historial. "" = nada que buscar. */
export function gmailQueryFor(account: string, after: Date | null): string {
  const acc = norm(account);
  const senders = [...new Set(MAIL_VENDORS.filter((v) => v.account === acc).flatMap((v) => v.senders))];
  if (senders.length === 0) return "";
  const from = `from:(${senders.join(" OR ")})`;
  return after ? `${from} after:${Math.floor(after.getTime() / 1000)}` : from;
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: PASS, todas las pruebas de `vendors.test.ts` en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx/mail/vendors.ts apps/compramelafoto/lib/finance-dnx/mail/vendors.test.ts apps/compramelafoto/package.json
git commit -m "Registrar en qué cuenta y desde qué remitente llega cada proveedor"
```

---

### Task 3: Cifrado del token

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/mail/token-vault.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/mail/token-vault.test.ts`
- Modify: `apps/compramelafoto/package.json` (sumar el test)

**Interfaces:**
- Produces:
  - `sealRefreshToken(token: string, keyBase64: string): string` → JSON `{ciphertext, nonce, authTag}`
  - `openRefreshToken(sealed: string, keyBase64: string): string` (tira si la clave no corresponde)
  - `vaultKeyFromEnv(env?: Record<string, string | undefined>): string` (tira con mensaje claro si falta)

- [ ] **Step 1: Escribir las pruebas**

```ts
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { openRefreshToken, sealRefreshToken, vaultKeyFromEnv } from "./token-vault";

const KEY = randomBytes(32).toString("base64");

test("lo que se cifra se puede descifrar con la misma clave", () => {
  const sealed = sealRefreshToken("1//token-de-prueba", KEY);
  assert.equal(openRefreshToken(sealed, KEY), "1//token-de-prueba");
});

test("el token no queda legible en lo guardado", () => {
  assert.equal(sealRefreshToken("1//token-de-prueba", KEY).includes("token-de-prueba"), false);
});

test("con otra clave no se puede abrir", () => {
  const sealed = sealRefreshToken("1//token-de-prueba", KEY);
  assert.throws(() => openRefreshToken(sealed, randomBytes(32).toString("base64")));
});

test("sin la variable de entorno avisa cuál falta", () => {
  assert.throws(() => vaultKeyFromEnv({}), /FINANCE_MAIL_VAULT_KEY/);
  assert.equal(vaultKeyFromEnv({ FINANCE_MAIL_VAULT_KEY: KEY }), KEY);
});
```

- [ ] **Step 2: Sumar al script y correr**

Agregar ` lib/finance-dnx/mail/token-vault.test.ts` a `test:finance-dnx`.
Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: FAIL, `Cannot find module './token-vault'`.

- [ ] **Step 3: Implementar**

```ts
import { decodeMasterKey, decryptUtf8, encryptUtf8 } from "@repo/payments/credential-vault";

export function vaultKeyFromEnv(env: Record<string, string | undefined> = process.env): string {
  const key = env.FINANCE_MAIL_VAULT_KEY?.trim();
  if (!key) throw new Error("Falta la variable FINANCE_MAIL_VAULT_KEY (32 bytes en base64).");
  return key;
}

export function sealRefreshToken(token: string, keyBase64: string): string {
  return JSON.stringify(encryptUtf8(token, decodeMasterKey(keyBase64)));
}

export function openRefreshToken(sealed: string, keyBase64: string): string {
  const parts = JSON.parse(sealed) as { ciphertext: string; nonce: string; authTag: string };
  return decryptUtf8(parts, decodeMasterKey(keyBase64));
}
```

Si `@repo/payments/credential-vault` no exporta esas tres funciones desde su `index.ts`, revisar `packages/payments/src/credential-vault/index.ts` y agregarlas al export (`export { decodeMasterKey, encryptUtf8, decryptUtf8 } from "./aes-gcm.js";`).

- [ ] **Step 4: Correr las pruebas**

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx/mail/token-vault.ts apps/compramelafoto/lib/finance-dnx/mail/token-vault.test.ts apps/compramelafoto/package.json
git commit -m "Guardar cifrado el permiso de lectura de Gmail"
```

---

### Task 4: OAuth de Google

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/mail/google-oauth.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/mail/google-oauth.test.ts`
- Modify: `apps/compramelafoto/package.json`

**Interfaces:**
- Consumes: `isAllowedAccount` (Task 2).
- Produces:
  - `GMAIL_SCOPES: string`
  - `signState(nowMs: number, secret: string): string` / `verifyState(state: string, nowMs: number, secret: string): boolean` (vence a los 10 minutos)
  - `buildConsentUrl(p: { clientId: string; redirectUri: string; state: string }): string`
  - `exchangeCode(p: { code, clientId, clientSecret, redirectUri, fetchImpl? }): Promise<{ refreshToken: string; email: string }>` — tira `OAuthError` si no hay refresh token, si la cuenta no está permitida o si Google responde error.
  - `refreshAccessToken(p: { refreshToken, clientId, clientSecret, fetchImpl? }): Promise<string>` — tira `OAuthError` con `revoked = true` ante `invalid_grant`.
  - `class OAuthError extends Error { revoked: boolean }`

El email sale del `id_token` que devuelve Google (se pide `openid email`). Se decodifica el payload sin verificar firma: viene directo de Google por TLS en el canje del código, no del navegador.

- [ ] **Step 1: Escribir las pruebas**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  GMAIL_SCOPES,
  OAuthError,
  buildConsentUrl,
  exchangeCode,
  refreshAccessToken,
  signState,
  verifyState,
} from "./google-oauth";

const SECRET = "secreto-de-prueba";
const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

function idToken(email: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64({ email, email_verified: true })}.firma`;
}

function fakeFetch(status: number, body: object): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

test("el state firmado vale durante 10 minutos y después no", () => {
  const s = signState(T0, SECRET);
  assert.equal(verifyState(s, T0 + 9 * 60_000, SECRET), true);
  assert.equal(verifyState(s, T0 + 11 * 60_000, SECRET), false);
});

test("un state alterado o con otro secreto no vale", () => {
  const s = signState(T0, SECRET);
  assert.equal(verifyState(s.replace(/.$/, s.endsWith("a") ? "b" : "a"), T0, SECRET), false);
  assert.equal(verifyState(s, T0, "otro"), false);
  assert.equal(verifyState("basura", T0, SECRET), false);
});

test("la URL pide sólo lectura, acceso offline y consentimiento", () => {
  const url = new URL(buildConsentUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "st" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("scope"), GMAIL_SCOPES);
  assert.equal(GMAIL_SCOPES.includes("gmail.readonly"), true);
  assert.equal(GMAIL_SCOPES.includes("gmail.modify"), false);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "st");
});

test("el canje devuelve token y email de una cuenta permitida", async () => {
  const r = await exchangeCode({
    code: "c", clientId: "cid", clientSecret: "cs", redirectUri: "https://x/cb",
    fetchImpl: fakeFetch(200, { refresh_token: "1//rt", id_token: idToken("DNXfotografia@gmail.com") }),
  });
  assert.deepEqual(r, { refreshToken: "1//rt", email: "dnxfotografia@gmail.com" });
});

test("una cuenta que no es de las tres se rechaza", async () => {
  await assert.rejects(
    exchangeCode({
      code: "c", clientId: "cid", clientSecret: "cs", redirectUri: "https://x/cb",
      fetchImpl: fakeFetch(200, { refresh_token: "1//rt", id_token: idToken("intruso@gmail.com") }),
    }),
    (e: unknown) => e instanceof OAuthError && /intruso@gmail.com/.test(e.message),
  );
});

test("sin refresh token se rechaza con un mensaje que explica qué hacer", async () => {
  await assert.rejects(
    exchangeCode({
      code: "c", clientId: "cid", clientSecret: "cs", redirectUri: "https://x/cb",
      fetchImpl: fakeFetch(200, { id_token: idToken("dnxfotografia@gmail.com") }),
    }),
    /permiso/i,
  );
});

test("un permiso revocado se marca como revocado", async () => {
  await assert.rejects(
    refreshAccessToken({
      refreshToken: "1//rt", clientId: "cid", clientSecret: "cs",
      fetchImpl: fakeFetch(400, { error: "invalid_grant" }),
    }),
    (e: unknown) => e instanceof OAuthError && e.revoked === true,
  );
});

test("la renovación devuelve el access token", async () => {
  const t = await refreshAccessToken({
    refreshToken: "1//rt", clientId: "cid", clientSecret: "cs",
    fetchImpl: fakeFetch(200, { access_token: "ya29.x", expires_in: 3599 }),
  });
  assert.equal(t, "ya29.x");
});
```

- [ ] **Step 2: Sumar al script y correr**

Agregar ` lib/finance-dnx/mail/google-oauth.test.ts`. Run: `pnpm --filter compramelafoto test:finance-dnx` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { isAllowedAccount } from "./vendors";

export const GMAIL_SCOPES = "openid email https://www.googleapis.com/auth/gmail.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 10_000;

export class OAuthError extends Error {
  constructor(message: string, readonly revoked = false) {
    super(message);
    this.name = "OAuthError";
  }
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `<emitidoMs>.<nonce>.<firma>`: evita que alguien cuelgue su cuenta de Google en la nuestra. */
export function signState(nowMs: number, secret: string): string {
  const payload = `${nowMs}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifyState(state: string, nowMs: number, secret: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [issued, nonce, sig] = parts;
  const expected = hmac(`${issued}.${nonce}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const age = nowMs - Number(issued);
  return Number.isFinite(age) && age >= 0 && age <= STATE_TTL_MS;
}

export function buildConsentUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", p.clientId);
  url.searchParams.set("redirect_uri", p.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", p.state);
  return url.toString();
}

async function postToken(body: Record<string, string>, fetchImpl: typeof fetch) {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown };
    return typeof data.email === "string" ? data.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(p: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{ refreshToken: string; email: string }> {
  const { ok, json } = await postToken(
    {
      code: p.code,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
      grant_type: "authorization_code",
    },
    p.fetchImpl ?? fetch,
  );
  if (!ok) throw new OAuthError(`Google rechazó la conexión (${String(json.error ?? "error desconocido")}).`);
  const email = emailFromIdToken(json.id_token);
  if (!email) throw new OAuthError("Google no informó qué cuenta se conectó.");
  if (!isAllowedAccount(email)) {
    throw new OAuthError(`La cuenta ${email} no es una de las cuentas de facturación de DNX.`);
  }
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : "";
  if (!refreshToken) {
    throw new OAuthError(
      "Google no dio el permiso permanente. Quitá el acceso de la app en tu cuenta de Google y volvé a conectar.",
    );
  }
  return { refreshToken, email };
}

export async function refreshAccessToken(p: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const { ok, json } = await postToken(
    {
      refresh_token: p.refreshToken,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      grant_type: "refresh_token",
    },
    p.fetchImpl ?? fetch,
  );
  if (!ok) {
    const code = String(json.error ?? "error desconocido");
    throw new OAuthError(
      code === "invalid_grant"
        ? "Google revocó el permiso de lectura. Hay que volver a conectar la cuenta."
        : `Google no renovó el acceso (${code}).`,
      code === "invalid_grant",
    );
  }
  const token = typeof json.access_token === "string" ? json.access_token : "";
  if (!token) throw new OAuthError("Google no devolvió un acceso válido.");
  return token;
}
```

- [ ] **Step 4: Correr las pruebas**

Run: `pnpm --filter compramelafoto test:finance-dnx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx/mail/google-oauth.ts apps/compramelafoto/lib/finance-dnx/mail/google-oauth.test.ts apps/compramelafoto/package.json
git commit -m "Conectar una cuenta de Gmail en sólo lectura con state firmado"
```

---

### Task 5: Cliente de Gmail

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/mail/gmail.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/mail/gmail.test.ts`
- Modify: `apps/compramelafoto/package.json`

**Interfaces:**
- Produces:
  - `type GmailMessage = { id: string; from: string; subject: string; receivedAt: Date; bodyText: string }`
  - `listMessageIds(p: { accessToken: string; query: string; pageToken?: string; fetchImpl?: typeof fetch }): Promise<{ ids: string[]; nextPageToken: string | null }>`
  - `getMessage(p: { accessToken: string; id: string; fetchImpl?: typeof fetch }): Promise<GmailMessage>`
  - `htmlToText(html: string): string`
  - `class GmailError extends Error { status: number }`
  - `const BODY_MAX_CHARS = 60_000`

- [ ] **Step 1: Escribir las pruebas**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { BODY_MAX_CHARS, GmailError, getMessage, htmlToText, listMessageIds } from "./gmail";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

function capture(status: number, body: object) {
  const calls: string[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    calls.push(String(url));
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer tok");
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

test("listar manda la búsqueda y devuelve ids y página siguiente", async () => {
  const f = capture(200, { messages: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" });
  const r = await listMessageIds({ accessToken: "tok", query: "from:(payment@aws.com)", fetchImpl: f.impl });
  assert.deepEqual(r, { ids: ["a", "b"], nextPageToken: "p2" });
  const url = new URL(f.calls[0]);
  assert.equal(url.searchParams.get("q"), "from:(payment@aws.com)");
  assert.equal(url.searchParams.get("maxResults"), "100");
});

test("sin resultados devuelve lista vacía", async () => {
  const f = capture(200, { resultSizeEstimate: 0 });
  assert.deepEqual(await listMessageIds({ accessToken: "tok", query: "q", fetchImpl: f.impl }), { ids: [], nextPageToken: null });
});

test("prefiere la parte de texto plano y lee encabezados", async () => {
  const f = capture(200, {
    id: "m1",
    internalDate: String(Date.UTC(2026, 9, 17, 23, 22)),
    payload: {
      headers: [
        { name: "From", value: "payment@aws.com" },
        { name: "Subject", value: "Gracias por el pago" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: b64("<p>HTML</p>") } },
        { mimeType: "text/plain", body: { data: b64("Hemos cobrado 106.72 USD") } },
      ],
    },
  });
  const m = await getMessage({ accessToken: "tok", id: "m1", fetchImpl: f.impl });
  assert.equal(m.from, "payment@aws.com");
  assert.equal(m.subject, "Gracias por el pago");
  assert.equal(m.bodyText, "Hemos cobrado 106.72 USD");
  assert.equal(m.receivedAt.toISOString(), "2026-10-17T23:22:00.000Z");
});

test("si sólo hay HTML (anidado), lo pasa a texto", async () => {
  const f = capture(200, {
    id: "m2",
    internalDate: "0",
    payload: {
      headers: [],
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/html", body: { data: b64("<div>Total:&nbsp;<b>$20.00</b></div><style>x{}</style>") } }],
        },
        { mimeType: "application/pdf", filename: "Receipt.pdf", body: { attachmentId: "att" } },
      ],
    },
  });
  const m = await getMessage({ accessToken: "tok", id: "m2", fetchImpl: f.impl });
  assert.equal(m.bodyText, "Total: $20.00");
  assert.equal(m.subject, "");
});

test("htmlToText saca scripts, estilos y entidades, y respeta saltos de bloque", () => {
  assert.equal(
    htmlToText("<script>alert(1)</script><p>Hola&amp;chau</p><p>Línea&#58; 2</p>"),
    "Hola&chau\nLínea: 2",
  );
});

test("un cuerpo enorme se recorta", async () => {
  const f = capture(200, {
    id: "m3", internalDate: "0",
    payload: { headers: [], mimeType: "text/plain", body: { data: b64("x".repeat(BODY_MAX_CHARS + 50)) } },
  });
  const m = await getMessage({ accessToken: "tok", id: "m3", fetchImpl: f.impl });
  assert.equal(m.bodyText.length, BODY_MAX_CHARS);
});

test("un error de Gmail tira GmailError con el código", async () => {
  const f = capture(401, { error: { message: "Invalid Credentials" } });
  await assert.rejects(
    listMessageIds({ accessToken: "tok", query: "q", fetchImpl: f.impl }),
    (e: unknown) => e instanceof GmailError && e.status === 401,
  );
});
```

- [ ] **Step 2: Sumar al script y correr** → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
const API = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const TIMEOUT_MS = 15_000;
export const BODY_MAX_CHARS = 60_000;

export type GmailMessage = { id: string; from: string; subject: string; receivedAt: Date; bodyText: string };

export class GmailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GmailError";
  }
}

type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: Part[];
};

async function getJson(url: string, accessToken: string, fetchImpl: typeof fetch): Promise<any> {
  const res = await fetchImpl(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GmailError(`Gmail respondió ${res.status}: ${json?.error?.message ?? "sin detalle"}`, res.status);
  return json;
}

export async function listMessageIds(p: {
  accessToken: string;
  query: string;
  pageToken?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ids: string[]; nextPageToken: string | null }> {
  const url = new URL(API);
  url.searchParams.set("q", p.query);
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("includeSpamTrash", "false");
  if (p.pageToken) url.searchParams.set("pageToken", p.pageToken);
  const json = await getJson(url.toString(), p.accessToken, p.fetchImpl ?? fetch);
  const ids = Array.isArray(json.messages) ? json.messages.map((m: { id: string }) => m.id) : [];
  return { ids, nextPageToken: typeof json.nextPageToken === "string" ? json.nextPageToken : null };
}

function decode(data: string | undefined): string {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function findPart(part: Part, mimeType: string): Part | null {
  if (part.mimeType === mimeType && !part.filename && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mimeType);
    if (hit) return hit;
  }
  return null;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export async function getMessage(p: { accessToken: string; id: string; fetchImpl?: typeof fetch }): Promise<GmailMessage> {
  const json = await getJson(`${API}/${encodeURIComponent(p.id)}?format=full`, p.accessToken, p.fetchImpl ?? fetch);
  const payload: Part = json.payload ?? {};
  const header = (name: string) =>
    payload.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const plain = findPart(payload, "text/plain");
  const html = plain ? null : findPart(payload, "text/html");
  const text = plain ? decode(plain.body?.data).trim() : html ? htmlToText(decode(html.body?.data)) : "";
  return {
    id: String(json.id),
    from: header("From"),
    subject: header("Subject"),
    receivedAt: new Date(Number(json.internalDate ?? 0)),
    bodyText: text.slice(0, BODY_MAX_CHARS),
  };
}
```

- [ ] **Step 4: Correr las pruebas** → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx/mail/gmail.ts apps/compramelafoto/lib/finance-dnx/mail/gmail.test.ts apps/compramelafoto/package.json
git commit -m "Buscar y bajar mails de proveedores desde la API de Gmail"
```

---

### Task 6: Sincronización de una cuenta

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/mail/sync.ts`
- Test: `apps/compramelafoto/lib/finance-dnx/mail/sync.test.ts`
- Modify: `apps/compramelafoto/package.json`

**Interfaces:**
- Consumes: `gmailQueryFor`, `matchVendorKey` (Task 2); `GmailMessage` (Task 5); `OAuthError` (Task 4).
- Produces:

```ts
export type SyncAccount = { id: number; email: string; lastSyncAt: Date | null; backfillDone: boolean; lastErrorAlertedAt: Date | null };
export type NewMailMessage = { accountId: number; gmailMessageId: string; fromAddress: string; subject: string; receivedAt: Date; bodyText: string; vendorKey: string | null; reviewReason: string };
export type SyncPorts = {
  getAccessToken(account: SyncAccount): Promise<string>;
  listIds(accessToken: string, query: string, pageToken?: string): Promise<{ ids: string[]; nextPageToken: string | null }>;
  getMessage(accessToken: string, id: string): Promise<GmailMessage>;
  knownIds(ids: string[]): Promise<Set<string>>;
  saveMessage(msg: NewMailMessage): Promise<void>;
  markSynced(accountId: number, at: Date, backfillDone: boolean): Promise<void>;
  markError(accountId: number, message: string, alertedAt: Date | null): Promise<void>;
  notify(text: string): Promise<void>;
};
export type SyncResult = { email: string; saved: number; pending: boolean; error: string | null };
export function syncAccount(account: SyncAccount, ports: SyncPorts, opts: { now: Date; deadlineMs: number; maxMessages?: number }): Promise<SyncResult>;
export const LOOKBACK_DAYS = 3;
```

Reglas:
- Búsqueda: `gmailQueryFor(email, backfillDone && lastSyncAt ? lastSyncAt − 3 días : null)`. Query vacía → `{ saved: 0, pending: false, error: null }` y `markSynced`.
- Recorre páginas; de cada página descarta los ids ya conocidos (`knownIds`) y baja los nuevos de a uno hasta `maxMessages` (por defecto 150) o hasta que `Date.now() > deadlineMs`.
- Cada mensaje nuevo se guarda con `vendorKey = matchVendorKey(email, from, subject)` y `reviewReason` = `"Todavía no hay lector para este proveedor."` si hay proveedor, o `"El remitente no corresponde a ningún proveedor."` si no.
- Si se cortó por tope o tiempo → `pending: true`, `markSynced(id, now, false)` sólo si `!backfillDone` (y conserva `backfillDone` como estaba); si terminó → `markSynced(id, now, true)`.
- Cualquier error → `markError`. Telegram sólo si `account.lastErrorAlertedAt` es `null` (primer error desde la última sincronización buena); entonces `alertedAt = now`. `markSynced` deja `lastError`/`lastErrorAlertedAt` en `null` (eso lo hace el puerto Prisma, Task 7).

- [ ] **Step 1: Escribir las pruebas**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { OAuthError } from "./google-oauth";
import type { GmailMessage } from "./gmail";
import { LOOKBACK_DAYS, syncAccount, type NewMailMessage, type SyncAccount, type SyncPorts } from "./sync";

const NOW = new Date("2026-10-18T09:00:00Z");
const FAR = Date.now() + 60_000;

const CUENTA: SyncAccount = {
  id: 1, email: "compramelafoto@gmail.com", lastSyncAt: null, backfillDone: false, lastErrorAlertedAt: null,
};

function mensaje(id: string, from = "payment@aws.com"): GmailMessage {
  return { id, from, subject: "Gracias por el pago", receivedAt: NOW, bodyText: `cuerpo ${id}` };
}

function fakes(pages: string[][], known: string[] = [], opts: { failToken?: Error } = {}) {
  const saved: NewMailMessage[] = [];
  const queries: string[] = [];
  const synced: { at: Date; backfillDone: boolean }[] = [];
  const errors: { message: string; alertedAt: Date | null }[] = [];
  const notified: string[] = [];
  const store = new Set(known);
  const ports: SyncPorts = {
    async getAccessToken() {
      if (opts.failToken) throw opts.failToken;
      return "tok";
    },
    async listIds(_t, query, pageToken) {
      queries.push(query);
      const i = pageToken ? Number(pageToken) : 0;
      return { ids: pages[i] ?? [], nextPageToken: i + 1 < pages.length ? String(i + 1) : null };
    },
    async getMessage(_t, id) {
      return id.startsWith("raro") ? mensaje(id, "alguien@otro.com") : mensaje(id);
    },
    async knownIds(ids) {
      return new Set(ids.filter((id) => store.has(id)));
    },
    async saveMessage(msg) {
      store.add(msg.gmailMessageId);
      saved.push(msg);
    },
    async markSynced(_id, at, backfillDone) {
      synced.push({ at, backfillDone });
    },
    async markError(_id, message, alertedAt) {
      errors.push({ message, alertedAt });
    },
    async notify(text) {
      notified.push(text);
    },
  };
  return { ports, saved, queries, synced, errors, notified };
}

test("la primera vez busca sin fecha, guarda todo y marca el historial como leído", async () => {
  const f = fakes([["a", "b"], ["c"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.deepEqual(r, { email: CUENTA.email, saved: 3, pending: false, error: null });
  assert.equal(f.queries[0].includes("after:"), false);
  assert.deepEqual(f.synced, [{ at: NOW, backfillDone: true }]);
  assert.equal(f.saved[0].vendorKey, "aws");
  assert.match(f.saved[0].reviewReason, /lector/);
});

test("un mail ya guardado no se vuelve a guardar", async () => {
  const f = fakes([["a", "b", "c"]], ["b"]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(r.saved, 2);
  assert.deepEqual(f.saved.map((m) => m.gmailMessageId), ["a", "c"]);
});

test("un remitente desconocido se guarda sin proveedor y con el motivo", async () => {
  const f = fakes([["raro1"]]);
  await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(f.saved[0].vendorKey, null);
  assert.match(f.saved[0].reviewReason, /ningún proveedor/);
});

test("con el historial leído, busca desde la última lectura menos 3 días", async () => {
  const last = new Date("2026-10-17T09:00:00Z");
  const f = fakes([[]]);
  await syncAccount({ ...CUENTA, lastSyncAt: last, backfillDone: true }, f.ports, { now: NOW, deadlineMs: FAR });
  const desde = Math.floor((last.getTime() - LOOKBACK_DAYS * 86_400_000) / 1000);
  assert.equal(f.queries[0].endsWith(`after:${desde}`), true);
});

test("si se corta por tope, queda pendiente y el historial no se marca como leído", async () => {
  const f = fakes([["a", "b", "c", "d"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  assert.equal(r.saved, 2);
  assert.equal(r.pending, true);
  assert.deepEqual(f.synced, [{ at: NOW, backfillDone: false }]);
});

test("si se acaba el tiempo, corta sin guardar más", async () => {
  const f = fakes([["a", "b"]]);
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: Date.now() - 1 });
  assert.equal(r.saved, 0);
  assert.equal(r.pending, true);
});

test("la siguiente ejecución sigue donde quedó", async () => {
  const f = fakes([["a", "b", "c", "d"]]);
  await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  assert.equal(r.saved, 2);
  const r3 = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR, maxMessages: 2 });
  assert.deepEqual([r3.saved, r3.pending], [0, false]);
  assert.deepEqual(f.saved.map((m) => m.gmailMessageId), ["a", "b", "c", "d"]);
});

test("un permiso revocado se registra y avisa por Telegram una vez", async () => {
  const err = new OAuthError("Google revocó el permiso de lectura.", true);
  const f = fakes([[]], [], { failToken: err });
  const r = await syncAccount(CUENTA, f.ports, { now: NOW, deadlineMs: FAR });
  assert.match(r.error ?? "", /revocó/);
  assert.deepEqual(f.errors, [{ message: err.message, alertedAt: NOW }]);
  assert.equal(f.notified.length, 1);
  assert.match(f.notified[0], /compramelafoto@gmail.com/);
});

test("si ya se avisó ese error, no se vuelve a avisar", async () => {
  const f = fakes([[]], [], { failToken: new OAuthError("revocado", true) });
  const yaAvisado = new Date("2026-10-17T09:00:00Z");
  await syncAccount({ ...CUENTA, lastErrorAlertedAt: yaAvisado }, f.ports, { now: NOW, deadlineMs: FAR });
  assert.equal(f.notified.length, 0);
  assert.deepEqual(f.errors, [{ message: "revocado", alertedAt: yaAvisado }]);
});
```

- [ ] **Step 2: Sumar al script y correr** → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

```ts
import type { GmailMessage } from "./gmail";
import { gmailQueryFor, matchVendorKey } from "./vendors";

export const LOOKBACK_DAYS = 3;
const DEFAULT_MAX_MESSAGES = 150;
const DAY_MS = 86_400_000;

export type SyncAccount = {
  id: number;
  email: string;
  lastSyncAt: Date | null;
  backfillDone: boolean;
  lastErrorAlertedAt: Date | null;
};

export type NewMailMessage = {
  accountId: number;
  gmailMessageId: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  bodyText: string;
  vendorKey: string | null;
  reviewReason: string;
};

export type SyncPorts = {
  getAccessToken(account: SyncAccount): Promise<string>;
  listIds(accessToken: string, query: string, pageToken?: string): Promise<{ ids: string[]; nextPageToken: string | null }>;
  getMessage(accessToken: string, id: string): Promise<GmailMessage>;
  knownIds(ids: string[]): Promise<Set<string>>;
  saveMessage(msg: NewMailMessage): Promise<void>;
  markSynced(accountId: number, at: Date, backfillDone: boolean): Promise<void>;
  markError(accountId: number, message: string, alertedAt: Date | null): Promise<void>;
  notify(text: string): Promise<void>;
};

export type SyncResult = { email: string; saved: number; pending: boolean; error: string | null };

const SIN_LECTOR = "Todavía no hay lector para este proveedor.";
const SIN_PROVEEDOR = "El remitente no corresponde a ningún proveedor.";

export async function syncAccount(
  account: SyncAccount,
  ports: SyncPorts,
  opts: { now: Date; deadlineMs: number; maxMessages?: number },
): Promise<SyncResult> {
  const max = opts.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const after =
    account.backfillDone && account.lastSyncAt
      ? new Date(account.lastSyncAt.getTime() - LOOKBACK_DAYS * DAY_MS)
      : null;
  const query = gmailQueryFor(account.email, after);
  let saved = 0;
  try {
    if (!query) {
      await ports.markSynced(account.id, opts.now, true);
      return { email: account.email, saved, pending: false, error: null };
    }
    const token = await ports.getAccessToken(account);
    let pageToken: string | undefined;
    let pending = false;
    pages: do {
      const page = await ports.listIds(token, query, pageToken);
      const known = await ports.knownIds(page.ids);
      for (const id of page.ids) {
        if (known.has(id)) continue;
        if (saved >= max || Date.now() > opts.deadlineMs) {
          pending = true;
          break pages;
        }
        const m = await ports.getMessage(token, id);
        const vendorKey = matchVendorKey(account.email, m.from, m.subject);
        await ports.saveMessage({
          accountId: account.id,
          gmailMessageId: m.id,
          fromAddress: m.from,
          subject: m.subject,
          receivedAt: m.receivedAt,
          bodyText: m.bodyText,
          vendorKey,
          reviewReason: vendorKey ? SIN_LECTOR : SIN_PROVEEDOR,
        });
        saved++;
      }
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
    await ports.markSynced(account.id, opts.now, pending ? account.backfillDone : true);
    return { email: account.email, saved, pending, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const firstAlert = account.lastErrorAlertedAt === null;
    await ports.markError(account.id, message, firstAlert ? opts.now : account.lastErrorAlertedAt);
    if (firstAlert) {
      await ports.notify(`Finanzas DNX: no se pudo leer ${account.email}. ${message}`);
    }
    return { email: account.email, saved, pending: true, error: message };
  }
}
```

- [ ] **Step 4: Correr las pruebas** → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx/mail/sync.ts apps/compramelafoto/lib/finance-dnx/mail/sync.test.ts apps/compramelafoto/package.json
git commit -m "Sincronizar una cuenta de Gmail sin duplicar y en tandas"
```

---

### Task 7: Puertos reales y rutas

**Files:**
- Create: `apps/compramelafoto/lib/finance-dnx/mail/prisma-ports.ts`
- Create: `apps/compramelafoto/lib/finance-dnx/mail/run-sync.ts`
- Create: las rutas de `connect`, `callback`, `accounts`, `accounts/[id]`, `sync`, `messages`, `messages/[id]` y `app/api/cron/finance-dnx-mail/route.ts`
- Modify: `apps/compramelafoto/vercel.json`

**Interfaces:**
- Consumes: todo lo anterior; `prisma` de `@/lib/prisma`; `requireAuth`, `Role`; `assertCronAuth`; `sendTelegramMessage` de `@repo/dnx-bot`; `readBotConfig` de `@/lib/bot/config`.
- Produces:
  - `runMailSync(opts: { budgetMs: number }): Promise<SyncResult[]>`
  - `googleClient(): { clientId: string; clientSecret: string }` (tira si faltan las variables)
  - `mailRedirectUri(req: Request): string` = `${origin}/api/admin/finance-dnx/mail/callback`
  - Rutas JSON: `GET accounts` → `{ accounts: { id, email, connectedAt, lastSyncAt, lastError, backfillDone, pendingReview }[] }`; `GET messages` → `{ messages: { id, account, fromAddress, subject, receivedAt, vendorKey, reviewReason, gmailUrl }[] }` (sólo `PARA_REVISAR`, más nuevos primero, hasta 200); `PATCH messages/[id]` con `{ status: "DESCARTADO" }`.

Estas piezas son pegamento sin lógica propia: se prueban de punta a punta en Task 9. La lógica que pueden romper ya está cubierta en Tasks 2 a 6.

- [ ] **Step 1: `prisma-ports.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";

import { getMessage, listMessageIds } from "./gmail";
import { refreshAccessToken } from "./google-oauth";
import type { SyncPorts } from "./sync";
import { openRefreshToken, vaultKeyFromEnv } from "./token-vault";

export function googleClient(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET.");
  return { clientId, clientSecret };
}

export function prismaSyncPorts(): SyncPorts {
  const { clientId, clientSecret } = googleClient();
  const key = vaultKeyFromEnv();
  return {
    async getAccessToken(account) {
      const row = await prisma.expenseMailAccount.findUniqueOrThrow({ where: { id: account.id } });
      return refreshAccessToken({ refreshToken: openRefreshToken(row.refreshTokenEnc, key), clientId, clientSecret });
    },
    listIds: (accessToken, query, pageToken) => listMessageIds({ accessToken, query, pageToken }),
    getMessage: (accessToken, id) => getMessage({ accessToken, id }),
    async knownIds(ids) {
      if (ids.length === 0) return new Set();
      const rows = await prisma.expenseMailMessage.findMany({
        where: { gmailMessageId: { in: ids } },
        select: { gmailMessageId: true },
      });
      return new Set(rows.map((r) => r.gmailMessageId));
    },
    async saveMessage(msg) {
      // upsert vacío: si dos ejecuciones se cruzan, el índice único evita el duplicado sin tirar.
      await prisma.expenseMailMessage.upsert({
        where: { gmailMessageId: msg.gmailMessageId },
        create: { ...msg, status: "PARA_REVISAR" },
        update: {},
      });
    },
    async markSynced(accountId, at, backfillDone) {
      await prisma.expenseMailAccount.update({
        where: { id: accountId },
        data: { lastSyncAt: at, backfillDone, lastError: null, lastErrorAlertedAt: null },
      });
    },
    async markError(accountId, message, alertedAt) {
      await prisma.expenseMailAccount.update({
        where: { id: accountId },
        data: { lastError: message.slice(0, 500), lastErrorAlertedAt: alertedAt },
      });
    },
    async notify(text) {
      await sendTelegramMessage(readBotConfig().telegram, text);
    },
  };
}
```

Verificar la firma real de `sendTelegramMessage` en `packages/dnx-bot/src/telegram.ts` (`(cfg, text)`) y de `readBotConfig` en `apps/compramelafoto/lib/bot/config.ts` antes de escribir; ajustar si difiere.

- [ ] **Step 2: `run-sync.ts`**

```ts
import { prisma } from "@/lib/prisma";

import { prismaSyncPorts } from "./prisma-ports";
import { syncAccount, type SyncResult } from "./sync";

/** Sincroniza todas las cuentas conectadas, en orden, repartiendo el tiempo disponible. */
export async function runMailSync(opts: { budgetMs: number }): Promise<SyncResult[]> {
  const deadlineMs = Date.now() + opts.budgetMs;
  const accounts = await prisma.expenseMailAccount.findMany({ orderBy: { id: "asc" } });
  if (accounts.length === 0) return [];
  const ports = prismaSyncPorts();
  const results: SyncResult[] = [];
  for (const a of accounts) {
    results.push(
      await syncAccount(
        { id: a.id, email: a.email, lastSyncAt: a.lastSyncAt, backfillDone: a.backfillDone, lastErrorAlertedAt: a.lastErrorAlertedAt },
        ports,
        { now: new Date(), deadlineMs },
      ),
    );
  }
  return results;
}
```

- [ ] **Step 3: `connect/route.ts` y `callback/route.ts`**

`app/api/admin/finance-dnx/mail/connect/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { buildConsentUrl, signState } from "@/lib/finance-dnx/mail/google-oauth";
import { googleClient } from "@/lib/finance-dnx/mail/prisma-ports";
import { vaultKeyFromEnv } from "@/lib/finance-dnx/mail/token-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const { clientId } = googleClient();
  const redirectUri = `${req.nextUrl.origin}/api/admin/finance-dnx/mail/callback`;
  const url = buildConsentUrl({ clientId, redirectUri, state: signState(Date.now(), vaultKeyFromEnv()) });
  return NextResponse.redirect(url);
}
```

`app/api/admin/finance-dnx/mail/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OAuthError, exchangeCode, verifyState } from "@/lib/finance-dnx/mail/google-oauth";
import { googleClient } from "@/lib/finance-dnx/mail/prisma-ports";
import { sealRefreshToken, vaultKeyFromEnv } from "@/lib/finance-dnx/mail/token-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function volver(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/finanzas-dnx/gastos", req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return volver(req, { gmail: "cancelado" });
  const key = vaultKeyFromEnv();
  if (!verifyState(sp.get("state") ?? "", Date.now(), key)) return volver(req, { gmail: "vencido" });
  try {
    const { clientId, clientSecret } = googleClient();
    const { refreshToken, email } = await exchangeCode({
      code: sp.get("code") ?? "",
      clientId,
      clientSecret,
      redirectUri: `${req.nextUrl.origin}/api/admin/finance-dnx/mail/callback`,
    });
    const refreshTokenEnc = sealRefreshToken(refreshToken, key);
    await prisma.expenseMailAccount.upsert({
      where: { email },
      create: { email, refreshTokenEnc },
      update: { refreshTokenEnc, connectedAt: new Date(), lastError: null, lastErrorAlertedAt: null },
    });
    return volver(req, { gmail: "conectada", cuenta: email });
  } catch (err) {
    const msg = err instanceof OAuthError ? err.message : "No se pudo conectar la cuenta.";
    console.error("GET /api/admin/finance-dnx/mail/callback ERROR >>>", err);
    return volver(req, { gmail: "error", detalle: msg });
  }
}
```

- [ ] **Step 4: `accounts`, `accounts/[id]`, `sync`, `messages`, `messages/[id]`**

`accounts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const accounts = await prisma.expenseMailAccount.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true, email: true, connectedAt: true, lastSyncAt: true, lastError: true, backfillDone: true,
      _count: { select: { messages: { where: { status: "PARA_REVISAR" } } } },
    },
  });
  return NextResponse.json({
    accounts: accounts.map(({ _count, ...a }) => ({ ...a, pendingReview: _count.messages })),
  });
}
```

`accounts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Desconectar borra el permiso guardado y los mails todavía sin resolver de esa cuenta; lo ya cargado queda. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  await prisma.expenseMailAccount.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
```

> El `onDelete: Cascade` borra también los mensajes de esa cuenta. Como en Tanda 1 ningún mensaje está `CARGADO`, no se pierde nada aplicado. **Tanda 2 debe revisar esto** antes de que existan mensajes cargados.

`sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { runMailSync } from "@/lib/finance-dnx/mail/run-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json({ results: await runMailSync({ budgetMs: 45_000 }) });
  } catch (err: any) {
    console.error("POST /api/admin/finance-dnx/mail/sync ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
```

`messages/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const rows = await prisma.expenseMailMessage.findMany({
    where: { status: "PARA_REVISAR" },
    orderBy: { receivedAt: "desc" },
    take: 200,
    select: {
      id: true, gmailMessageId: true, fromAddress: true, subject: true, receivedAt: true,
      vendorKey: true, reviewReason: true, account: { select: { email: true } },
    },
  });
  return NextResponse.json({
    messages: rows.map(({ account, gmailMessageId, ...m }) => ({
      ...m,
      account: account.email,
      gmailUrl: `https://mail.google.com/mail/?authuser=${encodeURIComponent(account.email)}#all/${gmailMessageId}`,
    })),
  });
}
```

`messages/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
  const id = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (!Number.isInteger(id) || body.status !== "DESCARTADO") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const r = await prisma.expenseMailMessage.updateMany({
    where: { id, status: "PARA_REVISAR" },
    data: { status: "DESCARTADO" },
  });
  if (r.count === 0) return NextResponse.json({ error: "El mail ya no está para revisar." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Cron**

`app/api/cron/finance-dnx-mail/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { runMailSync } from "@/lib/finance-dnx/mail/run-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;
  const results = await runMailSync({ budgetMs: 240_000 });
  return Response.json({ ok: true, results });
}
```

En `apps/compramelafoto/vercel.json`, dentro de `crons`, agregar (09:00 UTC = 06:00 en Argentina):

```json
    {
      "path": "/api/cron/finance-dnx-mail",
      "schedule": "0 9 * * *"
    },
```

Revisar en `vercel.json` si otros crons ya declaran `maxDuration` en `functions`; si el proyecto limita a 60 s, bajar `budgetMs` a 45 000 y `maxDuration` a 60.

- [ ] **Step 6: Correr pruebas y build de tipos de la app**

Run: `pnpm --filter compramelafoto test:finance-dnx`
Expected: PASS.
Run: `pnpm --filter compramelafoto exec tsc --noEmit -p tsconfig.json 2>&1 | grep -E "finance-dnx/mail|api/admin/finance-dnx/mail|cron/finance-dnx-mail" ; echo "exit=$?"`
Expected: sin líneas de error en los archivos nuevos (`exit=1` del grep). Si `tsc` muere por memoria, decirlo y confiar en el chequeo de tipos de CI.

- [ ] **Step 7: Commit**

```bash
git add apps/compramelafoto/lib/finance-dnx/mail apps/compramelafoto/app/api/admin/finance-dnx/mail apps/compramelafoto/app/api/cron/finance-dnx-mail apps/compramelafoto/vercel.json
git commit -m "Exponer conexión, lectura diaria y bandeja de mails de proveedores"
```

---

### Task 8: Pantalla — Conexiones y Para revisar

**Files:**
- Create: `apps/compramelafoto/app/admin/finanzas-dnx/gastos/MailConnections.tsx`
- Create: `apps/compramelafoto/app/admin/finanzas-dnx/gastos/MailReviewInbox.tsx`
- Modify: `apps/compramelafoto/app/admin/finanzas-dnx/gastos/page.tsx` (montar al final del `<div className="space-y-6">` principal)

**Interfaces:**
- Consumes: rutas de Task 7.
- Produces: `<MailConnections onSynced={() => void} />`, `<MailReviewInbox refreshKey={number} />`.

- [ ] **Step 1: `MailConnections.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Cuenta = {
  id: number;
  email: string;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  backfillDone: boolean;
  pendingReview: number;
};

const AVISOS: Record<string, string> = {
  conectada: "Cuenta conectada. Ya podés leer los mails.",
  cancelado: "Se canceló la conexión con Google.",
  vencido: "La conexión tardó demasiado. Probá de nuevo.",
};

function fechaAR(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });
}

export default function MailConnections({ onSynced }: { onSynced: () => void }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/admin/finance-dnx/mail/accounts", { cache: "no-store" });
    if (res.ok) setCuentas((await res.json()).accounts);
  }, []);

  useEffect(() => {
    void cargar();
    const sp = new URLSearchParams(window.location.search);
    const estado = sp.get("gmail");
    if (estado) {
      setMensaje(estado === "error" ? sp.get("detalle") ?? "No se pudo conectar la cuenta." : AVISOS[estado] ?? null);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [cargar]);

  async function leerAhora() {
    setLeyendo(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/finance-dnx/mail/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMensaje(json.error ?? "No se pudieron leer los mails.");
      } else {
        const total = (json.results as { saved: number }[]).reduce((s, r) => s + r.saved, 0);
        const quedan = (json.results as { pending: boolean }[]).some((r) => r.pending);
        setMensaje(`Se leyeron ${total} mails nuevos.${quedan ? " Quedan más: volvé a tocar \"Leer ahora\"." : ""}`);
      }
    } finally {
      setLeyendo(false);
      await cargar();
      onSynced();
    }
  }

  async function desconectar(c: Cuenta) {
    if (!confirm(`¿Desconectar ${c.email}? Los gastos ya cargados se mantienen.`)) return;
    await fetch(`/api/admin/finance-dnx/mail/accounts/${c.id}`, { method: "DELETE" });
    await cargar();
    onSynced();
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Conexiones con Gmail</h2>
          <p className="text-sm text-gray-600">
            Sólo lectura. Se leen únicamente los mails de los proveedores conocidos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => (window.location.href = "/api/admin/finance-dnx/mail/connect")}>
            Conectar Gmail
          </Button>
          <Button onClick={leerAhora} disabled={leyendo || cuentas.length === 0}>
            {leyendo ? "Leyendo..." : "Leer ahora"}
          </Button>
        </div>
      </div>
      {mensaje && <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-800 text-sm mb-4">{mensaje}</div>}
      {cuentas.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay cuentas conectadas.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {cuentas.map((c) => (
            <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 break-all">{c.email}</p>
                <p className="text-xs text-gray-500">
                  Última lectura: {fechaAR(c.lastSyncAt)} · {c.backfillDone ? "historial completo" : "leyendo historial"} ·{" "}
                  {c.pendingReview} para revisar
                </p>
                {c.lastError && <p className="text-xs text-red-700 mt-1">{c.lastError}</p>}
              </div>
              <Button variant="secondary" onClick={() => desconectar(c)}>Desconectar</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: `MailReviewInbox.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Mail = {
  id: number;
  account: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  vendorKey: string | null;
  reviewReason: string | null;
  gmailUrl: string;
};

export default function MailReviewInbox({ refreshKey }: { refreshKey: number }) {
  const [mails, setMails] = useState<Mail[]>([]);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/admin/finance-dnx/mail/messages", { cache: "no-store" });
    if (res.ok) setMails((await res.json()).messages);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, refreshKey]);

  async function descartar(id: number) {
    await fetch(`/api/admin/finance-dnx/mail/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "DESCARTADO" }),
    });
    await cargar();
  }

  if (mails.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-gray-900">Para revisar ({mails.length})</h2>
      <p className="text-sm text-gray-600 mb-4">Mails de proveedores que todavía no se cargaron como gasto.</p>
      <ul className="divide-y divide-gray-100">
        {mails.map((m) => (
          <li key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 break-words">{m.subject || "(sin asunto)"}</p>
              <p className="text-xs text-gray-500 break-all">
                {m.vendorKey ?? "sin proveedor"} · {m.fromAddress} · {m.account} ·{" "}
                {new Date(m.receivedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
              </p>
              {m.reviewReason && <p className="text-xs text-amber-700 mt-1">{m.reviewReason}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <a href={m.gmailUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline self-center">
                Ver mail
              </a>
              <Button variant="secondary" onClick={() => descartar(m.id)}>Descartar</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
```

- [ ] **Step 3: Montarlos en `page.tsx`**

Agregar imports al principio:

```tsx
import MailConnections from "./MailConnections";
import MailReviewInbox from "./MailReviewInbox";
```

Dentro del componente, junto a los otros `useState`:

```tsx
  const [mailRefresh, setMailRefresh] = useState(0);
```

Y antes del cierre del `<div className="space-y-6">` raíz del `return`:

```tsx
      <MailConnections onSynced={() => setMailRefresh((n) => n + 1)} />
      <MailReviewInbox refreshKey={mailRefresh} />
```

- [ ] **Step 4: Verificar en el navegador local**

Levantar CompraMeLaFoto con `next dev` (no usar previews de Vercel) apuntando a una rama de prueba de Neon con la migración aplicada, entrar como admin a `/admin/finanzas-dnx/gastos` y confirmar: se ven "Conexiones con Gmail" sin cuentas, "Leer ahora" deshabilitado, "Para revisar" oculto, y a 375 px de ancho no hay scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/admin/finanzas-dnx/gastos
git commit -m "Mostrar conexiones de Gmail y mails para revisar en Finanzas DNX"
```

---

### Task 9: Puesta en producción (con Daniel)

**Files:** ninguno nuevo; operaciones.

- [ ] **Step 1: PR y CI.** Abrir PR, esperar CI verde (`test:finance-dnx` y tipos), fusionar.

- [ ] **Step 2: Migración.** Aplicar `migration.sql` en `divine-hall-10689679` / `br-autumn-rain-ad18wq7y` (sentencia por sentencia, respetando los bloques `DO $$ … $$`), y registrar en `_prisma_migrations` con `checksum = sha256(migration.sql)` y `migration_name = '20261118120000_finanzas_dnx_mail'`. Confirmar con `\d "ExpenseMailMessage"` que existe.

- [ ] **Step 3: Proveedores.** En la misma base:

```sql
UPDATE "ExpenseVendor" SET name = 'Anthropic — Suscripción', "updatedAt" = now() WHERE key = 'anthropic';
INSERT INTO "ExpenseVendor" (key, name, category, "billingCurrency", "billingCycle", active, "updatedAt") VALUES
  ('aws', 'AWS', 'INFRA', 'USD', 'USO', true, now()),
  ('anthropic-api', 'Anthropic — API del bot', 'IA', 'USD', 'USO', true, now()),
  ('capcut', 'CapCut', 'OTRO', 'USD', 'MENSUAL', true, now()),
  ('elevenlabs', 'ElevenLabs', 'IA', 'USD', 'MENSUAL', true, now())
ON CONFLICT (key) DO NOTHING;
INSERT INTO "VendorAllocation" ("vendorId", "platformKey", "sharePercent")
SELECT id, CASE key WHEN 'aws' THEN 'clf' ELSE 'suite' END, 100 FROM "ExpenseVendor"
WHERE key IN ('aws', 'anthropic-api', 'capcut', 'elevenlabs')
ON CONFLICT ("vendorId", "platformKey") DO NOTHING;
```

(El reparto se puede corregir después desde la pantalla de Proveedores.)

- [ ] **Step 4: Variables y Google.**
  - Generar `FINANCE_MAIL_VAULT_KEY` (`openssl rand -base64 32`) y cargarla en el proyecto de Vercel de CompraMeLaFoto (Production), marcada como sensible.
  - En Google Cloud, proyecto `compramelafoto-auth`: habilitar `gmail.googleapis.com`; en el cliente OAuth web que usa `GOOGLE_CLIENT_ID`, agregar la URL de retorno `https://compramelafoto.com/api/admin/finance-dnx/mail/callback` (y la de `www` si el sitio responde ahí); en la pantalla de consentimiento, agregar el scope `gmail.readonly`.
  - Redesplegar.

- [ ] **Step 5: Conexión real.** Daniel entra a Finanzas → Gastos → "Conectar Gmail" con cada una de las tres cuentas, y toca "Leer ahora" hasta que las tres digan "historial completo". Comprobar en la base que hay mensajes de AWS (`payment@aws.com` del 17/10, 106,72 USD), Neon (SWURZY-00008), Resend (22/09) y ElevenLabs (23/09), y que ninguno se repite (`SELECT "gmailMessageId", count(*) FROM "ExpenseMailMessage" GROUP BY 1 HAVING count(*) > 1` → vacío).

- [ ] **Step 6: Siguiente paso.** Con los mails reales guardados, escribir el plan de la Tanda 2 (lectores y reglas) usando esos mails como fixtures.
