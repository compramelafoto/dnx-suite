# Etapa 0.1 — Quién ve qué: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dueño de un workspace de FOTOFFICE puede invitar a su equipo con roles fijos (Dueño, Administrador, Equipo; Colaborador preparado y oculto), encender y apagar sus módulos por familia con dependencias, y guardar su tipo de organización; todo el sistema usa una única política de permisos en la que Equipo opera todo y sólo Configuración, Módulos y Equipo quedan para Dueño/Administrador.

**Architecture:** Una política pura (`lib/access/policy.ts`) define la matriz rol × capacidad y los predicados existentes (`canManageWorkspaceSettings`, `canManageMembers`, etc.) pasan a delegar en ella. El catálogo de módulos suma familia, dependencias y marca de comisión; una función pura calcula dependencias y paquetes sugeridos por tipo. Invitaciones de equipo copian el patrón probado de `MemberInvitation` (token SHA-256, un uso, email de sesión igual, claim atómico) y todo cambio administrativo queda en `WorkspaceAdminEvent`.

**Tech Stack:** Next.js App Router (server components + server actions con `useActionState`), Prisma (`@repo/db`, esquema compartido en `packages/db/prisma/schema.prisma`), Vitest 3, Resend vía `lib/communications`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-29-etapa-0-1-quien-ve-que-design.md`

## Global Constraints

- Trabajar en un worktree propio creado desde `origin/main` (el `main` local está muy atrasado). Rama: `feat/fotoffice-quien-ve-que`.
- **Ninguna columna nueva en `Workspace`, `WorkspaceMembership` ni `WorkspaceFeatureModule`** (las leen todas las apps). Sólo: `ALTER TYPE "WorkspaceRole" ADD VALUE 'COLLABORATOR'`, tablas nuevas `WorkspaceInvitation` y `WorkspaceAdminEvent`, y columna `FotofficeWorkspaceBranding.organizationType TEXT`.
- Las tablas van **antes** que el código: la migración se aplica a mano en las bases y se registra con `migrate resolve`/INSERT con checksum (procedimiento de `packages/db/docs/MIGRACION-COBERTURAS.md`). No se fusiona el PR sin eso.
- Roles visibles: `WORKSPACE_OWNER`→"Dueño", `WORKSPACE_ADMIN`→"Administrador", `STAFF`→"Equipo", `COLLABORATOR`→"Colaborador". El legacy `ADMIN` equivale a Administrador y `MEMBER` a Equipo.
- Colaborador **no se ofrece** al invitar mientras el módulo `projects` no esté `AVAILABLE` en el registry.
- Invitación de equipo: vence a los **7 días**, un solo uso, email de sesión = email invitado, token crudo nunca guardado.
- Apagar un módulo nunca borra datos. Módulos con comisión (`membership-dues`, `bookings`, `courses-sales`) no se encienden desde el workspace: "Pedir activación".
- Textos de interfaz en español rioplatense, sin tecnicismos.
- Comandos (desde `apps/fotoffice`): tests `npx vitest run <ruta>`; tipos `npx tsc --noEmit -p tsconfig.json`; todo `npm test`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## File Structure

**Crear**
- `packages/db/prisma/migrations/20260930120000_fotoffice_equipo_y_modulos/migration.sql` — SQL aditivo.
- `packages/db/docs/MIGRACION-EQUIPO-Y-MODULOS.md` — procedimiento manual por base.
- `packages/db/src/fotoffice-team.ts` — capa de datos de equipo e invitaciones (transacciones).
- `apps/fotoffice/lib/access/roles.ts` — etiquetas y normalización de roles.
- `apps/fotoffice/lib/access/policy.ts` — matriz rol × capacidad (pura).
- `apps/fotoffice/lib/access/responsable.ts` — filtro "sólo lo asignado" (puro).
- `apps/fotoffice/lib/modules/dependencies.ts` — encender/apagar con dependencias (puro).
- `apps/fotoffice/lib/modules/suggested.ts` — paquete sugerido y orden de familias por tipo (puro).
- `apps/fotoffice/lib/workspace-type.ts` — leer/guardar el tipo de organización.
- `apps/fotoffice/lib/team/rules.ts` — reglas puras del equipo (último dueño, admin vs dueño, roles ofrecidos).
- `apps/fotoffice/lib/team/invitation-email.ts` — cuerpo del correo.
- `apps/fotoffice/lib/team/invite.ts` — emitir y enviar una invitación (server-only).
- `apps/fotoffice/lib/team/continuity.ts` — cookie para volver a la invitación tras registrarse.
- `apps/fotoffice/app/workspace/configuracion/equipo/{page.tsx,actions.ts,equipo-client.tsx}`.
- `apps/fotoffice/app/workspace/configuracion/modulos/{page.tsx,actions.ts,modulos-client.tsx}`.
- `apps/fotoffice/app/invitacion/equipo/[token]/{page.tsx,actions.ts,aceptar-form.tsx}`.
- Tests `*.test.ts` junto a cada archivo de `lib/` y `actions.ts`.

**Modificar**
- `packages/db/prisma/schema.prisma` — enum, 2 modelos, 1 columna, relaciones inversas.
- `packages/auth-guards/src/index.ts:17` y `packages/auth-guards/src/shims/repo-db.d.ts:57` — sumar `"COLLABORATOR"`.
- `packages/db/package.json` — export `./fotoffice-team`.
- `apps/fotoffice/lib/workspace-settings-access.ts`, `lib/members/role-policy.ts`, `lib/coverages/access-policy.ts`, `lib/raffles/access.ts`, `lib/payments/connect/authz.ts` y sus llamadores listados en la Task 3.
- `apps/fotoffice/lib/modules/registry.ts` (+ test) — `family`, `dependsOn`, `platformFee`.
- `apps/fotoffice/lib/landing/tipos.ts`, `lib/landing/catalogo.ts` (+ tests) — tipo `estudio`, texto de la ficha `equipo`.
- `apps/fotoffice/lib/post-login.ts` (+ test) — continuidad de invitación de equipo.
- `apps/fotoffice/components/shell/shell-nav.tsx` — ítems Equipo y Módulos en "Institución".
- `apps/fotoffice/app/workspace/configuracion/page.tsx` — tarjetas a Equipo y Módulos.
- `apps/fotoffice/app/workspace/page.tsx` — aviso "Elegí el tipo de organización" para Dueño/Admin.

---

### Task 0: Worktree y línea base

- [ ] **Step 1: Crear el worktree desde origin/main**

```bash
cd ~/Desktop/PROGRAMACIONES/dnx-suite
git fetch origin
git worktree add -b feat/fotoffice-quien-ve-que ../dnx-fotoffice-quien-ve-que origin/main
cd ../dnx-fotoffice-quien-ve-que && npm install
```

- [ ] **Step 2: Verificar que la línea base pasa**

Run: `cd apps/fotoffice && npx prisma generate --schema ../../packages/db/prisma/schema.prisma && npm test && npx tsc --noEmit -p tsconfig.json`
Expected: todos los tests en verde y sin errores de tipos. Si algo falla antes de tocar nada, anotarlo en el reporte y no seguir.

---

### Task 1: Esquema, migración y roles en paquetes compartidos

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (enum `WorkspaceRole` ~L10089, `model Workspace` ~L7058, `model FotofficeWorkspaceBranding` ~L7132, `model User` ~L36)
- Create: `packages/db/prisma/migrations/20260930120000_fotoffice_equipo_y_modulos/migration.sql`
- Create: `packages/db/docs/MIGRACION-EQUIPO-Y-MODULOS.md`
- Modify: `packages/auth-guards/src/index.ts:17`, `packages/auth-guards/src/shims/repo-db.d.ts:57`

**Interfaces:**
- Produces: `WorkspaceRole.COLLABORATOR`; modelos Prisma `WorkspaceInvitation`, `WorkspaceAdminEvent`; campo `FotofficeWorkspaceBranding.organizationType: string | null`.

- [ ] **Step 1: Editar el esquema**

En `enum WorkspaceRole` agregar `COLLABORATOR` al final. En `model FotofficeWorkspaceBranding`, debajo de `activityType`:

```prisma
  /// Tipo de organización elegido en Configuración → Módulos (ids de lib/landing/tipos.ts). null = sin elegir.
  organizationType      String?
```

Agregar los modelos (cerca de `WorkspaceMembership`):

```prisma
/// Invitación a sumarse al equipo de un workspace. Mismo patrón que MemberInvitation:
/// el estado se deriva de las fechas; el token crudo nunca se guarda.
model WorkspaceInvitation {
  id               String        @id @default(cuid())
  workspaceId      String
  /// Normalizado en minúsculas. Aceptar exige el mismo email en la sesión.
  email            String
  role             WorkspaceRole
  tokenHash        String        @unique
  expiresAt        DateTime
  acceptedAt       DateTime?
  acceptedByUserId Int?
  revokedAt        DateTime?
  sentAt           DateTime?
  sendFailedAt     DateTime?
  invitedByUserId  Int?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  workspace        Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy        User?         @relation("WorkspaceInvitationInviter", fields: [invitedByUserId], references: [id], onDelete: SetNull)
  acceptedBy       User?         @relation("WorkspaceInvitationAcceptor", fields: [acceptedByUserId], references: [id], onDelete: SetNull)

  @@index([workspaceId, email])
  @@index([expiresAt])
}

/// Bitácora de cambios administrativos del workspace: equipo y módulos.
model WorkspaceAdminEvent {
  id           String    @id @default(cuid())
  workspaceId  String
  /// null = sistema.
  actorUserId  Int?
  targetUserId Int?
  targetEmail  String?
  /// INVITED | INVITE_REVOKED | ACCEPTED | ROLE_CHANGED | REMOVED | MODULE_ON | MODULE_OFF | MODULE_REQUESTED | ORG_TYPE_SET
  kind         String
  fromRole     String?
  toRole       String?
  moduleKey    String?
  detail       String?
  createdAt    DateTime  @default(now())
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
}
```

En `model Workspace` agregar `workspaceInvitations WorkspaceInvitation[]` y `adminEvents WorkspaceAdminEvent[]`. En `model User` agregar `workspaceInvitationsSent WorkspaceInvitation[] @relation("WorkspaceInvitationInviter")` y `workspaceInvitationsAccepted WorkspaceInvitation[] @relation("WorkspaceInvitationAcceptor")`.

- [ ] **Step 2: Validar y generar el cliente**

Run: `cd packages/db && npx prisma validate && npx prisma generate`
Expected: "The schema … is valid" y cliente generado.

- [ ] **Step 3: Escribir la migración SQL**

Generar el SQL de las tablas con `npx prisma migrate diff --from-schema-datamodel <esquema de origin/main guardado en /tmp> --to-schema-datamodel prisma/schema.prisma --script` y dejarlo así (el `ALTER TYPE` va **fuera** de transacción y primero):

```sql
-- Etapa 0.1 FOTOFFICE: equipo, invitaciones, bitácora y tipo de organización.
-- Puramente ADITIVO. No agrega columnas a Workspace, WorkspaceMembership ni
-- WorkspaceFeatureModule, que leen todas las apps con el mismo cliente Prisma.

-- 1) Rol nuevo. ADD VALUE no puede correr dentro de la misma transacción que lo use.
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'COLLABORATOR';

-- 2) Tipo de organización (tabla propia de FOTOFFICE).
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN "organizationType" TEXT;

-- 3) Invitaciones de equipo.
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendFailedAt" TIMESTAMP(3),
    "invitedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_workspaceId_email_idx" ON "WorkspaceInvitation"("workspaceId", "email");
CREATE INDEX "WorkspaceInvitation_expiresAt_idx" ON "WorkspaceInvitation"("expiresAt");
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Bitácora administrativa.
CREATE TABLE "WorkspaceAdminEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "targetUserId" INTEGER,
    "targetEmail" TEXT,
    "kind" TEXT NOT NULL,
    "fromRole" TEXT,
    "toRole" TEXT,
    "moduleKey" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceAdminEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceAdminEvent_workspaceId_createdAt_idx" ON "WorkspaceAdminEvent"("workspaceId", "createdAt");
ALTER TABLE "WorkspaceAdminEvent" ADD CONSTRAINT "WorkspaceAdminEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Comparar con la salida de `migrate diff`: nombres de índices y FKs tienen que coincidir exactamente con lo que Prisma espera.

- [ ] **Step 4: Documentar el procedimiento manual**

`packages/db/docs/MIGRACION-EQUIPO-Y-MODULOS.md` con: checksum (`shasum -a 256 migration.sql`), bases destino (`compramelafoto/development` = producción FOTOFFICE, `compramelafoto/production`, `clickaton-production`, `dnx-suite-staging`; verificar si InfoSpot tiene `Workspace` y `FotofficeWorkspaceBranding` — si no, queda afuera), consulta previa (`SELECT 1 FROM "_prisma_migrations" WHERE migration_name='20260930120000_fotoffice_equipo_y_modulos'`), ejecución en dos partes (la sentencia `ALTER TYPE` sola; el resto dentro de `BEGIN … COMMIT` junto con el INSERT en `_prisma_migrations` con el checksum), verificación (existen las 2 tablas, la columna y el valor del enum: `SELECT unnest(enum_range(NULL::"WorkspaceRole"))`) y rollback (`DROP TABLE` x2, `ALTER TABLE … DROP COLUMN`, `DELETE FROM _prisma_migrations`; el valor de enum no se puede quitar y es inofensivo).

- [ ] **Step 5: Sumar el rol a auth-guards**

En `packages/auth-guards/src/index.ts:17` y `packages/auth-guards/src/shims/repo-db.d.ts:57`:

```ts
type WorkspaceRole = "WORKSPACE_OWNER" | "WORKSPACE_ADMIN" | "STAFF" | "COLLABORATOR";
```

Buscar `switch` exhaustivos sobre el rol en todo el repo: `git grep -n "case \"STAFF\"" -- apps packages`. Si aparece alguno sin `default`, agregar el caso `COLLABORATOR` con el comportamiento de "sin permisos".

- [ ] **Step 6: Chequear tipos de las apps afectadas**

Run: `npx turbo run build --filter=@repo/auth-guards... --dry=json | head` para listar dependientes; luego en cada app dependiente `npx tsc --noEmit -p tsconfig.json`. Como mínimo: `apps/fotoffice`, `apps/fotorank`, `apps/compramelafoto`, `apps/clickaton`.
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add packages/db packages/auth-guards
git commit -m "Esquema de equipo, invitaciones, bitácora y tipo de organización (FOTOFFICE)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Política central de acceso

**Files:**
- Create: `apps/fotoffice/lib/access/roles.ts`, `lib/access/policy.ts`, `lib/access/responsable.ts`
- Test: `apps/fotoffice/lib/access/policy.test.ts`, `lib/access/responsable.test.ts`

**Interfaces:**
- Produces:
  - `type RolCanonico = "OWNER" | "ADMIN" | "EQUIPO" | "COLABORADOR"`
  - `normalizarRol(role: string | null | undefined): RolCanonico | null`
  - `etiquetaRol(role: string | null | undefined): string`
  - `type Capacidad = "operar" | "verDinero" | "configurar" | "gestionarEquipo" | "transferirPropiedad" | "verSoloAsignado"`
  - `puede(role: string | null | undefined, capacidad: Capacidad): boolean`
  - `filtroSoloAsignado(role: string | null | undefined, userId: number): { responsableUserId: number } | Record<string, never>`

- [ ] **Step 1: Escribir los tests**

`lib/access/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { puede, type Capacidad } from "./policy";
import { etiquetaRol, normalizarRol } from "./roles";

const MATRIZ: Record<string, Record<Capacidad, boolean>> = {
  WORKSPACE_OWNER: { operar: true, verDinero: true, configurar: true, gestionarEquipo: true, transferirPropiedad: true, verSoloAsignado: false },
  WORKSPACE_ADMIN: { operar: true, verDinero: true, configurar: true, gestionarEquipo: true, transferirPropiedad: false, verSoloAsignado: false },
  STAFF: { operar: true, verDinero: true, configurar: false, gestionarEquipo: false, transferirPropiedad: false, verSoloAsignado: false },
  COLLABORATOR: { operar: false, verDinero: false, configurar: false, gestionarEquipo: false, transferirPropiedad: false, verSoloAsignado: true },
};

describe("puede — matriz rol × capacidad", () => {
  for (const [rol, fila] of Object.entries(MATRIZ)) {
    for (const [cap, esperado] of Object.entries(fila)) {
      it(`${rol} · ${cap} = ${esperado}`, () => {
        expect(puede(rol, cap as Capacidad)).toBe(esperado);
      });
    }
  }
  it("legacy ADMIN equivale a Administrador", () => {
    expect(puede("ADMIN", "configurar")).toBe(true);
    expect(puede("ADMIN", "transferirPropiedad")).toBe(false);
  });
  it("legacy MEMBER equivale a Equipo", () => {
    expect(puede("MEMBER", "operar")).toBe(true);
    expect(puede("MEMBER", "configurar")).toBe(false);
  });
  it("sin rol o rol desconocido no otorga nada", () => {
    for (const cap of Object.keys(MATRIZ.STAFF) as Capacidad[]) {
      expect(puede(null, cap)).toBe(false);
      expect(puede(undefined, cap)).toBe(false);
      expect(puede("ALGO_INVENTADO", cap)).toBe(false);
    }
  });
});

describe("roles", () => {
  it("normaliza y etiqueta", () => {
    expect(normalizarRol("STAFF")).toBe("EQUIPO");
    expect(etiquetaRol("WORKSPACE_OWNER")).toBe("Dueño");
    expect(etiquetaRol("WORKSPACE_ADMIN")).toBe("Administrador");
    expect(etiquetaRol("STAFF")).toBe("Equipo");
    expect(etiquetaRol("COLLABORATOR")).toBe("Colaborador");
    expect(etiquetaRol(null)).toBe("Sin acceso");
  });
});
```

`lib/access/responsable.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filtroSoloAsignado } from "./responsable";

describe("filtroSoloAsignado", () => {
  it("el colaborador sólo ve lo suyo", () => {
    expect(filtroSoloAsignado("COLLABORATOR", 7)).toEqual({ responsableUserId: 7 });
  });
  it("dueño, admin y equipo ven todo", () => {
    for (const r of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "STAFF"]) expect(filtroSoloAsignado(r, 7)).toEqual({});
  });
  it("sin rol no ve nada: filtro imposible", () => {
    expect(filtroSoloAsignado(null, 7)).toEqual({ responsableUserId: -1 });
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/access`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

`lib/access/roles.ts`:

```ts
/** Rol normalizado de FOTOFFICE. Acepta los valores de WorkspaceRole y los legacy de MembershipRole. */
export type RolCanonico = "OWNER" | "ADMIN" | "EQUIPO" | "COLABORADOR";

const MAPA: Record<string, RolCanonico> = {
  WORKSPACE_OWNER: "OWNER",
  WORKSPACE_ADMIN: "ADMIN",
  ADMIN: "ADMIN", // legacy Membership
  STAFF: "EQUIPO",
  MEMBER: "EQUIPO", // legacy Membership
  COLLABORATOR: "COLABORADOR",
};

export function normalizarRol(role: string | null | undefined): RolCanonico | null {
  if (!role) return null;
  return MAPA[role] ?? null;
}

const ETIQUETAS: Record<RolCanonico, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  EQUIPO: "Equipo",
  COLABORADOR: "Colaborador",
};

export function etiquetaRol(role: string | null | undefined): string {
  const r = normalizarRol(role);
  return r ? ETIQUETAS[r] : "Sin acceso";
}
```

`lib/access/policy.ts`:

```ts
import { normalizarRol, type RolCanonico } from "./roles";

/**
 * Única fuente de verdad de permisos de FOTOFFICE (spec 0.1 §3.3).
 * Equipo opera todo; sólo Configuración, Módulos y Equipo son de Dueño/Administrador.
 */
export type Capacidad =
  | "operar"
  | "verDinero"
  | "configurar"
  | "gestionarEquipo"
  | "transferirPropiedad"
  | "verSoloAsignado";

const MATRIZ: Record<RolCanonico, ReadonlySet<Capacidad>> = {
  OWNER: new Set(["operar", "verDinero", "configurar", "gestionarEquipo", "transferirPropiedad"]),
  ADMIN: new Set(["operar", "verDinero", "configurar", "gestionarEquipo"]),
  EQUIPO: new Set(["operar", "verDinero"]),
  COLABORADOR: new Set(["verSoloAsignado"]),
};

export function puede(role: string | null | undefined, capacidad: Capacidad): boolean {
  const r = normalizarRol(role);
  return r ? MATRIZ[r].has(capacidad) : false;
}
```

`lib/access/responsable.ts`:

```ts
import { puede } from "./policy";

/**
 * Filtro Prisma para listados de entidades con `responsableUserId`.
 * Vacío = ve todo. Sin rol = filtro imposible (-1).
 */
export function filtroSoloAsignado(
  role: string | null | undefined,
  userId: number,
): { responsableUserId: number } | Record<string, never> {
  if (puede(role, "operar")) return {};
  if (puede(role, "verSoloAsignado")) return { responsableUserId: userId };
  return { responsableUserId: -1 };
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run lib/access`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/access
git commit -m "Política central de permisos por rol (FOTOFFICE)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Auditoría — las guardas existentes delegan en la política

**Files:**
- Modify: `lib/workspace-settings-access.ts` (+ test), `lib/members/role-policy.ts` (+ test), `lib/coverages/access-policy.ts` (+ test si existe), `lib/raffles/access.ts`, `lib/payments/connect/authz.ts`
- Modify (llamadores de `canManageWorkspaceCollection` según la tabla del Step 4)
- Test: `lib/access/auditoria.test.ts`

**Interfaces:**
- Consumes: `puede()` de Task 2.
- Produces:
  - `canManageWorkspaceSettings(role)` ≡ `puede(role,"configurar")` (misma firma).
  - `canManageMembers(role)` ≡ `puede(role,"operar")` (misma firma; cambia comportamiento: Equipo ahora opera socios).
  - `canConfigureMembers(role)` ≡ `puede(role,"configurar")` — nuevo, para categorías, valores de cuota, diseñador y permisos de carnets.
  - `canCoordinateCoverages(role)` ≡ `puede(role,"operar")`; `canConfigureCoverages(role)` ≡ `puede(role,"configurar")` — nuevo.
  - `canOperateWorkspaceCollection(userId, workspaceId): Promise<boolean>` — nuevo, `operar`. `canManageWorkspaceCollection` queda como `configurar`.

- [ ] **Step 1: Test de auditoría que fija el comportamiento buscado**

`lib/access/auditoria.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { canConfigureMembers, canManageMembers } from "@/lib/members/role-policy";
import { canConfigureCoverages, canCoordinateCoverages, canReviewCoverages } from "@/lib/coverages/access-policy";

describe("auditoría 0.1 — Equipo opera, sólo configura Dueño/Admin", () => {
  it("Equipo opera socios pero no configura", () => {
    expect(canManageMembers("STAFF")).toBe(true);
    expect(canConfigureMembers("STAFF")).toBe(false);
  });
  it("Equipo coordina coberturas pero no las configura", () => {
    expect(canCoordinateCoverages("STAFF")).toBe(true);
    expect(canReviewCoverages("STAFF")).toBe(true);
    expect(canConfigureCoverages("STAFF")).toBe(false);
  });
  it("Equipo no toca configuración del workspace", () => {
    expect(canManageWorkspaceSettings("STAFF")).toBe(false);
  });
  it("Colaborador no opera ni configura nada existente", () => {
    for (const f of [canManageMembers, canConfigureMembers, canCoordinateCoverages, canReviewCoverages, canConfigureCoverages, canManageWorkspaceSettings]) {
      expect(f("COLLABORATOR")).toBe(false);
    }
  });
  it("Dueño y Admin pueden todo lo anterior", () => {
    for (const r of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]) {
      for (const f of [canManageMembers, canConfigureMembers, canCoordinateCoverages, canReviewCoverages, canConfigureCoverages, canManageWorkspaceSettings]) {
        expect(f(r)).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run lib/access/auditoria.test.ts`
Expected: FAIL (`canConfigureMembers`/`canConfigureCoverages` no existen; `canManageMembers("STAFF")` es false).

- [ ] **Step 3: Reescribir los predicados**

`lib/workspace-settings-access.ts` — el cuerpo pasa a `return puede(role, "configurar");` (conservar el comentario, agregando que delega en `lib/access/policy`).

`lib/members/role-policy.ts`:

```ts
import { puede } from "@/lib/access/policy";

/** Operar socios: alta, edición, importación, invitaciones, cuotas, carnets, solicitudes, exportar. Equipo incluido. */
export function canManageMembers(role: string | null | undefined): boolean {
  return puede(role, "operar");
}

/** Configurar socios: categorías, valores de cuota, calendario, diseñador y permisos de carnets. Sólo Dueño/Admin. */
export function canConfigureMembers(role: string | null | undefined): boolean {
  return puede(role, "configurar");
}
```

`lib/coverages/access-policy.ts`: `canCoordinateCoverages` → `puede(role,"operar")`; `canReviewCoverages` → `puede(role,"operar")`; nuevo `canConfigureCoverages` → `puede(role,"configurar")`; `transitionNeedsCoordinator` sin cambios.

`lib/raffles/access.ts`: `requireRafflesAdmin` usa `puede(ctx.role, "operar")` (crear, anunciar, sellar, resolver y cancelar sorteos pasan a Equipo). Dejar un comentario explicando el cambio.

`lib/payments/connect/authz.ts`: extraer la búsqueda de rol en `async function resolveCollectionRole(userId, workspaceId): Promise<string | null>` (WorkspaceMembership o Membership legacy, como hoy) y exponer:

```ts
export async function canManageWorkspaceCollection(userId: number, workspaceId: string): Promise<boolean> {
  return puede(await resolveCollectionRole(userId, workspaceId), "configurar");
}
export async function canOperateWorkspaceCollection(userId: number, workspaceId: string): Promise<boolean> {
  return puede(await resolveCollectionRole(userId, workspaceId), "operar");
}
```

Actualizar los tests existentes que afirmaban el comportamiento viejo (`lib/members/role-policy.test.ts`: "STAFF NO puede administrar" pasa a "STAFF opera socios (0.1)"; `lib/workspace-settings-access.test.ts` no cambia).

- [ ] **Step 4: Repartir llamadores entre operar y configurar**

Tabla de la auditoría (anotar en el mensaje de commit):

| Archivo | Antes | Después |
|---|---|---|
| `app/(shell)/members/categories/*` | `requireMembersManageContext` | nuevo `requireMembersConfigureContext` (Dueño/Admin) en `lib/members/access.ts` |
| `members/{new,import,[id]/edit}`, `app/actions/{members,members-import,member-access}.ts` | manage | manage (ahora incluye Equipo) |
| `app/actions/{generate-dues,manual-payment,issue-cards,membership-applications,payments-import,recommendations}.ts`, `members/cuotas/*` (operación), `members/solicitudes`, `members/[id]` | `canManageWorkspaceCollection` | `canOperateWorkspaceCollection` |
| `app/actions/{dues-settings,card-operators,split-consent}.ts`, `members/carnets/permisos`, `api/payments/mercadopago/connect/start`, `workspace/configuracion/cobros/page.tsx`, pantallas de valores/calendario de cuotas | `canManageWorkspaceCollection` | sin cambio (configurar) |
| `members/disenador/*`, `app/actions/carnet-template.ts` | `canDesignTemplates` | sin cambio |
| `coberturas/configuracion/page.tsx` | `requireCoveragesCoordinator` | nuevo `requireCoveragesConfigurator` en `lib/coverages/access.ts` (usa `canConfigureCoverages`) |
| Resto de `coberturas/*` que usaba coordinator | coordinator | coordinator (ahora incluye Equipo) |
| Reservas, Caja, Clientes | — | sin cambio (ya separan operar/configurar) |

Para cada archivo: `git grep -n "<función vieja>" -- apps/fotoffice` y reemplazar según la tabla. Si una pantalla de cuotas mezcla operación y configuración, la operación usa `canOperate…` y los formularios de configuración siguen con `canManage…` + `fieldset disabled`.

- [ ] **Step 5: Correr toda la suite y los tipos**

Run: `npm test && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. Si falla `lib/workspace-role-consistency.test.ts`, no cambiar el literal que exige en `app/(shell)/layout.tsx`.

- [ ] **Step 6: Commit**

```bash
git add -A apps/fotoffice
git commit -m "Equipo opera todo; sólo Dueño y Administrador configuran

Auditoría de guardas: socios, cuotas, carnets (emitir), solicitudes, sorteos y
coberturas pasan a Equipo; categorías, valores, diseño, permisos de carnets,
Mercado Pago y configuración de coberturas quedan para Dueño/Administrador.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Catálogo de módulos con familias, dependencias y comisión

**Files:**
- Modify: `apps/fotoffice/lib/modules/registry.ts`, `lib/modules/registry.test.ts`
- Create: `apps/fotoffice/lib/modules/dependencies.ts`, `lib/modules/dependencies.test.ts`

**Interfaces:**
- Produces:
  - `type ModuleFamily = "base" | "negocio" | "institucion" | "coberturas" | "formacion" | "espacios"`
  - `ModuleDefinition` suma `family: ModuleFamily; dependsOn?: string[]; platformFee?: boolean`
  - `FAMILY_LABELS: Record<ModuleFamily, string>`
  - `alEncender(clave: string, encendidos: ReadonlySet<string>): string[]` — dependencias faltantes (transitivas, en orden de encendido)
  - `alApagar(clave: string, encendidos: ReadonlySet<string>): string[]` — dependientes encendidos (transitivos)

- [ ] **Step 1: Tests**

Agregar a `lib/modules/registry.test.ts`:

```ts
import { FAMILY_LABELS, MODULE_REGISTRY, getModuleDefinition } from "./registry";

describe("familias y dependencias (0.1)", () => {
  it("todo módulo tiene familia con etiqueta", () => {
    for (const m of MODULE_REGISTRY) expect(FAMILY_LABELS[m.family]).toBeTruthy();
  });
  it("dependsOn apunta a claves existentes", () => {
    for (const m of MODULE_REGISTRY) for (const d of m.dependsOn ?? []) expect(getModuleDefinition(d)).toBeDefined();
  });
  it("los módulos con comisión son exactamente cuotas, reservas y cursos", () => {
    expect(MODULE_REGISTRY.filter((m) => m.platformFee).map((m) => m.key).sort()).toEqual(
      ["bookings", "courses-sales", "membership-dues"],
    );
  });
});
```

`lib/modules/dependencies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { alApagar, alEncender } from "./dependencies";

describe("dependencias de módulos", () => {
  it("encender cuotas sin socios pide socios", () => {
    expect(alEncender("membership-dues", new Set())).toEqual(["members"]);
  });
  it("encender cuotas con socios no pide nada", () => {
    expect(alEncender("membership-dues", new Set(["members"]))).toEqual([]);
  });
  it("evaluaciones pide cursos", () => {
    expect(alEncender("evaluaciones", new Set())).toEqual(["courses-sales"]);
  });
  it("apagar socios avisa que cuotas deja de funcionar", () => {
    expect(alApagar("members", new Set(["members", "membership-dues", "cash"]))).toEqual(["membership-dues"]);
  });
  it("apagar algo sin dependientes no avisa", () => {
    expect(alApagar("cash", new Set(["cash", "clients"]))).toEqual([]);
  });
  it("no hay ciclos en el catálogo", () => {
    // alEncender termina para toda clave
    for (const k of ["membership-dues", "evaluaciones", "members", "cash"]) expect(Array.isArray(alEncender(k, new Set()))).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/modules`
Expected: FAIL.

- [ ] **Step 3: Implementar**

En `registry.ts` agregar el tipo y etiquetas:

```ts
export type ModuleFamily = "base" | "negocio" | "institucion" | "coberturas" | "formacion" | "espacios";

export const FAMILY_LABELS: Record<ModuleFamily, string> = {
  base: "Base",
  negocio: "Negocio fotográfico",
  institucion: "Institución",
  coberturas: "Coberturas y voluntariado",
  formacion: "Formación",
  espacios: "Espacios",
};
```

Sumar a `ModuleDefinition`: `family: ModuleFamily; dependsOn?: string[]; platformFee?: boolean;` y completar cada entrada:

| key | family | dependsOn | platformFee |
|---|---|---|---|
| courses-sales | formacion | — | true |
| evaluaciones | formacion | ["courses-sales"] | — |
| service-leads | negocio | — | — |
| website | base | — | — |
| bookings | espacios | — | true |
| coverages | coberturas | — | — |
| cash | base | — | — |
| communications | base | — | — |
| events | institucion | — | — |
| clients | base | — | — |
| members | institucion | — | — |
| membership-dues | institucion | ["members"] | true |
| raffles | institucion | — | — |
| governance | institucion | — | — |
| exhibitions | institucion | — | — |
| transparency | institucion | — | — |

Sumar las claves futuras del CRM como `PLANNED` (sin `route`), para que Módulos las muestre como "Próximamente": `quotes` "Consultas y presupuestos" (negocio, orden 26), `orders` "Pedidos" (negocio, 27, dependsOn ["clients"]), `projects` "Proyectos" (negocio, 28), `gallery` "Galería" (negocio, 29, dependsOn ["projects"]), `agenda` "Agenda" (base, 35). **Antes** de agregarlas, correr `git grep -n '"quotes"\|"orders"\|"projects"\|"gallery"\|"agenda"' -- apps/fotoffice/lib/landing` para no chocar con `BASE_DEL_SISTEMA` (el test de catálogo prohíbe que una pseudo-clave de la portada esté en el registry; hoy usa `consultas`, `cobros`, `portal`, `carnets`, `correos`, `equipo`).

`lib/modules/dependencies.ts`:

```ts
import { MODULE_REGISTRY, getModuleDefinition } from "./registry";

/** Dependencias faltantes para encender `clave`, transitivas, en orden de encendido (primero la base). */
export function alEncender(clave: string, encendidos: ReadonlySet<string>): string[] {
  const faltan: string[] = [];
  const visitar = (k: string, camino: Set<string>) => {
    for (const d of getModuleDefinition(k)?.dependsOn ?? []) {
      if (camino.has(d)) continue; // defensa contra ciclos
      visitar(d, new Set([...camino, d]));
      if (!encendidos.has(d) && !faltan.includes(d)) faltan.push(d);
    }
  };
  visitar(clave, new Set([clave]));
  return faltan;
}

/** Módulos encendidos que dejan de funcionar si se apaga `clave` (transitivo). */
export function alApagar(clave: string, encendidos: ReadonlySet<string>): string[] {
  const afectados: string[] = [];
  const pendientes = [clave];
  while (pendientes.length) {
    const actual = pendientes.shift()!;
    for (const m of MODULE_REGISTRY) {
      if (m.dependsOn?.includes(actual) && encendidos.has(m.key) && !afectados.includes(m.key)) {
        afectados.push(m.key);
        pendientes.push(m.key);
      }
    }
  }
  return afectados;
}
```

- [ ] **Step 4: Correr y ver que pasan (incluido el test de catálogo de la portada)**

Run: `npx vitest run lib/modules lib/landing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/modules
git commit -m "Módulos con familia, dependencias y marca de comisión

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tipo "estudio", paquete sugerido y orden de familias

**Files:**
- Modify: `apps/fotoffice/lib/landing/tipos.ts` (+ test), `lib/landing/catalogo.ts` (+ test si cambia)
- Create: `apps/fotoffice/lib/modules/suggested.ts`, `lib/modules/suggested.test.ts`

**Interfaces:**
- Consumes: `MODULE_REGISTRY`, `ModuleFamily`, `alEncender` (Task 4); `TIPOS`, `tipoPorId`, `clavesDe` (existentes).
- Produces:
  - `paqueteSugerido(tipoId: string): string[]` — claves `AVAILABLE`, sin `platformFee`, con dependencias incluidas, sin duplicados.
  - `ordenDeFamilias(tipoId: string | null): ModuleFamily[]`

- [ ] **Step 1: Tests**

`lib/modules/suggested.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TIPOS } from "@/lib/landing/tipos";
import { getModuleDefinition } from "./registry";
import { ordenDeFamilias, paqueteSugerido } from "./suggested";

describe("paqueteSugerido", () => {
  it("cada tipo produce sólo módulos disponibles y sin comisión", () => {
    for (const t of TIPOS) {
      for (const k of paqueteSugerido(t.id)) {
        const m = getModuleDefinition(k)!;
        expect(m.status).toBe("AVAILABLE");
        expect(m.platformFee).not.toBe(true);
      }
    }
  });
  it("estudio incluye caja y clientes", () => {
    const p = paqueteSugerido("estudio");
    expect(p).toContain("cash");
    expect(p).toContain("clients");
  });
  it("sociedad incluye socios aunque cuotas quede afuera por comisión", () => {
    const p = paqueteSugerido("sociedad");
    expect(p).toContain("members");
    expect(p).not.toContain("membership-dues");
  });
  it("tipo desconocido: paquete vacío", () => {
    expect(paqueteSugerido("xyz")).toEqual([]);
  });
});

describe("ordenDeFamilias", () => {
  it("estudio empieza por negocio; sociedad por institución", () => {
    expect(ordenDeFamilias("estudio")[0]).toBe("negocio");
    expect(ordenDeFamilias("sociedad")[0]).toBe("institucion");
  });
  it("siempre devuelve las seis familias", () => {
    expect(new Set(ordenDeFamilias(null)).size).toBe(6);
  });
});
```

En `lib/landing/tipos.test.ts` agregar: `expect(tipoPorId("estudio")).toBeDefined()`.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/modules/suggested.test.ts lib/landing`
Expected: FAIL.

- [ ] **Step 3: Agregar el tipo "estudio"**

En `TIPOS` (después de `local`), respetando los tests existentes (3 destacados, `porque` > 60 caracteres, claves válidas, `proximo` en `EN_CONSTRUCCION`):

```ts
  {
    id: "estudio",
    label: "Tengo un estudio o productora con equipo",
    resumen: "Hacemos eventos y sesiones, atendemos al público y somos varios trabajando a la vez.",
    icono: "tipo-local",
    destacados: [
      {
        key: "consultas",
        porque:
          "Cada consulta entra con el evento, la fecha y el lugar, y cualquiera del equipo la sigue desde donde la dejó el otro, sin preguntar por WhatsApp en qué quedó.",
      },
      {
        key: "cash",
        porque:
          "La caja del mostrador con turnos y arqueo: quien atiende cobra, anota y cierra, y a fin de mes sabés qué entró por cada lado sin juntar papelitos.",
      },
      {
        key: "equipo",
        porque:
          "Invitás a quien atiende con el rol justo: usa todo el sistema para trabajar pero no toca la configuración, y queda registrado quién hizo cada cosa.",
      },
    ],
    ademas: ["clients", "cobros", "website", "correos", "bookings", "courses-sales"],
    proximo: "12",
  },
```

Si el ícono `tipo-local` no sirve para el test de íconos, usar el mismo que `local`.

En `lib/landing/catalogo.ts`, ficha `equipo` de `BASE_DEL_SISTEMA`: reemplazar el texto que promete "permiso por módulo" por roles: `resuelve: "Sumás a quien te ayuda con el rol justo: Administrador, Equipo o Colaborador. Cada uno ve y hace lo que le corresponde, y queda registrado quién hizo qué."` y `pantallas: ["Invitar por correo", "Roles del equipo", "Historial de cambios"]`.

- [ ] **Step 4: Implementar `suggested.ts`**

```ts
import { clavesDe, tipoPorId } from "@/lib/landing/tipos";
import { alEncender } from "./dependencies";
import { getModuleDefinition, type ModuleFamily } from "./registry";

const TODAS: ModuleFamily[] = ["base", "negocio", "institucion", "coberturas", "formacion", "espacios"];

const PRIMERO: Record<string, ModuleFamily[]> = {
  freelance: ["negocio", "base"],
  estudio: ["negocio", "base", "espacios", "formacion"],
  local: ["base", "negocio", "espacios"],
  escuela: ["formacion", "base"],
  sociedad: ["institucion", "espacios", "formacion", "base"],
  agrupacion: ["institucion", "base"],
  ong: ["coberturas", "institucion", "base"],
  espacio: ["espacios", "base"],
};

export function ordenDeFamilias(tipoId: string | null): ModuleFamily[] {
  const primero = (tipoId && PRIMERO[tipoId]) || [];
  return [...primero, ...TODAS.filter((f) => !primero.includes(f))];
}

export function paqueteSugerido(tipoId: string): string[] {
  const tipo = tipoPorId(tipoId);
  if (!tipo) return [];
  const elegidos: string[] = [];
  for (const clave of clavesDe(tipo)) {
    const m = getModuleDefinition(clave);
    if (!m || m.status !== "AVAILABLE" || m.platformFee) continue;
    for (const dep of [...alEncender(clave, new Set(elegidos)), clave]) {
      const d = getModuleDefinition(dep);
      if (d && d.status === "AVAILABLE" && !d.platformFee && !elegidos.includes(dep)) elegidos.push(dep);
    }
  }
  return elegidos;
}
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npx vitest run lib/modules lib/landing`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/modules apps/fotoffice/lib/landing
git commit -m "Tipo 'estudio' y paquete de módulos sugerido por tipo de organización

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Capa de datos de equipo, invitaciones y bitácora

**Files:**
- Create: `apps/fotoffice/lib/team/rules.ts`, `lib/team/rules.test.ts`
- Create: `packages/db/src/fotoffice-team.ts`; Modify: `packages/db/package.json` (export `"./fotoffice-team"` igual que `"./fotoffice-member-invitations"`)
- Create: `apps/fotoffice/lib/workspace-type.ts`, `lib/workspace-type.test.ts`

**Interfaces:**
- Produces (`lib/team/rules.ts`, puro):
  - `type Accion = { tipo: "CAMBIAR_ROL"; nuevoRol: string } | { tipo: "DAR_DE_BAJA" }`
  - `validarAccionSobreMiembro(p: { actorRole: string; objetivoRole: string; esUnoMismo: boolean; duenosRestantes: number; accion: Accion }): string | null` — mensaje de error o null
  - `rolesOfrecidos(actorRole: string, colaboradorDisponible: boolean): string[]`
  - `TEAM_INVITATION_TTL_DAYS = 7`, `teamInvitationExpiryFrom(now?: Date): Date`
- Produces (`@repo/db/fotoffice-team`):
  - `class TeamError extends Error { reason: "ALREADY_MEMBER" | "INVITATION_INVALID" | "NOT_FOUND" }`
  - `createTeamInvitation(input: { workspaceId: string; email: string; role: WorkspaceRole; tokenHash: string; expiresAt: Date; invitedByUserId: number }): Promise<{ id: string; resend: boolean }>`
  - `markTeamInvitationDelivery(id: string, sent: boolean): Promise<void>`
  - `revokeTeamInvitation(workspaceId: string, id: string, actorUserId: number): Promise<void>`
  - `findTeamInvitationByTokenHash(tokenHash: string)` → `{ id, workspaceId, email, role, expiresAt, acceptedAt, revokedAt, workspace: { name } } | null`
  - `acceptTeamInvitation(id: string, userId: number): Promise<{ workspaceId: string }>`
  - `listTeam(workspaceId: string)` → `{ members: { userId, name, email, role, lastLoginAt }[]; invitations: { id, email, role, expiresAt, acceptedAt, revokedAt, sentAt, sendFailedAt }[]; events: WorkspaceAdminEvent[] (últimos 50) }`
  - `changeMemberRole(workspaceId: string, targetUserId: number, newRole: WorkspaceRole, actorUserId: number): Promise<void>`
  - `removeMember(workspaceId: string, targetUserId: number, actorUserId: number): Promise<void>`
  - `recordAdminEvent(e: { workspaceId: string; actorUserId: number | null; kind: string; targetUserId?: number; targetEmail?: string; fromRole?: string; toRole?: string; moduleKey?: string; detail?: string }): Promise<void>`
- Produces (`lib/workspace-type.ts`): `getOrganizationType(workspaceId: string): Promise<string | null>`, `setOrganizationType(workspaceId: string, tipoId: string, actorUserId: number): Promise<void>` (valida con `tipoPorId`, upsert en branding, evento `ORG_TYPE_SET`).

- [ ] **Step 1: Tests de reglas**

`lib/team/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rolesOfrecidos, teamInvitationExpiryFrom, validarAccionSobreMiembro } from "./rules";

const base = { esUnoMismo: false, duenosRestantes: 2 };

describe("validarAccionSobreMiembro", () => {
  it("nadie deja el workspace sin dueño", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_OWNER", objetivoRole: "WORKSPACE_OWNER", esUnoMismo: true, duenosRestantes: 1, accion: { tipo: "CAMBIAR_ROL", nuevoRol: "STAFF" } })).toMatch(/último dueño/i);
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_OWNER", objetivoRole: "WORKSPACE_OWNER", esUnoMismo: true, duenosRestantes: 1, accion: { tipo: "DAR_DE_BAJA" } })).toMatch(/último dueño/i);
  });
  it("un admin no toca a un dueño ni nombra dueños", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_ADMIN", objetivoRole: "WORKSPACE_OWNER", accion: { tipo: "DAR_DE_BAJA" } })).toMatch(/dueño/i);
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_ADMIN", objetivoRole: "STAFF", accion: { tipo: "CAMBIAR_ROL", nuevoRol: "WORKSPACE_OWNER" } })).toMatch(/dueño/i);
  });
  it("equipo no gestiona a nadie", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "STAFF", objetivoRole: "STAFF", accion: { tipo: "DAR_DE_BAJA" } })).toMatch(/permiso/i);
  });
  it("un dueño puede pasar a equipo a un admin", () => {
    expect(validarAccionSobreMiembro({ ...base, actorRole: "WORKSPACE_OWNER", objetivoRole: "WORKSPACE_ADMIN", accion: { tipo: "CAMBIAR_ROL", nuevoRol: "STAFF" } })).toBeNull();
  });
});

describe("rolesOfrecidos", () => {
  it("dueño ofrece admin y equipo; colaborador sólo si Proyectos existe", () => {
    expect(rolesOfrecidos("WORKSPACE_OWNER", false)).toEqual(["WORKSPACE_ADMIN", "STAFF"]);
    expect(rolesOfrecidos("WORKSPACE_OWNER", true)).toEqual(["WORKSPACE_ADMIN", "STAFF", "COLLABORATOR"]);
  });
  it("equipo no ofrece nada", () => {
    expect(rolesOfrecidos("STAFF", true)).toEqual([]);
  });
});

it("la invitación vence a los 7 días", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  expect(teamInvitationExpiryFrom(now).toISOString()).toBe("2026-10-08T12:00:00.000Z");
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/team/rules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `lib/team/rules.ts`**

```ts
import { puede } from "@/lib/access/policy";
import { normalizarRol } from "@/lib/access/roles";

export const TEAM_INVITATION_TTL_DAYS = 7;
export function teamInvitationExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + TEAM_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type Accion = { tipo: "CAMBIAR_ROL"; nuevoRol: string } | { tipo: "DAR_DE_BAJA" };

export function validarAccionSobreMiembro(p: {
  actorRole: string;
  objetivoRole: string;
  esUnoMismo: boolean;
  duenosRestantes: number;
  accion: Accion;
}): string | null {
  if (!puede(p.actorRole, "gestionarEquipo")) return "No tenés permiso para gestionar el equipo.";
  const actor = normalizarRol(p.actorRole);
  const objetivo = normalizarRol(p.objetivoRole);
  const nuevo = p.accion.tipo === "CAMBIAR_ROL" ? normalizarRol(p.accion.nuevoRol) : null;
  if (actor === "ADMIN" && (objetivo === "OWNER" || nuevo === "OWNER")) {
    return "Sólo un dueño puede modificar dueños o nombrar uno nuevo.";
  }
  const pierdeDueno = objetivo === "OWNER" && (p.accion.tipo === "DAR_DE_BAJA" || nuevo !== "OWNER");
  if (pierdeDueno && p.duenosRestantes <= 1) {
    return "No se puede: es el último dueño del espacio de trabajo.";
  }
  return null;
}

export function rolesOfrecidos(actorRole: string, colaboradorDisponible: boolean): string[] {
  if (!puede(actorRole, "gestionarEquipo")) return [];
  const roles = ["WORKSPACE_ADMIN", "STAFF"];
  if (colaboradorDisponible) roles.push("COLLABORATOR");
  return roles;
}
```

- [ ] **Step 4: Implementar `packages/db/src/fotoffice-team.ts`**

Seguir la forma de `packages/db/src/fotoffice-member-invitations.ts` (importa `prisma` del mismo paquete). Puntos obligatorios:

```ts
import { prisma } from "./client"; // usar el mismo import que fotoffice-member-invitations.ts
import type { WorkspaceRole } from "@prisma/client";

export class TeamError extends Error {
  constructor(readonly reason: "ALREADY_MEMBER" | "INVITATION_INVALID" | "NOT_FOUND") {
    super(reason);
  }
}

export async function recordAdminEvent(e: {
  workspaceId: string; actorUserId: number | null; kind: string;
  targetUserId?: number; targetEmail?: string; fromRole?: string; toRole?: string; moduleKey?: string; detail?: string;
}): Promise<void> {
  await prisma.workspaceAdminEvent.create({ data: e });
}

export async function createTeamInvitation(input: {
  workspaceId: string; email: string; role: WorkspaceRole; tokenHash: string; expiresAt: Date; invitedByUserId: number;
}): Promise<{ id: string; resend: boolean }> {
  const email = input.email.trim().toLowerCase();
  return prisma.$transaction(async (tx) => {
    const yaEsta = await tx.workspaceMembership.findFirst({
      where: { workspaceId: input.workspaceId, user: { email: { equals: email, mode: "insensitive" } } },
      select: { id: true },
    });
    if (yaEsta) throw new TeamError("ALREADY_MEMBER");
    const superseded = await tx.workspaceInvitation.updateMany({
      where: { workspaceId: input.workspaceId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const inv = await tx.workspaceInvitation.create({
      data: { workspaceId: input.workspaceId, email, role: input.role, tokenHash: input.tokenHash, expiresAt: input.expiresAt, invitedByUserId: input.invitedByUserId },
      select: { id: true },
    });
    await tx.workspaceAdminEvent.create({
      data: { workspaceId: input.workspaceId, actorUserId: input.invitedByUserId, kind: "INVITED", targetEmail: email, toRole: input.role },
    });
    return { id: inv.id, resend: superseded.count > 0 };
  });
}

export async function acceptTeamInvitation(id: string, userId: number): Promise<{ workspaceId: string }> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.workspaceInvitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedByUserId: userId },
    });
    if (claimed.count !== 1) throw new TeamError("INVITATION_INVALID");
    const inv = await tx.workspaceInvitation.findUniqueOrThrow({ where: { id }, select: { workspaceId: true, role: true, email: true } });
    await tx.workspaceMembership.upsert({
      where: { userId_workspaceId: { userId, workspaceId: inv.workspaceId } },
      update: {},
      create: { userId, workspaceId: inv.workspaceId, role: inv.role },
    });
    await tx.workspaceAppAccess.upsert({
      where: { userId_workspaceId_app: { userId, workspaceId: inv.workspaceId, app: "FOTOFFICE" } },
      update: { enabled: true },
      create: { userId, workspaceId: inv.workspaceId, app: "FOTOFFICE", enabled: true },
    });
    await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    await tx.workspaceAdminEvent.create({
      data: { workspaceId: inv.workspaceId, actorUserId: userId, kind: "ACCEPTED", targetUserId: userId, targetEmail: inv.email, toRole: inv.role },
    });
    return { workspaceId: inv.workspaceId };
  });
}
```

`markTeamInvitationDelivery` setea `sentAt` (y limpia `sendFailedAt`) o `sendFailedAt`. `revokeTeamInvitation` hace `updateMany` con `workspaceId` + `id` + `acceptedAt: null`, registra `INVITE_REVOKED`. `changeMemberRole` y `removeMember` corren en `$transaction`, leen el rol actual, **no validan reglas** (lo hace la action con `validarAccionSobreMiembro`), actualizan/borran `WorkspaceMembership`; `removeMember` además borra `WorkspaceAppAccess(FOTOFFICE)` de ese usuario en ese workspace y la fila legacy `Membership` si existe; ambos registran `ROLE_CHANGED`/`REMOVED` con `fromRole`/`toRole`. `listTeam` hace las tres consultas en paralelo (miembros con `user: { select: { id, name, email, lastLoginAt } }`, invitaciones de los últimos 60 días, 50 eventos más recientes). Verificar el nombre exacto de la clave compuesta de `WorkspaceAppAccess` en el cliente generado (`userId_workspaceId_app`).

- [ ] **Step 5: Implementar `lib/workspace-type.ts` con test**

Test con `vi.hoisted` + `vi.mock("@repo/db")` (patrón de `app/workspace/configuracion/actions.test.ts`): `setOrganizationType` rechaza un id inexistente (`throw new Error("Tipo de organización desconocido.")`), hace `fotofficeWorkspaceBranding.update({ where: { workspaceId }, data: { organizationType } })` y registra `ORG_TYPE_SET` vía `recordAdminEvent` (mockear `@repo/db/fotoffice-team`). `getOrganizationType` devuelve `branding?.organizationType ?? null`. Si el workspace no tiene branding, `setOrganizationType` lanza `"Completá primero los datos de la institución."` (no crea branding: lo crea el onboarding).

- [ ] **Step 6: Correr tests y tipos**

Run: `npx vitest run lib/team lib/workspace-type.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db apps/fotoffice/lib/team apps/fotoffice/lib/workspace-type*
git commit -m "Capa de datos de equipo, invitaciones y bitácora administrativa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Emitir y enviar invitaciones de equipo

**Files:**
- Create: `apps/fotoffice/lib/team/invitation-email.ts` (+ test), `lib/team/invite.ts` (+ test)

**Interfaces:**
- Consumes: `generateInvitationToken`, `hashInvitationToken` (`lib/members/invitation-tokens.ts`); `createTeamInvitation`, `markTeamInvitationDelivery`, `TeamError` (Task 6); `teamInvitationExpiryFrom` (Task 6); `loadWorkspaceEmailContext` (`lib/communications/load-workspace-signature.ts`); `sendAndLogEmail`; `etiquetaRol`.
- Produces:
  - `buildTeamInvitationUrl(rawToken: string, env?: Record<string,string|undefined>): { ok: true; url: string } | { ok: false }` → `${APP_URL}/invitacion/equipo/${encodeURIComponent(token)}`
  - `buildTeamInvitationEmail(i: { organizationName: string; roleLabel: string; inviterName: string; url: string; signature: { html: string; text: string } | null }): { subject: string; html: string; text: string }`
  - `inviteTeamMember(p: { workspaceId: string; actor: { id: number; name: string | null }; email: string; role: string }): Promise<{ ok: true; sentTo: string; warn?: string } | { ok: false; error: string }>`

- [ ] **Step 1: Tests**

`lib/team/invitation-email.test.ts`: el asunto contiene el nombre de la organización; el HTML y el texto contienen la URL, el rol ("Equipo") y la frase "vence en 7 días"; si `signature` es null no aparece `fo-signature`; `buildTeamInvitationUrl` falla sin `APP_URL` y arma `https://app.test/invitacion/equipo/abc%2B` para el token `abc+`.

`lib/team/invite.test.ts` (mocks de `@repo/db/fotoffice-team`, `@/lib/communications/send-and-log`, `@/lib/communications/load-workspace-signature`, `process.env.APP_URL`):
- email inválido → `{ ok:false, error:"Revisá el correo." }` y no crea nada;
- `TeamError("ALREADY_MEMBER")` → `{ ok:false, error:"Esa persona ya es parte del equipo." }`;
- envío OK → `markTeamInvitationDelivery(id, true)` y `{ ok:true, sentTo }`;
- envío fallido → `markTeamInvitationDelivery(id, false)` y `{ ok:true, sentTo, warn: "La invitación quedó creada pero el correo no salió. Podés reenviarla." }`;
- sin `APP_URL` → `{ ok:false, error:"Falta configurar la dirección de la app." }` y no crea nada.

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run lib/team` → FAIL.

- [ ] **Step 3: Implementar**

`lib/team/invitation-email.ts` — mismo estilo que `lib/members/invitation-email.ts` (tabla simple, escape de HTML del nombre de la organización y del invitante). Texto:

- Asunto: `${organizationName}: te invitaron a sumarte al equipo`
- Cuerpo: "Hola: ${inviterName} te invitó a sumarte al equipo de ${organizationName} en FOTOFFICE con el rol ${roleLabel}. Para aceptar, entrá a este enlace: ${url}. El enlace es personal, sirve una sola vez y vence en 7 días. Si no esperabas este correo, podés ignorarlo."
- Firma: `signature.html` dentro de `<td class="pie" id="fo-signature">` y `signature.text` al final del texto.

`lib/team/invite.ts` (`import "server-only"`):

```ts
import "server-only";
import { createTeamInvitation, markTeamInvitationDelivery, TeamError } from "@repo/db/fotoffice-team";
import { etiquetaRol } from "@/lib/access/roles";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { generateInvitationToken, hashInvitationToken } from "@/lib/members/invitation-tokens";
import { buildTeamInvitationEmail, buildTeamInvitationUrl } from "./invitation-email";
import { teamInvitationExpiryFrom } from "./rules";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteTeamMember(p: {
  workspaceId: string; actor: { id: number; name: string | null }; email: string; role: string;
}): Promise<{ ok: true; sentTo: string; warn?: string } | { ok: false; error: string }> {
  const email = p.email.trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return { ok: false, error: "Revisá el correo." };
  const rawToken = generateInvitationToken();
  const link = buildTeamInvitationUrl(rawToken);
  if (!link.ok) return { ok: false, error: "Falta configurar la dirección de la app." };
  let id: string;
  try {
    ({ id } = await createTeamInvitation({
      workspaceId: p.workspaceId, email, role: p.role as never,
      tokenHash: hashInvitationToken(rawToken), expiresAt: teamInvitationExpiryFrom(), invitedByUserId: p.actor.id,
    }));
  } catch (e) {
    if (e instanceof TeamError && e.reason === "ALREADY_MEMBER") return { ok: false, error: "Esa persona ya es parte del equipo." };
    throw e;
  }
  const { organizationName, signature } = await loadWorkspaceEmailContext(p.workspaceId);
  const body = buildTeamInvitationEmail({
    organizationName, roleLabel: etiquetaRol(p.role), inviterName: p.actor.name ?? "Alguien del equipo", url: link.url, signature,
  });
  const res = await sendAndLogEmail({ to: email, templateKey: "fotoffice.team.invitation", body, userId: p.actor.id });
  const sent = res.status === "SENT";
  await markTeamInvitationDelivery(id, sent);
  return sent
    ? { ok: true, sentTo: email }
    : { ok: true, sentTo: email, warn: "La invitación quedó creada pero el correo no salió. Podés reenviarla." };
}
```

(`role` llega ya validado contra `rolesOfrecidos` en la action; el `as never` evita importar el enum de Prisma en la app — si el repo ya exporta el tipo `WorkspaceRole` desde `@repo/db`, usarlo en su lugar.)

- [ ] **Step 4: Correr y ver que pasan** — `npx vitest run lib/team` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/team
git commit -m "Invitaciones de equipo por correo con enlace de un solo uso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pantalla Configuración → Equipo

**Files:**
- Create: `apps/fotoffice/app/workspace/configuracion/equipo/page.tsx`, `actions.ts`, `actions.test.ts`, `equipo-client.tsx`
- Modify: `apps/fotoffice/app/workspace/configuracion/page.tsx` (tarjeta "Equipo")

**Interfaces:**
- Consumes: `requireAuth`, `requireOwnWorkspace`, `resolveWorkspaceRole`, `puede`, `etiquetaRol`, `rolesOfrecidos`, `validarAccionSobreMiembro`, `inviteTeamMember`, `listTeam`, `changeMemberRole`, `removeMember`, `revokeTeamInvitation`, `getModuleDefinition`.
- Produces: server actions `inviteTeamAction`, `changeRoleAction`, `removeMemberAction`, `revokeInvitationAction`, `resendInvitationAction`, todas `(_prev: EquipoState | undefined, formData: FormData) => Promise<EquipoState>` con `type EquipoState = { error: string | null; ok?: string; warn?: string }`.

- [ ] **Step 1: Tests de las actions**

`actions.test.ts` con el patrón de `app/workspace/configuracion/actions.test.ts` (mock `@repo/db` para `workspaceMembership.findUnique/count`, `@/lib/auth`, `@/lib/entrada/require-own-workspace`, `@repo/db/fotoffice-team`, `@/lib/team/invite`, `next/cache`). Casos:
1. Equipo (`STAFF`) invita → `{ error: "No tenés permiso para gestionar el equipo." }` y no llama a `inviteTeamMember`.
2. Dueño invita con rol `COLLABORATOR` mientras `projects` es `PLANNED` → `{ error: "Ese rol no está disponible." }`.
3. Dueño invita `STAFF` → llama `inviteTeamMember` con `{ workspaceId, email, role:"STAFF" }` y devuelve `{ error:null, ok:"Invitación enviada a …" }`.
4. Dueño único intenta bajarse a sí mismo → error "último dueño"; no llama `removeMember`.
5. Admin intenta dar de baja a un dueño → error; no llama `removeMember`.
6. Dueño cambia a un admin a Equipo → llama `changeMemberRole(ws, target, "STAFF", actor)`.
7. `resendInvitationAction` revoca la anterior (vía `createTeamInvitation` que ya la reemplaza) reusando email y rol leídos de la invitación.

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run app/workspace/configuracion/equipo` → FAIL.

- [ ] **Step 3: Implementar `actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { changeMemberRole, removeMember, revokeTeamInvitation } from "@repo/db/fotoffice-team";
import { puede } from "@/lib/access/policy";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { getModuleDefinition } from "@/lib/modules/registry";
import { inviteTeamMember } from "@/lib/team/invite";
import { rolesOfrecidos, validarAccionSobreMiembro, type Accion } from "@/lib/team/rules";

export type EquipoState = { error: string | null; ok?: string; warn?: string };
const RUTA = "/workspace/configuracion/equipo";

async function contexto() {
  const user = await requireAuth();
  const ws = await requireOwnWorkspace(user);
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ws.workspaceId } }, select: { role: true },
  });
  return { user, workspaceId: ws.workspaceId, role: m?.role ?? null };
}
const colaboradorDisponible = () => getModuleDefinition("projects")?.status === "AVAILABLE";

export async function inviteTeamAction(_p: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: "No tenés permiso para gestionar el equipo." };
  const nuevoRol = String(fd.get("role") ?? "");
  if (!rolesOfrecidos(role, colaboradorDisponible()).includes(nuevoRol)) return { error: "Ese rol no está disponible." };
  const r = await inviteTeamMember({ workspaceId, actor: { id: user.id, name: user.name }, email: String(fd.get("email") ?? ""), role: nuevoRol });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Invitación enviada a ${r.sentTo}.`, warn: r.warn };
}

async function sobreMiembro(fd: FormData, accion: Accion): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  const targetUserId = Number(fd.get("userId"));
  const objetivo = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } }, select: { role: true },
  });
  if (!role || !objetivo) return { error: "No se encontró a esa persona en el equipo." };
  const duenosRestantes = await prisma.workspaceMembership.count({ where: { workspaceId, role: "WORKSPACE_OWNER" } });
  const error = validarAccionSobreMiembro({ actorRole: role, objetivoRole: objetivo.role, esUnoMismo: targetUserId === user.id, duenosRestantes, accion });
  if (error) return { error };
  if (accion.tipo === "DAR_DE_BAJA") await removeMember(workspaceId, targetUserId, user.id);
  else await changeMemberRole(workspaceId, targetUserId, accion.nuevoRol as never, user.id);
  revalidatePath(RUTA);
  return { error: null, ok: accion.tipo === "DAR_DE_BAJA" ? "Listo, ya no tiene acceso." : "Rol actualizado." };
}

export async function changeRoleAction(_p: EquipoState | undefined, fd: FormData) {
  const nuevoRol = String(fd.get("role") ?? "");
  const { role } = await contexto();
  if (![...rolesOfrecidos(role ?? "", colaboradorDisponible()), "WORKSPACE_OWNER"].includes(nuevoRol)) return { error: "Ese rol no está disponible." };
  return sobreMiembro(fd, { tipo: "CAMBIAR_ROL", nuevoRol });
}
export async function removeMemberAction(_p: EquipoState | undefined, fd: FormData) {
  return sobreMiembro(fd, { tipo: "DAR_DE_BAJA" });
}
export async function revokeInvitationAction(_p: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: "No tenés permiso para gestionar el equipo." };
  await revokeTeamInvitation(workspaceId, String(fd.get("invitationId")), user.id);
  revalidatePath(RUTA);
  return { error: null, ok: "Invitación anulada." };
}
export async function resendInvitationAction(_p: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: "No tenés permiso para gestionar el equipo." };
  const inv = await prisma.workspaceInvitation.findFirst({
    where: { id: String(fd.get("invitationId")), workspaceId }, select: { email: true, role: true },
  });
  if (!inv) return { error: "No se encontró la invitación." };
  const r = await inviteTeamMember({ workspaceId, actor: { id: user.id, name: user.name }, email: inv.email, role: inv.role });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Invitación reenviada a ${r.sentTo}.`, warn: r.warn };
}
```

(Nombrar dueño sólo lo puede un dueño: `validarAccionSobreMiembro` ya bloquea al admin.)

- [ ] **Step 4: Implementar la página**

`page.tsx` (server, `export const dynamic = "force-dynamic"`): `requireAuth` → `requireOwnWorkspace` → rol. Si `!puede(role,"gestionarEquipo")`, `<PageHeader title="Equipo" />` + "Sólo el dueño o un administrador pueden ver y gestionar el equipo." Si puede: `listTeam(workspaceId)` y render de `<EquipoClient …>` con:
- tabla de miembros: nombre, correo, `etiquetaRol(role)`, último ingreso (`toLocaleDateString("es-AR")` o "Nunca"), y para cada uno un `<form>` con `select` de rol (opciones `rolesOfrecidos` + "Dueño" si el actor es dueño) y botón "Dar de baja" con confirmación en la interfaz (no `window.confirm`: un segundo botón "Confirmar baja");
- invitaciones pendientes/vencidas con estado derivado (usar `invitationState` de `lib/members/invitations.ts`, que recibe `{acceptedAt, revokedAt, expiresAt}`), acciones Reenviar / Anular;
- formulario "Invitar": correo + select de rol (`rolesOfrecidos`) + botón;
- "Historial": los eventos con fecha, actor y texto por `kind` ("invitó a", "aceptó", "cambió el rol de … de X a Y", "dio de baja a", "encendió/apagó el módulo …").

`equipo-client.tsx` (`"use client"`): un `useActionState` por formulario, mostrando `state.error` en rojo, `state.ok` en verde y `state.warn` en ámbar; estilos `fo-card`, `fo-input`, `fo-btn`, `fo-btn-primary`, `fo-btn-ghost`.

En `app/workspace/configuracion/page.tsx` agregar la tarjeta-link "Equipo — Invitá a quien trabaja con vos y elegí su rol" junto a Cobros y Palabras, visible sólo si `puede(role,"gestionarEquipo")`.

- [ ] **Step 5: Tests, tipos y lint**

Run: `npx vitest run app/workspace/configuracion && npx tsc --noEmit -p tsconfig.json && npx eslint app/workspace/configuracion/equipo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/app/workspace/configuracion
git commit -m "Configuración → Equipo: invitar, cambiar rol, dar de baja e historial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Aceptar la invitación (con y sin cuenta)

**Files:**
- Create: `apps/fotoffice/app/invitacion/equipo/[token]/page.tsx`, `actions.ts`, `actions.test.ts`, `aceptar-form.tsx`
- Create: `apps/fotoffice/lib/team/continuity.ts` (+ test)
- Modify: `apps/fotoffice/lib/post-login.ts` (+ su test)

**Interfaces:**
- Consumes: `findTeamInvitationByTokenHash`, `acceptTeamInvitation`, `TeamError` (Task 6); `hashInvitationToken`; `invitationState`, `emailsMatch` (`lib/members/invitations.ts`); `getAuthUser`; `requestPasswordReset` de `@repo/auth` (como en `app/actions/member-activation.ts`).
- Produces:
  - `setTeamInvitationContinuity(rawToken: string, expiresAt: Date): Promise<void>`, `readTeamInvitationContinuity(): Promise<string | null>`, `clearTeamInvitationContinuity(): Promise<void>` — cookie `fotoffice_team_invitation`, httpOnly, sameSite lax, maxAge hasta el vencimiento (usar `continuityMaxAgeSeconds` de `lib/members/invitation-continuity.ts`).
  - `resolveTeamInvitationContinuityPath(userEmail: string): Promise<string | null>` — si la cookie apunta a una invitación PENDING cuyo email coincide, devuelve `/invitacion/equipo/<token>`.
  - `acceptTeamInvitationAction(_prev, fd): Promise<{ error: string | null }>` y `startTeamActivationAction(_prev, fd): Promise<{ error: string | null; sent?: boolean }>`.

- [ ] **Step 1: Tests**

`actions.test.ts`: sin sesión → error "Iniciá sesión para aceptar."; invitación vencida/revocada/aceptada → "Esta invitación ya no está disponible."; email distinto → "Esta invitación es para <email>. Entraste como <otro>."; OK → llama `acceptTeamInvitation(id, user.id)`, `clearTeamInvitationContinuity`, y `redirect("/workspace")` (mock de `next/navigation` que lanza `NEXT_REDIRECT`); `TeamError("INVITATION_INVALID")` concurrente → mismo mensaje de no disponible. `startTeamActivationAction`: hace `prisma.user.upsert({ where:{ email }, update:{}, create:{ email, role:"CUSTOMER" } })`, guarda continuidad y llama `requestPasswordReset({ email, appBaseUrl, appLabel:"FotoOffice", resetPath:"/recuperar" })`; devuelve `{ error:null, sent:true }`.

`lib/team/continuity.test.ts`: devuelve la ruta sólo si la invitación está PENDING y el email coincide; null en los demás casos.

En el test de `lib/post-login.ts`: con cookie de equipo válida y sin `next`, el destino es `/invitacion/equipo/<token>`; la continuidad de socios sigue teniendo prioridad si ambas existen.

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run app/invitacion lib/team lib/post-login` → FAIL.

- [ ] **Step 3: Implementar**

`page.tsx` (`export const dynamic = "force-dynamic"`), mismo esqueleto que `app/invitacion/[token]/page.tsx`:
1. `const inv = await findTeamInvitationByTokenHash(hashInvitationToken(decodeURIComponent(token)))`. Si no existe: "Este enlace no es válido."
2. `invitationState(inv) !== "PENDING"`: "Esta invitación ya no está disponible. Pedile a quien te invitó que te mande una nueva."
3. Sin sesión: "Te invitaron a sumarte al equipo de {workspace.name} como {etiquetaRol(role)}." + botón "Ya tengo cuenta" → `/login?next=/invitacion/equipo/<token>` + formulario "Es mi primera vez" (`startTeamActivationAction`, que manda el correo para crear contraseña).
4. Con sesión y email distinto: el mensaje de error con los dos correos y un link a cerrar sesión.
5. Con sesión y email igual: `<AceptarForm invitationId>` con botón "Aceptar y entrar".

`lib/post-login.ts`: justo después de `const continuity = await resolveInvitationContinuityPath(user.email); if (continuity) …`, agregar:

```ts
  const teamContinuity = await resolveTeamInvitationContinuityPath(user.email);
  if (teamContinuity) return { path: teamContinuity, workspaceId: null };
```

- [ ] **Step 4: Correr y ver que pasan; tipos**

Run: `npx vitest run app/invitacion lib/team lib/post-login && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/app/invitacion/equipo apps/fotoffice/lib/team apps/fotoffice/lib/post-login*
git commit -m "Aceptar la invitación al equipo, con cuenta o creándola

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pantalla Configuración → Módulos

**Files:**
- Create: `apps/fotoffice/app/workspace/configuracion/modulos/page.tsx`, `actions.ts`, `actions.test.ts`, `modulos-client.tsx`
- Modify: `apps/fotoffice/app/workspace/configuracion/page.tsx` (tarjeta "Módulos"), `app/workspace/page.tsx` (aviso de tipo)

**Interfaces:**
- Consumes: `listModules`, `getModuleDefinition`, `FAMILY_LABELS`, `alEncender`, `alApagar`, `paqueteSugerido`, `ordenDeFamilias`, `getEnabledModuleKeysForWorkspace`, `getOrganizationType`, `setOrganizationType`, `recordAdminEvent`, `TIPOS`, `tipoPorId`, `sendAndLogEmail`, `puede`.
- Produces:
  - `type ModulosState = { error: string | null; ok?: string; confirmar?: { tipo: "ENCENDER"; faltan: string[] } | { tipo: "APAGAR"; afectados: string[] } }`
  - `toggleModuleAction(_p, fd)` — campos `moduleKey`, `enabled` ("true"/"false"), `confirmado` ("1" opcional)
  - `requestModuleAction(_p, fd)` — campo `moduleKey`
  - `chooseOrganizationTypeAction(_p, fd)` — campos `tipo`, `aplicarPaquete` ("1" opcional)

- [ ] **Step 1: Tests de las actions**

Casos (mismos mocks que Task 8 + `workspaceFeatureModule.upsert/findMany`, `@/lib/modules/gating`, `@/lib/workspace-type`, `@repo/db/fotoffice-team`, `@/lib/communications/send-and-log`):
1. Equipo → "No tenés permiso para cambiar los módulos."
2. Encender `membership-dues` → `{ error: "Este módulo cobra una comisión: pedí la activación." }` (nunca hace upsert).
3. Encender `evaluaciones` sin `courses-sales` y sin `confirmado` → devuelve `confirmar: { tipo:"ENCENDER", faltan:["courses-sales"] }`, sin upsert. Con `confirmado=1` → no aplica porque `courses-sales` es de comisión: error "Primero hay que activar Cursos presenciales, que cobra comisión: pedí la activación."
4. Encender `clients` → upsert `enabled:true` + evento `MODULE_ON`.
5. Apagar `members` con `membership-dues` encendido → `{ error: "No se puede apagar: Cuotas societarias depende de este módulo y lo gestiona FOTOFFICE." }` (cuotas cobra comisión), sin upsert. Apagar `courses-sales`… (comisión, también bloqueado para el workspace: sólo el Super Admin). Apagar `members` con `raffles` encendido (sin dependencias) → apaga directo. Caso con dependiente sin comisión: registrar temporalmente en el test un módulo ficticio con `dependsOn: ["clients"]` vía `vi.mock("@/lib/modules/registry", …)`; sin confirmar → `confirmar: { tipo:"APAGAR", afectados:[…] }`; confirmado → apaga `clients` y el dependiente, con un evento `MODULE_OFF` por cada uno.
6. Clave inexistente o `PLANNED` → "Ese módulo no existe o todavía no está disponible."
7. `requestModuleAction` → manda correo a cada email de `FOTOFFICE_PLATFORM_ADMIN_EMAILS` con asunto "FOTOFFICE: {workspace} pide activar {módulo}", registra `MODULE_REQUESTED`, devuelve ok "Listo, te avisamos cuando esté activo." Si la variable está vacía: igual registra el evento y devuelve ok.
8. `chooseOrganizationTypeAction` con `tipo=estudio` y `aplicarPaquete=1` → `setOrganizationType` + upsert `enabled:true` de cada clave de `paqueteSugerido("estudio")` que no esté encendida (nunca apaga nada) + un evento `MODULE_ON` por cada una.

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run app/workspace/configuracion/modulos` → FAIL.

- [ ] **Step 3: Implementar `actions.ts`**

Estructura (mismo `contexto()` que Task 8; permiso `configurar`):

```ts
export async function toggleModuleAction(_p: ModulosState | undefined, fd: FormData): Promise<ModulosState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "configurar")) return { error: "No tenés permiso para cambiar los módulos." };
  const key = String(fd.get("moduleKey") ?? "");
  const def = getModuleDefinition(key);
  if (!def || def.status !== "AVAILABLE") return { error: "Ese módulo no existe o todavía no está disponible." };
  const encender = fd.get("enabled") === "true";
  const confirmado = fd.get("confirmado") === "1";
  const encendidos = await getEnabledModuleKeysForWorkspace(workspaceId);

  if (encender) {
    if (def.platformFee) return { error: "Este módulo cobra una comisión: pedí la activación." };
    const faltan = alEncender(key, encendidos);
    const conComision = faltan.map(getModuleDefinition).find((d) => d?.platformFee);
    if (conComision) return { error: `Primero hay que activar ${conComision.label}, que cobra comisión: pedí la activación.` };
    if (faltan.length && !confirmado) return { error: null, confirmar: { tipo: "ENCENDER", faltan } };
    for (const k of [...faltan, key]) await setModule(workspaceId, k, true, user.id);
    revalidatePath("/", "layout");
    return { error: null, ok: "Módulo encendido." };
  }
  if (def.platformFee) return { error: "Este módulo lo gestiona FOTOFFICE: pedí la desactivación." };
  const afectados = alApagar(key, encendidos);
  const gestionado = afectados.map(getModuleDefinition).find((d) => d?.platformFee);
  if (gestionado) return { error: `No se puede apagar: ${gestionado.label} depende de este módulo y lo gestiona FOTOFFICE.` };
  if (afectados.length && !confirmado) return { error: null, confirmar: { tipo: "APAGAR", afectados } };
  for (const k of [key, ...afectados]) await setModule(workspaceId, k, false, user.id);
  revalidatePath("/", "layout");
  return { error: null, ok: "Módulo apagado. Los datos quedan guardados." };
}

async function setModule(workspaceId: string, moduleKey: string, enabled: boolean, actorUserId: number) {
  await prisma.workspaceFeatureModule.upsert({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
    update: { enabled }, create: { workspaceId, moduleKey, enabled },
  });
  await recordAdminEvent({ workspaceId, actorUserId, kind: enabled ? "MODULE_ON" : "MODULE_OFF", moduleKey });
}
```

`requestModuleAction` y `chooseOrganizationTypeAction` según los casos del Step 1 (el correo a plataforma usa `sendAndLogEmail` con `templateKey: "fotoffice.module.request"` y cuerpo de texto simple con workspace, módulo y quién lo pidió).

- [ ] **Step 4: Implementar la página**

`page.tsx` (server): contexto + permiso `configurar` (si no: "Sólo el dueño o un administrador pueden cambiar los módulos."). Carga tipo, encendidos y `listModules()`.
- **Sin tipo**: primero una sección "¿Qué tipo de organización es?" con las 8 opciones de `TIPOS` (label + resumen) y, al elegir, la lista `paqueteSugerido(tipo)` con nombres, y dos botones: "Elegir y encender estos módulos" (`aplicarPaquete=1`) y "Sólo elegir el tipo".
- **Con tipo**: línea "Tipo: {label} · Cambiar" (vuelve a mostrar el selector, sin aplicar paquete salvo que se pida).
- Familias en `ordenDeFamilias(tipo)`; en cada una sus módulos con: nombre (`aplicarVocabulario` con el vocabulario del workspace), "por qué" (el `porque` del tipo si la clave está en sus destacados; si no, `description`), y según el caso: interruptor; "Pedir activación" si `platformFee` y apagado; "Activado por FOTOFFICE" si `platformFee` y encendido (sin interruptor: lo apaga el Super Admin); "Próximamente" si `PLANNED`.
- `modulos-client.tsx` maneja el diálogo de confirmación con los `faltan`/`afectados` que devuelve la action (reenvía el mismo form con `confirmado=1`).

En `app/workspace/configuracion/page.tsx`: tarjeta "Módulos — Encendé o apagá lo que usa tu organización". En `app/workspace/page.tsx`: si el usuario `puede(role,"configurar")` y `getOrganizationType` es null, un aviso arriba: "Contanos qué tipo de organización son para ordenar el menú y sugerirte módulos. Elegir →" (link a Módulos).

- [ ] **Step 5: Tests, tipos y lint** — `npx vitest run app/workspace && npx tsc --noEmit -p tsconfig.json && npx eslint app/workspace/configuracion/modulos` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/app/workspace
git commit -m "Configuración → Módulos: tipo de organización, familias y dependencias

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Menú

**Files:**
- Modify: `apps/fotoffice/components/shell/shell-nav.tsx`, `components/shell/shell-sidebar.tsx`, `app/(shell)/layout.tsx`, `app/workspace/layout.tsx`
- Create: `apps/fotoffice/lib/modules/nav-order.ts` (+ test)

**Interfaces:**
- Consumes: `ordenDeFamilias`, `getModuleDefinition`, `getOrganizationType`, `puede`.
- Produces: `ordenarSecciones<T extends { moduleKey: string | null }>(secciones: T[], tipo: string | null): T[]` — ordena por la posición de la familia del módulo en `ordenDeFamilias(tipo)`; las secciones sin módulo (Inicio, Presencia pública, Institución, Plataforma) conservan su posición fija (Inicio primero; Institución y Plataforma al final).

- [ ] **Step 1: Test de `ordenarSecciones`**

Con secciones `[{moduleKey:null,id:"inicio"},{moduleKey:"members"},{moduleKey:"raffles"},{moduleKey:"coverages"},{moduleKey:"courses-sales"},{moduleKey:"bookings"},{moduleKey:null,id:"institucion"}]`: para `estudio` → inicio, espacios/formación según `ordenDeFamilias("estudio")`, …, institución al final; para `sociedad` → inicio, members, raffles, bookings, courses-sales, coverages, institución; para `null` → orden original.

- [ ] **Step 2: Correr y ver que falla; implementar; ver que pasa**

Run: `npx vitest run lib/modules/nav-order.test.ts`

- [ ] **Step 3: Aplicar en el menú**

- `app/(shell)/layout.tsx`: leer `organizationType` (una consulta a branding, en paralelo con las existentes) y pasarlo a `ShellSidebar` → `ShellNav` como prop `organizationType: string | null`. **No tocar** la línea literal `const activeRole = …` que exige `lib/workspace-role-consistency.test.ts`.
- `components/shell/shell-nav.tsx`: armar el arreglo de secciones con su `moduleKey` y pasarlo por `ordenarSecciones`. En la sección `institucion` (visible si `canManageWorkspaceSettings`), agregar:

```ts
{ href: "/workspace/configuracion/equipo", label: "Equipo", icon: Users, isActive: under("/workspace/configuracion/equipo") },
{ href: "/workspace/configuracion/modulos", label: "Módulos", icon: LayoutGrid, isActive: under("/workspace/configuracion/modulos") },
```

(importar `Users` y `LayoutGrid` de `lucide-react`; si `Users` ya se usa para Socios, usar `UserCog`).
- `app/workspace/layout.tsx`: en el nav lateral de `/workspace`, sumar links a Equipo y Módulos debajo de "Configuración" para quien `puede(role,"configurar")`.
- Donde se muestre el rol del usuario (buscar `"STAFF"` en `components/` y `app/` con `git grep -n '"STAFF"' -- apps/fotoffice/components apps/fotoffice/app`), usar `etiquetaRol`.

- [ ] **Step 4: Suite completa, tipos y build**

Run: `npm test && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: PASS y build OK (`next build --webpack`).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice
git commit -m "Menú ordenado por familia según el tipo, con Equipo y Módulos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Preparar la publicación

**Files:**
- Modify: `packages/db/docs/MIGRACION-EQUIPO-Y-MODULOS.md` (checksum final y estado por base)

- [ ] **Step 1: Checksum final**

Run: `shasum -a 256 packages/db/prisma/migrations/20260930120000_fotoffice_equipo_y_modulos/migration.sql` y anotarlo en el documento.

- [ ] **Step 2: Relevar quiénes ganan permisos (sólo lectura)**

En la base de producción de FOTOFFICE (Neon `divine-hall-10689679`, rama `development`), con consulta de sólo lectura:

```sql
SELECT w.name AS workspace, u.email, wm.role
FROM "WorkspaceMembership" wm
JOIN "Workspace" w ON w.id = wm."workspaceId"
JOIN "User" u ON u.id = wm."userId"
WHERE wm.role = 'STAFF'
UNION ALL
SELECT w.name, u.email, m.role::text
FROM "Membership" m
JOIN "Workspace" w ON w.id = m."workspaceId"
JOIN "User" u ON u.id = m."userId"
WHERE m.role = 'MEMBER'
ORDER BY 1, 2;
```

Anotar el resultado en el documento de migración y **presentarlo a Daniel antes de publicar** (spec §6.1).

- [ ] **Step 3: Revisión final y PR**

Run: `npm test && npx tsc --noEmit -p tsconfig.json && npm run build` (en `apps/fotoffice`) y `npx tsc --noEmit` en `apps/fotorank`, `apps/compramelafoto`, `apps/clickaton`.
Abrir el PR (sin fusionar) con: resumen, tabla de la auditoría (Task 3), instrucciones de migración, y la lista de la prueba manual:
1. Aplicar el SQL en las bases (documento de migración) y registrar el checksum.
2. Daniel entra a DNX Estudio → Configuración → Módulos, elige "Estudio o productora" (sin aplicar paquete si ya tiene lo que quiere).
3. Daniel invita una cuenta de prueba como Equipo; la cuenta acepta desde el correo (probar también "Es mi primera vez").
4. Con la cuenta de prueba: entra al panel, usa Caja y Ventas (si está fusionado), no ve Configuración, Módulos ni Equipo.
5. Daniel le cambia el rol a Administrador y la da de baja; el historial muestra las tres acciones.
6. Recién entonces: invitar a Sabi y Cami como Equipo y asignar tipos a SFPR (`sociedad`) y Foto Positiva (`ong`) desde Módulos o por SQL.

- [ ] **Step 4: Commit**

```bash
git add packages/db/docs
git commit -m "Documentar la publicación de la etapa 0.1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
