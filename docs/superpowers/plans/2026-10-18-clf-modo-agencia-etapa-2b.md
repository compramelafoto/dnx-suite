# Modo agencia — Etapa 2b (FTP por fotógrafo y "Estoy acá") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada fotógrafo de una agencia tenga su propio usuario de FTP para mandar fotos desde la cámara al álbum de la agencia, que pueda marcar "Estoy acá" desde el celular para que sus fotos sin GPS tomen ese punto, y dejar el servidor de FTP listo para desplegar (sin desplegarlo: Daniel lo contrata después).

**Architecture:** Tabla `AgencyUploadCredential` (usuario FTP por miembro con álbum de destino) y `AgencyMemberPresence` ("Estoy acá" vigente hasta fin del día en hora argentina). Columnas nuevas en `CameraIngestJob` (`declaredLat`, `declaredLng`, `agencyCredentialId`). La lógica de login y de destino vive en `apps/compramelafoto/lib/agencies/ftp-*.ts` (testeable con vitest); el gateway (`apps/compramelafoto-workers/camera-ftp-gateway`) sólo la llama: primero busca el usuario en `CameraConnectionSettings` como siempre y, si no existe, en `AgencyUploadCredential`. La ingesta (cron de Vercel `/api/cron/process-camera-ingest-jobs`, ya activo) pasa el punto declarado a `finalizeAlbumPhotoFromRaw`. Dockerfile del gateway reescrito para el monorepo + guía de despliegue (Fly.io) — sin desplegar.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL Neon, bcryptjs (ya usado por el FTP), ftp-srv (gateway), tsx, vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-clf-modo-agencia-design.md` (Parte 2: Puerta 1 FTP, "Estoy acá"; Parte 5: credenciales revocables).

## Global Constraints

- Todo texto visible en español rioplatense, claro y no técnico.
- **Los usuarios de FTP que ya existen (`CameraConnectionSettings`) siguen funcionando exactamente igual**; la búsqueda en la tabla nueva sólo ocurre si el usuario no está en la vieja.
- Usuario FTP de agencia: `ag` + id del miembro en base 36 (p. ej. `ag1z`), único en las dos tablas (los viejos empiezan con `u`). Contraseña: la misma regla que hoy (`generateFtpPassword`, 8 caracteres) guardada con `hashFtpPassword` (bcrypt). Se muestra **una sola vez**.
- Una credencial de agencia sólo sube al álbum elegido, que tiene que ser de esa agencia; en **cada** login y en **cada** subida se vuelve a chequear `checkAgencyAlbumUpload` (miembro ACTIVE con condiciones vigentes).
- Revocar: el miembro (desde "Mis agencias") o automáticamente al darlo de baja. Revocada = `revokedAt` no nulo, el login falla.
- "Estoy acá" vale hasta las 23:59:59 de ese día en hora argentina (UTC−3, sin horario de verano). Se puede borrar.
- Ubicación de la foto por FTP: GPS de la foto si lo trae; si no, el "Estoy acá" vigente **en el momento en que llegó la foto**; si no, sin ubicación (regla de la etapa 2a).
- Migración aditiva `20261123120000_clf_agencia_ftp`: tablas nuevas + columnas opcionales en `CameraIngestJob`. Se aplica a mano en las cinco bases (CLF production, development, Clickatón, InfoSpot, compramelafoto-staging) **antes** de fusionar, con `SET LOCAL lock_timeout = '5s'` y su checksum.
- **No se despliega el servidor de FTP** en esta etapa (decisión de Daniel). La pantalla sigue mostrando "Servidor FTP aún no disponible" mientras `CAMERA_CONNECTION_FTP_SERVER_LIVE` no sea `true`.
- Tests: `beforeEach(() => { ... })` siempre con llaves.
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia-2b` (rama `feat/clf-agencia-etapa-2b`).

## Review Focus

1. **Login con un usuario viejo (`u…`)**: mismo camino y mismas respuestas que hoy, sin consultar la tabla nueva. Test en Task 3.
2. **Credencial de un miembro dado de baja, revocada, o cuyo álbum dejó de ser de la agencia**: el login y la subida fallan con 530/550, no se encola nada. Tests en Task 3.
3. **"Estoy acá" vencido** (de ayer): no se usa como punto. Test en Task 2 y Task 3.
4. **Dos credenciales para el mismo miembro**: generar una nueva revoca la anterior; nunca quedan dos activas. Test en Task 4.
5. **Un álbum ajeno elegido como destino** (POST con albumId de otra agencia): 400 sin crear credencial. Test en Task 4.

---

## File Structure

```
packages/db/prisma/schema.prisma                                    (modificar)
packages/db/prisma/migrations/20261123120000_clf_agencia_ftp/migration.sql

apps/compramelafoto/lib/agencies/presence.ts            fin del día ART y punto vigente
apps/compramelafoto/lib/agencies/presence.test.ts
apps/compramelafoto/lib/agencies/ftp-credentials.ts     usuario, emitir/revocar credencial
apps/compramelafoto/lib/agencies/ftp-credentials.test.ts
apps/compramelafoto/lib/agencies/ftp-login.ts           login de agencia y destino de cada subida
apps/compramelafoto/lib/agencies/ftp-login.test.ts
apps/compramelafoto/lib/camera-connection/create-camera-upload-log-and-enqueue.ts (modificar: campos opcionales)
apps/compramelafoto/lib/camera-connection/claim-camera-ingest-job.ts               (modificar: devolver columnas)
apps/compramelafoto/lib/camera-connection/process-camera-ingest-job.ts             (modificar: declaredPoint)
apps/compramelafoto-workers/camera-ftp-gateway/src/authenticate.ts                  (modificar)
apps/compramelafoto-workers/camera-ftp-gateway/src/handle-upload.ts                 (modificar)
apps/compramelafoto-workers/camera-ingest/src/claim-camera-ingest-job.ts            (modificar si duplica el SELECT)
apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/[agencyId]/ftp/route.ts        GET, POST, PATCH, DELETE
apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/[agencyId]/estoy-aca/route.ts  GET, POST, DELETE
apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/ftp-estoy-aca.test.ts
apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/[memberId]/route.ts       (modificar: baja revoca)
apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/camara/page.tsx         FTP + Estoy acá
apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx                            (botón)
apps/compramelafoto-workers/camera-ftp-gateway/Dockerfile                                   (reescribir)
apps/compramelafoto-workers/camera-ftp-gateway/fly.toml                                     (crear)
apps/compramelafoto-workers/deploy/README.md                                                (reescribir)
apps/compramelafoto/vitest.bot.config.ts                                                    (include)
```

---

### Task 1: Tablas y columnas

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261123120000_clf_agencia_ftp/migration.sql`

**Interfaces:**
- Produces: `prisma.agencyUploadCredential`, `prisma.agencyMemberPresence`; `CameraIngestJob.declaredLat/declaredLng/agencyCredentialId`; back-relations `AgencyMember.uploadCredentials`, `AgencyMember.presence`, `Agency.uploadCredentials`, `Album.agencyUploadCredentials`.

- [ ] **Step 1:** `cd /Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia-2b && pnpm install --frozen-lockfile`

- [ ] **Step 2: Schema.** Agregar al final:

```prisma
/// Modo agencia: usuario de FTP de un fotógrafo del equipo. Sube sólo al álbum elegido de esa agencia.
model AgencyUploadCredential {
  id              Int          @id @default(autoincrement())
  agencyId        Int
  memberId        Int
  albumId         Int
  ftpUsername     String       @unique
  ftpPasswordHash String
  lastUsedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime     @default(now())
  agency          Agency       @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  member          AgencyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  album           Album        @relation("AgencyUploadCredentialAlbum", fields: [albumId], references: [id], onDelete: Cascade)

  @@index([memberId])
  @@index([agencyId])
}

/// Modo agencia: "Estoy acá" del fotógrafo, para sus fotos sin GPS. Vale hasta fin del día (hora argentina).
model AgencyMemberPresence {
  id         Int          @id @default(autoincrement())
  memberId   Int          @unique
  lat        Float
  lng        Float
  placeId    Int?
  validUntil DateTime
  updatedAt  DateTime     @updatedAt
  member     AgencyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
}
```

En `model Agency` agregar `uploadCredentials AgencyUploadCredential[]`; en `model AgencyMember` agregar `uploadCredentials AgencyUploadCredential[]` y `presence AgencyMemberPresence?`; en `model Album` agregar `agencyUploadCredentials AgencyUploadCredential[] @relation("AgencyUploadCredentialAlbum")`; en `model CameraIngestJob` agregar:

```prisma
  /// Modo agencia: punto "Estoy acá" vigente al llegar la foto y credencial FTP usada.
  declaredLat        Float?
  declaredLng        Float?
  agencyCredentialId Int?
```

- [ ] **Step 3: Migración** `packages/db/prisma/migrations/20261123120000_clf_agencia_ftp/migration.sql`:

```sql
-- Modo agencia de CompraMeLaFoto (etapa 2b): usuario de FTP por fotógrafo del equipo y "Estoy acá".
-- Crea AgencyUploadCredential y AgencyMemberPresence y agrega tres columnas opcionales a "CameraIngestJob".
-- No toca filas existentes. Schema compartido: se aplica a mano en las cinco bases ANTES del deploy y se
-- registra con el checksum del archivo.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyUploadCredential" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "ftpUsername" TEXT NOT NULL,
    "ftpPasswordHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyUploadCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyMemberPresence" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "placeId" INTEGER,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyMemberPresence_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "declaredLat" DOUBLE PRECISION;
ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "declaredLng" DOUBLE PRECISION;
ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "agencyCredentialId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyUploadCredential_ftpUsername_key" ON "AgencyUploadCredential"("ftpUsername");
CREATE INDEX IF NOT EXISTS "AgencyUploadCredential_memberId_idx" ON "AgencyUploadCredential"("memberId");
CREATE INDEX IF NOT EXISTS "AgencyUploadCredential_agencyId_idx" ON "AgencyUploadCredential"("agencyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyMemberPresence_memberId_key" ON "AgencyMemberPresence"("memberId");

-- AddForeignKey
ALTER TABLE "AgencyUploadCredential" ADD CONSTRAINT "AgencyUploadCredential_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyUploadCredential" ADD CONSTRAINT "AgencyUploadCredential_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyUploadCredential" ADD CONSTRAINT "AgencyUploadCredential_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMemberPresence" ADD CONSTRAINT "AgencyMemberPresence_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AgencyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4:** `cd packages/db && DATABASE_URL=postgresql://x:x@localhost/x DIRECT_URL=postgresql://x:x@localhost/x pnpm exec prisma validate && pnpm exec prisma generate` → válido. Comparar nombres/tipos a ojo.

- [ ] **Step 5: Commit** `git add packages/db && git commit -m "Modo agencia: usuario de FTP por fotógrafo y Estoy acá"`

---

### Task 2: "Estoy acá" (fin del día y punto vigente)

**Files:**
- Create: `apps/compramelafoto/lib/agencies/presence.ts`, `apps/compramelafoto/lib/agencies/presence.test.ts`

**Interfaces:**
- Produces:
  - `endOfDayArgentina(now: Date): Date` — 23:59:59.999 del día argentino de `now`, en UTC (ART = UTC−3 fijo).
  - `activePresencePoint(presence: { lat: number; lng: number; validUntil: Date } | null, at: Date): { lat: number; lng: number } | null`

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { activePresencePoint, endOfDayArgentina } from "./presence";

describe("endOfDayArgentina", () => {
  it("de mañana en Argentina: fin de ese día", () => {
    // 18/01 10:00 ART = 13:00Z → fin del 18/01 ART = 19/01 02:59:59.999Z
    expect(endOfDayArgentina(new Date("2027-01-18T13:00:00Z")).toISOString()).toBe("2027-01-19T02:59:59.999Z");
  });
  it("de noche en Argentina (ya es otro día en UTC): sigue siendo el mismo día argentino", () => {
    // 18/01 23:30 ART = 19/01 02:30Z
    expect(endOfDayArgentina(new Date("2027-01-19T02:30:00Z")).toISOString()).toBe("2027-01-19T02:59:59.999Z");
  });
});

describe("activePresencePoint", () => {
  const p = { lat: -38.02, lng: -57.53, validUntil: new Date("2027-01-19T02:59:59.999Z") };
  it("vigente: devuelve el punto", () => {
    expect(activePresencePoint(p, new Date("2027-01-18T20:00:00Z"))).toEqual({ lat: -38.02, lng: -57.53 });
  });
  it("vencido o sin presencia: null", () => {
    expect(activePresencePoint(p, new Date("2027-01-19T03:00:00Z"))).toBe(null);
    expect(activePresencePoint(null, new Date())).toBe(null);
  });
});
```

- [ ] **Step 2:** correr → FAIL (`../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/presence.test.ts` desde `apps/compramelafoto`).

- [ ] **Step 3: Implementación**

```ts
/** "Estoy acá" del fotógrafo de una agencia. Argentina no tiene horario de verano: UTC−3 fijo. */
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

export function endOfDayArgentina(now: Date): Date {
  const art = new Date(now.getTime() - ART_OFFSET_MS);
  const endArtAsUtc = Date.UTC(art.getUTCFullYear(), art.getUTCMonth(), art.getUTCDate(), 23, 59, 59, 999);
  return new Date(endArtAsUtc + ART_OFFSET_MS);
}

export function activePresencePoint(
  presence: { lat: number; lng: number; validUntil: Date } | null,
  at: Date
): { lat: number; lng: number } | null {
  if (!presence) return null;
  return presence.validUntil.getTime() >= at.getTime() ? { lat: presence.lat, lng: presence.lng } : null;
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `"Modo agencia: Estoy acá vale hasta fin del día"`.

---

### Task 3: Login FTP de agencia y destino de cada subida

**Files:**
- Create: `apps/compramelafoto/lib/agencies/ftp-login.ts`, `apps/compramelafoto/lib/agencies/ftp-login.test.ts`
- Modify: `apps/compramelafoto-workers/camera-ftp-gateway/src/authenticate.ts`, `.../src/handle-upload.ts`
- Modify: `apps/compramelafoto/lib/camera-connection/create-camera-upload-log-and-enqueue.ts`

**Interfaces:**
- Consumes: `checkAgencyAlbumUpload(albumId, userId)` (`@/lib/agencies/access`), `verifyFtpPassword(pw, hash)` (`@/lib/camera-connection/camera-connection-service`), `activePresencePoint` (Task 2).
- Produces:
  - `type AgencyFtpLogin = { userId: number; ftpUsername: string; albumId: number; agencyCredentialId: number; memberId: number }`
  - `loginAgencyFtp(username: string, password: string): Promise<{ ok: true; login: AgencyFtpLogin } | { ok: false; code: 530 | 550; message: string } | null>` — `null` = no es un usuario de agencia (que siga el camino viejo); falla si revocada, contraseña mala o `checkAgencyAlbumUpload` no lo deja.
  - `resolveAgencyFtpUpload(login: AgencyFtpLogin, receivedAt: Date): Promise<{ ok: true; albumId: number; declaredPoint: { lat: number; lng: number } | null } | { ok: false; message: string }>` — re-chequea el acceso, toma el "Estoy acá" vigente y actualiza `lastUsedAt`.
  - `CreateCameraUploadLogAndEnqueueInput` gana `declaredLat?: number | null; declaredLng?: number | null; agencyCredentialId?: number | null` (se guardan en el job; ausentes = como hoy).
  - `CameraFtpAuthContext` gana `agency?: AgencyFtpLogin` (en el login de agencia: `assignmentMode = MANUAL`, `activeAlbumId = login.albumId`).

- [ ] **Step 1: Test** `lib/agencies/ftp-login.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const credFindUnique = vi.fn();
const credUpdate = vi.fn();
const presenceFindUnique = vi.fn();
const verifyFtpPassword = vi.fn();
const checkAgencyAlbumUpload = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyUploadCredential: { findUnique: (...a: unknown[]) => credFindUnique(...a), update: (...a: unknown[]) => credUpdate(...a) },
    agencyMemberPresence: { findUnique: (...a: unknown[]) => presenceFindUnique(...a) },
  },
}));
vi.mock("@/lib/camera-connection/camera-connection-service", () => ({ verifyFtpPassword: (...a: unknown[]) => verifyFtpPassword(...a) }));
vi.mock("@/lib/agencies/access", () => ({ checkAgencyAlbumUpload: (...a: unknown[]) => checkAgencyAlbumUpload(...a) }));

import { loginAgencyFtp, resolveAgencyFtpUpload } from "./ftp-login";

const cred = { id: 4, agencyId: 3, memberId: 7, albumId: 50, ftpUsername: "ag7", ftpPasswordHash: "h", revokedAt: null, member: { userId: 20 } };

beforeEach(() => {
  for (const f of [credFindUnique, credUpdate, presenceFindUnique, verifyFtpPassword, checkAgencyAlbumUpload]) f.mockReset();
  credUpdate.mockResolvedValue({});
});

describe("loginAgencyFtp", () => {
  it("usuario viejo (no está en la tabla de agencia): null para seguir el camino de siempre", async () => {
    credFindUnique.mockResolvedValue(null);
    expect(await loginAgencyFtp("u20", "x")).toBe(null);
  });
  it("credencial válida", async () => {
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(true);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    expect(await loginAgencyFtp("ag7", "pw")).toEqual({
      ok: true,
      login: { userId: 20, ftpUsername: "ag7", albumId: 50, agencyCredentialId: 4, memberId: 7 },
    });
    expect(checkAgencyAlbumUpload).toHaveBeenCalledWith(50, 20);
  });
  it("revocada, contraseña mala o sin acceso: falla", async () => {
    credFindUnique.mockResolvedValue({ ...cred, revokedAt: new Date() });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 530 });
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(false);
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 530 });
    verifyFtpPassword.mockResolvedValue(true);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "no" });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: false });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
  });
});

describe("resolveAgencyFtpUpload", () => {
  const login = { userId: 20, ftpUsername: "ag7", albumId: 50, agencyCredentialId: 4, memberId: 7 };
  it("usa el Estoy acá vigente y marca lastUsedAt", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    presenceFindUnique.mockResolvedValue({ lat: -38, lng: -57.5, validUntil: new Date("2027-01-19T02:59:59.999Z") });
    const r = await resolveAgencyFtpUpload(login, new Date("2027-01-18T20:00:00Z"));
    expect(r).toEqual({ ok: true, albumId: 50, declaredPoint: { lat: -38, lng: -57.5 } });
    expect(credUpdate.mock.calls[0][0].where).toEqual({ id: 4 });
  });
  it("Estoy acá vencido: sin punto", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    presenceFindUnique.mockResolvedValue({ lat: -38, lng: -57.5, validUntil: new Date("2027-01-18T02:59:59.999Z") });
    expect(await resolveAgencyFtpUpload(login, new Date("2027-01-18T20:00:00Z"))).toMatchObject({ ok: true, declaredPoint: null });
  });
  it("si lo dieron de baja entre el login y la subida: falla", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
    expect(await resolveAgencyFtpUpload(login, new Date())).toEqual({ ok: false, message: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
  });
});
```

Registrar en `apps/compramelafoto/vitest.bot.config.ts` (si no lo cubre `lib/agencies/**/*.test.ts`, que ya está) y correr → FAIL.

- [ ] **Step 2: `lib/agencies/ftp-login.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { verifyFtpPassword } from "@/lib/camera-connection/camera-connection-service";
import { checkAgencyAlbumUpload } from "@/lib/agencies/access";
import { activePresencePoint } from "@/lib/agencies/presence";

export type AgencyFtpLogin = { userId: number; ftpUsername: string; albumId: number; agencyCredentialId: number; memberId: number };

const NO_ACCESS = "Este usuario de FTP ya no puede subir a ese álbum de la agencia.";

/** null = el usuario no es de agencia: el gateway sigue con CameraConnectionSettings como siempre. */
export async function loginAgencyFtp(
  username: string,
  password: string
): Promise<{ ok: true; login: AgencyFtpLogin } | { ok: false; code: 530 | 550; message: string } | null> {
  const ftpUsername = username?.trim();
  if (!ftpUsername) return null;
  const cred = await prisma.agencyUploadCredential.findUnique({
    where: { ftpUsername },
    select: { id: true, memberId: true, albumId: true, ftpUsername: true, ftpPasswordHash: true, revokedAt: true, member: { select: { userId: true } } },
  });
  if (!cred) return null;
  if (cred.revokedAt) return { ok: false, code: 530, message: "Invalid credentials" };
  if (!(await verifyFtpPassword(password, cred.ftpPasswordHash))) return { ok: false, code: 530, message: "Invalid credentials" };
  const access = await checkAgencyAlbumUpload(cred.albumId, cred.member.userId);
  if (!access.agencyAlbum || !access.allowed) {
    return { ok: false, code: 550, message: access.agencyAlbum ? access.error ?? NO_ACCESS : NO_ACCESS };
  }
  return {
    ok: true,
    login: { userId: cred.member.userId, ftpUsername: cred.ftpUsername, albumId: cred.albumId, agencyCredentialId: cred.id, memberId: cred.memberId },
  };
}

export async function resolveAgencyFtpUpload(
  login: AgencyFtpLogin,
  receivedAt: Date
): Promise<{ ok: true; albumId: number; declaredPoint: { lat: number; lng: number } | null } | { ok: false; message: string }> {
  const access = await checkAgencyAlbumUpload(login.albumId, login.userId);
  if (!access.agencyAlbum || !access.allowed) {
    return { ok: false, message: access.agencyAlbum ? access.error ?? NO_ACCESS : NO_ACCESS };
  }
  const presence = await prisma.agencyMemberPresence.findUnique({
    where: { memberId: login.memberId },
    select: { lat: true, lng: true, validUntil: true },
  });
  await prisma.agencyUploadCredential
    .update({ where: { id: login.agencyCredentialId }, data: { lastUsedAt: receivedAt } })
    .catch(() => {});
  return { ok: true, albumId: login.albumId, declaredPoint: activePresencePoint(presence, receivedAt) };
}
```

- [ ] **Step 3: enqueue.** En `create-camera-upload-log-and-enqueue.ts`, agregar al input `declaredLat?: number | null; declaredLng?: number | null; agencyCredentialId?: number | null;` y, en el `cameraIngestJob.create` dentro de la transacción, `...(input.declaredLat != null && input.declaredLng != null ? { declaredLat: input.declaredLat, declaredLng: input.declaredLng } : {}), ...(input.agencyCredentialId != null ? { agencyCredentialId: input.agencyCredentialId } : {})`. Nada más cambia.

- [ ] **Step 4: gateway.**
  - `authenticate.ts`: agregar `agency?: AgencyFtpLogin` a `CameraFtpAuthContext` (import type desde `@/lib/agencies/ftp-login.js`). Después de `const settings = await prisma.cameraConnectionSettings.findUnique(...)`: si `!settings?.ftpUsername`, llamar `const agencyLogin = await loginAgencyFtp(ftpUsername, password)`; si `null` → `throw new GeneralError("Invalid credentials", 530)` (igual que hoy); si `!ok` → `code === 530 ? new GeneralError(msg, 530) : new FileSystemError(msg, 550)`; si ok → `return { userId, ftpUsername, assignmentMode: CameraConnectionAssignmentMode.MANUAL, activeAlbumId: login.albumId, agency: login }`. El camino de `settings` existente no cambia.
  - `handle-upload.ts`: en `handleCameraFtpUpload`, justo después de `const receivedAt = new Date();`, si `auth.agency`: `const agencyDest = await resolveAgencyFtpUpload(auth.agency, receivedAt)`; si `!ok` → `createRejectedUploadLog(auth, filename, buffer.length, agencyDest.message, auth.agency.albumId)` y `throw new FileSystemError(agencyDest.message, 550)`; si ok, usar `albumId = agencyDest.albumId` y saltear `resolveFtpDestinationAlbum`; al encolar pasar `declaredLat: agencyDest.declaredPoint?.lat ?? null, declaredLng: agencyDest.declaredPoint?.lng ?? null, agencyCredentialId: auth.agency.agencyCredentialId`. Sin `auth.agency`, todo igual que hoy. Usar el nombre de variable que ya existe para el álbum destino; reestructurar lo mínimo (p. ej. `const destination = auth.agency ? {...} : await resolveFtpDestinationAlbum(...)` con la misma forma `{ ok, albumId }`).
  - Typecheck del gateway: `cd apps/compramelafoto-workers/camera-ftp-gateway && pnpm typecheck` (exit 0) y `pnpm test`.

- [ ] **Step 5:** tests de `lib/agencies` PASS, `pnpm typecheck` de compramelafoto y del gateway en 0. Commit `"Modo agencia: el FTP reconoce los usuarios de agencia y sube al álbum elegido"`.

---

### Task 4: Ingesta con el punto declarado + APIs del miembro (FTP y Estoy acá) + baja revoca

**Files:**
- Modify: `apps/compramelafoto/lib/camera-connection/claim-camera-ingest-job.ts` (tipo + `RETURNING j."declaredLat", j."declaredLng"`), `apps/compramelafoto-workers/camera-ingest/src/claim-camera-ingest-job.ts` si tiene su propia consulta, `apps/compramelafoto/lib/camera-connection/process-camera-ingest-job.ts` (pasar `declaredPoint`)
- Create: `apps/compramelafoto/lib/agencies/ftp-credentials.ts`, `.../ftp-credentials.test.ts`
- Create: `app/api/fotografo/agencias/mis-agencias/[agencyId]/ftp/route.ts`, `.../[agencyId]/estoy-aca/route.ts`, `app/api/fotografo/agencias/mis-agencias/ftp-estoy-aca.test.ts`
- Modify: `app/api/fotografo/agencias/mi-agencia/equipo/[memberId]/route.ts` (acción `remove` revoca credenciales activas del miembro)

**Interfaces:**
- Produces:
  - `agencyFtpUsername(memberId: number): string` → `ag${memberId.toString(36)}`
  - `issueAgencyFtpCredential(input: { agencyId: number; memberId: number; albumId: number }): Promise<{ ftpUsername: string; password: string }>` — en una transacción revoca las activas del miembro y crea una nueva (si el usuario `agXX` ya existe revocado, agrega sufijo `-2`, `-3`… hasta encontrar libre).
  - `revokeAgencyFtpCredentials(memberId: number): Promise<number>`
  - `GET …/[agencyId]/ftp` → `{ live: boolean; host: string; port: number; credential: { ftpUsername: string; albumId: number; albumTitle: string; lastUsedAt: string | null } | null }`
  - `POST …/[agencyId]/ftp` body `{ albumId }` → `{ ftpUsername, password, host, port }` (400 si el álbum no es de esa agencia; 404 si no es miembro ACTIVE)
  - `PATCH …/[agencyId]/ftp` body `{ albumId }` → cambia el álbum de la credencial activa
  - `DELETE …/[agencyId]/ftp` → revoca
  - `GET …/[agencyId]/estoy-aca` → `{ presence: { lat, lng, placeId, validUntil } | null }` (null si venció)
  - `POST …/[agencyId]/estoy-aca` body `{ placeId }` (de esa agencia) o `{ lat, lng }` → `{ presence }` con `validUntil = endOfDayArgentina(now)`
  - `DELETE …/[agencyId]/estoy-aca`

- [ ] **Step 1: Tests** (`ftp-credentials.test.ts` y `ftp-estoy-aca.test.ts`, vitest, prisma mockeado como en los tests de agencias existentes, `beforeEach` con llaves). Casos mínimos:
  - `agencyFtpUsername(7) === "ag7"`, `agencyFtpUsername(71) === "ag1z"`.
  - `issueAgencyFtpCredential`: llama a `updateMany({ where: { memberId, revokedAt: null }, data: { revokedAt: <Date> } })` antes de `create`; guarda `ftpPasswordHash` (no la contraseña); devuelve la contraseña de 8 caracteres; si `findUnique` encuentra `ag7`, usa `ag7-2`.
  - `POST ftp` con un álbum que no está en `agencyAlbum` de esa agencia → 400 y no se emite nada; miembro REQUESTED → 404; válido → 200 con `ftpUsername`, `password`, `host`, `port`.
  - `POST estoy-aca` con `placeId` de otra agencia → 400; con `{ lat: 200, lng: 0 }` → 400; con `placeId` válido → upsert con `validUntil` = `endOfDayArgentina(now)` (usar `vi.useFakeTimers()` + `vi.setSystemTime`).
  - `GET estoy-aca` con presencia vencida → `{ presence: null }`.
  - Equipo `PATCH remove` llama a `revokeAgencyFtpCredentials(memberId)` (mockear `@/lib/agencies/ftp-credentials` en el test de equipo existente y agregar la aserción).

- [ ] **Step 2:** correr → FAIL.

- [ ] **Step 3: Implementación.**
  - `ftp-credentials.ts` con `generateFtpPassword` y `hashFtpPassword` de `@/lib/camera-connection/camera-connection-service`, y `prisma.$transaction(async (tx) => …)`.
  - Rutas con `requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER])`, buscando la membresía con `agencyId_userId` y exigiendo `status === "ACTIVE"` (404 si no). Validar que `albumId` tenga fila en `agencyAlbum` con ese `agencyId` (400 "Ese álbum no es de la agencia." si no). `host/port/live` con `getCameraConnectionFtpHost()`, `getCameraConnectionFtpPort()`, `isCameraConnectionFtpServerLive()` de `@/lib/camera-connection/camera-connection-api-helpers`. Punto de "Estoy acá" con `parseDeclaredPoint` (etapa 2a) o el `AgencyPlace` de esa agencia.
  - `claim-camera-ingest-job.ts`: agregar `declaredLat: number | null; declaredLng: number | null` al tipo y al `RETURNING`; en `process-camera-ingest-job.ts` pasar `declaredPoint: job.declaredLat != null && job.declaredLng != null ? { lat: job.declaredLat, lng: job.declaredLng } : null` a `finalizeAlbumPhotoFromRaw`. Si `apps/compramelafoto-workers/camera-ingest/src/claim-camera-ingest-job.ts` tiene su propia copia de la consulta, actualizarla igual.
  - Equipo `remove`: después del update a REMOVED, `await revokeAgencyFtpCredentials(member.id)`.

- [ ] **Step 4:** tests PASS (`app/api/fotografo/agencias lib/agencies lib/camera-connection`) y `pnpm typecheck` exit 0.

- [ ] **Step 5:** commit `"Modo agencia: el fotógrafo saca su usuario de FTP y marca Estoy acá"`.

---

### Task 5: Pantalla "Cámara y ubicación" del miembro

**Files:**
- Create: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/camara/page.tsx`
- Modify: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx` (botón "Cámara y ubicación" junto a "Subir fotos")

**Interfaces:**
- Consumes: APIs de Task 4, `GET …/mis-agencias` (albums con albumId) y `GET …/[agencyId]/lugares` (etapa 2a), `AgencyPageFrame`.

- [ ] **Step 1: Página** con dos tarjetas:
  1. **"Subir desde la cámara (FTP)"**:
     - Si `!live`: aviso "El servidor de FTP todavía no está funcionando. Podés preparar tu usuario y cargarlo en la cámara; vas a poder subir cuando lo activemos."
     - Sin credencial: select de álbum de la agencia + botón "Crear mi usuario de FTP".
     - Con credencial: servidor (`host`), puerto (`port`), usuario, álbum (select que hace PATCH), "Último uso", botón "Generar contraseña nueva" (POST; muestra la contraseña en un recuadro con "Copiá esta contraseña ahora: no la vamos a volver a mostrar.") y "Desactivar" (DELETE con `confirm`).
     - Texto de ayuda: "Cargá estos datos en la configuración de FTP de tu cámara (o en la app de la cámara). Las fotos van solas al álbum de la agencia a tu nombre."
  2. **"Estoy acá"**:
     - Muestra el punto vigente ("Hoy estás en Playa Grande hasta las 23:59") o "Todavía no marcaste dónde estás hoy".
     - Select de lugares de la agencia + "Usar mi ubicación actual" (geolocalización; si falla, mensaje y vuelve a vacío, sin quedar esperando) + botón "Marcar". Botón "Borrar".
     - Ayuda: "Si tu cámara no tiene GPS, las fotos que subas hoy por FTP toman este lugar. Vence a la medianoche."
  - Todo con `credentials: "include"`, errores visibles en rojo, textos en rioplatense.
- [ ] **Step 2: Botón** en Mis agencias: `<Link href={`/fotografo/agencias/mis-agencias/${a.agencyId}/camara`}><Button size="sm" variant="outline">Cámara y ubicación</Button></Link>`.
- [ ] **Step 3:** `pnpm typecheck` exit 0 (sin verificación visual local). Commit `"Modo agencia: pantalla de FTP y Estoy acá para el equipo"`.

---

### Task 6: Servidor de FTP listo para desplegar (sin desplegar)

**Files:**
- Rewrite: `apps/compramelafoto-workers/camera-ftp-gateway/Dockerfile`
- Create: `apps/compramelafoto-workers/camera-ftp-gateway/fly.toml`
- Rewrite: `apps/compramelafoto-workers/deploy/README.md`
- Modify: `apps/compramelafoto-workers/deploy/camera-connection/docker-compose.yml` (sólo el gateway; la ingesta la hace el cron de Vercel)

- [ ] **Step 1: Dockerfile** (patrón del worker de video: build desde la raíz del monorepo):
  - `FROM node:20-bookworm-slim`, `apt-get install openssl ca-certificates`, `corepack enable && corepack prepare pnpm@9.0.0 --activate`, `WORKDIR /repo`.
  - Copiar manifiestos (`package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json*`, `packages/*/package.json` que `@repo/db` y el gateway necesiten, `apps/compramelafoto-workers/camera-ftp-gateway/package.json`), `packages/db/prisma`, luego `pnpm install --frozen-lockfile --filter compramelafoto-camera-ftp-gateway...`.
  - Copiar `packages/db`, `apps/compramelafoto-workers/camera-ftp-gateway` y **`apps/compramelafoto/lib`** (el gateway importa `@/lib/...` vía `tsconfig` paths con tsx; verificar con `grep -rhn "from \"@/" apps/compramelafoto/lib/camera-connection apps/compramelafoto/lib/agencies apps/compramelafoto/lib/r2-client.ts | sort -u` qué más de `apps/compramelafoto` hace falta —p. ej. `@/lib/prisma`— y copiar sólo eso; si alguna dependencia npm de esas libs no está en el `package.json` del gateway, agregarla allí).
  - `RUN pnpm --filter @repo/db exec prisma generate`, `WORKDIR /repo/apps/compramelafoto-workers/camera-ftp-gateway`, `EXPOSE 21 50000-50050 8080`, `CMD ["pnpm","start"]`.
  - Verificación sin Docker (no está instalado en esta máquina): `cd apps/compramelafoto-workers/camera-ftp-gateway && pnpm typecheck && pnpm test` y arrancarlo localmente con variables falsas para ver que levanta el `/health` (`HEALTH_PORT=18080 DATABASE_URL=postgresql://x:x@localhost/x R2_ACCOUNT_ID=x R2_ACCESS_KEY_ID=x R2_SECRET_ACCESS_KEY=x R2_ENDPOINT=https://x CAMERA_CONNECTION_FTP_PORT=2121 timeout 15 pnpm start`; con `curl localhost:18080/health` en paralelo). Si no puede arrancar sin base, documentarlo y no forzarlo.
- [ ] **Step 2: `fly.toml`** con `app = "clf-camera-ftp"`, región `eze` (Buenos Aires), `[[services]]` TCP para 21 y el rango pasivo 50000-50050 (un bloque por puerto o `ports` con `start_port/end_port` según la versión de Fly), `[[services]]` HTTP interno para `/health` en 8080, 1 máquina, `[env]` sin secretos. Los secretos (`DATABASE_URL`, `R2_*`, `FTP_PASV_URL` = IP pública dedicada) van con `fly secrets set` — sólo documentados.
- [ ] **Step 3: README de despliegue** (`deploy/README.md`) en español: qué es, qué hace falta (cuenta Fly.io, IP dedicada IPv4 ~2 USD/mes, la máquina ~3-5 USD/mes), pasos numerados (`fly launch --no-deploy`, `fly ips allocate-v4`, `fly secrets set …` con la lista exacta de variables de `src/config.ts`, `fly deploy -c apps/compramelafoto-workers/camera-ftp-gateway/fly.toml --dockerfile apps/compramelafoto-workers/camera-ftp-gateway/Dockerfile` desde la raíz), DNS `ftp.compramelafoto.com` → IP, en Vercel `CAMERA_CONNECTION_FTP_SERVER_LIVE=true` y `CAMERA_CONNECTION_FTP_HOST=ftp.compramelafoto.com`, prueba con FileZilla y con `pnpm smoke-test`. Aclarar que la ingesta la hace el cron de Vercel (`/api/cron/process-camera-ingest-jobs`) y que el `camera-ingest` de docker es opcional. Advertencia: el límite de la app es 10 MB por foto (`MAX_FILE_SIZE`), el gateway acepta 30 MB: configurar la cámara en JPG mediano/fino.
- [ ] **Step 4:** commit `"Servidor de FTP de CLF listo para desplegar en Fly.io (sin desplegar)"`.

---

### Task 7: Migración en las cinco bases, PR, producción

- [ ] Todos los tests (bot, análisis, gateway) y `pnpm typecheck` (compramelafoto y gateway) en 0.
- [ ] Aplicar `20261123120000_clf_agencia_ftp` en las cinco bases con `SET LOCAL lock_timeout = '5s'` + sentencias + fila en `_prisma_migrations` con el `sha256` del archivo; verificar tablas, columnas y fila.
- [ ] PR contra `main`, CI en verde, fusionar, esperar el deploy de `compramelafoto-dnxsuite`.
- [ ] Verificar: `GET /api/fotografo/agencias/mis-agencias/1/ftp` sin sesión → 401; `/fotografo/agencias/mis-agencias/1/camara` → 200.
