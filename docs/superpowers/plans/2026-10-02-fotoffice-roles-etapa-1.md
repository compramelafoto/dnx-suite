# FOTOFFICE — Roles, etapa 1: tablas y función única de permisos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear las tablas de roles personalizados y una sola función que decide el nivel de permiso (`NONE`/`VIEW`/`MANAGE`) de una persona sobre un módulo, y pasar a esa función Socios, Cuotas, Reservas y Sorteos (pantallas, acciones y menú), **sin cambiar el acceso de nadie**.

**Architecture:** Una función pura (`resolveModuleLevel`) decide el nivel a partir de: módulo activo, rol de workspace y asignaciones vigentes. Un envoltorio de servidor (`getModuleLevels`) junta esos datos de la base. Los `access.ts` de cada módulo conservan sus nombres y sus redirecciones, pero preguntan a esa función. Mientras nadie tenga asignaciones (la pantalla para crearlas es la etapa 2), una tabla de compatibilidad le da a `STAFF` exactamente lo que tiene hoy.

**Tech Stack:** Next.js (versión con cambios: leer `apps/fotoffice/node_modules/next/dist/docs/` antes de tocar rutas), Prisma 6 (`packages/db`), Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md` (secciones 4, 8, 9 y 10, etapa 1).

## Global Constraints

- Nadie gana ni pierde acceso en esta etapa: dueño/admin → `MANAGE` en todo; `STAFF` sin asignaciones → lo de hoy (Socios `VIEW`, Cuotas `NONE`, Reservas `VIEW`, Sorteos `VIEW`).
- Conectar Mercado Pago y el consentimiento de split **siguen** con `canManageWorkspaceCollection` (dueño/admin). Nunca se delega (spec §4, "Lo que nunca se delega").
- Ocultar en el menú no protege: cada página y acción vuelve a preguntar el nivel.
- Sin staging: el SQL se aplica en la base de producción de FOTOFFICE (Neon `compramelafoto`, rama `development`) **antes** de fusionar, y lo aplica Daniel. Después, `prisma migrate resolve --applied`.
- El build de FOTOFFICE chequea tipos **incluidos los tests**: correr `pnpm --filter fotoffice build` antes del PR, no sólo `test`.
- Trabajar en el worktree `../dnx-suite-wt-roles` (rama `docs/fotoffice-roles-comision-directiva`). Otras sesiones comparten el índice de git del checkout principal.
- Mensajes de commit en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Textos al usuario en español rioplatense (vos).

## Mapa de archivos

| Archivo | Qué hace |
|---|---|
| `packages/db/prisma/schema.prisma` | +enum `ModulePermissionLevel`, +3 modelos, back-relations en `Workspace` y `User` |
| `packages/db/prisma/migrations/20261003000000_fotoffice_roles_personalizados/migration.sql` | SQL generado por `prisma migrate diff` |
| `apps/fotoffice/lib/permissions/levels.ts` (nuevo) | Lógica pura: niveles, vigencia, compatibilidad STAFF, alias de habilitación |
| `apps/fotoffice/lib/permissions/levels.test.ts` (nuevo) | Pruebas de la lógica pura |
| `apps/fotoffice/lib/permissions/module-access.ts` (nuevo) | `getModuleLevels`, `getModuleLevel`, `hasModuleLevel` (servidor) |
| `apps/fotoffice/lib/permissions/module-access.test.ts` (nuevo) | Pruebas con la base simulada |
| `apps/fotoffice/lib/permissions/collection-usage.test.ts` (nuevo) | Guardia: el permiso de cobros sólo se usa donde corresponde |
| `apps/fotoffice/lib/raffles/access.ts`, `lib/bookings/access.ts`, `lib/members/access.ts` | Pasan a preguntar el nivel |
| `apps/fotoffice/app/(shell)/sorteos/page.tsx`, `sorteos/[id]/page.tsx` | Usan `level` en vez de `role` |
| 14 archivos de Cuotas, Solicitudes y Carnets, más `lib/workspace-home/load.ts` (Task 5) | Dejan `canManageWorkspaceCollection` |
| `components/shell/admin-shell.tsx`, `shell-sidebar.tsx`, `shell-nav.tsx`, `app/workspace/page.tsx` | Menú e inicio salen de los mismos niveles |
| `apps/fotoffice/lib/workspace-role-consistency.test.ts` | Se actualiza la invariante menú = páginas |

---

### Task 0: Preparar el worktree

**Files:** ninguno nuevo (el spec ya está copiado en el worktree).

- [ ] **Step 1: Instalar dependencias en el worktree**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles
pnpm install --frozen-lockfile
```
Expected: termina sin errores (el `postinstall` de `packages/db` corre `prisma generate`).

- [ ] **Step 2: Línea de base de tests**

```bash
pnpm --filter fotoffice test
```
Expected: todo en verde. Si algo falla **antes** de tocar nada, anotarlo en el PR y no arreglarlo acá.

- [ ] **Step 3: Commit del spec y este plan**

```bash
git add docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md docs/superpowers/plans/2026-10-02-fotoffice-roles-etapa-1.md
git commit -m "Diseñar los roles y la Comisión directiva de FOTOFFICE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Tablas y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `User` en la línea ~36, modelo `Workspace` en la línea ~7071, y al final del archivo los modelos nuevos)
- Create: `packages/db/prisma/migrations/20261003000000_fotoffice_roles_personalizados/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `WorkspaceCustomRole`, `WorkspaceRolePermission`, `WorkspaceRoleAssignment` y enum `ModulePermissionLevel { NONE VIEW MANAGE }`. El cliente expone `prisma.workspaceRoleAssignment.findMany(...)`.

- [ ] **Step 1: Agregar los modelos al final de `schema.prisma`**

```prisma
// ─── FOTOFFICE: roles personalizados (Comisión directiva) ───────────────────
// Diseño: docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md

/// Nivel de un rol sobre un módulo del catálogo de FOTOFFICE.
enum ModulePermissionLevel {
  NONE
  VIEW
  MANAGE
}

/// Rol definido por un workspace. El nombre y los módulos los elige cada institución.
model WorkspaceCustomRole {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  description String?
  color       String?
  /// Plantilla de la que nació ("treasury", "secretary"…). Null si se creó de cero.
  templateKey String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace                 @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  permissions WorkspaceRolePermission[]
  assignments WorkspaceRoleAssignment[]

  @@unique([workspaceId, name])
}

/// Nivel de un rol sobre un módulo (`moduleKey` = clave de `lib/modules/registry.ts`).
model WorkspaceRolePermission {
  id        String                @id @default(cuid())
  roleId    String
  moduleKey String
  level     ModulePermissionLevel
  /// Etapa 5: acciones sensibles extra, p. ej. "membership-dues.manual_payment".
  actions   String[]              @default([])

  role WorkspaceCustomRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([roleId, moduleKey])
}

/// Persona ↔ rol en un workspace, con cargo y mandato opcionales.
model WorkspaceRoleAssignment {
  id            String    @id @default(cuid())
  workspaceId   String
  userId        Int
  roleId        String
  /// Cargo institucional ("Tesorera"). No da permisos por sí solo.
  positionTitle String?
  startsAt      DateTime?
  /// Null = no vence.
  endsAt        DateTime?
  /// Quién hizo la asignación. Sin relación a propósito: no agrega otra back-relation a `User`.
  assignedById  Int
  revokedAt     DateTime?
  createdAt     DateTime  @default(now())

  user User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  role WorkspaceCustomRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@index([workspaceId, userId])
  @@index([roleId])
}
```

- [ ] **Step 2: Back-relations**

En `model Workspace { ... }`, debajo de `workspaceMembershipsUnified WorkspaceMembership[]` (línea ~7091), agregar:

```prisma
  customRoles                 WorkspaceCustomRole[]
```

En `model User { ... }`, debajo de `workspaceMembershipsUnified           WorkspaceMembership[]` (línea ~302), agregar:

```prisma
  workspaceRoleAssignments              WorkspaceRoleAssignment[]
```

- [ ] **Step 3: Validar y generar el cliente**

```bash
cd packages/db
npx prisma validate
npx prisma generate
```
Expected: `The schema at prisma/schema.prisma is valid` y `Generated Prisma Client`.

- [ ] **Step 4: Generar el SQL desde la diferencia de esquemas (sin base)**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles
SCRATCH=/private/tmp/claude-501/-Users-danielcuart-Desktop-PROGRAMACIONES-dnx-suite-apps-fotoffice/f88e827b-5465-47c7-95e3-ad459e026a19/scratchpad
git show origin/main:packages/db/prisma/schema.prisma > "$SCRATCH/schema-antes.prisma"
mkdir -p packages/db/prisma/migrations/20261003000000_fotoffice_roles_personalizados
cd packages/db
npx prisma migrate diff \
  --from-schema-datamodel "$SCRATCH/schema-antes.prisma" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/20261003000000_fotoffice_roles_personalizados/migration.sql
cat prisma/migrations/20261003000000_fotoffice_roles_personalizados/migration.sql
```
Expected: sólo `CREATE TYPE "ModulePermissionLevel"`, tres `CREATE TABLE`, sus índices y cuatro `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. **Si aparece cualquier otra sentencia** (un `ALTER` sobre una tabla existente, un `DROP`), detenerse: el esquema de `origin/main` cambió y hay que rehacer el paso con la rama actualizada.

- [ ] **Step 5: Encabezado del SQL**

Agregar al principio de `migration.sql`:

```sql
-- Roles personalizados de FOTOFFICE (Comisión directiva), etapa 1.
-- Sólo crea tablas nuevas: no toca ninguna existente y nadie cambia de permisos al aplicarla.
-- Se aplica a mano en la base de FOTOFFICE (Neon compramelafoto, rama development) y después:
--   npx prisma migrate resolve --applied 20261003000000_fotoffice_roles_personalizados
-- Las otras bases no la necesitan: sólo FOTOFFICE consulta estas tablas.
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261003000000_fotoffice_roles_personalizados
git commit -m "Tablas de roles personalizados de FOTOFFICE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: La lógica pura de niveles

**Files:**
- Create: `apps/fotoffice/lib/permissions/levels.ts`
- Test: `apps/fotoffice/lib/permissions/levels.test.ts`

**Interfaces:**
- Produces:
  - `type ModuleLevel = "NONE" | "VIEW" | "MANAGE"`
  - `type ModuleLevels = Readonly<Record<string, ModuleLevel>>`
  - `type RoleAssignmentForLevels = { startsAt: Date | null; endsAt: Date | null; revokedAt: Date | null; permissions: readonly { moduleKey: string; level: ModuleLevel }[] }`
  - `maxLevel(levels: Iterable<ModuleLevel>): ModuleLevel`
  - `hasLevel(actual: ModuleLevel, required: "VIEW" | "MANAGE"): boolean`
  - `isAssignmentActive(a: Pick<RoleAssignmentForLevels, "startsAt" | "endsAt" | "revokedAt">, now: Date): boolean`
  - `legacyStaffLevel(moduleKey: string): ModuleLevel`
  - `isModuleEffectivelyEnabled(moduleKey: string, enabled: ReadonlySet<string>): boolean`
  - `resolveModuleLevel(input: { moduleKey: string; moduleEnabled: boolean; workspaceRole: string | null; assignments: readonly RoleAssignmentForLevels[]; now: Date }): ModuleLevel`
  - `manageFlagFor(levels: ModuleLevels, moduleKey: string, adminFallback: boolean): boolean`

- [ ] **Step 1: Escribir las pruebas**

```ts
import { describe, expect, it } from "vitest";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import {
  hasLevel,
  isAssignmentActive,
  isModuleEffectivelyEnabled,
  legacyStaffLevel,
  manageFlagFor,
  maxLevel,
  resolveModuleLevel,
  type RoleAssignmentForLevels,
} from "./levels";

const now = new Date("2026-10-03T12:00:00Z");
const ayer = new Date("2026-10-02T12:00:00Z");
const manana = new Date("2026-10-04T12:00:00Z");

function asignacion(
  permisos: RoleAssignmentForLevels["permissions"],
  fechas: Partial<Pick<RoleAssignmentForLevels, "startsAt" | "endsAt" | "revokedAt">> = {},
): RoleAssignmentForLevels {
  return { startsAt: null, endsAt: null, revokedAt: null, permissions: permisos, ...fechas };
}

function nivel(input: Partial<Parameters<typeof resolveModuleLevel>[0]>) {
  return resolveModuleLevel({
    moduleKey: MEMBERS_MODULE_KEY,
    moduleEnabled: true,
    workspaceRole: "STAFF",
    assignments: [],
    now,
    ...input,
  });
}

describe("maxLevel y hasLevel", () => {
  it("el máximo de nada es NONE", () => expect(maxLevel([])).toBe("NONE"));
  it("MANAGE gana a VIEW", () => expect(maxLevel(["VIEW", "MANAGE", "NONE"])).toBe("MANAGE"));
  it("MANAGE alcanza para VIEW, VIEW no alcanza para MANAGE", () => {
    expect(hasLevel("MANAGE", "VIEW")).toBe(true);
    expect(hasLevel("VIEW", "MANAGE")).toBe(false);
    expect(hasLevel("NONE", "VIEW")).toBe(false);
  });
});

describe("vigencia de una asignación", () => {
  it("sin fechas, vale", () => expect(isAssignmentActive(asignacion([]), now)).toBe(true));
  it("revocada, no vale", () => expect(isAssignmentActive(asignacion([], { revokedAt: ayer }), now)).toBe(false));
  it("todavía no empezó, no vale", () => expect(isAssignmentActive(asignacion([], { startsAt: manana }), now)).toBe(false));
  it("ya venció, no vale", () => expect(isAssignmentActive(asignacion([], { endsAt: ayer }), now)).toBe(false));
  it("vence justo ahora, ya no vale", () => expect(isAssignmentActive(asignacion([], { endsAt: now }), now)).toBe(false));
});

describe("compatibilidad: STAFF sin asignaciones conserva lo de hoy", () => {
  it.each([
    [MEMBERS_MODULE_KEY, "VIEW"],
    [MEMBERSHIP_DUES_MODULE_KEY, "NONE"],
    [BOOKINGS_MODULE_KEY, "VIEW"],
    [RAFFLES_MODULE_KEY, "VIEW"],
    ["un-modulo-no-migrado", "NONE"],
  ])("%s → %s", (key, esperado) => {
    expect(legacyStaffLevel(key)).toBe(esperado);
    expect(nivel({ moduleKey: key })).toBe(esperado);
  });
});

describe("resolveModuleLevel", () => {
  it("módulo apagado: nadie entra, ni el dueño", () => {
    expect(nivel({ moduleEnabled: false, workspaceRole: "WORKSPACE_OWNER" })).toBe("NONE");
  });

  it("sin rol en el workspace: nada, aunque tenga asignaciones", () => {
    expect(
      nivel({ workspaceRole: null, assignments: [asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }])] }),
    ).toBe("NONE");
  });

  it.each(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"])("%s gestiona todo", (rol) => {
    expect(nivel({ workspaceRole: rol, moduleKey: MEMBERSHIP_DUES_MODULE_KEY })).toBe("MANAGE");
  });

  it("con asignaciones vigentes, mandan los roles y no la compatibilidad", () => {
    const tesoreria = asignacion([{ moduleKey: MEMBERSHIP_DUES_MODULE_KEY, level: "MANAGE" }]);
    expect(nivel({ moduleKey: MEMBERSHIP_DUES_MODULE_KEY, assignments: [tesoreria] })).toBe("MANAGE");
    // Socios no figura en su rol: queda sin acceso, aunque como STAFF suelto tendría VIEW.
    expect(nivel({ moduleKey: MEMBERS_MODULE_KEY, assignments: [tesoreria] })).toBe("NONE");
  });

  it("con dos roles, gana el nivel más alto", () => {
    const a = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "VIEW" }]);
    const b = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }]);
    expect(nivel({ assignments: [a, b] })).toBe("MANAGE");
  });

  it("si todas las asignaciones vencieron, vuelve a la compatibilidad", () => {
    const vencida = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { endsAt: ayer });
    expect(nivel({ assignments: [vencida] })).toBe("VIEW");
  });
});

describe("habilitación efectiva", () => {
  it("Cuotas cuenta como activa si Socios está activo (vive bajo /members)", () => {
    expect(isModuleEffectivelyEnabled(MEMBERSHIP_DUES_MODULE_KEY, new Set([MEMBERS_MODULE_KEY]))).toBe(true);
  });
  it("los demás módulos sólo cuentan con su propia llave", () => {
    expect(isModuleEffectivelyEnabled(RAFFLES_MODULE_KEY, new Set([MEMBERS_MODULE_KEY]))).toBe(false);
    expect(isModuleEffectivelyEnabled(RAFFLES_MODULE_KEY, new Set([RAFFLES_MODULE_KEY]))).toBe(true);
  });
});

describe("manageFlagFor (menú)", () => {
  it("en un módulo migrado decide el nivel", () => {
    expect(manageFlagFor({ [RAFFLES_MODULE_KEY]: "VIEW" }, RAFFLES_MODULE_KEY, true)).toBe(false);
    expect(manageFlagFor({ [RAFFLES_MODULE_KEY]: "MANAGE" }, RAFFLES_MODULE_KEY, false)).toBe(true);
  });
  it("en un módulo no migrado se usa el criterio de siempre", () => {
    expect(manageFlagFor({}, "courses-sales", true)).toBe(true);
    expect(manageFlagFor({}, "courses-sales", false)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/permissions/levels.test.ts`
Expected: FAIL, `Failed to resolve import "./levels"`.

- [ ] **Step 3: Implementar `levels.ts`**

```ts
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";

/**
 * Niveles de permiso por módulo (diseño de roles, §4 y §9).
 *
 * Todo lo de este archivo es puro: no lee la base ni depende de Next. La lectura vive en
 * `module-access.ts`; acá sólo se decide, para que la regla se pruebe sin simular nada.
 */

export type ModuleLevel = "NONE" | "VIEW" | "MANAGE";
export type ModuleLevels = Readonly<Record<string, ModuleLevel>>;

export type RoleAssignmentForLevels = {
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt: Date | null;
  permissions: readonly { moduleKey: string; level: ModuleLevel }[];
};

const RANK: Record<ModuleLevel, number> = { NONE: 0, VIEW: 1, MANAGE: 2 };

export function maxLevel(levels: Iterable<ModuleLevel>): ModuleLevel {
  let best: ModuleLevel = "NONE";
  for (const level of levels) if (RANK[level] > RANK[best]) best = level;
  return best;
}

export function hasLevel(actual: ModuleLevel, required: "VIEW" | "MANAGE"): boolean {
  return RANK[actual] >= RANK[required];
}

/** Dueño y admin gestionan todo. `ADMIN` es el valor de la tabla legacy `Membership`. */
const FULL_ACCESS_ROLES = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]);

/**
 * Lo que `STAFF` puede hoy en cada módulo ya migrado, copiado de los `access.ts` previos.
 * Es la red de seguridad de la etapa 1: mientras alguien no tenga roles asignados, sigue
 * exactamente igual que antes. Un módulo que no figura acá todavía no pregunta por niveles.
 */
const LEGACY_STAFF_LEVELS: Readonly<Record<string, ModuleLevel>> = {
  [MEMBERS_MODULE_KEY]: "VIEW",
  // Cuotas exigía `canManageWorkspaceCollection`: sólo dueño o admin.
  [MEMBERSHIP_DUES_MODULE_KEY]: "NONE",
  [BOOKINGS_MODULE_KEY]: "VIEW",
  [RAFFLES_MODULE_KEY]: "VIEW",
};

export function legacyStaffLevel(moduleKey: string): ModuleLevel {
  return LEGACY_STAFF_LEVELS[moduleKey] ?? "NONE";
}

/**
 * Cuotas vive bajo `/members` y hoy funciona con Socios activo aunque su propia llave esté
 * apagada (ver `lib/workspace-home/load.ts`). Sin este alias, la etapa 1 le quitaría Cuotas
 * a esas instituciones.
 */
const ENABLEMENT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  [MEMBERSHIP_DUES_MODULE_KEY]: [MEMBERSHIP_DUES_MODULE_KEY, MEMBERS_MODULE_KEY],
};

export function isModuleEffectivelyEnabled(moduleKey: string, enabled: ReadonlySet<string>): boolean {
  const keys = ENABLEMENT_ALIASES[moduleKey] ?? [moduleKey];
  return keys.some((k) => enabled.has(k));
}

export function isAssignmentActive(
  a: Pick<RoleAssignmentForLevels, "startsAt" | "endsAt" | "revokedAt">,
  now: Date,
): boolean {
  if (a.revokedAt) return false;
  if (a.startsAt && a.startsAt > now) return false;
  if (a.endsAt && a.endsAt <= now) return false;
  return true;
}

/**
 * El orden importa (spec §9):
 * 1. módulo apagado → nada; 2. sin rol en el workspace → nada;
 * 3. dueño/admin → todo; 4. con asignaciones vigentes → el máximo entre sus roles;
 * 5. STAFF sin asignaciones → lo de hoy.
 */
export function resolveModuleLevel(input: {
  moduleKey: string;
  moduleEnabled: boolean;
  workspaceRole: string | null;
  assignments: readonly RoleAssignmentForLevels[];
  now: Date;
}): ModuleLevel {
  if (!input.moduleEnabled) return "NONE";
  if (!input.workspaceRole) return "NONE";
  if (FULL_ACCESS_ROLES.has(input.workspaceRole)) return "MANAGE";

  const active = input.assignments.filter((a) => isAssignmentActive(a, input.now));
  if (active.length > 0) {
    return maxLevel(
      active.flatMap((a) =>
        a.permissions.filter((p) => p.moduleKey === input.moduleKey).map((p) => p.level),
      ),
    );
  }
  return legacyStaffLevel(input.moduleKey);
}

/**
 * Bandera "puede gestionar" para el menú y el inicio. En los módulos migrados decide el
 * nivel; en el resto se mantiene el criterio de antes (`adminFallback`) hasta la etapa 4.
 */
export function manageFlagFor(levels: ModuleLevels, moduleKey: string, adminFallback: boolean): boolean {
  if (!(moduleKey in LEGACY_STAFF_LEVELS)) return adminFallback;
  return levels[moduleKey] === "MANAGE";
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/permissions/levels.test.ts`
Expected: PASS, todos los casos.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/permissions/levels.ts apps/fotoffice/lib/permissions/levels.test.ts
git commit -m "La regla de niveles de permiso por módulo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: La función de servidor

**Files:**
- Create: `apps/fotoffice/lib/permissions/module-access.ts`
- Test: `apps/fotoffice/lib/permissions/module-access.test.ts`

**Interfaces:**
- Consumes: todo lo de `levels.ts` (Task 2); `getEnabledModuleKeysForWorkspace(workspaceId): Promise<Set<string>>` de `@/lib/modules/gating`; `resolveWorkspaceRole(userId, workspaceId): Promise<string | null>` de `@/lib/workspace-role`; `listAvailableModuleKeys(): string[]` de `@/lib/modules/registry`.
- Produces:
  - `getModuleLevels(userId: number, workspaceId: string, now?: Date): Promise<ModuleLevels>`
  - `getModuleLevel(userId: number, workspaceId: string, moduleKey: string): Promise<ModuleLevel>`
  - `hasModuleLevel(userId: number, workspaceId: string, moduleKey: string, required: "VIEW" | "MANAGE"): Promise<boolean>`

- [ ] **Step 1: Escribir las pruebas**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@repo/db";

const H = vi.hoisted(() => ({
  findMany: vi.fn(),
  enabled: vi.fn(),
  role: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  return { ...real, prisma: { workspaceRoleAssignment: { findMany: H.findMany } } };
});
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: H.enabled }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));

const { getModuleLevel, getModuleLevels, hasModuleLevel } = await import("./module-access");

beforeEach(() => {
  H.findMany.mockReset().mockResolvedValue([]);
  H.enabled.mockReset().mockResolvedValue(new Set(["members", "raffles", "bookings"]));
  H.role.mockReset().mockResolvedValue("STAFF");
});

describe("getModuleLevels", () => {
  it("STAFF sin roles: lo de hoy", async () => {
    const levels = await getModuleLevels(7, "ws-1");
    expect(levels.members).toBe("VIEW");
    expect(levels.raffles).toBe("VIEW");
    expect(levels["membership-dues"]).toBe("NONE");
  });

  it("consulta sólo asignaciones de ESTA persona en ESTE workspace, con roles de ese workspace", async () => {
    await getModuleLevels(7, "ws-1");
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, workspaceId: "ws-1", revokedAt: null, role: { workspaceId: "ws-1" } },
      }),
    );
  });

  it("aplica las asignaciones que vienen de la base", async () => {
    H.findMany.mockResolvedValue([
      {
        startsAt: null,
        endsAt: null,
        revokedAt: null,
        role: { permissions: [{ moduleKey: "membership-dues", level: "MANAGE" }] },
      },
    ]);
    const levels = await getModuleLevels(7, "ws-1");
    expect(levels["membership-dues"]).toBe("MANAGE");
    expect(levels.members).toBe("NONE");
  });

  it("si la tabla todavía no existe en la base, sigue con la compatibilidad", async () => {
    H.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("The table `WorkspaceRoleAssignment` does not exist", {
        code: "P2021",
        clientVersion: "6",
      }),
    );
    expect((await getModuleLevels(7, "ws-1")).members).toBe("VIEW");
  });

  it("cualquier otro error de base se propaga", async () => {
    H.findMany.mockRejectedValue(new Error("se cayó la conexión"));
    await expect(getModuleLevels(7, "ws-1")).rejects.toThrow("se cayó la conexión");
  });
});

describe("getModuleLevel y hasModuleLevel", () => {
  it("un módulo apagado da NONE", async () => {
    H.role.mockResolvedValue("WORKSPACE_OWNER");
    expect(await getModuleLevel(7, "ws-1", "evaluaciones")).toBe("NONE");
  });

  it("hasModuleLevel compara contra el nivel pedido", async () => {
    expect(await hasModuleLevel(7, "ws-1", "raffles", "VIEW")).toBe(true);
    expect(await hasModuleLevel(7, "ws-1", "raffles", "MANAGE")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/permissions/module-access.test.ts`
Expected: FAIL, `Failed to resolve import "./module-access"`.

- [ ] **Step 3: Implementar `module-access.ts`**

```ts
import "server-only";
import { Prisma, prisma } from "@repo/db";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { listAvailableModuleKeys } from "@/lib/modules/registry";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import {
  hasLevel,
  isModuleEffectivelyEnabled,
  resolveModuleLevel,
  type ModuleLevel,
  type ModuleLevels,
  type RoleAssignmentForLevels,
} from "./levels";

/**
 * La única puerta para saber qué puede hacer alguien en un módulo (diseño de roles, §9).
 *
 * Páginas, acciones y menú preguntan acá. Si cada uno resolviera por su cuenta volvería a
 * pasar lo de antes de `resolveWorkspaceRole`: el menú ofrecía pantallas que la página negaba.
 */

async function loadAssignments(userId: number, workspaceId: string): Promise<RoleAssignmentForLevels[]> {
  try {
    const rows = await prisma.workspaceRoleAssignment.findMany({
      // `role.workspaceId` además del de la asignación: un rol de otra institución nunca cuenta.
      where: { userId, workspaceId, revokedAt: null, role: { workspaceId } },
      select: {
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        role: { select: { permissions: { select: { moduleKey: true, level: true } } } },
      },
    });
    return rows.map((r) => ({
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      revokedAt: r.revokedAt,
      permissions: r.role.permissions,
    }));
  } catch (e) {
    // P2021: la tabla no existe. Pasa en una base donde todavía no se aplicó la migración;
    // sin asignaciones, todos siguen con la compatibilidad, que es lo que tenían.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") return [];
    throw e;
  }
}

export async function getModuleLevels(
  userId: number,
  workspaceId: string,
  now: Date = new Date(),
): Promise<ModuleLevels> {
  const [enabled, workspaceRole, assignments] = await Promise.all([
    getEnabledModuleKeysForWorkspace(workspaceId),
    resolveWorkspaceRole(userId, workspaceId),
    loadAssignments(userId, workspaceId),
  ]);

  const levels: Record<string, ModuleLevel> = {};
  for (const moduleKey of listAvailableModuleKeys()) {
    levels[moduleKey] = resolveModuleLevel({
      moduleKey,
      moduleEnabled: isModuleEffectivelyEnabled(moduleKey, enabled),
      workspaceRole,
      assignments,
      now,
    });
  }
  return levels;
}

export async function getModuleLevel(
  userId: number,
  workspaceId: string,
  moduleKey: string,
): Promise<ModuleLevel> {
  return (await getModuleLevels(userId, workspaceId))[moduleKey] ?? "NONE";
}

export async function hasModuleLevel(
  userId: number,
  workspaceId: string,
  moduleKey: string,
  required: "VIEW" | "MANAGE",
): Promise<boolean> {
  return hasLevel(await getModuleLevel(userId, workspaceId, moduleKey), required);
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/permissions`
Expected: PASS (los dos archivos).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/permissions/module-access.ts apps/fotoffice/lib/permissions/module-access.test.ts
git commit -m "Una sola función de servidor decide el nivel de permiso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Reservas y Sorteos preguntan el nivel

**Files:**
- Modify: `apps/fotoffice/lib/raffles/access.ts`, `apps/fotoffice/lib/bookings/access.ts`
- Modify: `apps/fotoffice/app/(shell)/sorteos/page.tsx:7,20,23`, `apps/fotoffice/app/(shell)/sorteos/[id]/page.tsx:10,51,58`
- Test: `apps/fotoffice/lib/raffles/access.test.ts` (reescribir), `apps/fotoffice/lib/bookings/access.test.ts` (nuevo)

**Interfaces:**
- Consumes: `getModuleLevel` (Task 3), `hasLevel` y `ModuleLevel` (Task 2).
- Produces: `requireRafflesStaff()`, `requireRafflesAdmin()`, `requireBookingsStaff()`, `requireBookingsAdmin()` con los mismos nombres y redirecciones; ahora devuelven `{ user, workspace, level: ModuleLevel }` en vez de `{ user, workspace, role }`.

- [ ] **Step 1: Reescribir `lib/raffles/access.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, requireActiveWorkspaceMock, levelMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  requireActiveWorkspaceMock: vi.fn(),
  levelMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: requireActiveWorkspaceMock }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: levelMock }));

const { requireRafflesAdmin, requireRafflesStaff } = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
});

describe("la puerta del módulo Sorteos", () => {
  it("pregunta el nivel de ESTA persona en ESTE workspace y ESTE módulo", async () => {
    await requireRafflesStaff();
    expect(levelMock).toHaveBeenCalledWith(7, "ws-1", "raffles");
  });

  it("sin workspace activo, va a elegir uno", async () => {
    requireActiveWorkspaceMock.mockResolvedValue({ user: { id: 7 }, workspace: null });
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/workspace");
  });

  it("sin nivel (módulo apagado o sin rol), afuera", async () => {
    levelMock.mockResolvedValue("NONE");
    await expect(requireRafflesStaff()).rejects.toThrow("REDIRECT:/dashboard");
    await expect(requireRafflesAdmin()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("con VIEW ve la lista pero no administra", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireRafflesStaff()).resolves.toMatchObject({ level: "VIEW" });
    await expect(requireRafflesAdmin()).rejects.toThrow("REDIRECT:/sorteos");
  });

  it("con MANAGE administra", async () => {
    await expect(requireRafflesAdmin()).resolves.toMatchObject({ workspace: ws, level: "MANAGE" });
  });
});
```

Crear `lib/bookings/access.test.ts` con el mismo contenido, cambiando: el import a `requireBookingsAdmin, requireBookingsStaff`, el módulo esperado a `"bookings"`, la redirección de "no administra" a `"REDIRECT:/reservas"` y los títulos a "Reservas".

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice exec vitest run lib/raffles/access.test.ts lib/bookings/access.test.ts`
Expected: FAIL (`getModuleLevel` nunca se llama; `level` no existe en el resultado).

- [ ] **Step 3: Reescribir `lib/raffles/access.ts`**

```ts
import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { RAFFLES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, siempre en el servidor.
 *
 * El nivel sale de `getModuleLevel`, que ya incluye si el módulo está habilitado para ESE
 * workspace y qué rol tiene la persona. Esconder el link del menú es lo cosmético, nunca el control.
 *
 * Ver la lista y entregar premios pide VIEW. Crear, anunciar, sellar, resolver y cancelar pide
 * MANAGE: son los actos que definen el resultado, y quien los hace queda con nombre y apellido
 * en la historia del sorteo.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, RAFFLES_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  return { user, workspace, level };
}

/** Ver los sorteos y entregar premios. */
export async function requireRafflesStaff() {
  return contextoBase();
}

/** Crear, anunciar, sellar, resolver, cancelar. */
export async function requireRafflesAdmin() {
  const ctx = await contextoBase();
  if (!hasLevel(ctx.level, "MANAGE")) redirect("/sorteos");
  return ctx;
}
```

`lib/bookings/access.ts`, igual con `BOOKINGS_MODULE_KEY`, `requireBookingsStaff` / `requireBookingsAdmin`, la redirección `"/reservas"` y este comentario de cabecera: *"Agenda pide VIEW; Espacios, Extras y Tarifas piden MANAGE."*

- [ ] **Step 4: Pantallas de Sorteos que leían `role`**

En `app/(shell)/sorteos/page.tsx`: borrar el import de `canManageWorkspaceSettings`, cambiar `const { workspace, role } = await requireRafflesStaff();` por `const { workspace, level } = await requireRafflesStaff();` y `const puedeAdministrar = canManageWorkspaceSettings(role);` por `const puedeAdministrar = level === "MANAGE";`.

En `app/(shell)/sorteos/[id]/page.tsx`: lo mismo, con `const admin = level === "MANAGE";`.

Comprobar que no quedó nadie leyendo `.role` de estos contextos:

```bash
cd apps/fotoffice
grep -rn "require\(Raffles\|Bookings\)\(Staff\|Admin\)" app lib | grep "role"
```
Expected: sin resultados.

- [ ] **Step 5: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/raffles lib/bookings`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/raffles apps/fotoffice/lib/bookings "apps/fotoffice/app/(shell)/sorteos"
git commit -m "Reservas y Sorteos deciden el acceso por nivel de permiso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Socios y Cuotas preguntan el nivel

**Files:**
- Modify: `apps/fotoffice/lib/members/access.ts`
- Modify (Cuotas → `membership-dues`): `app/(shell)/members/cuotas/page.tsx`, `app/(shell)/members/cuotas/historial/page.tsx`, `app/(shell)/members/cuotas/configuracion/page.tsx`, `app/(shell)/members/[id]/page.tsx`, `app/actions/generate-dues.ts`, `app/actions/manual-payment.ts`, `app/actions/dues-settings.ts` (3 lugares), `app/actions/payments-import.ts`, `app/actions/recommendations.ts`
- Modify: `apps/fotoffice/lib/workspace-home/load.ts:4-5,92-94` (cifra de cobranza del inicio → `membership-dues`)
- Modify (Socios → `members`): `app/(shell)/members/solicitudes/page.tsx`, `app/actions/membership-applications.ts`, `app/(shell)/members/carnets/permisos/page.tsx`, `app/actions/card-operators.ts`, `app/actions/issue-cards.ts`
- Test: `apps/fotoffice/lib/workspace-role-consistency.test.ts` (el `it` de Socios), `apps/fotoffice/lib/members/access.test.ts` (nuevo), `apps/fotoffice/lib/permissions/collection-usage.test.ts` (nuevo), `apps/fotoffice/app/actions/membership-applications.test.ts` (ajustar el mock)

**Interfaces:**
- Consumes: `getModuleLevel`, `hasModuleLevel` (Task 3).
- Produces: `requireMembersContext()` / `requireMembersManageContext()` / `resolveMembersExportContext()` con el mismo tipo `MembersContext` de hoy.

**No se tocan** (siguen con `canManageWorkspaceCollection`, porque deciden a dónde va la plata): `app/workspace/configuracion/cobros/page.tsx`, `app/actions/split-consent.ts`, `app/api/payments/mercadopago/connect/start/route.ts`.

- [ ] **Step 1: Guardia sobre el permiso de cobros (test que falla)**

`lib/permissions/collection-usage.test.ts`:

```ts
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * `canManageWorkspaceCollection` decide a dónde va la plata de la institución (conectar Mercado
 * Pago, consentir el split). Eso nunca se delega a un rol (diseño de roles, §4). Todo lo demás
 * de Cuotas pregunta el nivel del módulo, para que Tesorería pueda operar sin ser admin.
 */
const PERMITIDOS = [
  "app/actions/split-consent.ts",
  "app/api/payments/mercadopago/connect/start/route.ts",
  "app/workspace/configuracion/cobros/page.tsx",
  "lib/payments/connect/authz.ts",
].sort();

describe("el permiso de cobros sólo se usa para conectar el cobro", () => {
  it("ningún otro archivo lo llama", () => {
    const salida = execSync(
      `grep -rl "canManageWorkspaceCollection(" app lib components --include=*.ts --include=*.tsx || true`,
      { cwd: appRoot, encoding: "utf8" },
    );
    const archivos = salida
      .split("\n")
      .filter(Boolean)
      .filter((f) => !f.endsWith(".test.ts"))
      .sort();
    expect(archivos).toEqual(PERMITIDOS);
  });
});
```

Run: `pnpm --filter fotoffice exec vitest run lib/permissions/collection-usage.test.ts`
Expected: FAIL; la lista incluye los archivos de Cuotas, Solicitudes, Carnets y `lib/workspace-home/load.ts`.

- [ ] **Step 2: Test de `lib/members/access.ts` (falla)**

`lib/members/access.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  redirect: vi.fn((d: string) => {
    throw new Error(`REDIRECT:${d}`);
  }),
  requireAuth: vi.fn(),
  getAuthUser: vi.fn(),
  workspace: vi.fn(),
  enabled: vi.fn(),
  level: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuth: H.requireAuth, getAuthUser: H.getAuthUser }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.workspace }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.enabled }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: H.level }));

const { requireMembersContext, requireMembersManageContext, resolveMembersExportContext } = await import(
  "./access"
);

beforeEach(() => {
  H.redirect.mockClear();
  H.requireAuth.mockReset().mockResolvedValue({ id: 7 });
  H.getAuthUser.mockReset().mockResolvedValue({ id: 7 });
  H.workspace.mockReset().mockResolvedValue({ id: "ws-1", name: "SFPR" });
  H.enabled.mockReset().mockResolvedValue(true);
  H.level.mockReset().mockResolvedValue("MANAGE");
});

describe("Socios", () => {
  it("módulo apagado: mismo destino que antes", async () => {
    H.enabled.mockResolvedValue(false);
    await expect(requireMembersContext()).rejects.toThrow("REDIRECT:/dashboard?module=off");
  });

  it("sin nivel: afuera", async () => {
    H.level.mockResolvedValue("NONE");
    await expect(requireMembersContext()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("VIEW consulta pero no gestiona", async () => {
    H.level.mockResolvedValue("VIEW");
    await expect(requireMembersContext()).resolves.toMatchObject({ canManage: false });
    await expect(requireMembersManageContext()).rejects.toThrow("REDIRECT:/members?forbidden=manage");
  });

  it("MANAGE gestiona", async () => {
    await expect(requireMembersManageContext()).resolves.toMatchObject({ canManage: true });
    expect(H.level).toHaveBeenCalledWith(7, "ws-1", "members");
  });

  it("la exportación del padrón exige MANAGE", async () => {
    H.level.mockResolvedValue("VIEW");
    expect(await resolveMembersExportContext()).toBeNull();
    H.level.mockResolvedValue("MANAGE");
    expect(await resolveMembersExportContext()).toMatchObject({ canManage: true });
  });
});
```

Run: `pnpm --filter fotoffice exec vitest run lib/members/access.test.ts`
Expected: FAIL (`getModuleLevel` no se llama).

- [ ] **Step 3: Actualizar la invariante de Socios en `lib/workspace-role-consistency.test.ts`**

`lib/members/access.ts` va a dejar de llamar a `resolveWorkspaceRole` (lo hace `module-access.ts` por él), así que el `it` que lo exigía cambia. Agregar `const permissionsSrc = readFileSync(join(here, "permissions/module-access.ts"), "utf8");`.
Reemplazar el `it("los guards del módulo Socios usan esa misma función", ...)` por:

```ts
  it("la función de niveles resuelve el rol con esa misma función", () => {
    assert.match(permissionsSrc, /resolveWorkspaceRole/);
    assert.doesNotMatch(permissionsSrc, /prisma\.membership\b/);
  });

  it("los guards del módulo Socios preguntan el nivel, no el rol por su cuenta", () => {
    assert.match(membersAccessSrc, /getModuleLevel/);
    assert.doesNotMatch(membersAccessSrc, /prisma\.workspaceMembership/);
    assert.doesNotMatch(membersAccessSrc, /prisma\.membership\b/);
  });
```

- [ ] **Step 4: Reescribir `lib/members/access.ts`**

Reemplazar los imports de `resolveWorkspaceRole` y `canManageMembers` por `import { getModuleLevel } from "@/lib/permissions/module-access";`. Cambiar el comentario del campo `canManage` a *"Nivel MANAGE en Socios: puede crear/editar socios, cambiar estado y administrar categorías. VIEW sólo consulta."* Y en las funciones:

```ts
export async function requireMembersContext(): Promise<MembersContext> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/dashboard");

  const enabled = await isModuleEnabledForWorkspace(workspace.id, MEMBERS_MODULE_KEY);
  if (!enabled) redirect("/dashboard?module=off");

  const level = await getModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY);
  if (level === "NONE") redirect("/dashboard");
  return { user, workspace, canManage: level === "MANAGE" };
}
```

y en `resolveMembersExportContext`, reemplazar las dos últimas líneas antes del `return` por:

```ts
  // La exportación masiva se lleva datos personales de todo el padrón: sólo nivel MANAGE.
  const level = await getModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY);
  if (level !== "MANAGE") return null;
```

`requireMembersManageContext` no cambia.

- [ ] **Step 5: Reemplazar el permiso de cobros en Cuotas, Solicitudes y Carnets**

En cada archivo: quitar `import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";`, agregar `import { hasModuleLevel } from "@/lib/permissions/module-access";` y la constante del módulo (`MEMBERSHIP_DUES_MODULE_KEY` de `@/lib/membership/constants` o `MEMBERS_MODULE_KEY` de `@/lib/members/constants`, si no está importada). Reemplazar la llamada según esta tabla; el resto de la línea (redirect o mensaje de error) queda igual:

| Archivo | Reemplazo de `canManageWorkspaceCollection(user.id, workspace.id)` |
|---|---|
| `app/(shell)/members/cuotas/page.tsx` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "VIEW")` |
| `app/(shell)/members/cuotas/historial/page.tsx` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/(shell)/members/cuotas/configuracion/page.tsx` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/(shell)/members/[id]/page.tsx` (`puedeCobrar`) | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/actions/generate-dues.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/actions/manual-payment.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/actions/dues-settings.ts` (las 3) | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/actions/payments-import.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/actions/recommendations.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE")` |
| `app/(shell)/members/solicitudes/page.tsx` | `hasModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY, "MANAGE")` |
| `app/actions/membership-applications.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY, "MANAGE")` |
| `app/(shell)/members/carnets/permisos/page.tsx` | `hasModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY, "MANAGE")` |
| `app/actions/card-operators.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY, "MANAGE")` |
| `app/actions/issue-cards.ts` | `hasModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY, "MANAGE")` |

Por qué cada lado: lo que mueve plata de cuotas (generar, registrar pagos, importar, valores, bonificaciones) es de Tesorería. Altas y carnets son de Secretaría (spec §5). Para dueño, admin y STAFF el resultado es idéntico al de hoy: los dos módulos dan `MANAGE` a dueño/admin y `NONE`/`VIEW` a STAFF, que con `"MANAGE"` exigido queda afuera igual que antes.

En `app/(shell)/members/cuotas/page.tsx`, como ahora alcanza con VIEW para ver la página, el botón de generar sólo se muestra a quien gestiona. Después de la línea del `redirect`, agregar:

```ts
  const puedeGestionar = await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE");
```

y envolver el botón (línea ~73):

```tsx
        {puedeGestionar ? <GenerateDuesButton defaultPeriod={periodOf(new Date())} /> : null}
```

**`lib/workspace-home/load.ts`:**

Reemplazar `import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";` por `import { hasModuleLevel } from "@/lib/permissions/module-access";` y:

```ts
  const cobra =
    (enabled.has(MEMBERSHIP_DUES_MODULE_KEY) || enabled.has(MEMBERS_MODULE_KEY)) &&
    (await hasModuleLevel(input.userId, workspaceId, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"));
```

En `app/actions/membership-applications.test.ts`, cambiar el mock:

```ts
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.canManage }));
```

(en lugar de `vi.mock("@/lib/payments/connect/authz", ...)`). `H.canManage` ya devuelve un booleano, que es lo que devuelve `hasModuleLevel`.

- [ ] **Step 6: Comprobar**

```bash
cd apps/fotoffice
grep -rln "canManageWorkspaceCollection(" app lib components | grep -v "\.test\.ts"
pnpm --filter fotoffice exec vitest run lib/members lib/permissions lib/workspace-role-consistency.test.ts app/actions/membership-applications.test.ts
```
Expected: el `grep` lista sólo los 4 permitidos. Los tests pasan, incluido `collection-usage.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/members apps/fotoffice/lib/permissions/collection-usage.test.ts apps/fotoffice/lib/workspace-home/load.ts apps/fotoffice/lib/workspace-role-consistency.test.ts apps/fotoffice/app
git commit -m "Socios y Cuotas deciden el acceso por nivel; el cobro sigue reservado al dueño

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Menú e inicio salen de los mismos niveles

**Files:**
- Modify: `apps/fotoffice/components/shell/admin-shell.tsx:13-15,54-68,108-111`
- Modify: `apps/fotoffice/components/shell/shell-sidebar.tsx` (props)
- Modify: `apps/fotoffice/components/shell/shell-nav.tsx:158-191` (props y dos llamadas)
- Modify: `apps/fotoffice/app/workspace/page.tsx:9-11,38-48,75`
- Test: `apps/fotoffice/lib/workspace-role-consistency.test.ts`

**Interfaces:**
- Consumes: `getModuleLevels` (Task 3); `manageFlagFor` (Task 2).
- Produces: `ShellSidebar` y `ShellNav` reciben dos props nuevas, `canManageBookings: boolean` y `canManageRaffles: boolean`.

- [ ] **Step 1: Actualizar la invariante (test que falla)**

En `lib/workspace-role-consistency.test.ts`:
- Reemplazar el `it("los dos flags del menú (Socios y Configuración) salen del MISMO rol resuelto", ...)` por:

```ts
  it("los permisos de módulo del menú salen de UN solo cálculo de niveles", () => {
    assert.match(
      layoutSrc,
      /const levels = workspace !== null \? await getModuleLevels\(user\.id, workspace\.id\) : \{\};/,
    );
    assert.match(layoutSrc, /manageFlagFor\(levels, MEMBERS_MODULE_KEY/);
    assert.match(layoutSrc, /manageFlagFor\(levels, BOOKINGS_MODULE_KEY/);
    assert.match(layoutSrc, /manageFlagFor\(levels, RAFFLES_MODULE_KEY/);
    // Configuración sigue siendo de dueño/admin: no se delega (diseño de roles, §4).
    assert.match(layoutSrc, /canManageWorkspaceSettings\(activeRole\)/);
  });
```

- En el `it` del inicio del workspace agregar `assert.match(workspaceHomeSrc, /getModuleLevels/);`.

Run: `pnpm --filter fotoffice exec vitest run lib/workspace-role-consistency.test.ts`
Expected: FAIL en los `it` del menú y del inicio.

- [ ] **Step 2: `admin-shell.tsx`**

Reemplazar `import { canManageMembers } from "@/lib/members/role-policy";` por:

```ts
import { getModuleLevels } from "@/lib/permissions/module-access";
import { manageFlagFor } from "@/lib/permissions/levels";
```

(asegurar que `BOOKINGS_MODULE_KEY`, `MEMBERS_MODULE_KEY` y `RAFFLES_MODULE_KEY` ya estén importadas; lo están, porque se usan en `bookingsOn`/`membersOn`/`rafflesOn`). Reemplazar las líneas 64–68 por:

```ts
  // El rol sigue alimentando el encabezado y Configuración (que no se delega). Los permisos
  // de cada módulo salen de un solo cálculo de niveles, el mismo que usan las páginas.
  const activeRole = workspace !== null ? await resolveWorkspaceRole(user.id, workspace.id) : null;
  const levels = workspace !== null ? await getModuleLevels(user.id, workspace.id) : {};
  const canManageWorkspaceSettingsFlag = canManageWorkspaceSettings(activeRole);
  const canManageMembersFlag = manageFlagFor(levels, MEMBERS_MODULE_KEY, false);
  const canManageBookingsFlag = manageFlagFor(levels, BOOKINGS_MODULE_KEY, false);
  const canManageRafflesFlag = manageFlagFor(levels, RAFFLES_MODULE_KEY, false);
```

y en `<ShellSidebar ... />` agregar:

```tsx
          canManageBookings={canManageBookingsFlag}
          canManageRaffles={canManageRafflesFlag}
```

- [ ] **Step 3: `shell-sidebar.tsx` y `shell-nav.tsx`**

En `ShellSidebar`: agregar `canManageBookings` y `canManageRaffles` a la desestructuración y al tipo (`canManageBookings: boolean; canManageRaffles: boolean;`, debajo de `canManageMembers`), y pasarlas a `<ShellNav canManageBookings={canManageBookings} canManageRaffles={canManageRaffles} ... />`.

En `ShellNav`: lo mismo en la desestructuración y el tipo, y cambiar:

```tsx
  const reservas: Item[] = bookingsEnabled
    ? itemsDeModulo(BOOKINGS_MODULE_KEY, canManageBookings, vocabulary)
    : [];
```

```tsx
  const sorteos: Item[] = rafflesEnabled
    ? itemsDeModulo(RAFFLES_MODULE_KEY, canManageRaffles, vocabulary)
    : [];
```

Coberturas, Blog e Institución siguen con `canManageWorkspaceSettings` (etapa 4).

- [ ] **Step 4: `app/workspace/page.tsx`**

Reemplazar `import { canManageMembers } from "@/lib/members/role-policy";` por:

```ts
import { getModuleLevels } from "@/lib/permissions/module-access";
import { manageFlagFor } from "@/lib/permissions/levels";
```

Agregar `getModuleLevels(user.id, workspaceId),` como sexto elemento del `Promise.all` y `levels` a la desestructuración: `const [branding, profile, enabled, vocabulary, role, levels] = await Promise.all([...])`. Reemplazar `const puedeAdministrarSocios = canManageMembers(role);` por:

```ts
  const puedeAdministrarSocios = manageFlagFor(levels, MEMBERS_MODULE_KEY, false);
```

y en `submodulesFor(...)`:

```ts
          { canManage: manageFlagFor(levels, m.key, admin) },
```

(y actualizar el comentario de encima: *"El permiso es por módulo: sale del nivel en los módulos migrados y del rol de admin en el resto."*).

- [ ] **Step 5: Correr todo**

```bash
pnpm --filter fotoffice test
```
Expected: PASS completo.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/components/shell apps/fotoffice/app/workspace/page.tsx apps/fotoffice/lib/workspace-role-consistency.test.ts
git commit -m "El menú y el inicio usan los mismos niveles que las páginas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación, PR y SQL

**Files:** ninguno.

- [ ] **Step 1: Build completo (chequea tipos, incluidos los tests)**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles
DATABASE_URL="postgresql://x:x@localhost:5432/x" AUTH_SECRET="x" pnpm --filter fotoffice build
```
Expected: `Compiled successfully` y sin errores de tipos. Un archivo `"use server"` sólo puede exportar funciones `async`: si aparece *"Server Actions must be async functions"*, mover lo puro fuera de ese archivo.

- [ ] **Step 2: Lint**

```bash
pnpm --filter fotoffice lint
```
Expected: sin errores nuevos en los archivos tocados.

- [ ] **Step 3: Prueba manual en local (`next dev`, no previews de Vercel)**

Con `apps/fotoffice/.env.local` apuntando a la base de FOTOFFICE: entrar como dueño de SFPR y recorrer Socios → Padrón, Solicitudes, Cuotas (con el botón Generar visible), Valores y calendario, Carnets → Permisos, Reservas → Espacios, Sorteos → Nuevo, y la portada `/workspace`. Todo tiene que verse **igual que en producción**. Antes de aplicar el SQL, las tablas no existen y la función debe seguir andando (rama P2021).

- [ ] **Step 4: Push y PR**

```bash
git push -u origin docs/fotoffice-roles-comision-directiva
gh pr create --title "FOTOFFICE: roles personalizados, etapa 1 (tablas y función única de permisos)" --body "$(cat <<'EOF'
## Qué cambia

Nada visible. Es la base de la Comisión directiva: tablas de roles y una sola función que decide qué puede hacer cada persona en cada módulo. Socios, Cuotas, Reservas y Sorteos (pantallas, acciones y menú) ya preguntan ahí.

- Dueño y admin: siguen gestionando todo.
- Equipo (STAFF) sin roles: exactamente lo de hoy.
- Conectar Mercado Pago sigue siendo sólo de dueño o admin, y un test lo vigila.

Diseño: `docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md`
Plan: `docs/superpowers/plans/2026-10-02-fotoffice-roles-etapa-1.md`

## Antes de fusionar

Aplicar en la base de FOTOFFICE (Neon `compramelafoto`, rama `development`) el SQL de
`packages/db/prisma/migrations/20261003000000_fotoffice_roles_personalizados/migration.sql`
y registrarlo:

    cd packages/db
    set -a && . ../../apps/fotoffice/.env.local && set +a
    npx prisma migrate resolve --applied 20261003000000_fotoffice_roles_personalizados

Sólo crea tablas nuevas. Si el código llegara antes que el SQL, sigue funcionando igual (sin roles asignados).

## Después de fusionar

Mirar que el deploy de producción quede Ready y entrar como dueño de SFPR a Socios, Cuotas, Reservas y Sorteos.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Informar a Daniel** que el SQL lo aplica él antes de fusionar, con el comando de registro de arriba, y que después hay que verificar `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name LIKE '%roles_personalizados%'`.

---

## Qué queda para la etapa 2 (no hacer acá)

- Pantallas Roles e Integrantes, plantillas por workspace, correo de aviso.
- Revisar las acciones que hoy piden sólo VIEW pero escriben: **entregar premios** (Sorteos) y **crear reservas en la agenda** (Reservas). Con STAFF sin roles es lo de hoy; cuando exista un rol con VIEW de solo lectura (por ejemplo, Revisor de cuentas), esas acciones van a necesitar MANAGE o una acción sensible propia.
- Caja, Clientes, Cursos, Evaluaciones, Sitio web, Blog, Portfolio y Coberturas siguen con el rol de workspace (etapa 4).
