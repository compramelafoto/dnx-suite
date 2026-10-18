# Modo agencia — Etapa 1 (agencia y equipo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fotógrafo de CLF pueda crear su agencia, armar su equipo (link de invitación y solicitudes desde un directorio), fijar porcentajes por fotógrafo, marcar álbumes como "de la agencia" y que **sólo** su equipo pueda subir a esos álbumes, con el menú "Agencias" (NEW) y sus tres secciones.

**Architecture:** Tablas nuevas `Agency*` en el schema compartido (migración aditiva, aplicada a mano en las cinco bases). Reglas puras en `apps/compramelafoto/lib/agencies/` (porcentajes, estados, permisos, distancia) con tests; acceso a datos en `lib/agencies/queries.ts`; rutas API bajo `app/api/fotografo/agencias/`; páginas cliente bajo `app/fotografo/agencias/`. El álbum de agencia es un `Album` normal del dueño marcado por `AgencyAlbum`; la compuerta de subida (`ensureAlbumUploadAccess` y sus dos copias) consulta esa marca. El reparto de plata, la subida por FTP/DNX FLUX y el panel antipuenteo **no** son de esta etapa.

**Tech Stack:** Next.js (App Router, `params` como `Promise`), Prisma (`@repo/db`, re-exportado en `@/lib/prisma`), PostgreSQL Neon, vitest (binario prestado de `services/dnx-mcp`), Tailwind, react-leaflet (mapa existente `components/organizer/LocationMap.tsx`).

**Spec:** `docs/superpowers/specs/2026-10-18-clf-modo-agencia-design.md` (Parte 1 completa; de la Parte 5, permisos y condiciones).

## Global Constraints

- Todo texto visible en **español rioplatense** ("vos", "subí", "tenés"), claro y no técnico.
- El producto se llama **ComprameLaFoto**; el programa de escritorio se escribe **DNX FLUX**.
- Porcentajes guardados en **puntos básicos** enteros (`3000` = 30 %), rango 0–10000; en pantalla, porcentaje con hasta 1 decimal.
- Porcentaje general por defecto de una agencia: **30 %** (`3000`).
- Estados como `TEXT` + `CHECK` (no enums de Prisma), igual que las migraciones recientes.
- Migración **aditiva**: sólo crea tablas; no toca filas existentes. Se aplica a mano en las **cinco** bases con `packages/db/scripts/migraciones-cinco-bases.mts` y queda registrada con su checksum. Nombre: `20261120120000_clf_agencias`.
- Un miembro de agencia **nunca** recibe datos de compradores ni de interesados, ni descargas de pedidos, de un álbum de agencia.
- La conexión de Mercado Pago es la existente (`/fotografo/configuracion?tab=mercadopago`); esta etapa sólo enlaza a ella y muestra si está conectada (`User.mpAccessToken` presente).
- Una cuenta puede ser dueña de **una** agencia (`Agency.ownerUserId` único) y miembro de otras.
- No se toca el Checkout ni el webhook de pagos de CLF.
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia` (rama `docs/clf-modo-agencia`), nunca sobre el árbol compartido de `dnx-suite`.

## Review Focus

1. **Subir a un álbum de agencia sin ser del equipo** (fotógrafo cualquiera, miembro `REQUESTED`, `REMOVED`, `REJECTED`, o `ACTIVE` con condiciones viejas): debe dar 403 por las **tres** compuertas (`ensureAlbumUploadAccess`, POST de `photos/route.ts`, `validateActiveAlbumForCameraConnection`). Tests en Task 3.
2. **Un miembro con una foto en un álbum de agencia pide `/api/fotografo/pedidos` o la descarga de un pedido**: no debe ver ese pedido ni descargarlo; el dueño sigue viéndolo. Tests en Task 4.
3. **El dueño intenta unirse a su propia agencia con el link, o usar un link revocado/regenerado**: error claro, sin crear filas. Tests en Task 8.
4. **Porcentajes fuera de rango o con texto** ("30%", "-5", "150", "", "abc"): 400 con mensaje en español; vacío en el porcentaje de un miembro = "usa el general". Tests en Task 2.
5. **Un miembro dado de baja que vuelve por link o solicitud**: se reactiva la misma fila (sin duplicar por el `@@unique`) y vuelve a aceptar condiciones. Tests en Task 2 y Task 8.

---

## File Structure

```
packages/db/prisma/schema.prisma                                   (modificar: 5 modelos + back-relations en User y Album)
packages/db/prisma/migrations/20261120120000_clf_agencias/migration.sql (crear)

apps/compramelafoto/lib/agencies/
  rules.ts            reglas puras: porcentajes, estados, permisos, condiciones, distancia
  rules.test.ts
  queries.ts          lecturas/escrituras Prisma reutilizadas por las rutas
  access.ts           ¿puede este usuario subir a este álbum? (usa queries)
  access.test.ts
  invite-token.ts     generar link y resolver token
  invite-token.test.ts

apps/compramelafoto/app/api/dashboard/albums/[id]/photos/upload-helpers.ts   (modificar)
apps/compramelafoto/app/api/dashboard/albums/[id]/photos/route.ts            (modificar POST)
apps/compramelafoto/lib/camera-connection/camera-connection-service.ts       (modificar)
apps/compramelafoto/app/api/fotografo/pedidos/route.ts                       (modificar where)
apps/compramelafoto/app/api/fotografo/pedidos/[orderId]/download/route.ts    (modificar)

apps/compramelafoto/app/api/fotografo/agencias/
  mi-agencia/route.ts                  GET, POST (crear), PATCH (configuración)
  mi-agencia/route.test.ts
  mi-agencia/equipo/route.ts           GET (miembros y solicitudes)
  mi-agencia/equipo/[memberId]/route.ts PATCH (porcentaje, aceptar, rechazar, baja)
  mi-agencia/equipo/route.test.ts
  mi-agencia/invitacion/route.ts       POST (generar link nuevo)
  mi-agencia/albumes/route.ts          GET, POST (vincular), DELETE (desvincular)
  mi-agencia/lugares/route.ts          GET, POST, DELETE
  mi-agencia/albumes-lugares.test.ts
  unirse/route.ts                      GET (vista previa por token), POST (aceptar y unirse)
  unirse/route.test.ts
  mis-agencias/route.ts                GET
  mis-agencias/[agencyId]/condiciones/route.ts POST (aceptar condiciones vigentes)
  mis-agencias/route.test.ts
  directorio/route.ts                  GET (cercanas), POST (pedir sumarse)
  directorio/route.test.ts

apps/compramelafoto/config/navigation.ts            (modificar: ítem Agencias)
apps/compramelafoto/components/agencies/AgencyPageFrame.tsx   marco común de página
apps/compramelafoto/components/agencies/AgencyMapPicker.tsx   mapa editable (envuelve LocationMap)
apps/compramelafoto/app/fotografo/agencias/page.tsx            hub con las tres explicaciones
apps/compramelafoto/app/fotografo/agencias/mi-agencia/page.tsx
apps/compramelafoto/app/fotografo/agencias/directorio/page.tsx
apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx
apps/compramelafoto/app/agencias/unirse/page.tsx               página del link de invitación

apps/compramelafoto/vitest.bot.config.ts            (modificar: include)
```

---

### Task 1: Schema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `User` ~línea 36, modelo `Album` ~línea 2251, y modelos nuevos al final del bloque de CLF)
- Create: `packages/db/prisma/migrations/20261120120000_clf_agencias/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `Agency`, `AgencyMember`, `AgencyInvite`, `AgencyAlbum`, `AgencyPlace` (campos exactos abajo); `prisma.agency`, `prisma.agencyMember`, `prisma.agencyInvite`, `prisma.agencyAlbum`, `prisma.agencyPlace`; back-relations `User.ownedAgency`, `User.agencyMemberships`, `Album.agencyAlbum`.

- [ ] **Step 1: Instalar dependencias del worktree (una sola vez)**

Run: `cd /Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia && pnpm install --frozen-lockfile`
Expected: termina sin errores y corre `prisma generate` en el postinstall.

- [ ] **Step 2: Agregar los modelos al schema**

Agregar al final de `packages/db/prisma/schema.prisma`:

```prisma
/// Modo agencia (CLF): una empresa de fotografía con un equipo de fotógrafos que suben a sus álbumes.
model Agency {
  id                    Int            @id @default(autoincrement())
  ownerUserId           Int            @unique
  name                  String
  logoUrl               String?
  description           String?
  /// Porcentaje general del fotógrafo en puntos básicos (3000 = 30 %).
  defaultCommissionBps  Int            @default(3000)
  directoryListed       Boolean        @default(false)
  directoryLat          Float?
  directoryLng          Float?
  directoryRadiusKm     Int            @default(50)
  directoryCity         String?
  notFoundSearchEnabled Boolean        @default(false)
  /// IMMEDIATE | AWAIT_FILTER (etapa 2).
  publishMode           String         @default("IMMEDIATE")
  /// Días que se ve cada foto desde que se sacó (etapa 5).
  photoVisibilityDays   Int            @default(30)
  /// Condiciones propias; null = texto por defecto (lib/agencies/rules.ts).
  termsText             String?
  termsVersion          Int            @default(1)
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
  owner                 User           @relation("AgencyOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)
  members               AgencyMember[]
  invites               AgencyInvite[]
  albums                AgencyAlbum[]
  places                AgencyPlace[]

  @@index([directoryListed])
}

model AgencyMember {
  id                   Int       @id @default(autoincrement())
  agencyId             Int
  userId               Int
  /// REQUESTED | ACTIVE | REJECTED | REMOVED
  status               String    @default("REQUESTED")
  /// null = usa Agency.defaultCommissionBps.
  commissionBps        Int?
  termsVersionAccepted Int?
  termsAcceptedAt      DateTime?
  termsAcceptedText    String?
  requestMessage       String?
  joinedAt             DateTime?
  removedAt            DateTime?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  agency               Agency    @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  user                 User      @relation("AgencyMemberUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([agencyId, userId])
  @@index([userId])
}

model AgencyInvite {
  id              String    @id @default(cuid())
  agencyId        Int
  tokenHash       String    @unique
  createdByUserId Int
  useCount        Int       @default(0)
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())
  agency          Agency    @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  @@index([agencyId])
}

model AgencyAlbum {
  id        Int      @id @default(autoincrement())
  agencyId  Int
  albumId   Int      @unique
  createdAt DateTime @default(now())
  agency    Agency   @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  album     Album    @relation(fields: [albumId], references: [id], onDelete: Cascade)

  @@index([agencyId])
}

model AgencyPlace {
  id        Int      @id @default(autoincrement())
  agencyId  Int
  name      String
  lat       Float
  lng       Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  agency    Agency   @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  @@index([agencyId])
}
```

En `model User {` agregar, junto a `fotoOfficeInterests` (~línea 245):

```prisma
  ownedAgency                           Agency?                                @relation("AgencyOwner")
  agencyMemberships                     AgencyMember[]                         @relation("AgencyMemberUser")
```

En `model Album {` agregar, junto a `packSelectionSessions` (~línea 2378):

```prisma
  agencyAlbum                     AgencyAlbum?
```

- [ ] **Step 3: Escribir la migración**

Create `packages/db/prisma/migrations/20261120120000_clf_agencias/migration.sql`:

```sql
-- Modo agencia de CompraMeLaFoto (etapa 1): crea Agency, AgencyMember, AgencyInvite, AgencyAlbum y
-- AgencyPlace. Sólo crea tablas nuevas: no toca ninguna existente, no borra ni actualiza filas. El schema es
-- compartido: se aplica a mano en las cinco bases (sólo CLF la usa) y se registra con el checksum del archivo.

-- CreateTable
CREATE TABLE "Agency" (
    "id" SERIAL NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 3000,
    "directoryListed" BOOLEAN NOT NULL DEFAULT false,
    "directoryLat" DOUBLE PRECISION,
    "directoryLng" DOUBLE PRECISION,
    "directoryRadiusKm" INTEGER NOT NULL DEFAULT 50,
    "directoryCity" TEXT,
    "notFoundSearchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishMode" TEXT NOT NULL DEFAULT 'IMMEDIATE',
    "photoVisibilityDays" INTEGER NOT NULL DEFAULT 30,
    "termsText" TEXT,
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Agency_defaultCommissionBps_check" CHECK ("defaultCommissionBps" BETWEEN 0 AND 10000),
    CONSTRAINT "Agency_publishMode_check" CHECK ("publishMode" IN ('IMMEDIATE','AWAIT_FILTER'))
);

-- CreateTable
CREATE TABLE "AgencyMember" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "commissionBps" INTEGER,
    "termsVersionAccepted" INTEGER,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsAcceptedText" TEXT,
    "requestMessage" TEXT,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgencyMember_status_check" CHECK ("status" IN ('REQUESTED','ACTIVE','REJECTED','REMOVED')),
    CONSTRAINT "AgencyMember_commissionBps_check" CHECK ("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 10000)
);

-- CreateTable
CREATE TABLE "AgencyInvite" (
    "id" TEXT NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAlbum" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyPlace" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_ownerUserId_key" ON "Agency"("ownerUserId");
CREATE INDEX "Agency_directoryListed_idx" ON "Agency"("directoryListed");
CREATE UNIQUE INDEX "AgencyMember_agencyId_userId_key" ON "AgencyMember"("agencyId", "userId");
CREATE INDEX "AgencyMember_userId_idx" ON "AgencyMember"("userId");
CREATE UNIQUE INDEX "AgencyInvite_tokenHash_key" ON "AgencyInvite"("tokenHash");
CREATE INDEX "AgencyInvite_agencyId_idx" ON "AgencyInvite"("agencyId");
CREATE UNIQUE INDEX "AgencyAlbum_albumId_key" ON "AgencyAlbum"("albumId");
CREATE INDEX "AgencyAlbum_agencyId_idx" ON "AgencyAlbum"("agencyId");
CREATE INDEX "AgencyPlace_agencyId_idx" ON "AgencyPlace"("agencyId");

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyInvite" ADD CONSTRAINT "AgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyAlbum" ADD CONSTRAINT "AgencyAlbum_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyAlbum" ADD CONSTRAINT "AgencyAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyPlace" ADD CONSTRAINT "AgencyPlace_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Validar schema y que el SQL coincide con Prisma**

Run: `cd packages/db && pnpm exec prisma validate && pnpm exec prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` y cliente generado.

Run: `cd packages/db && pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script`
Expected: no aparece ninguna sentencia sobre `Agency*` (si el repo ya tenía deriva previa en otras tablas, ignorarla; anotar en el commit que no es de esta migración). Si no hay `SHADOW_DATABASE_URL` disponible, saltear este paso y comparar a ojo nombres de columnas, tipos y defaults del Step 2 contra el Step 3.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261120120000_clf_agencias
git commit -m "Modo agencia: tablas de agencia, equipo, invitaciones, álbumes y lugares"
```

---

### Task 2: Reglas puras de agencia

**Files:**
- Create: `apps/compramelafoto/lib/agencies/rules.ts`
- Create: `apps/compramelafoto/lib/agencies/rules.test.ts`
- Modify: `apps/compramelafoto/vitest.bot.config.ts` (agregar a `include`)

**Interfaces:**
- Produces:
  - `type AgencyMemberStatus = "REQUESTED" | "ACTIVE" | "REJECTED" | "REMOVED"`
  - `DEFAULT_COMMISSION_BPS = 3000`
  - `DEFAULT_AGENCY_TERMS: string`
  - `parseCommissionPercent(input: unknown, opts?: { allowEmpty?: boolean }): { ok: true; bps: number | null } | { ok: false; error: string }`
  - `bpsToPercentLabel(bps: number): string` → `"30 %"`, `"27,5 %"`
  - `effectiveCommissionBps(member: { commissionBps: number | null }, agency: { defaultCommissionBps: number }): number`
  - `resolveAgencyTerms(agency: { termsText: string | null }): string`
  - `memberCanUpload(member: { status: string; termsVersionAccepted: number | null } | null, agency: { termsVersion: number }): boolean`
  - `memberNeedsTerms(member: { status: string; termsVersionAccepted: number | null }, agency: { termsVersion: number }): boolean`
  - `planJoin(existing: { status: string } | null): { action: "create" } | { action: "reactivate" } | { action: "already_active" }`
  - `planRequest(existing: { status: string } | null): { action: "create" } | { action: "reopen" } | { action: "already_active" } | { action: "already_requested" }`
  - `validateAgencyInput(body: unknown): { ok: true; data: AgencyInput } | { ok: false; error: string }` con `type AgencyInput = { name: string; description: string | null; defaultCommissionBps: number; directoryListed: boolean; directoryLat: number | null; directoryLng: number | null; directoryRadiusKm: number; directoryCity: string | null; notFoundSearchEnabled: boolean; termsText: string | null }`
  - `sortByDistanceKm<T extends { lat: number; lng: number }>(items: T[], from: { lat: number; lng: number }): Array<T & { distanceKm: number }>`

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/lib/agencies/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENCY_TERMS,
  bpsToPercentLabel,
  effectiveCommissionBps,
  memberCanUpload,
  memberNeedsTerms,
  parseCommissionPercent,
  planJoin,
  planRequest,
  resolveAgencyTerms,
  sortByDistanceKm,
  validateAgencyInput,
} from "./rules";

describe("parseCommissionPercent", () => {
  it("acepta números y textos con coma", () => {
    expect(parseCommissionPercent(30)).toEqual({ ok: true, bps: 3000 });
    expect(parseCommissionPercent("27,5")).toEqual({ ok: true, bps: 2750 });
    expect(parseCommissionPercent("0")).toEqual({ ok: true, bps: 0 });
    expect(parseCommissionPercent("100")).toEqual({ ok: true, bps: 10000 });
  });
  it("rechaza fuera de rango, texto y símbolos", () => {
    for (const bad of ["-5", "150", "abc", "30%", null, undefined]) {
      const r = parseCommissionPercent(bad);
      expect(r.ok).toBe(false);
    }
    const r = parseCommissionPercent("150");
    expect(r.ok === false && r.error).toBe("El porcentaje tiene que estar entre 0 y 100.");
  });
  it("vacío sólo si se permite y devuelve null", () => {
    expect(parseCommissionPercent("", { allowEmpty: true })).toEqual({ ok: true, bps: null });
    expect(parseCommissionPercent(null, { allowEmpty: true })).toEqual({ ok: true, bps: null });
    expect(parseCommissionPercent("").ok).toBe(false);
  });
  it("redondea a un decimal", () => {
    expect(parseCommissionPercent("33.33")).toEqual({ ok: true, bps: 3330 });
  });
});

describe("bpsToPercentLabel", () => {
  it("formatea con coma decimal", () => {
    expect(bpsToPercentLabel(3000)).toBe("30 %");
    expect(bpsToPercentLabel(2750)).toBe("27,5 %");
  });
});

describe("effectiveCommissionBps", () => {
  it("usa el del miembro si tiene, si no el general", () => {
    expect(effectiveCommissionBps({ commissionBps: 3500 }, { defaultCommissionBps: 3000 })).toBe(3500);
    expect(effectiveCommissionBps({ commissionBps: 0 }, { defaultCommissionBps: 3000 })).toBe(0);
    expect(effectiveCommissionBps({ commissionBps: null }, { defaultCommissionBps: 3000 })).toBe(3000);
  });
});

describe("condiciones y permisos", () => {
  it("texto por defecto si la agencia no cargó uno", () => {
    expect(resolveAgencyTerms({ termsText: null })).toBe(DEFAULT_AGENCY_TERMS);
    expect(resolveAgencyTerms({ termsText: "   " })).toBe(DEFAULT_AGENCY_TERMS);
    expect(resolveAgencyTerms({ termsText: "Mis reglas" })).toBe("Mis reglas");
  });
  it("sólo sube el miembro ACTIVE con las condiciones vigentes", () => {
    const agency = { termsVersion: 2 };
    expect(memberCanUpload({ status: "ACTIVE", termsVersionAccepted: 2 }, agency)).toBe(true);
    expect(memberCanUpload({ status: "ACTIVE", termsVersionAccepted: 1 }, agency)).toBe(false);
    expect(memberCanUpload({ status: "ACTIVE", termsVersionAccepted: null }, agency)).toBe(false);
    for (const status of ["REQUESTED", "REJECTED", "REMOVED"]) {
      expect(memberCanUpload({ status, termsVersionAccepted: 2 }, agency)).toBe(false);
    }
    expect(memberCanUpload(null, agency)).toBe(false);
  });
  it("pide aceptar de nuevo cuando cambió la versión", () => {
    expect(memberNeedsTerms({ status: "ACTIVE", termsVersionAccepted: 1 }, { termsVersion: 2 })).toBe(true);
    expect(memberNeedsTerms({ status: "ACTIVE", termsVersionAccepted: 2 }, { termsVersion: 2 })).toBe(false);
    expect(memberNeedsTerms({ status: "REMOVED", termsVersionAccepted: 1 }, { termsVersion: 2 })).toBe(false);
  });
});

describe("planJoin y planRequest", () => {
  it("link de invitación", () => {
    expect(planJoin(null)).toEqual({ action: "create" });
    expect(planJoin({ status: "ACTIVE" })).toEqual({ action: "already_active" });
    for (const status of ["REQUESTED", "REJECTED", "REMOVED"]) {
      expect(planJoin({ status })).toEqual({ action: "reactivate" });
    }
  });
  it("solicitud desde el directorio", () => {
    expect(planRequest(null)).toEqual({ action: "create" });
    expect(planRequest({ status: "ACTIVE" })).toEqual({ action: "already_active" });
    expect(planRequest({ status: "REQUESTED" })).toEqual({ action: "already_requested" });
    expect(planRequest({ status: "REJECTED" })).toEqual({ action: "reopen" });
    expect(planRequest({ status: "REMOVED" })).toEqual({ action: "reopen" });
  });
});

describe("validateAgencyInput", () => {
  it("normaliza lo mínimo", () => {
    const r = validateAgencyInput({ name: "  Fotoshow  ", defaultCommissionPercent: "30" });
    expect(r).toEqual({
      ok: true,
      data: {
        name: "Fotoshow",
        description: null,
        defaultCommissionBps: 3000,
        directoryListed: false,
        directoryLat: null,
        directoryLng: null,
        directoryRadiusKm: 50,
        directoryCity: null,
        notFoundSearchEnabled: false,
        termsText: null,
      },
    });
  });
  it("sin porcentaje usa 30 %", () => {
    const r = validateAgencyInput({ name: "X" });
    expect(r.ok && r.data.defaultCommissionBps).toBe(3000);
  });
  it("exige nombre", () => {
    expect(validateAgencyInput({ name: "  " })).toEqual({ ok: false, error: "Poné el nombre de la agencia." });
  });
  it("para aparecer en el directorio exige el punto en el mapa", () => {
    const r = validateAgencyInput({ name: "X", directoryListed: true });
    expect(r).toEqual({ ok: false, error: "Para aparecer en el directorio marcá tu zona en el mapa." });
    const ok = validateAgencyInput({ name: "X", directoryListed: true, directoryLat: -38.0, directoryLng: -57.55, directoryRadiusKm: 30 });
    expect(ok.ok && ok.data.directoryRadiusKm).toBe(30);
  });
  it("radio entre 1 y 500 km", () => {
    const r = validateAgencyInput({ name: "X", directoryRadiusKm: 0 });
    expect(r).toEqual({ ok: false, error: "El radio tiene que estar entre 1 y 500 km." });
  });
  it("rechaza coordenadas inválidas", () => {
    const r = validateAgencyInput({ name: "X", directoryLat: 200, directoryLng: 0 });
    expect(r).toEqual({ ok: false, error: "La ubicación del mapa no es válida." });
  });
});

describe("sortByDistanceKm", () => {
  it("ordena de más cerca a más lejos y agrega la distancia", () => {
    const mdq = { lat: -38.0055, lng: -57.5426 };
    const out = sortByDistanceKm(
      [
        { id: "bsas", lat: -34.6037, lng: -58.3816 },
        { id: "mdq", lat: -38.0, lng: -57.55 },
      ],
      mdq
    );
    expect(out.map((o) => o.id)).toEqual(["mdq", "bsas"]);
    expect(out[0].distanceKm).toBeLessThan(2);
    expect(out[1].distanceKm).toBeGreaterThan(350);
  });
});
```

- [ ] **Step 2: Registrar el test y verlo fallar**

En `apps/compramelafoto/vitest.bot.config.ts`, dentro de `include: [`, agregar al principio:

```ts
      "lib/agencies/**/*.test.ts",
      "app/api/fotografo/agencias/**/*.test.ts",
      "app/api/dashboard/albums/*/photos/upload-helpers.test.ts",
      "app/api/fotografo/pedidos/agency-privacy.test.ts",
```

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/rules.test.ts`
Expected: FAIL (`Failed to resolve import "./rules"`).

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/lib/agencies/rules.ts`:

```ts
import { haversineDistanceMeters } from "@/lib/geo";
import { isCoordPairValid } from "@/lib/geo/argentina-bounds";

/** Reglas puras del modo agencia: sin base de datos, para poder testearlas. */

export type AgencyMemberStatus = "REQUESTED" | "ACTIVE" | "REJECTED" | "REMOVED";

export const DEFAULT_COMMISSION_BPS = 3000;
const DEFAULT_RADIUS_KM = 50;

export const DEFAULT_AGENCY_TERMS = [
  "Al sumarte a esta agencia aceptás que:",
  "• Las fotos que subas a los álbumes de la agencia se venden sólo por ComprameLaFoto, al precio que fija la agencia.",
  "• Cobrás el porcentaje que la agencia te asigna sobre cada venta de tus fotos.",
  "• No vendés ni entregás por fuera de la plataforma fotos sacadas para la agencia.",
  "• No ves ni guardás datos de los clientes de la agencia.",
  "• La agencia puede darte de baja; tus fotos ya subidas siguen en sus álbumes.",
].join("\n");

export function parseCommissionPercent(
  input: unknown,
  opts: { allowEmpty?: boolean } = {}
): { ok: true; bps: number | null } | { ok: false; error: string } {
  const empty = input === null || input === undefined || (typeof input === "string" && input.trim() === "");
  if (empty) {
    return opts.allowEmpty ? { ok: true, bps: null } : { ok: false, error: "Poné un porcentaje." };
  }
  let n: number;
  if (typeof input === "number") n = input;
  else if (typeof input === "string" && /^\s*\d+([.,]\d+)?\s*$/.test(input)) n = Number(input.trim().replace(",", "."));
  else return { ok: false, error: "El porcentaje tiene que ser un número, por ejemplo 30." };
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, error: "El porcentaje tiene que estar entre 0 y 100." };
  }
  return { ok: true, bps: Math.round(Math.round(n * 10) * 10) };
}

export function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(".", ",");
  return `${text} %`;
}

export function effectiveCommissionBps(
  member: { commissionBps: number | null },
  agency: { defaultCommissionBps: number }
): number {
  return member.commissionBps ?? agency.defaultCommissionBps;
}

export function resolveAgencyTerms(agency: { termsText: string | null }): string {
  const t = agency.termsText?.trim();
  return t ? t : DEFAULT_AGENCY_TERMS;
}

export function memberCanUpload(
  member: { status: string; termsVersionAccepted: number | null } | null,
  agency: { termsVersion: number }
): boolean {
  return Boolean(member && member.status === "ACTIVE" && member.termsVersionAccepted === agency.termsVersion);
}

export function memberNeedsTerms(
  member: { status: string; termsVersionAccepted: number | null },
  agency: { termsVersion: number }
): boolean {
  return member.status === "ACTIVE" && member.termsVersionAccepted !== agency.termsVersion;
}

export function planJoin(
  existing: { status: string } | null
): { action: "create" } | { action: "reactivate" } | { action: "already_active" } {
  if (!existing) return { action: "create" };
  if (existing.status === "ACTIVE") return { action: "already_active" };
  return { action: "reactivate" };
}

export function planRequest(
  existing: { status: string } | null
):
  | { action: "create" }
  | { action: "reopen" }
  | { action: "already_active" }
  | { action: "already_requested" } {
  if (!existing) return { action: "create" };
  if (existing.status === "ACTIVE") return { action: "already_active" };
  if (existing.status === "REQUESTED") return { action: "already_requested" };
  return { action: "reopen" };
}

export type AgencyInput = {
  name: string;
  description: string | null;
  defaultCommissionBps: number;
  directoryListed: boolean;
  directoryLat: number | null;
  directoryLng: number | null;
  directoryRadiusKm: number;
  directoryCity: string | null;
  notFoundSearchEnabled: boolean;
  termsText: string | null;
};

function optionalText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function validateAgencyInput(body: unknown): { ok: true; data: AgencyInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = optionalText(b.name, 120);
  if (!name) return { ok: false, error: "Poné el nombre de la agencia." };

  let defaultCommissionBps = DEFAULT_COMMISSION_BPS;
  if (b.defaultCommissionPercent !== undefined) {
    const p = parseCommissionPercent(b.defaultCommissionPercent);
    if (!p.ok) return p;
    defaultCommissionBps = p.bps as number;
  }

  const lat = optionalNumber(b.directoryLat);
  const lng = optionalNumber(b.directoryLng);
  if (Number.isNaN(lat) || Number.isNaN(lng) || (lat !== null) !== (lng !== null)) {
    return { ok: false, error: "La ubicación del mapa no es válida." };
  }
  if (lat !== null && lng !== null && !isCoordPairValid(lat, lng)) {
    return { ok: false, error: "La ubicación del mapa no es válida." };
  }

  const radiusRaw = optionalNumber(b.directoryRadiusKm);
  const directoryRadiusKm = radiusRaw === null ? DEFAULT_RADIUS_KM : Math.round(radiusRaw);
  if (Number.isNaN(radiusRaw) || directoryRadiusKm < 1 || directoryRadiusKm > 500) {
    return { ok: false, error: "El radio tiene que estar entre 1 y 500 km." };
  }

  const directoryListed = b.directoryListed === true;
  if (directoryListed && (lat === null || lng === null)) {
    return { ok: false, error: "Para aparecer en el directorio marcá tu zona en el mapa." };
  }

  return {
    ok: true,
    data: {
      name,
      description: optionalText(b.description, 600),
      defaultCommissionBps,
      directoryListed,
      directoryLat: lat,
      directoryLng: lng,
      directoryRadiusKm,
      directoryCity: optionalText(b.directoryCity, 120),
      notFoundSearchEnabled: b.notFoundSearchEnabled === true,
      termsText: optionalText(b.termsText, 4000),
    },
  };
}

export function sortByDistanceKm<T extends { lat: number; lng: number }>(
  items: T[],
  from: { lat: number; lng: number }
): Array<T & { distanceKm: number }> {
  return items
    .map((it) => ({ ...it, distanceKm: haversineDistanceMeters(from.lat, from.lng, it.lat, it.lng) / 1000 }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/rules.test.ts`
Expected: PASS (todos). Si `isCoordPairValid` acepta (200, 0), revisar su código: debe rechazar latitudes fuera de ±90; si no lo hace, validar en `validateAgencyInput` con `Math.abs(lat) <= 90 && Math.abs(lng) <= 180` en su lugar.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/rules.ts apps/compramelafoto/lib/agencies/rules.test.ts apps/compramelafoto/vitest.bot.config.ts
git commit -m "Modo agencia: reglas de porcentajes, estados, condiciones y distancia"
```

---

### Task 3: Compuerta de subida para álbumes de agencia

**Files:**
- Create: `apps/compramelafoto/lib/agencies/queries.ts`
- Create: `apps/compramelafoto/lib/agencies/access.ts`
- Create: `apps/compramelafoto/lib/agencies/access.test.ts`
- Modify: `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/upload-helpers.ts:45-73`
- Create: `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/upload-helpers.test.ts`
- Modify: `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/route.ts:304-330`
- Modify: `apps/compramelafoto/lib/camera-connection/camera-connection-service.ts:134-162`

**Interfaces:**
- Consumes: `memberCanUpload` (Task 2).
- Produces:
  - `findAgencyAlbumGate(albumId: number): Promise<{ agencyId: number; ownerUserId: number; termsVersion: number } | null>` (en `queries.ts`)
  - `findMembership(agencyId: number, userId: number): Promise<{ id: number; status: string; termsVersionAccepted: number | null; commissionBps: number | null } | null>` (en `queries.ts`)
  - `checkAgencyAlbumUpload(albumId: number, userId: number): Promise<{ agencyAlbum: false } | { agencyAlbum: true; allowed: boolean; error?: string }>` (en `access.ts`)
  - `AGENCY_UPLOAD_DENIED = "Este álbum es de una agencia: sólo su equipo puede subir fotos."`

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/lib/agencies/access.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const findAgencyAlbumGate = vi.fn();
const findMembership = vi.fn();
vi.mock("./queries", () => ({
  findAgencyAlbumGate: (...a: unknown[]) => findAgencyAlbumGate(...a),
  findMembership: (...a: unknown[]) => findMembership(...a),
}));

import { AGENCY_UPLOAD_DENIED, checkAgencyAlbumUpload } from "./access";

beforeEach(() => {
  findAgencyAlbumGate.mockReset();
  findMembership.mockReset();
});

describe("checkAgencyAlbumUpload", () => {
  it("álbum común: no es de agencia", async () => {
    findAgencyAlbumGate.mockResolvedValue(null);
    expect(await checkAgencyAlbumUpload(1, 9)).toEqual({ agencyAlbum: false });
    expect(findMembership).not.toHaveBeenCalled();
  });
  it("el dueño siempre puede", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
    expect(await checkAgencyAlbumUpload(1, 9)).toEqual({ agencyAlbum: true, allowed: true });
  });
  it("miembro activo con condiciones vigentes puede", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 2 });
    findMembership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 2, commissionBps: null });
    expect(await checkAgencyAlbumUpload(1, 20)).toEqual({ agencyAlbum: true, allowed: true });
    expect(findMembership).toHaveBeenCalledWith(3, 20);
  });
  it("activo con condiciones viejas: tiene que aceptarlas", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 2 });
    findMembership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 1, commissionBps: null });
    expect(await checkAgencyAlbumUpload(1, 20)).toEqual({
      agencyAlbum: true,
      allowed: false,
      error: "La agencia cambió sus condiciones: aceptalas en Agencias → Mis agencias para seguir subiendo.",
    });
  });
  it("cualquier otro: no", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
    for (const m of [null, { id: 1, status: "REQUESTED", termsVersionAccepted: 1, commissionBps: null }, { id: 1, status: "REMOVED", termsVersionAccepted: 1, commissionBps: null }]) {
      findMembership.mockResolvedValue(m);
      expect(await checkAgencyAlbumUpload(1, 20)).toEqual({ agencyAlbum: true, allowed: false, error: AGENCY_UPLOAD_DENIED });
    }
  });
});
```

Create `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/upload-helpers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindUnique = vi.fn();
const checkAgencyAlbumUpload = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { album: { findUnique: (...a: unknown[]) => albumFindUnique(...a) } } }));
vi.mock("@/lib/agencies/access", () => ({
  checkAgencyAlbumUpload: (...a: unknown[]) => checkAgencyAlbumUpload(...a),
}));

import { ensureAlbumUploadAccess } from "./upload-helpers";

beforeEach(() => {
  albumFindUnique.mockReset();
  checkAgencyAlbumUpload.mockReset();
});

describe("ensureAlbumUploadAccess con agencias", () => {
  it("álbum de agencia público: un extraño no puede subir aunque sea público", async () => {
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: true, isHidden: false, eventId: null });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
    expect(await ensureAlbumUploadAccess(1, 20)).toEqual({
      ok: false,
      error: "Este álbum es de una agencia: sólo su equipo puede subir fotos.",
      status: 403,
    });
  });
  it("álbum de agencia: miembro activo puede aunque el álbum esté oculto", async () => {
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: false, isHidden: true, eventId: null });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    expect(await ensureAlbumUploadAccess(1, 20)).toEqual({ ok: true, error: null, status: 200, albumEventId: null });
  });
  it("álbum común: comportamiento de siempre", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: false });
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: true, isHidden: false, eventId: 4 });
    expect(await ensureAlbumUploadAccess(1, 20)).toEqual({ ok: true, error: null, status: 200, albumEventId: 4 });
    albumFindUnique.mockResolvedValue({ userId: 9, isPublic: false, isHidden: false, eventId: null });
    expect((await ensureAlbumUploadAccess(1, 20)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/access.test.ts "app/api/dashboard/albums/[id]/photos/upload-helpers.test.ts"`
Expected: FAIL (no existe `./access`; el helper no consulta la agencia).

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/lib/agencies/queries.ts`:

```ts
import { prisma } from "@/lib/prisma";

/** Acceso a datos del modo agencia que reutilizan las rutas y la compuerta de subida. */

export async function findAgencyAlbumGate(
  albumId: number
): Promise<{ agencyId: number; ownerUserId: number; termsVersion: number } | null> {
  const row = await prisma.agencyAlbum.findUnique({
    where: { albumId },
    select: { agencyId: true, agency: { select: { ownerUserId: true, termsVersion: true } } },
  });
  if (!row) return null;
  return { agencyId: row.agencyId, ownerUserId: row.agency.ownerUserId, termsVersion: row.agency.termsVersion };
}

export async function findMembership(
  agencyId: number,
  userId: number
): Promise<{ id: number; status: string; termsVersionAccepted: number | null; commissionBps: number | null } | null> {
  return prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId } },
    select: { id: true, status: true, termsVersionAccepted: true, commissionBps: true },
  });
}

export async function findOwnedAgency(userId: number) {
  return prisma.agency.findUnique({ where: { ownerUserId: userId } });
}
```

Create `apps/compramelafoto/lib/agencies/access.ts`:

```ts
import { memberCanUpload } from "./rules";
import { findAgencyAlbumGate, findMembership } from "./queries";

export const AGENCY_UPLOAD_DENIED = "Este álbum es de una agencia: sólo su equipo puede subir fotos.";
const AGENCY_TERMS_PENDING =
  "La agencia cambió sus condiciones: aceptalas en Agencias → Mis agencias para seguir subiendo.";

/** ¿Este álbum es de una agencia y, si lo es, este usuario puede subirle fotos? */
export async function checkAgencyAlbumUpload(
  albumId: number,
  userId: number
): Promise<{ agencyAlbum: false } | { agencyAlbum: true; allowed: boolean; error?: string }> {
  const gate = await findAgencyAlbumGate(albumId);
  if (!gate) return { agencyAlbum: false };
  if (gate.ownerUserId === userId) return { agencyAlbum: true, allowed: true };
  const member = await findMembership(gate.agencyId, userId);
  if (memberCanUpload(member, gate)) return { agencyAlbum: true, allowed: true };
  if (member?.status === "ACTIVE") return { agencyAlbum: true, allowed: false, error: AGENCY_TERMS_PENDING };
  return { agencyAlbum: true, allowed: false, error: AGENCY_UPLOAD_DENIED };
}
```

In `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/upload-helpers.ts`, add the import at the top (with the other imports):

```ts
import { checkAgencyAlbumUpload } from "@/lib/agencies/access";
```

and replace the body of `ensureAlbumUploadAccess` (lines 49-73) with:

```ts
export async function ensureAlbumUploadAccess(
  albumId: number,
  userId: number
): Promise<AlbumUploadAccessResult> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { userId: true, isPublic: true, isHidden: true, eventId: true },
  });
  if (!album) {
    return { ok: false, error: "Álbum no encontrado", status: 404 };
  }
  // Álbum de agencia: sólo el dueño y su equipo activo, sea público o no.
  const agency = await checkAgencyAlbumUpload(albumId, userId);
  if (agency.agencyAlbum) {
    if (!agency.allowed) {
      return { ok: false, error: agency.error ?? "No autorizado", status: 403 };
    }
    return { ok: true, error: null, status: 200, albumEventId: album.eventId };
  }
  if (album.userId !== userId) {
    if (!album.isPublic || album.isHidden) {
      return {
        ok: false,
        error: "Este álbum no permite colaboración. Solo el creador puede agregar fotos.",
        status: 403,
      };
    }
  }
  return { ok: true, error: null, status: 200, albumEventId: album.eventId };
}
```

In `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/route.ts` (POST, lines 304-330): replace from `// Verificar que el álbum existe y es público` through the closing `}` of the `if (album.userId !== user.id) {…}` block with:

```ts
    // Mismo criterio que el resto de las subidas (incluye álbumes de agencia).
    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const album = { eventId: access.albumEventId };
```

and add `import { ensureAlbumUploadAccess } from "./upload-helpers";` to its imports if it is not already there. Then search the rest of that POST handler for other uses of `album.` (`grep -n "album\." "app/api/dashboard/albums/[id]/photos/route.ts"`): if it uses anything besides `album.eventId`, re-add that field by keeping the previous `prisma.album.findUnique` select **after** the access check instead of the stub object.

In `apps/compramelafoto/lib/camera-connection/camera-connection-service.ts`, inside `validateActiveAlbumForCameraConnection`, replace the block `if (album.userId !== userId) { if (!album.isPublic || album.isHidden) { … } }` with:

```ts
  const agency = await checkAgencyAlbumUpload(album.id, userId);
  if (agency.agencyAlbum) {
    if (!agency.allowed) {
      return { ok: false, error: agency.error ?? "No autorizado", status: 403 };
    }
  } else if (album.userId !== userId) {
    if (!album.isPublic || album.isHidden) {
      return {
        ok: false,
        error: "Este álbum no permite colaboración. Solo el creador puede usarlo.",
        status: 403,
      };
    }
  }
```

and add `import { checkAgencyAlbumUpload } from "@/lib/agencies/access";` at the top.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies "app/api/dashboard/albums/[id]/photos/upload-helpers.test.ts"`
Expected: PASS.

Run: `cd apps/compramelafoto && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck`
Expected: sin errores nuevos en los archivos tocados (si el typecheck muere por memoria y "devuelve éxito", mirar la salida: tiene que terminar mostrando 0 errores, no un corte).

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies apps/compramelafoto/app/api/dashboard/albums/[id]/photos apps/compramelafoto/lib/camera-connection/camera-connection-service.ts
git commit -m "Modo agencia: sólo el equipo de la agencia sube a sus álbumes"
```

---

### Task 4: Privacidad de pedidos en álbumes de agencia

**Files:**
- Modify: `apps/compramelafoto/app/api/fotografo/pedidos/route.ts:119-127`
- Modify: `apps/compramelafoto/app/api/fotografo/pedidos/[orderId]/download/route.ts:41-55`
- Create: `apps/compramelafoto/app/api/fotografo/pedidos/agency-privacy.test.ts`

**Interfaces:**
- Produces: `digitalOrdersVisibilityWhere(userId: number)` exportada desde `apps/compramelafoto/lib/agencies/order-visibility.ts` (crear) que devuelve el `OR` de `prisma.order.findMany`.

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/app/api/fotografo/pedidos/agency-privacy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canCollaboratorDownloadOrder, digitalOrdersVisibilityWhere } from "@/lib/agencies/order-visibility";

describe("pedidos de álbumes de agencia", () => {
  it("el colaborador no ve pedidos de álbumes de agencia; el dueño sí", () => {
    expect(digitalOrdersVisibilityWhere(7)).toEqual({
      OR: [
        { album: { userId: 7 } },
        { album: { photos: { some: { userId: 7 } }, agencyAlbum: { is: null } } },
      ],
    });
  });
  it("descarga: el colaborador de un álbum de agencia no descarga", () => {
    expect(canCollaboratorDownloadOrder({ isCollaborator: true, isAgencyAlbum: true })).toBe(false);
    expect(canCollaboratorDownloadOrder({ isCollaborator: true, isAgencyAlbum: false })).toBe(true);
    expect(canCollaboratorDownloadOrder({ isCollaborator: false, isAgencyAlbum: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/pedidos/agency-privacy.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/lib/agencies/order-visibility.ts`:

```ts
/**
 * Pedidos de álbumes de agencia: los ve y descarga sólo el dueño. El fotógrafo del equipo
 * ve sus ventas por "Mis agencias" (sin datos del comprador), nunca por Pedidos.
 */
export function digitalOrdersVisibilityWhere(userId: number) {
  return {
    OR: [
      { album: { userId } },
      { album: { photos: { some: { userId } }, agencyAlbum: { is: null } } },
    ],
  };
}

export function canCollaboratorDownloadOrder(input: { isCollaborator: boolean; isAgencyAlbum: boolean }): boolean {
  return input.isCollaborator && !input.isAgencyAlbum;
}
```

In `app/api/fotografo/pedidos/route.ts`, replace:

```ts
          {
            OR: [
              { album: { userId: id } },
              { album: { photos: { some: { userId: id } } } },
            ],
          },
```

with:

```ts
          digitalOrdersVisibilityWhere(id),
```

and add `import { digitalOrdersVisibilityWhere } from "@/lib/agencies/order-visibility";`.

In `app/api/fotografo/pedidos/[orderId]/download/route.ts`, change the select to include the agency mark and the check:

```ts
  const digitalOrder = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      album: { select: { userId: true, agencyAlbum: { select: { id: true } } } },
      items: { select: { photo: { select: { userId: true } } } },
    },
  });
  const isOwner = digitalOrder?.album?.userId === user.id;
  const isCollaborator = canCollaboratorDownloadOrder({
    isCollaborator: Boolean(digitalOrder?.items?.some((it) => it.photo?.userId === user.id)),
    isAgencyAlbum: Boolean(digitalOrder?.album?.agencyAlbum),
  });
```

and add `import { canCollaboratorDownloadOrder } from "@/lib/agencies/order-visibility";`.

- [ ] **Step 4: Run test and typecheck**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/pedidos/agency-privacy.test.ts && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck`
Expected: PASS y 0 errores.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/order-visibility.ts apps/compramelafoto/app/api/fotografo/pedidos
git commit -m "Modo agencia: el equipo no ve ni descarga pedidos de los álbumes de la agencia"
```

---

### Task 5: API "Mi agencia" (crear, ver, configurar)

**Files:**
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/route.test.ts`

**Interfaces:**
- Consumes: `validateAgencyInput`, `resolveAgencyTerms`, `bpsToPercentLabel` (Task 2); `findOwnedAgency` (Task 3).
- Produces: `GET /api/fotografo/agencias/mi-agencia` → `{ agency: AgencyDto | null }`; `POST` (crear) → `{ agency: AgencyDto }` 201; `PATCH` → `{ agency: AgencyDto }`. `AgencyDto = { id, name, description, logoUrl, defaultCommissionBps, defaultCommissionLabel, directoryListed, directoryLat, directoryLng, directoryRadiusKm, directoryCity, notFoundSearchEnabled, termsText, termsVersion, termsEffective }`. `toAgencyDto(agency)` exportada desde `apps/compramelafoto/lib/agencies/dto.ts` (crear).

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const agencyFindUnique = vi.fn();
const agencyCreate = vi.fn();
const agencyUpdate = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agency: {
      findUnique: (...a: unknown[]) => agencyFindUnique(...a),
      create: (...a: unknown[]) => agencyCreate(...a),
      update: (...a: unknown[]) => agencyUpdate(...a),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET, PATCH, POST } from "./route";

const row = {
  id: 3, ownerUserId: 10, name: "Fotoshow", description: null, logoUrl: null, defaultCommissionBps: 3000,
  directoryListed: false, directoryLat: null, directoryLng: null, directoryRadiusKm: 50, directoryCity: null,
  notFoundSearchEnabled: false, termsText: null, termsVersion: 1,
};
const req = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 10 } });
  agencyFindUnique.mockReset();
  agencyCreate.mockReset();
  agencyUpdate.mockReset();
});

describe("mi-agencia", () => {
  it("GET sin agencia devuelve null", async () => {
    agencyFindUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agency: null });
    expect(requireAuth).toHaveBeenCalledWith(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
  });
  it("sin sesión: 401", async () => {
    requireAuth.mockResolvedValue({ error: "No autenticado", user: null });
    expect((await GET()).status).toBe(401);
  });
  it("POST crea con 30 % por defecto", async () => {
    agencyFindUnique.mockResolvedValue(null);
    agencyCreate.mockResolvedValue(row);
    const res = await POST(req({ name: "Fotoshow" }));
    expect(res.status).toBe(201);
    expect(agencyCreate.mock.calls[0][0].data).toMatchObject({ ownerUserId: 10, name: "Fotoshow", defaultCommissionBps: 3000 });
    const body = await res.json();
    expect(body.agency.defaultCommissionLabel).toBe("30 %");
    expect(body.agency.termsEffective).toContain("Al sumarte a esta agencia");
    expect(body.agency).not.toHaveProperty("ownerUserId");
  });
  it("POST si ya tiene agencia: 409", async () => {
    agencyFindUnique.mockResolvedValue(row);
    const res = await POST(req({ name: "Otra" }));
    expect(res.status).toBe(409);
    expect(agencyCreate).not.toHaveBeenCalled();
  });
  it("POST con datos inválidos: 400 con el mensaje", async () => {
    agencyFindUnique.mockResolvedValue(null);
    const res = await POST(req({ name: "X", defaultCommissionPercent: "150" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El porcentaje tiene que estar entre 0 y 100." });
  });
  it("PATCH que cambia las condiciones sube la versión", async () => {
    agencyFindUnique.mockResolvedValue(row);
    agencyUpdate.mockResolvedValue({ ...row, termsText: "Nuevas", termsVersion: 2 });
    const res = await PATCH(req({ name: "Fotoshow", termsText: "Nuevas" }));
    expect(res.status).toBe(200);
    expect(agencyUpdate.mock.calls[0][0].data.termsVersion).toBe(2);
  });
  it("PATCH sin cambiar condiciones no sube la versión", async () => {
    agencyFindUnique.mockResolvedValue(row);
    agencyUpdate.mockResolvedValue(row);
    await PATCH(req({ name: "Fotoshow 2" }));
    expect(agencyUpdate.mock.calls[0][0].data.termsVersion).toBe(1);
  });
  it("PATCH sin agencia: 404", async () => {
    agencyFindUnique.mockResolvedValue(null);
    expect((await PATCH(req({ name: "X" }))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/mi-agencia/route.test.ts`
Expected: FAIL (no existe la ruta).

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/lib/agencies/dto.ts`:

```ts
import { bpsToPercentLabel, resolveAgencyTerms } from "./rules";

type AgencyRow = {
  id: number; name: string; description: string | null; logoUrl: string | null; defaultCommissionBps: number;
  directoryListed: boolean; directoryLat: number | null; directoryLng: number | null; directoryRadiusKm: number;
  directoryCity: string | null; notFoundSearchEnabled: boolean; termsText: string | null; termsVersion: number;
};

export function toAgencyDto(a: AgencyRow) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    logoUrl: a.logoUrl,
    defaultCommissionBps: a.defaultCommissionBps,
    defaultCommissionLabel: bpsToPercentLabel(a.defaultCommissionBps),
    directoryListed: a.directoryListed,
    directoryLat: a.directoryLat,
    directoryLng: a.directoryLng,
    directoryRadiusKm: a.directoryRadiusKm,
    directoryCity: a.directoryCity,
    notFoundSearchEnabled: a.notFoundSearchEnabled,
    termsText: a.termsText,
    termsVersion: a.termsVersion,
    termsEffective: resolveAgencyTerms(a),
  };
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { validateAgencyInput } from "@/lib/agencies/rules";
import { toAgencyDto } from "@/lib/agencies/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) };
  return { user };
}

export async function GET() {
  const a = await auth();
  if ("res" in a) return a.res;
  const agency = await prisma.agency.findUnique({ where: { ownerUserId: a.user.id } });
  return NextResponse.json({ agency: agency ? toAgencyDto(agency) : null });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const existing = await prisma.agency.findUnique({ where: { ownerUserId: a.user.id } });
  if (existing) return NextResponse.json({ error: "Ya tenés una agencia." }, { status: 409 });
  const parsed = validateAgencyInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const agency = await prisma.agency.create({ data: { ownerUserId: a.user.id, ...parsed.data } });
  return NextResponse.json({ agency: toAgencyDto(agency) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const existing = await prisma.agency.findUnique({ where: { ownerUserId: a.user.id } });
  if (!existing) return NextResponse.json({ error: "Todavía no creaste tu agencia." }, { status: 404 });
  const parsed = validateAgencyInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // Cambiar las condiciones obliga al equipo a aceptarlas de nuevo antes de seguir subiendo.
  const termsChanged = (parsed.data.termsText ?? null) !== (existing.termsText ?? null);
  const agency = await prisma.agency.update({
    where: { id: existing.id },
    data: { ...parsed.data, termsVersion: termsChanged ? existing.termsVersion + 1 : existing.termsVersion },
  });
  return NextResponse.json({ agency: toAgencyDto(agency) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/mi-agencia/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/dto.ts apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/route.ts apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/route.test.ts
git commit -m "Modo agencia: crear, ver y configurar la agencia"
```

---

### Task 6: API del equipo (miembros, solicitudes, link de invitación)

**Files:**
- Create: `apps/compramelafoto/lib/agencies/invite-token.ts`
- Create: `apps/compramelafoto/lib/agencies/invite-token.test.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/[memberId]/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/invitacion/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/route.test.ts`

**Interfaces:**
- Consumes: `parseCommissionPercent`, `effectiveCommissionBps`, `bpsToPercentLabel`, `memberNeedsTerms` (Task 2); `hashToken` (`@/lib/token-hash`).
- Produces:
  - `createInviteToken(): { token: string; tokenHash: string }`; `buildInviteUrl(baseUrl: string, token: string): string` → `${baseUrl}/agencias/unirse?token=${token}`; `appBaseUrl(): string`
  - `requireOwnedAgency()` en `lib/agencies/owner-auth.ts` → `{ user, agency } | { res: NextResponse }`
  - `GET /api/fotografo/agencias/mi-agencia/equipo` → `{ members: MemberDto[], requests: MemberDto[] }` con `MemberDto = { id, userId, name, email, status, commissionBps, commissionLabel, usesDefault, needsTerms, requestMessage, joinedAt }`
  - `PATCH /api/fotografo/agencias/mi-agencia/equipo/[memberId]` body `{ action: "setCommission", percent: string|number|null } | { action: "accept" } | { action: "reject" } | { action: "remove" }`
  - `POST /api/fotografo/agencias/mi-agencia/invitacion` → `{ url: string }` (revoca los links anteriores)

- [ ] **Step 1: Write the failing tests**

Create `apps/compramelafoto/lib/agencies/invite-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/token-hash";
import { buildInviteUrl, createInviteToken } from "./invite-token";

describe("invite-token", () => {
  it("genera un token largo y su hash", () => {
    const { token, tokenHash } = createInviteToken();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(createInviteToken().token).not.toBe(token);
  });
  it("arma la URL", () => {
    expect(buildInviteUrl("https://www.compramelafoto.com", "abc")).toBe("https://www.compramelafoto.com/agencias/unirse?token=abc");
    expect(buildInviteUrl("https://www.compramelafoto.com/", "abc")).toBe("https://www.compramelafoto.com/agencias/unirse?token=abc");
  });
});
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const agencyFindUnique = vi.fn();
const memberFindMany = vi.fn();
const memberFindFirst = vi.fn();
const memberUpdate = vi.fn();
const inviteUpdateMany = vi.fn();
const inviteCreate = vi.fn();
const transaction = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agency: { findUnique: (...a: unknown[]) => agencyFindUnique(...a) },
    agencyMember: {
      findMany: (...a: unknown[]) => memberFindMany(...a),
      findFirst: (...a: unknown[]) => memberFindFirst(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
    agencyInvite: {
      updateMany: (...a: unknown[]) => inviteUpdateMany(...a),
      create: (...a: unknown[]) => inviteCreate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET } from "./route";
import { PATCH } from "./[memberId]/route";
import { POST as POST_INVITE } from "../invitacion/route";

const agency = { id: 3, ownerUserId: 10, defaultCommissionBps: 3000, termsVersion: 2, termsText: null };
const req = (body: unknown) => ({ json: async () => body }) as any;
const ctx = (memberId: string) => ({ params: Promise.resolve({ memberId }) });

beforeEach(() => {
  for (const f of [requireAuth, agencyFindUnique, memberFindMany, memberFindFirst, memberUpdate, inviteUpdateMany, inviteCreate, transaction]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 10 } });
  agencyFindUnique.mockResolvedValue(agency);
  transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe("equipo", () => {
  it("GET separa miembros y solicitudes y calcula porcentajes", async () => {
    memberFindMany.mockResolvedValue([
      { id: 1, userId: 20, status: "ACTIVE", commissionBps: null, termsVersionAccepted: 1, requestMessage: null, joinedAt: new Date("2026-10-20T12:00:00Z"), user: { name: "Juan", email: "juan@x.com" } },
      { id: 2, userId: 21, status: "REQUESTED", commissionBps: null, termsVersionAccepted: 2, requestMessage: "Hola", joinedAt: null, user: { name: "Pedro", email: "p@x.com" } },
      { id: 3, userId: 22, status: "ACTIVE", commissionBps: 3500, termsVersionAccepted: 2, requestMessage: null, joinedAt: null, user: { name: "Ana", email: "a@x.com" } },
    ]);
    const body = await (await GET()).json();
    expect(body.members.map((m: any) => m.name)).toEqual(["Juan", "Ana"]);
    expect(body.members[0]).toMatchObject({ commissionLabel: "30 %", usesDefault: true, needsTerms: true });
    expect(body.members[1]).toMatchObject({ commissionLabel: "35 %", usesDefault: false, needsTerms: false });
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0]).toMatchObject({ name: "Pedro", requestMessage: "Hola" });
  });
  it("GET sin agencia: 404", async () => {
    agencyFindUnique.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });
  it("PATCH no toca miembros de otra agencia", async () => {
    memberFindFirst.mockResolvedValue(null);
    const res = await PATCH(req({ action: "remove" }), ctx("99"));
    expect(res.status).toBe(404);
    expect(memberFindFirst.mock.calls[0][0].where).toEqual({ id: 99, agencyId: 3 });
  });
  it("PATCH setCommission vacío = usa el general", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    memberUpdate.mockResolvedValue({});
    const res = await PATCH(req({ action: "setCommission", percent: "" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(memberUpdate.mock.calls[0][0].data).toEqual({ commissionBps: null });
  });
  it("PATCH setCommission inválido: 400", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    const res = await PATCH(req({ action: "setCommission", percent: "150" }), ctx("1"));
    expect(res.status).toBe(400);
  });
  it("PATCH accept sólo sobre solicitudes", async () => {
    memberFindFirst.mockResolvedValue({ id: 2, status: "ACTIVE" });
    expect((await PATCH(req({ action: "accept" }), ctx("2"))).status).toBe(409);
    memberFindFirst.mockResolvedValue({ id: 2, status: "REQUESTED" });
    memberUpdate.mockResolvedValue({});
    expect((await PATCH(req({ action: "accept" }), ctx("2"))).status).toBe(200);
    expect(memberUpdate.mock.calls[0][0].data.status).toBe("ACTIVE");
    expect(memberUpdate.mock.calls[0][0].data.joinedAt).toBeInstanceOf(Date);
  });
  it("PATCH remove marca la baja", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    memberUpdate.mockResolvedValue({});
    await PATCH(req({ action: "remove" }), ctx("1"));
    expect(memberUpdate.mock.calls[0][0].data.status).toBe("REMOVED");
    expect(memberUpdate.mock.calls[0][0].data.removedAt).toBeInstanceOf(Date);
  });
  it("PATCH acción desconocida: 400", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    expect((await PATCH(req({ action: "nada" }), ctx("1"))).status).toBe(400);
  });
  it("POST invitación revoca las anteriores y devuelve el link", async () => {
    inviteUpdateMany.mockResolvedValue({ count: 1 });
    inviteCreate.mockResolvedValue({});
    const res = await POST_INVITE();
    const body = await res.json();
    expect(body.url).toMatch(/\/agencias\/unirse\?token=[a-f0-9]{48}$/);
    expect(inviteUpdateMany.mock.calls[0][0]).toMatchObject({ where: { agencyId: 3, revokedAt: null } });
    expect(inviteCreate.mock.calls[0][0].data).toMatchObject({ agencyId: 3, createdByUserId: 10 });
    expect(inviteCreate.mock.calls[0][0].data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/invite-token.test.ts app/api/fotografo/agencias/mi-agencia/equipo`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/lib/agencies/invite-token.ts`:

```ts
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";

/** El token sólo se muestra al generarlo; en la base queda el hash. */
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function buildInviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/agencias/unirse?token=${token}`;
}

/** Misma regla que `resolveAppUrl` de las invitaciones escolares, sin arrastrar sus imports de correo. */
export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!raw) return "http://localhost:3000";
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}
```

Create `apps/compramelafoto/lib/agencies/owner-auth.ts` (compartido por las rutas del dueño):

```ts
import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/** Sesión de fotógrafo + su agencia. Devuelve una respuesta de error lista si falta algo. */
export async function requireOwnedAgency() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) } as const;
  const agency = await prisma.agency.findUnique({ where: { ownerUserId: user.id } });
  if (!agency) return { res: NextResponse.json({ error: "Todavía no creaste tu agencia." }, { status: 404 }) } as const;
  return { user, agency } as const;
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";
import { bpsToPercentLabel, effectiveCommissionBps, memberNeedsTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const rows = await prisma.agencyMember.findMany({
    where: { agencyId: a.agency.id, status: { in: ["ACTIVE", "REQUESTED"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, userId: true, status: true, commissionBps: true, termsVersionAccepted: true,
      requestMessage: true, joinedAt: true, user: { select: { name: true, email: true } },
    },
  });
  const dto = rows.map((m) => {
    const bps = effectiveCommissionBps(m, a.agency);
    return {
      id: m.id,
      userId: m.userId,
      name: m.user.name ?? m.user.email,
      email: m.user.email,
      status: m.status,
      commissionBps: bps,
      commissionLabel: bpsToPercentLabel(bps),
      usesDefault: m.commissionBps === null,
      needsTerms: memberNeedsTerms(m, a.agency),
      requestMessage: m.requestMessage,
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    };
  });
  return NextResponse.json({
    members: dto.filter((m) => m.status === "ACTIVE"),
    requests: dto.filter((m) => m.status === "REQUESTED"),
  });
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/equipo/[memberId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";
import { parseCommissionPercent } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const { memberId } = await Promise.resolve(params);
  const id = parseInt(memberId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const member = await prisma.agencyMember.findFirst({ where: { id, agencyId: a.agency.id } });
  if (!member) return NextResponse.json({ error: "No encontramos a ese fotógrafo en tu agencia." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; percent?: unknown };
  switch (body.action) {
    case "setCommission": {
      const p = parseCommissionPercent(body.percent, { allowEmpty: true });
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      await prisma.agencyMember.update({ where: { id }, data: { commissionBps: p.bps } });
      return NextResponse.json({ ok: true });
    }
    case "accept": {
      if (member.status !== "REQUESTED") return NextResponse.json({ error: "Esa solicitud ya no está pendiente." }, { status: 409 });
      await prisma.agencyMember.update({ where: { id }, data: { status: "ACTIVE", joinedAt: new Date(), removedAt: null } });
      return NextResponse.json({ ok: true });
    }
    case "reject": {
      if (member.status !== "REQUESTED") return NextResponse.json({ error: "Esa solicitud ya no está pendiente." }, { status: 409 });
      await prisma.agencyMember.update({ where: { id }, data: { status: "REJECTED" } });
      return NextResponse.json({ ok: true });
    }
    case "remove": {
      if (member.status !== "ACTIVE") return NextResponse.json({ error: "Ese fotógrafo no está activo." }, { status: 409 });
      await prisma.agencyMember.update({ where: { id }, data: { status: "REMOVED", removedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  }
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/invitacion/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";
import { appBaseUrl, buildInviteUrl, createInviteToken } from "@/lib/agencies/invite-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Genera un link nuevo; el anterior deja de funcionar. */
export async function POST() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const { token, tokenHash } = createInviteToken();
  await prisma.$transaction([
    prisma.agencyInvite.updateMany({ where: { agencyId: a.agency.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.agencyInvite.create({ data: { agencyId: a.agency.id, tokenHash, createdByUserId: a.user.id } }),
  ]);
  return NextResponse.json({ url: buildInviteUrl(appBaseUrl(), token) });
}
```

Note: `requireOwnedAgency` uses `prisma.agency.findUnique` — the test mock above already provides it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies app/api/fotografo/agencias`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies apps/compramelafoto/app/api/fotografo/agencias/mi-agencia
git commit -m "Modo agencia: equipo, solicitudes, porcentajes y link de invitación"
```

---

### Task 7: API de álbumes y lugares de la agencia

**Files:**
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/lugares/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes-lugares.test.ts`

**Interfaces:**
- Consumes: `requireOwnedAgency` (Task 6).
- Produces:
  - `GET …/albumes` → `{ linked: Array<{ albumId, title, publicSlug }>, available: Array<{ albumId, title }> }` (`available` = álbumes propios, no borrados, sin agencia, los 100 más nuevos)
  - `POST …/albumes` body `{ albumId }` → 201 / 400 / 404 / 409
  - `DELETE …/albumes?albumId=N` → 200 / 404
  - `GET …/lugares` → `{ places: Array<{ id, name, lat, lng }> }`; `POST` body `{ name, lat, lng }` → 201; `DELETE …/lugares?id=N`

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes-lugares.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOwnedAgency = vi.fn();
const albumFindFirst = vi.fn();
const albumFindMany = vi.fn();
const agencyAlbumFindMany = vi.fn();
const agencyAlbumCreate = vi.fn();
const agencyAlbumDeleteMany = vi.fn();
const placeFindMany = vi.fn();
const placeCreate = vi.fn();
const placeDeleteMany = vi.fn();
vi.mock("@/lib/agencies/owner-auth", () => ({ requireOwnedAgency: (...a: unknown[]) => requireOwnedAgency(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findFirst: (...a: unknown[]) => albumFindFirst(...a), findMany: (...a: unknown[]) => albumFindMany(...a) },
    agencyAlbum: {
      findMany: (...a: unknown[]) => agencyAlbumFindMany(...a),
      create: (...a: unknown[]) => agencyAlbumCreate(...a),
      deleteMany: (...a: unknown[]) => agencyAlbumDeleteMany(...a),
    },
    agencyPlace: {
      findMany: (...a: unknown[]) => placeFindMany(...a),
      create: (...a: unknown[]) => placeCreate(...a),
      deleteMany: (...a: unknown[]) => placeDeleteMany(...a),
    },
  },
}));

import * as albumes from "./albumes/route";
import * as lugares from "./lugares/route";

const req = (body: unknown, url = "http://x/api") => ({ json: async () => body, nextUrl: new URL(url) }) as any;

beforeEach(() => {
  for (const f of [requireOwnedAgency, albumFindFirst, albumFindMany, agencyAlbumFindMany, agencyAlbumCreate, agencyAlbumDeleteMany, placeFindMany, placeCreate, placeDeleteMany]) f.mockReset();
  requireOwnedAgency.mockResolvedValue({ user: { id: 10 }, agency: { id: 3 } });
});

describe("álbumes de la agencia", () => {
  it("POST vincula un álbum propio", async () => {
    albumFindFirst.mockResolvedValue({ id: 50, agencyAlbum: null });
    agencyAlbumCreate.mockResolvedValue({});
    const res = await albumes.POST(req({ albumId: 50 }));
    expect(res.status).toBe(201);
    expect(albumFindFirst.mock.calls[0][0].where).toEqual({ id: 50, userId: 10, deletedAt: null });
    expect(agencyAlbumCreate.mock.calls[0][0].data).toEqual({ agencyId: 3, albumId: 50 });
  });
  it("POST de álbum ajeno o inexistente: 404", async () => {
    albumFindFirst.mockResolvedValue(null);
    expect((await albumes.POST(req({ albumId: 50 }))).status).toBe(404);
  });
  it("POST de álbum ya vinculado: 409", async () => {
    albumFindFirst.mockResolvedValue({ id: 50, agencyAlbum: { id: 1 } });
    expect((await albumes.POST(req({ albumId: 50 }))).status).toBe(409);
  });
  it("POST sin albumId: 400", async () => {
    expect((await albumes.POST(req({}))).status).toBe(400);
  });
  it("DELETE desvincula sólo de esta agencia", async () => {
    agencyAlbumDeleteMany.mockResolvedValue({ count: 1 });
    const res = await albumes.DELETE(req(null, "http://x/api?albumId=50"));
    expect(res.status).toBe(200);
    expect(agencyAlbumDeleteMany.mock.calls[0][0].where).toEqual({ agencyId: 3, albumId: 50 });
  });
});

describe("lugares", () => {
  it("POST valida nombre y coordenadas", async () => {
    expect((await lugares.POST(req({ name: "", lat: -38, lng: -57 }))).status).toBe(400);
    expect((await lugares.POST(req({ name: "Playa Grande", lat: 999, lng: -57 }))).status).toBe(400);
    placeCreate.mockResolvedValue({ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 });
    const res = await lugares.POST(req({ name: " Playa Grande ", lat: -38.02, lng: -57.53 }));
    expect(res.status).toBe(201);
    expect(placeCreate.mock.calls[0][0].data).toEqual({ agencyId: 3, name: "Playa Grande", lat: -38.02, lng: -57.53 });
  });
  it("DELETE sólo de esta agencia", async () => {
    placeDeleteMany.mockResolvedValue({ count: 0 });
    expect((await lugares.DELETE(req(null, "http://x/api?id=7"))).status).toBe(404);
    expect(placeDeleteMany.mock.calls[0][0].where).toEqual({ id: 7, agencyId: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/mi-agencia/albumes-lugares.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const linked = await prisma.agencyAlbum.findMany({
    where: { agencyId: a.agency.id },
    orderBy: { createdAt: "desc" },
    select: { albumId: true, album: { select: { title: true, publicSlug: true } } },
  });
  const available = await prisma.album.findMany({
    where: { userId: a.user.id, deletedAt: null, agencyAlbum: { is: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, title: true },
  });
  return NextResponse.json({
    linked: linked.map((l) => ({ albumId: l.albumId, title: l.album.title, publicSlug: l.album.publicSlug })),
    available: available.map((al) => ({ albumId: al.id, title: al.title })),
  });
}

export async function POST(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { albumId?: unknown };
  const albumId = Number(body.albumId);
  if (!Number.isInteger(albumId) || albumId <= 0) return NextResponse.json({ error: "Elegí un álbum." }, { status: 400 });
  const album = await prisma.album.findFirst({
    where: { id: albumId, userId: a.user.id, deletedAt: null },
    select: { id: true, agencyAlbum: { select: { id: true } } },
  });
  if (!album) return NextResponse.json({ error: "Ese álbum no es tuyo o no existe." }, { status: 404 });
  if (album.agencyAlbum) return NextResponse.json({ error: "Ese álbum ya es de la agencia." }, { status: 409 });
  await prisma.agencyAlbum.create({ data: { agencyId: a.agency.id, albumId } });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const albumId = Number(req.nextUrl.searchParams.get("albumId"));
  if (!Number.isInteger(albumId) || albumId <= 0) return NextResponse.json({ error: "Álbum inválido." }, { status: 400 });
  const { count } = await prisma.agencyAlbum.deleteMany({ where: { agencyId: a.agency.id, albumId } });
  if (count === 0) return NextResponse.json({ error: "Ese álbum no es de la agencia." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/lugares/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const places = await prisma.agencyPlace.findMany({
    where: { agencyId: a.agency.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, lat: true, lng: true },
  });
  return NextResponse.json({ places });
}

export async function POST(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; lat?: unknown; lng?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!name) return NextResponse.json({ error: "Poné el nombre del lugar." }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Marcá el lugar en el mapa." }, { status: 400 });
  }
  const place = await prisma.agencyPlace.create({ data: { agencyId: a.agency.id, name, lat, lng } });
  return NextResponse.json({ place: { id: place.id, name: place.name, lat: place.lat, lng: place.lng } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Lugar inválido." }, { status: 400 });
  const { count } = await prisma.agencyPlace.deleteMany({ where: { id, agencyId: a.agency.id } });
  if (count === 0) return NextResponse.json({ error: "Ese lugar no es de la agencia." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/mi-agencia/albumes-lugares.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/lugares apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes-lugares.test.ts
git commit -m "Modo agencia: álbumes de la agencia y lugares frecuentes"
```

---

### Task 8: Unirse por link y "Mis agencias"

**Files:**
- Create: `apps/compramelafoto/app/api/fotografo/agencias/unirse/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/unirse/route.test.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/[agencyId]/condiciones/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.test.ts`

**Interfaces:**
- Consumes: `planJoin`, `resolveAgencyTerms`, `effectiveCommissionBps`, `bpsToPercentLabel`, `memberNeedsTerms` (Task 2); `hashToken`.
- Produces:
  - `GET /api/fotografo/agencias/unirse?token=…` → `{ agency: { name, logoUrl, description, commissionLabel, terms }, alreadyActive: boolean, isOwner: boolean }` / 404 si el link no vale
  - `POST /api/fotografo/agencias/unirse` body `{ token, acceptTerms: true }` → `{ outcome: "joined" | "already_active" }`
  - `GET /api/fotografo/agencias/mis-agencias` → `{ mpConnected: boolean, agencies: Array<{ agencyId, name, logoUrl, status, commissionLabel, needsTerms, terms, albums: Array<{ title, publicSlug }>, myPhotosCount }> }` (sólo `ACTIVE` y `REQUESTED`)
  - `POST /api/fotografo/agencias/mis-agencias/[agencyId]/condiciones` body `{ acceptTerms: true }` → `{ ok: true }`

- [ ] **Step 1: Write the failing tests**

Create `apps/compramelafoto/app/api/fotografo/agencias/unirse/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/token-hash";

const requireAuth = vi.fn();
const inviteFindUnique = vi.fn();
const inviteUpdate = vi.fn();
const memberFindUnique = vi.fn();
const memberCreate = vi.fn();
const memberUpdate = vi.fn();
const transaction = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyInvite: { findUnique: (...a: unknown[]) => inviteFindUnique(...a), update: (...a: unknown[]) => inviteUpdate(...a) },
    agencyMember: {
      findUnique: (...a: unknown[]) => memberFindUnique(...a),
      create: (...a: unknown[]) => memberCreate(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET, POST } from "./route";

const agency = { id: 3, ownerUserId: 10, name: "Fotoshow", logoUrl: null, description: null, defaultCommissionBps: 3000, termsText: null, termsVersion: 2 };
const validInvite = { id: "i1", revokedAt: null, agency };
const getReq = (token: string) => ({ nextUrl: new URL(`http://x/api?token=${token}`) }) as any;
const postReq = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  for (const f of [requireAuth, inviteFindUnique, inviteUpdate, memberFindUnique, memberCreate, memberUpdate, transaction]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
  transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe("unirse", () => {
  it("GET busca por hash del token y muestra condiciones", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue(null);
    const body = await (await GET(getReq("tok"))).json();
    expect(inviteFindUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken("tok") });
    expect(body.agency).toMatchObject({ name: "Fotoshow", commissionLabel: "30 %" });
    expect(body.agency.terms).toContain("Al sumarte");
    expect(body).toMatchObject({ alreadyActive: false, isOwner: false });
  });
  it("link revocado o inexistente: 404", async () => {
    inviteFindUnique.mockResolvedValue({ ...validInvite, revokedAt: new Date() });
    expect((await GET(getReq("tok"))).status).toBe(404);
    inviteFindUnique.mockResolvedValue(null);
    expect((await POST(postReq({ token: "tok", acceptTerms: true }))).status).toBe(404);
  });
  it("POST exige aceptar las condiciones", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    const res = await POST(postReq({ token: "tok" }));
    expect(res.status).toBe(400);
    expect(memberCreate).not.toHaveBeenCalled();
  });
  it("el dueño no se une a su propia agencia", async () => {
    requireAuth.mockResolvedValue({ error: null, user: { id: 10 } });
    inviteFindUnique.mockResolvedValue(validInvite);
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(res.status).toBe(409);
    expect(memberCreate).not.toHaveBeenCalled();
  });
  it("POST crea el miembro activo con las condiciones vigentes", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue(null);
    memberCreate.mockResolvedValue({});
    inviteUpdate.mockResolvedValue({});
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "joined" });
    const data = memberCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ agencyId: 3, userId: 20, status: "ACTIVE", termsVersionAccepted: 2 });
    expect(data.termsAcceptedText).toContain("Al sumarte");
    expect(inviteUpdate.mock.calls[0][0]).toEqual({ where: { id: "i1" }, data: { useCount: { increment: 1 } } });
  });
  it("POST reactiva a un dado de baja sin duplicar", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue({ id: 7, status: "REMOVED" });
    memberUpdate.mockResolvedValue({});
    inviteUpdate.mockResolvedValue({});
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "joined" });
    expect(memberCreate).not.toHaveBeenCalled();
    expect(memberUpdate.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(memberUpdate.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", removedAt: null, termsVersionAccepted: 2 });
  });
  it("POST si ya es activo no toca nada", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue({ id: 7, status: "ACTIVE" });
    expect(await (await POST(postReq({ token: "tok", acceptTerms: true }))).json()).toEqual({ outcome: "already_active" });
    expect(memberUpdate).not.toHaveBeenCalled();
  });
});
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const userFindUnique = vi.fn();
const memberFindMany = vi.fn();
const memberFindUnique = vi.fn();
const memberUpdate = vi.fn();
const photoGroupBy = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agencyMember: {
      findMany: (...a: unknown[]) => memberFindMany(...a),
      findUnique: (...a: unknown[]) => memberFindUnique(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
    photo: { groupBy: (...a: unknown[]) => photoGroupBy(...a) },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET } from "./route";
import { POST as ACCEPT } from "./[agencyId]/condiciones/route";

beforeEach(() => {
  for (const f of [requireAuth, userFindUnique, memberFindMany, memberFindUnique, memberUpdate, photoGroupBy]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
});

describe("mis-agencias", () => {
  it("lista agencias con porcentaje, condiciones y fotos propias, sin datos de clientes", async () => {
    userFindUnique.mockResolvedValue({ mpAccessToken: "APP_USR-x" });
    memberFindMany.mockResolvedValue([
      {
        agencyId: 3, status: "ACTIVE", commissionBps: null, termsVersionAccepted: 1,
        agency: {
          name: "Fotoshow", logoUrl: null, defaultCommissionBps: 3000, termsText: null, termsVersion: 2,
          albums: [{ albumId: 50, album: { title: "Temporada 2027", publicSlug: "temporada-2027-ab" } }],
        },
      },
    ]);
    photoGroupBy.mockResolvedValue([{ albumId: 50, _count: { _all: 12 } }]);
    const body = await (await GET()).json();
    expect(body.mpConnected).toBe(true);
    expect(body.agencies[0]).toMatchObject({
      agencyId: 3, name: "Fotoshow", status: "ACTIVE", commissionLabel: "30 %", needsTerms: true, myPhotosCount: 12,
      albums: [{ title: "Temporada 2027", publicSlug: "temporada-2027-ab" }],
    });
    expect(JSON.stringify(body)).not.toMatch(/email|buyer|phone/i);
    expect(memberFindMany.mock.calls[0][0].where).toEqual({ userId: 20, status: { in: ["ACTIVE", "REQUESTED"] } });
    expect(photoGroupBy.mock.calls[0][0].where).toEqual({ albumId: { in: [50] }, userId: 20, isRemoved: false });
  });
  it("aceptar condiciones guarda la versión vigente", async () => {
    memberFindUnique.mockResolvedValue({ id: 7, status: "ACTIVE", agency: { termsVersion: 2, termsText: null } });
    memberUpdate.mockResolvedValue({});
    const res = await ACCEPT({ json: async () => ({ acceptTerms: true }) } as any, { params: Promise.resolve({ agencyId: "3" }) });
    expect(res.status).toBe(200);
    expect(memberUpdate.mock.calls[0][0].data).toMatchObject({ termsVersionAccepted: 2 });
  });
  it("aceptar sin tilde: 400; sin membresía: 404", async () => {
    expect((await ACCEPT({ json: async () => ({}) } as any, { params: Promise.resolve({ agencyId: "3" }) })).status).toBe(400);
    memberFindUnique.mockResolvedValue(null);
    expect((await ACCEPT({ json: async () => ({ acceptTerms: true }) } as any, { params: Promise.resolve({ agencyId: "3" }) })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/unirse app/api/fotografo/agencias/mis-agencias`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/app/api/fotografo/agencias/unirse/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashToken } from "@/lib/token-hash";
import { bpsToPercentLabel, planJoin, resolveAgencyTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_LINK = "Este link de invitación ya no funciona. Pedile uno nuevo a la agencia.";

async function findValidInvite(token: string) {
  if (!token) return null;
  const invite = await prisma.agencyInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true, revokedAt: true,
      agency: { select: { id: true, ownerUserId: true, name: true, logoUrl: true, description: true, defaultCommissionBps: true, termsText: true, termsVersion: true } },
    },
  });
  return invite && !invite.revokedAt ? invite : null;
}

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) } as const;
  return { user } as const;
}

export async function GET(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const invite = await findValidInvite(req.nextUrl.searchParams.get("token") ?? "");
  if (!invite) return NextResponse.json({ error: INVALID_LINK }, { status: 404 });
  const ag = invite.agency;
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: ag.id, userId: a.user.id } },
    select: { status: true },
  });
  return NextResponse.json({
    agency: {
      name: ag.name,
      logoUrl: ag.logoUrl,
      description: ag.description,
      commissionLabel: bpsToPercentLabel(ag.defaultCommissionBps),
      terms: resolveAgencyTerms(ag),
    },
    alreadyActive: member?.status === "ACTIVE",
    isOwner: ag.ownerUserId === a.user.id,
  });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; acceptTerms?: unknown };
  const invite = await findValidInvite(typeof body.token === "string" ? body.token : "");
  if (!invite) return NextResponse.json({ error: INVALID_LINK }, { status: 404 });
  const ag = invite.agency;
  if (ag.ownerUserId === a.user.id) {
    return NextResponse.json({ error: "Sos el dueño de esta agencia: no hace falta que te sumes." }, { status: 409 });
  }
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: "Para sumarte tenés que aceptar las condiciones de la agencia." }, { status: 400 });
  }
  const existing = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: ag.id, userId: a.user.id } },
    select: { id: true, status: true },
  });
  const plan = planJoin(existing);
  if (plan.action === "already_active") return NextResponse.json({ outcome: "already_active" });

  const now = new Date();
  const terms = {
    status: "ACTIVE",
    termsVersionAccepted: ag.termsVersion,
    termsAcceptedAt: now,
    termsAcceptedText: resolveAgencyTerms(ag),
    joinedAt: now,
    removedAt: null,
  };
  await prisma.$transaction([
    plan.action === "create"
      ? prisma.agencyMember.create({ data: { agencyId: ag.id, userId: a.user.id, ...terms } })
      : prisma.agencyMember.update({ where: { id: existing!.id }, data: terms }),
    prisma.agencyInvite.update({ where: { id: invite.id }, data: { useCount: { increment: 1 } } }),
  ]);
  return NextResponse.json({ outcome: "joined" });
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { bpsToPercentLabel, effectiveCommissionBps, memberNeedsTerms, resolveAgencyTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lo que el fotógrafo del equipo ve de cada agencia. Nunca incluye datos de clientes. */
export async function GET() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { mpAccessToken: true } });
  const memberships = await prisma.agencyMember.findMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "REQUESTED"] } },
    orderBy: { createdAt: "desc" },
    select: {
      agencyId: true, status: true, commissionBps: true, termsVersionAccepted: true,
      agency: {
        select: {
          name: true, logoUrl: true, defaultCommissionBps: true, termsText: true, termsVersion: true,
          albums: { select: { albumId: true, album: { select: { title: true, publicSlug: true } } } },
        },
      },
    },
  });

  const albumIds = memberships.flatMap((m) => m.agency.albums.map((al) => al.albumId));
  const counts = albumIds.length
    ? await prisma.photo.groupBy({
        by: ["albumId"],
        where: { albumId: { in: albumIds }, userId: user.id, isRemoved: false },
        _count: { _all: true },
      })
    : [];
  const countByAlbum = new Map(counts.map((c) => [c.albumId, c._count._all]));

  return NextResponse.json({
    mpConnected: Boolean(me?.mpAccessToken),
    agencies: memberships.map((m) => ({
      agencyId: m.agencyId,
      name: m.agency.name,
      logoUrl: m.agency.logoUrl,
      status: m.status,
      commissionLabel: bpsToPercentLabel(effectiveCommissionBps(m, m.agency)),
      needsTerms: memberNeedsTerms(m, m.agency),
      terms: resolveAgencyTerms(m.agency),
      albums: m.agency.albums.map((al) => ({ title: al.album.title, publicSlug: al.album.publicSlug })),
      myPhotosCount: m.agency.albums.reduce((sum, al) => sum + (countByAlbum.get(al.albumId) ?? 0), 0),
    })),
  });
}
```

Create `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/[agencyId]/condiciones/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resolveAgencyTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { acceptTerms?: unknown };
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: "Tenés que tildar que aceptás las condiciones." }, { status: 400 });
  }
  const { agencyId } = await Promise.resolve(params);
  const id = parseInt(agencyId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: id, userId: user.id } },
    select: { id: true, status: true, agency: { select: { termsVersion: true, termsText: true } } },
  });
  if (!member || member.status !== "ACTIVE") {
    return NextResponse.json({ error: "No sos parte del equipo de esa agencia." }, { status: 404 });
  }
  await prisma.agencyMember.update({
    where: { id: member.id },
    data: {
      termsVersionAccepted: member.agency.termsVersion,
      termsAcceptedAt: new Date(),
      termsAcceptedText: resolveAgencyTerms(member.agency),
    },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/api/fotografo/agencias/unirse apps/compramelafoto/app/api/fotografo/agencias/mis-agencias
git commit -m "Modo agencia: sumarse por link, aceptar condiciones y ver mis agencias"
```

---

### Task 9: API del directorio de agencias

**Files:**
- Create: `apps/compramelafoto/app/api/fotografo/agencias/directorio/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/directorio/route.test.ts`

**Interfaces:**
- Consumes: `sortByDistanceKm`, `planRequest`, `resolveAgencyTerms`, `bpsToPercentLabel` (Task 2).
- Produces:
  - `GET /api/fotografo/agencias/directorio` → `{ noLocation: boolean, agencies: Array<{ agencyId, name, logoUrl, description, city, distanceKm, commissionLabel, myStatus: "ACTIVE" | "REQUESTED" | null }> }` (agencias listadas, sin la propia, a ≤ 500 km, máx. 100; si el fotógrafo no tiene ubicación en su perfil, `noLocation: true` y lista ordenada por nombre)
  - `POST /api/fotografo/agencias/directorio` body `{ agencyId, message?, acceptTerms: true }` → `{ outcome: "requested" | "already_requested" | "already_active" }`

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/app/api/fotografo/agencias/directorio/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const userFindUnique = vi.fn();
const agencyFindMany = vi.fn();
const agencyFindFirst = vi.fn();
const memberFindMany = vi.fn();
const memberFindUnique = vi.fn();
const memberCreate = vi.fn();
const memberUpdate = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agency: { findMany: (...a: unknown[]) => agencyFindMany(...a), findFirst: (...a: unknown[]) => agencyFindFirst(...a) },
    agencyMember: {
      findMany: (...a: unknown[]) => memberFindMany(...a),
      findUnique: (...a: unknown[]) => memberFindUnique(...a),
      create: (...a: unknown[]) => memberCreate(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET, POST } from "./route";

const a = (id: number, name: string, lat: number, lng: number) => ({
  id, name, logoUrl: null, description: null, directoryCity: null, directoryLat: lat, directoryLng: lng, defaultCommissionBps: 3000,
});
const post = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  for (const f of [requireAuth, userFindUnique, agencyFindMany, agencyFindFirst, memberFindMany, memberFindUnique, memberCreate, memberUpdate]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
  memberFindMany.mockResolvedValue([]);
});

describe("directorio", () => {
  it("ordena por distancia, saca las de más de 500 km y marca mi estado", async () => {
    userFindUnique.mockResolvedValue({ latitude: -38.0055, longitude: -57.5426 });
    agencyFindMany.mockResolvedValue([a(1, "Porteña", -34.6037, -58.3816), a(2, "Fotoshow", -38.0, -57.55), a(3, "Salta", -24.78, -65.41)]);
    memberFindMany.mockResolvedValue([{ agencyId: 2, status: "ACTIVE" }]);
    const body = await (await GET()).json();
    expect(body.noLocation).toBe(false);
    expect(body.agencies.map((x: any) => x.name)).toEqual(["Fotoshow", "Porteña"]);
    expect(body.agencies[0].myStatus).toBe("ACTIVE");
    expect(body.agencies[1].myStatus).toBe(null);
    expect(agencyFindMany.mock.calls[0][0].where).toMatchObject({ directoryListed: true, ownerUserId: { not: 20 } });
  });
  it("sin ubicación en el perfil: avisa y ordena por nombre", async () => {
    userFindUnique.mockResolvedValue({ latitude: null, longitude: null });
    agencyFindMany.mockResolvedValue([a(1, "Zeta", -34, -58), a(2, "Alfa", -38, -57)]);
    const body = await (await GET()).json();
    expect(body.noLocation).toBe(true);
    expect(body.agencies.map((x: any) => x.name)).toEqual(["Alfa", "Zeta"]);
    expect(body.agencies[0].distanceKm).toBe(null);
  });
  it("POST pide sumarse aceptando condiciones", async () => {
    agencyFindFirst.mockResolvedValue({ id: 2, ownerUserId: 10, termsText: null, termsVersion: 1 });
    memberFindUnique.mockResolvedValue(null);
    memberCreate.mockResolvedValue({});
    const res = await POST(post({ agencyId: 2, message: "Tengo FTP", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "requested" });
    expect(memberCreate.mock.calls[0][0].data).toMatchObject({ agencyId: 2, userId: 20, status: "REQUESTED", requestMessage: "Tengo FTP", termsVersionAccepted: 1 });
  });
  it("POST reabre una solicitud rechazada", async () => {
    agencyFindFirst.mockResolvedValue({ id: 2, ownerUserId: 10, termsText: null, termsVersion: 1 });
    memberFindUnique.mockResolvedValue({ id: 5, status: "REJECTED" });
    memberUpdate.mockResolvedValue({});
    expect(await (await POST(post({ agencyId: 2, acceptTerms: true }))).json()).toEqual({ outcome: "requested" });
    expect(memberUpdate.mock.calls[0][0].data.status).toBe("REQUESTED");
  });
  it("POST sin aceptar o a una agencia no listada", async () => {
    expect((await POST(post({ agencyId: 2 }))).status).toBe(400);
    agencyFindFirst.mockResolvedValue(null);
    expect((await POST(post({ agencyId: 2, acceptTerms: true }))).status).toBe(404);
    expect(agencyFindFirst.mock.calls[0][0].where).toEqual({ id: 2, directoryListed: true });
  });
  it("POST a la propia: 409", async () => {
    agencyFindFirst.mockResolvedValue({ id: 2, ownerUserId: 20, termsText: null, termsVersion: 1 });
    expect((await POST(post({ agencyId: 2, acceptTerms: true }))).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/directorio`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/app/api/fotografo/agencias/directorio/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { bpsToPercentLabel, planRequest, resolveAgencyTerms, sortByDistanceKm } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DISTANCE_KM = 500;

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) } as const;
  return { user } as const;
}

export async function GET() {
  const a = await auth();
  if ("res" in a) return a.res;
  const me = await prisma.user.findUnique({ where: { id: a.user.id }, select: { latitude: true, longitude: true } });
  const rows = await prisma.agency.findMany({
    where: { directoryListed: true, ownerUserId: { not: a.user.id }, directoryLat: { not: null }, directoryLng: { not: null } },
    select: { id: true, name: true, logoUrl: true, description: true, directoryCity: true, directoryLat: true, directoryLng: true, defaultCommissionBps: true },
    take: 1000,
  });
  const mine = await prisma.agencyMember.findMany({
    where: { userId: a.user.id, status: { in: ["ACTIVE", "REQUESTED"] } },
    select: { agencyId: true, status: true },
  });
  const statusBy = new Map(mine.map((m) => [m.agencyId, m.status as "ACTIVE" | "REQUESTED"]));
  const toDto = (r: (typeof rows)[number], distanceKm: number | null) => ({
    agencyId: r.id,
    name: r.name,
    logoUrl: r.logoUrl,
    description: r.description,
    city: r.directoryCity,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm),
    commissionLabel: bpsToPercentLabel(r.defaultCommissionBps),
    myStatus: statusBy.get(r.id) ?? null,
  });

  const hasLocation = me?.latitude != null && me?.longitude != null;
  if (!hasLocation) {
    const byName = [...rows].sort((x, y) => x.name.localeCompare(y.name, "es")).slice(0, 100);
    return NextResponse.json({ noLocation: true, agencies: byName.map((r) => toDto(r, null)) });
  }
  const sorted = sortByDistanceKm(
    rows.map((r) => ({ ...r, lat: r.directoryLat as number, lng: r.directoryLng as number })),
    { lat: me!.latitude as number, lng: me!.longitude as number }
  )
    .filter((r) => r.distanceKm <= MAX_DISTANCE_KM)
    .slice(0, 100);
  return NextResponse.json({ noLocation: false, agencies: sorted.map((r) => toDto(r, r.distanceKm)) });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { agencyId?: unknown; message?: unknown; acceptTerms?: unknown };
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: "Para pedir sumarte tenés que aceptar las condiciones de la agencia." }, { status: 400 });
  }
  const agencyId = Number(body.agencyId);
  if (!Number.isInteger(agencyId) || agencyId <= 0) return NextResponse.json({ error: "Agencia inválida." }, { status: 400 });
  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, directoryListed: true },
    select: { id: true, ownerUserId: true, termsText: true, termsVersion: true },
  });
  if (!agency) return NextResponse.json({ error: "Esa agencia no está en el directorio." }, { status: 404 });
  if (agency.ownerUserId === a.user.id) return NextResponse.json({ error: "Es tu propia agencia." }, { status: 409 });

  const existing = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId: a.user.id } },
    select: { id: true, status: true },
  });
  const plan = planRequest(existing);
  if (plan.action === "already_active" || plan.action === "already_requested") {
    return NextResponse.json({ outcome: plan.action });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) || null : null;
  const data = {
    status: "REQUESTED",
    requestMessage: message,
    termsVersionAccepted: agency.termsVersion,
    termsAcceptedAt: new Date(),
    termsAcceptedText: resolveAgencyTerms(agency),
    removedAt: null,
  };
  if (plan.action === "create") {
    await prisma.agencyMember.create({ data: { agencyId, userId: a.user.id, ...data } });
  } else {
    await prisma.agencyMember.update({ where: { id: existing!.id }, data });
  }
  return NextResponse.json({ outcome: "requested" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/directorio`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/api/fotografo/agencias/directorio
git commit -m "Modo agencia: directorio de agencias cercanas y solicitudes"
```

---

### Task 10: Menú "Agencias" y página de inicio de la sección

**Files:**
- Modify: `apps/compramelafoto/config/navigation.ts` (después del ítem `escolar`)
- Create: `apps/compramelafoto/components/agencies/AgencyPageFrame.tsx`
- Create: `apps/compramelafoto/app/fotografo/agencias/page.tsx`

**Interfaces:**
- Produces: `AgencyPageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode })` — maneja sesión (redirige a `/fotografo/login`), header del panel y contenedor. `AGENCY_SECTIONS` exportado desde `apps/compramelafoto/lib/agencies/sections.ts` (crear): `Array<{ id: "mi-agencia" | "directorio" | "mis-agencias"; label: string; path: string; help: string }>`.

- [ ] **Step 1: Crear las secciones y el menú**

Create `apps/compramelafoto/lib/agencies/sections.ts`:

```ts
/** Las tres secciones del menú Agencias, con la explicación que se muestra adentro. */
export const AGENCY_SECTIONS = [
  {
    id: "mi-agencia",
    label: "Mi agencia",
    path: "/fotografo/agencias/mi-agencia",
    help: "Armá tu equipo de fotógrafos, decidí cuánto cobra cada uno y vendé todo desde un solo álbum.",
  },
  {
    id: "directorio",
    label: "Directorio de agencias",
    path: "/fotografo/agencias/directorio",
    help: "Encontrá agencias cerca tuyo y mandales una solicitud para sumarte a su equipo.",
  },
  {
    id: "mis-agencias",
    label: "Mis agencias",
    path: "/fotografo/agencias/mis-agencias",
    help: "Las agencias para las que trabajás, lo que subiste y lo que te pagaron.",
  },
] as const;
```

In `apps/compramelafoto/config/navigation.ts`, add `import { AGENCY_SECTIONS } from "@/lib/agencies/sections";` at the top and, in the array returned by `getPhotographerSidebarItems`, right after the closing `},` of the `escolar` item, insert:

```ts
    {
      id: "agencias",
      label: "Agencias",
      path: "/fotografo/agencias",
      icon: icons.events ?? icons.albums,
      badge: "NEW",
      children: AGENCY_SECTIONS.map((s) => ({ id: `agencias-${s.id}`, label: s.label, path: s.path })),
    },
```

- [ ] **Step 2: Crear el marco de página**

Create `apps/compramelafoto/components/agencies/AgencyPageFrame.tsx`:

```tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import PhotographerWorkspacePageHeader from "@/components/photographer/workspace/PhotographerWorkspacePageHeader";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

export default function AgencyPageFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const router = useRouter();
  const [photographer, setPhotographer] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    ensurePhotographerSession().then((session) => {
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => active && d && setPhotographer(d))
        .catch(() => {});
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-6 md:py-8">
        <DsDashboardInner>
          <PhotographerWorkspacePageHeader title={title} subtitle={subtitle} />
          {ready ? children : <p className="text-gray-600">Cargando...</p>}
        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
```

- [ ] **Step 3: Página de inicio de Agencias**

Create `apps/compramelafoto/app/fotografo/agencias/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

export default function AgenciasHomePage() {
  return (
    <AgencyPageFrame
      title="Agencias"
      subtitle="Trabajá en equipo: una agencia junta a varios fotógrafos que venden desde un mismo álbum y cada uno cobra su parte."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {AGENCY_SECTIONS.map((s) => (
          <Link key={s.id} href={s.path} className="block">
            <Card className="h-full space-y-2 transition hover:shadow-md">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">{s.label}</h2>
              <p className="text-sm text-[#6b7280]">{s.help}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AgencyPageFrame>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `cd apps/compramelafoto && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck`
Expected: 0 errores.

Visual (en el worktree con `next dev --webpack` contra una base de prueba, nunca producción): iniciar sesión como fotógrafo de prueba, ver en el menú lateral **Agencias** con el cartel NEW llamativo y sus tres hijos, y en `/fotografo/agencias` las tres tarjetas con su explicación.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/config/navigation.ts apps/compramelafoto/lib/agencies/sections.ts apps/compramelafoto/components/agencies/AgencyPageFrame.tsx apps/compramelafoto/app/fotografo/agencias/page.tsx
git commit -m "Modo agencia: menú Agencias (NEW) y página con las tres secciones"
```

---

### Task 11: Página "Mi agencia"

**Files:**
- Create: `apps/compramelafoto/components/agencies/AgencyMapPicker.tsx`
- Create: `apps/compramelafoto/app/fotografo/agencias/mi-agencia/page.tsx`

**Interfaces:**
- Consumes: APIs de Tasks 5, 6 y 7; `AgencyPageFrame`, `AGENCY_SECTIONS` (Task 10); `LocationMap` (`components/organizer/LocationMap.tsx`, props `{ latitude, longitude, editable?, onPositionChange?, height? }`).
- Produces: `AgencyMapPicker({ lat, lng, onChange, height? }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void; height?: string })`.

- [ ] **Step 1: Mapa reutilizable**

Create `apps/compramelafoto/components/agencies/AgencyMapPicker.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/organizer/LocationMap"), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-xl bg-gray-100" />,
});

/** Tocá el mapa para marcar el punto. Sin punto, arranca en Buenos Aires. */
export default function AgencyMapPicker({
  lat,
  lng,
  onChange,
  height = "260px",
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
      <LocationMap latitude={lat ?? 0} longitude={lng ?? 0} editable onPositionChange={onChange} height={height} />
    </div>
  );
}
```

- [ ] **Step 2: La página**

Create `apps/compramelafoto/app/fotografo/agencias/mi-agencia/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import AgencyMapPicker from "@/components/agencies/AgencyMapPicker";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

type Agency = {
  id: number; name: string; description: string | null; defaultCommissionBps: number; defaultCommissionLabel: string;
  directoryListed: boolean; directoryLat: number | null; directoryLng: number | null; directoryRadiusKm: number;
  directoryCity: string | null; notFoundSearchEnabled: boolean; termsText: string | null; termsEffective: string;
};
type Member = { id: number; name: string; email: string; commissionLabel: string; usesDefault: boolean; needsTerms: boolean; requestMessage: string | null };
type Place = { id: number; name: string; lat: number; lng: number };

const HELP = AGENCY_SECTIONS.find((s) => s.id === "mi-agencia")!.help;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo salió mal. Probá de nuevo.");
  return data;
}

function CreateAgency({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Creá tu agencia</h2>
      <p className="text-sm text-[#6b7280]">Después vas a poder invitar a tu equipo y elegir qué álbumes son de la agencia.</p>
      <label className="block text-sm font-medium">Nombre de la agencia
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Fotoshow Estudio" />
      </label>
      <label className="block text-sm font-medium">Porcentaje general para cada fotógrafo (%)
        <Input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await api("/api/fotografo/agencias/mi-agencia", { method: "POST", body: JSON.stringify({ name, defaultCommissionPercent: percent }) });
            onCreated();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Crear agencia
      </Button>
    </Card>
  );
}

function TeamSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const d = await api("/api/fotografo/agencias/mi-agencia/equipo");
      setMembers(d.members);
      setRequests(d.requests);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (id: number, body: object) => {
    setError(null);
    try {
      await api(`/api/fotografo/agencias/mi-agencia/equipo/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Equipo</h2>
      <div className="space-y-2">
        <p className="text-sm text-[#6b7280]">Mandale este link a cada fotógrafo. Al entrar, acepta tus condiciones y queda en el equipo.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const d = await api("/api/fotografo/agencias/mi-agencia/invitacion", { method: "POST" });
              setInviteUrl(d.url);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {inviteUrl ? "Generar otro link (el anterior deja de andar)" : "Generar link de invitación"}
        </Button>
        {inviteUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-gray-100 px-2 py-1 text-xs">{inviteUrl}</code>
            <Button size="sm" onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copiar</Button>
          </div>
        )}
      </div>

      {requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Solicitudes para sumarse</h3>
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-medium">{r.name}</p>
                {r.requestMessage && <p className="text-sm text-[#6b7280]">“{r.requestMessage}”</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act(r.id, { action: "accept" })}>Aceptar</Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, { action: "reject" })}>Rechazar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium">Fotógrafos ({members.length})</h3>
        {members.length === 0 && <p className="text-sm text-[#6b7280]">Todavía no hay nadie en tu equipo.</p>}
        {members.map((m) => (
          <MemberRow key={m.id} member={m} onCommission={(percent) => act(m.id, { action: "setCommission", percent })} onRemove={() => {
            if (confirm(`¿Dar de baja a ${m.name}? Ya no va a poder subir fotos; sus ventas se le siguen pagando.`)) act(m.id, { action: "remove" });
          }} />
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function MemberRow({ member, onCommission, onRemove }: { member: Member; onCommission: (p: string) => void; onRemove: () => void }) {
  const [value, setValue] = useState(member.usesDefault ? "" : member.commissionLabel.replace(" %", "").replace(",", "."));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
      <div>
        <p className="font-medium">{member.name}</p>
        <p className="text-xs text-[#6b7280]">
          {member.commissionLabel}{member.usesDefault ? " (general)" : ""}
          {member.needsTerms ? " · tiene que aceptar las condiciones nuevas" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input className="w-24" value={value} onChange={(e) => setValue(e.target.value)} placeholder="general" inputMode="decimal" />
        <Button size="sm" variant="outline" onClick={() => onCommission(value)}>Guardar %</Button>
        <Button size="sm" variant="secondary" onClick={onRemove}>Dar de baja</Button>
      </div>
    </div>
  );
}

function AlbumsSection() {
  const [linked, setLinked] = useState<Array<{ albumId: number; title: string; publicSlug: string }>>([]);
  const [available, setAvailable] = useState<Array<{ albumId: number; title: string }>>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await api("/api/fotografo/agencias/mi-agencia/albumes").catch((e) => {
      setError((e as Error).message);
      return { linked: [], available: [] };
    });
    setLinked(d.linked);
    setAvailable(d.available);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Álbumes de la agencia</h2>
      <p className="text-sm text-[#6b7280]">Sólo tu equipo puede subir fotos a estos álbumes. Los precios y la venta se configuran como en cualquier álbum.</p>
      {linked.map((l) => (
        <div key={l.albumId} className="flex items-center justify-between rounded-xl border p-3">
          <a className="font-medium underline" href={`/dashboard/albums/${l.albumId}`}>{l.title}</a>
          <Button size="sm" variant="outline" onClick={async () => {
            await api(`/api/fotografo/agencias/mi-agencia/albumes?albumId=${l.albumId}`, { method: "DELETE" }).catch((e) => setError((e as Error).message));
            load();
          }}>Quitar de la agencia</Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <select className="rounded-xl border px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Elegí uno de tus álbumes…</option>
          {available.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
        </select>
        <Button size="sm" disabled={!selected} onClick={async () => {
          setError(null);
          await api("/api/fotografo/agencias/mi-agencia/albumes", { method: "POST", body: JSON.stringify({ albumId: Number(selected) }) }).catch((e) => setError((e as Error).message));
          setSelected("");
          load();
        }}>Sumar a la agencia</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function PlacesSection() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await api("/api/fotografo/agencias/mi-agencia/lugares").catch(() => ({ places: [] }));
    setPlaces(d.places);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Lugares frecuentes</h2>
      <p className="text-sm text-[#6b7280]">Balnearios, miradores, pistas… Tu equipo los elige rápido al subir fotos desde una cámara sin GPS.</p>
      <ul className="space-y-1">
        {places.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span>{p.name}</span>
            <button className="text-red-600 underline" onClick={async () => {
              await api(`/api/fotografo/agencias/mi-agencia/lugares?id=${p.id}`, { method: "DELETE" }).catch(() => {});
              load();
            }}>Borrar</button>
          </li>
        ))}
      </ul>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del lugar, ej.: Playa Grande" />
      <AgencyMapPicker lat={point?.lat ?? null} lng={point?.lng ?? null} onChange={(lat, lng) => setPoint({ lat, lng })} />
      <Button size="sm" disabled={!name || !point} onClick={async () => {
        setError(null);
        try {
          await api("/api/fotografo/agencias/mi-agencia/lugares", { method: "POST", body: JSON.stringify({ name, ...point }) });
          setName("");
          setPoint(null);
          load();
        } catch (e) {
          setError((e as Error).message);
        }
      }}>Agregar lugar</Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function SettingsSection({ agency, onSaved }: { agency: Agency; onSaved: (a: Agency) => void }) {
  const [form, setForm] = useState({
    name: agency.name,
    description: agency.description ?? "",
    defaultCommissionPercent: String(agency.defaultCommissionBps / 100),
    directoryListed: agency.directoryListed,
    directoryLat: agency.directoryLat,
    directoryLng: agency.directoryLng,
    directoryRadiusKm: String(agency.directoryRadiusKm),
    directoryCity: agency.directoryCity ?? "",
    notFoundSearchEnabled: agency.notFoundSearchEnabled,
    termsText: agency.termsText ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Configuración</h2>
      <label className="block text-sm font-medium">Nombre<Input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label className="block text-sm font-medium">Descripción (se ve en el directorio)
        <textarea className="mt-1 w-full rounded-xl border p-3 text-sm" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Porcentaje general para cada fotógrafo (%)
        <Input value={form.defaultCommissionPercent} onChange={(e) => set("defaultCommissionPercent", e.target.value)} inputMode="decimal" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notFoundSearchEnabled} onChange={(e) => set("notFoundSearchEnabled", e.target.checked)} />
        Permitir “No me encuentro”: el cliente elige día, hora y lugar y ve sólo esas fotos sin selfie.
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.directoryListed} onChange={(e) => set("directoryListed", e.target.checked)} />
        Aparecer en el Directorio de agencias para que te pidan sumarse.
      </label>
      {form.directoryListed && (
        <div className="space-y-2">
          <Input value={form.directoryCity} onChange={(e) => set("directoryCity", e.target.value)} placeholder="Ciudad, ej.: Mar del Plata" />
          <AgencyMapPicker lat={form.directoryLat} lng={form.directoryLng} onChange={(lat, lng) => setForm((f) => ({ ...f, directoryLat: lat, directoryLng: lng }))} />
          <label className="block text-sm">Radio de trabajo (km)<Input value={form.directoryRadiusKm} onChange={(e) => set("directoryRadiusKm", e.target.value)} inputMode="numeric" /></label>
        </div>
      )}
      <label className="block text-sm font-medium">Condiciones para tu equipo (si lo dejás vacío se usan las de abajo)
        <textarea className="mt-1 w-full rounded-xl border p-3 text-sm" rows={6} value={form.termsText} onChange={(e) => set("termsText", e.target.value)} placeholder={agency.termsEffective} />
      </label>
      <p className="text-xs text-[#6b7280]">Si cambiás las condiciones, tu equipo tiene que aceptarlas de nuevo antes de seguir subiendo.</p>
      <Button onClick={async () => {
        setMsg(null);
        try {
          const d = await api("/api/fotografo/agencias/mi-agencia", { method: "PATCH", body: JSON.stringify(form) });
          onSaved(d.agency);
          setMsg("Guardado.");
        } catch (e) {
          setMsg((e as Error).message);
        }
      }}>Guardar</Button>
      {msg && <p className="text-sm">{msg}</p>}
    </Card>
  );
}

export default function MiAgenciaPage() {
  const [agency, setAgency] = useState<Agency | null | undefined>(undefined);
  const load = useCallback(async () => {
    const d = await api("/api/fotografo/agencias/mi-agencia").catch(() => ({ agency: null }));
    setAgency(d.agency);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <AgencyPageFrame title="Mi agencia" subtitle={HELP}>
      {agency === undefined && <p className="text-gray-600">Cargando...</p>}
      {agency === null && <CreateAgency onCreated={load} />}
      {agency && (
        <div className="space-y-6">
          <TeamSection />
          <AlbumsSection />
          <PlacesSection />
          <SettingsSection agency={agency} onSaved={setAgency} />
        </div>
      )}
    </AgencyPageFrame>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `cd apps/compramelafoto && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck`
Expected: 0 errores. If `Input` does not accept `className`, check `components/ui/Input.tsx` (it spreads `...props` and takes `className`, line 7) — it does.

Visual (dev local, base de prueba): crear agencia → aparece Equipo, Álbumes, Lugares, Configuración; generar link y copiarlo; sumar un álbum propio; agregar un lugar tocando el mapa; guardar configuración con directorio sin punto → mensaje "Para aparecer en el directorio marcá tu zona en el mapa."

- [ ] **Step 4: Commit**

```bash
git add apps/compramelafoto/components/agencies/AgencyMapPicker.tsx apps/compramelafoto/app/fotografo/agencias/mi-agencia
git commit -m "Modo agencia: pantalla Mi agencia (equipo, álbumes, lugares y configuración)"
```

---

### Task 12: Páginas "Mis agencias", "Directorio" y el link de invitación

**Files:**
- Create: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx`
- Create: `apps/compramelafoto/app/fotografo/agencias/directorio/page.tsx`
- Create: `apps/compramelafoto/app/agencias/unirse/page.tsx`

**Interfaces:**
- Consumes: APIs de Tasks 8 y 9; `AgencyPageFrame`, `AGENCY_SECTIONS` (Task 10).

- [ ] **Step 1: Mis agencias**

Create `apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

type Item = {
  agencyId: number; name: string; status: "ACTIVE" | "REQUESTED"; commissionLabel: string; needsTerms: boolean;
  terms: string; albums: Array<{ title: string; publicSlug: string }>; myPhotosCount: number;
};

const HELP = AGENCY_SECTIONS.find((s) => s.id === "mis-agencias")!.help;

export default function MisAgenciasPage() {
  const [data, setData] = useState<{ mpConnected: boolean; agencies: Item[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/fotografo/agencias/mis-agencias", { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setData(d);
    else setError(d.error || "No pudimos cargar tus agencias.");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <AgencyPageFrame title="Mis agencias" subtitle={HELP}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && (
        <div className="space-y-6">
          <Card className="space-y-2">
            <h2 className="text-lg font-medium">Mercado Pago</h2>
            <p className="text-sm text-[#6b7280]">
              {data.mpConnected
                ? "Tu Mercado Pago está conectado. Ahí te va a llegar tu parte de cada venta."
                : "Conectá tu Mercado Pago para cobrar tu parte de cada venta directo en tu cuenta."}
            </p>
            <Link href="/fotografo/configuracion?tab=mercadopago">
              <Button size="sm" variant={data.mpConnected ? "outline" : "primary"}>
                {data.mpConnected ? "Ver mi conexión" : "Conectar Mercado Pago"}
              </Button>
            </Link>
          </Card>

          {data.agencies.length === 0 && (
            <Card className="space-y-2">
              <p>Todavía no trabajás para ninguna agencia.</p>
              <Link className="text-sm underline" href="/fotografo/agencias/directorio">Buscar agencias cerca tuyo</Link>
            </Card>
          )}

          {data.agencies.map((a) => (
            <Card key={a.agencyId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{a.name}</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
                  {a.status === "ACTIVE" ? `En el equipo · cobrás ${a.commissionLabel}` : "Solicitud enviada, esperando respuesta"}
                </span>
              </div>
              {a.status === "ACTIVE" && (
                <>
                  <p className="text-sm text-[#6b7280]">Fotos tuyas subidas: {a.myPhotosCount}</p>
                  {a.albums.length > 0 && (
                    <ul className="text-sm">
                      {a.albums.map((al) => (
                        <li key={al.publicSlug}>
                          <a className="underline" href={`/album/${al.publicSlug}`} target="_blank" rel="noreferrer">{al.title}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-[#6b7280]">La subida por FTP y DNX FLUX y el detalle de lo cobrado llegan en las próximas etapas.</p>
                </>
              )}
              {a.needsTerms && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium">La agencia cambió sus condiciones. Aceptalas para seguir subiendo fotos.</p>
                  <pre className="whitespace-pre-wrap text-xs">{a.terms}</pre>
                  <Button size="sm" onClick={async () => {
                    const res = await fetch(`/api/fotografo/agencias/mis-agencias/${a.agencyId}/condiciones`, {
                      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ acceptTerms: true }),
                    });
                    if (!res.ok) setError((await res.json().catch(() => ({}))).error || "No se pudo guardar.");
                    load();
                  }}>Acepto las condiciones</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AgencyPageFrame>
  );
}
```

- [ ] **Step 2: Directorio**

Create `apps/compramelafoto/app/fotografo/agencias/directorio/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

type Row = {
  agencyId: number; name: string; description: string | null; city: string | null; distanceKm: number | null;
  commissionLabel: string; myStatus: "ACTIVE" | "REQUESTED" | null;
};

const HELP = AGENCY_SECTIONS.find((s) => s.id === "directorio")!.help;

function RequestBox({ agencyId, onDone }: { agencyId: number; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <textarea className="w-full rounded-xl border p-2 text-sm" rows={2} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="Contales quién sos, qué equipo tenés, si tu cámara tiene FTP…" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        Acepto las condiciones de la agencia (las vas a ver completas si te aceptan).
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button size="sm" disabled={!accept} onClick={async () => {
        const res = await fetch("/api/fotografo/agencias/directorio", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agencyId, message, acceptTerms: true }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error || "No se pudo enviar.");
        else onDone();
      }}>Enviar solicitud</Button>
    </div>
  );
}

export default function DirectorioPage() {
  const [data, setData] = useState<{ noLocation: boolean; agencies: Row[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/fotografo/agencias/directorio", { credentials: "include" });
    setData(await res.json().catch(() => ({ noLocation: false, agencies: [] })));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <AgencyPageFrame title="Directorio de agencias" subtitle={HELP}>
      {data?.noLocation && (
        <Card className="mb-4 text-sm">
          Para ordenar las agencias por cercanía, cargá tu ubicación en{" "}
          <Link className="underline" href="/fotografo/configuracion?tab=datos">tu perfil</Link>.
        </Card>
      )}
      {data && data.agencies.length === 0 && <Card>Todavía no hay agencias en el directorio cerca tuyo.</Card>}
      <div className="space-y-3">
        {data?.agencies.map((a) => (
          <Card key={a.agencyId} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">{a.name}</h2>
                <p className="text-xs text-[#6b7280]">
                  {[a.city, a.distanceKm !== null ? `a ${a.distanceKm} km` : null, `paga ${a.commissionLabel} por venta`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {a.myStatus === "ACTIVE" && <span className="text-sm">Ya estás en el equipo</span>}
              {a.myStatus === "REQUESTED" && <span className="text-sm">Solicitud enviada</span>}
              {a.myStatus === null && open !== a.agencyId && (
                <Button size="sm" onClick={() => setOpen(a.agencyId)}>Pedir sumarme</Button>
              )}
            </div>
            {a.description && <p className="text-sm text-[#6b7280]">{a.description}</p>}
            {open === a.agencyId && <RequestBox agencyId={a.agencyId} onDone={() => { setOpen(null); load(); }} />}
          </Card>
        ))}
      </div>
    </AgencyPageFrame>
  );
}
```

- [ ] **Step 3: Página del link de invitación**

Create `apps/compramelafoto/app/agencias/unirse/page.tsx`:

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Preview = {
  agency: { name: string; description: string | null; commissionLabel: string; terms: string };
  alreadyActive: boolean;
  isOwner: boolean;
};

function Join() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);

  useEffect(() => {
    fetch(`/api/fotografo/agencias/unirse?token=${encodeURIComponent(token)}`, { credentials: "include" }).then(async (res) => {
      if (res.status === 401) {
        router.push(`/fotografo/login?redirect=${encodeURIComponent(`/agencias/unirse?token=${token}`)}`);
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (res.ok) setPreview(d);
      else setError(d.error || "Este link no funciona.");
    });
  }, [token, router]);

  if (error) return <Card>{error}</Card>;
  if (!preview) return <p className="text-gray-600">Cargando...</p>;
  if (preview.isOwner) return <Card>Sos el dueño de {preview.agency.name}. Este link es para tu equipo.</Card>;
  if (preview.alreadyActive) {
    return (
      <Card className="space-y-3">
        <p>Ya sos parte del equipo de {preview.agency.name}.</p>
        <Button onClick={() => router.push("/fotografo/agencias/mis-agencias")}>Ir a Mis agencias</Button>
      </Card>
    );
  }
  return (
    <Card className="space-y-4">
      <h1 className="text-2xl font-semibold">Sumate al equipo de {preview.agency.name}</h1>
      {preview.agency.description && <p className="text-[#6b7280]">{preview.agency.description}</p>}
      <p>Por cada venta de tus fotos cobrás <strong>{preview.agency.commissionLabel}</strong>, directo en tu Mercado Pago.</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm">{preview.agency.terms}</pre>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        Leí y acepto las condiciones de la agencia.
      </label>
      <Button disabled={!accept} onClick={async () => {
        const res = await fetch("/api/fotografo/agencias/unirse", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, acceptTerms: true }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error || "No pudimos sumarte.");
        else router.push("/fotografo/agencias/mis-agencias");
      }}>Sumarme al equipo</Button>
    </Card>
  );
}

export default function UnirseAgenciaPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Suspense fallback={<p className="text-gray-600">Cargando...</p>}>
          <Join />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `cd apps/compramelafoto && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck`
Expected: 0 errores.

Check that `/fotografo/login` honors `?redirect=`: `grep -n "redirect" app/fotografo/login/page.tsx`. If it uses another name (e.g. `next`), change the parameter in Step 3 to match.

Visual (dev local, base de prueba, dos usuarios fotógrafos de prueba): A crea agencia y genera link; B abre el link sin sesión → va al login → vuelve, ve condiciones y porcentaje, acepta → "Mis agencias" lo muestra en el equipo; A marca "Aparecer en el directorio" con punto en el mapa; C (con ubicación en su perfil) ve la agencia en el Directorio, pide sumarse; A la acepta en Equipo.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/fotografo/agencias/mis-agencias apps/compramelafoto/app/fotografo/agencias/directorio apps/compramelafoto/app/agencias/unirse
git commit -m "Modo agencia: pantallas Mis agencias, Directorio y link de invitación"
```

---

### Task 13: Migración en las cinco bases, PR y verificación en producción

**Files:** ninguno nuevo.

- [ ] **Step 1: Correr todos los tests y el typecheck**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck`
Expected: todos PASS y 0 errores.

- [ ] **Step 2: Aplicar la migración en las cinco bases (antes del deploy)**

Simulación primero:
Run: `cd packages/db && pnpm exec tsx scripts/migraciones-cinco-bases.mts --bases ~/neon-bases.json --solo 20261120120000_clf_agencias`
Expected: lista las cinco bases con la migración pendiente y nada aplicado.

Aplicar:
Run: `cd packages/db && pnpm exec tsx scripts/migraciones-cinco-bases.mts --bases ~/neon-bases.json --aplicar --solo 20261120120000_clf_agencias`
Expected: aplicada y registrada en `_prisma_migrations` en las cinco. Si `~/neon-bases.json` no existe, pedírselo a Daniel (no inventar cadenas de conexión; nunca escribir credenciales en archivos del repo).

Verificación en CLF producción (Neon `divine-hall-10689679`, rama `br-autumn-rain-ad18wq7y`, siempre con `branch_id` explícito):
`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Agency%' ORDER BY 1;`
Expected: `Agency`, `AgencyAlbum`, `AgencyInvite`, `AgencyMember`, `AgencyPlace`.

- [ ] **Step 3: PR**

```bash
git push -u origin docs/clf-modo-agencia
gh pr create --base main --title "CLF: modo agencia, etapa 1 (agencia y equipo)" --body "<resumen en español: qué se agrega, que la migración ya está aplicada en las cinco bases, cómo se probó; terminar con 🤖 Generated with [Claude Code](https://claude.com/claude-code)>"
```

Wait for CI (`tipos-y-pruebas` + Vercel). If green, merge (Daniel lo autorizó en general).

- [ ] **Step 4: Verificar en producción**

After the deploy of `compramelafoto-dnxsuite` finishes:
- `curl -s -o /dev/null -w "%{http_code}" https://www.compramelafoto.com/api/fotografo/agencias/mi-agencia` → `401` (sin sesión, la ruta existe).
- `https://www.compramelafoto.com/agencias/unirse?token=x` → redirige al login.
- Confirm no regresión in uploads of a normal public album: `SELECT count(*) FROM "AgencyAlbum";` = 0 → `ensureAlbumUploadAccess` takes the old path for every album.

- [ ] **Step 5: Avisar a Daniel**

Resumen en español no técnico: qué puede hacer Diego ya (crear agencia, invitar, porcentajes, álbum de agencia, directorio), qué todavía no (subir por FTP/DNX FLUX, reparto de plata, panel antipuenteo: etapas 2 a 5) y el link para probar.
