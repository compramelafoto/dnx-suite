# FOTOFFICE — Roles, etapa 2: cargos, roles por institución e integrantes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño o un admin arme la Comisión directiva: defina cargos (con "vota" sí/no), cree y edite roles con su grilla de permisos (con plantillas), y sume integrantes (socios con o sin cuenta, o usuarios no socios) con cargo, roles y mandato. Es la "etapa 0" de Gobierno institucional.

**Architecture:** Dos tablas nuevas de cargos (`WorkspaceOffice`, `WorkspaceOfficeTerm`) y ajustes a las de la etapa 1 (asignación por socio, roles archivables). La regla pura de niveles deja de caer en la compatibilidad STAFF para quien ya tuvo roles. Un módulo `lib/commission/` concentra plantillas, siembra, cargos vigentes, sincronización de membresía y acciones; las pantallas viven en `/workspace/configuracion/comision`.

**Tech Stack:** Next.js 16.2 (leer `apps/fotoffice/node_modules/next/dist/docs/` antes de crear rutas o acciones), React 19.2, Prisma 6, Vitest, Resend vía `sendAndLogEmail`.

**Spec:** `docs/superpowers/specs/2026-10-02-fotoffice-roles-comision-directiva-design.md` (secciones 3–8, 11 y **12**). Contexto: `apps/fotoffice/docs/superpowers/specs/2026-10-03-fotoffice-gobierno-proyectos-design.md` en la rama `docs/fotoffice-gobierno-proyectos`.

## Global Constraints

- La rama sale de `docs/fotoffice-roles-comision-directiva` (PR 317, sin fusionar). El PR de esta etapa va **apilado** sobre ese: base `docs/fotoffice-roles-comision-directiva`.
- Quien crea roles, define cargos y suma integrantes: **dueño y admins** (`canManageWorkspaceSettings`). Nadie más, en ninguna acción.
- Nada se borra: quitar a alguien = `revokedAt`; borrar un rol con personas = archivarlo (`archivedAt`) y revocar sus asignaciones.
- A `WORKSPACE_OWNER` y `WORKSPACE_ADMIN` nunca se les crea, cambia ni borra la membresía desde esta función.
- Votan los mandatos vigentes en cargos con `votes = true`. Un socio inactivo con cargo **sigue votando**.
- Socio sin cuenta: cargo y roles se cargan sobre `memberId`; la membresía de equipo se crea cuando tenga cuenta (sincronización al iniciar sesión).
- Acción sensible de Caja: la cadena exacta `cash.project_money`.
- Sin staging: el SQL lo aplica Daniel en la base de FOTOFFICE (Neon `compramelafoto`, rama `development`, proyecto `divine-hall-10689679`, rama `br-old-rain-adwthzng`) **antes** de fusionar, después del de la etapa 1.
- El build chequea tipos de los tests. En esta máquina: `NODE_OPTIONS=--max-old-space-size=8192`.
- Archivos `"use server"`: sólo exportan funciones async. Lo puro va en `lib/`.
- Textos al usuario en español rioplatense (vos). Fechas que ve el usuario: hora argentina. Montos: no aplica.
- Commits en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Trabajar sólo en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles-2`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/prisma/schema.prisma` + migración `20261004000000_fotoffice_cargos_y_comision` | Cargos, mandatos, asignación por socio, roles archivables |
| `apps/fotoffice/lib/permissions/levels.ts` | Regla §12.3: quien tuvo roles no vuelve a la compatibilidad |
| `apps/fotoffice/lib/permissions/module-access.ts` | Carga asignaciones por usuario o por ficha de socio, incluidas revocadas |
| `apps/fotoffice/lib/commission/templates.ts` (nuevo, puro) | Plantillas de roles y de cargos; constante `CASH_PROJECT_MONEY_ACTION` |
| `apps/fotoffice/lib/commission/seed.ts` (nuevo) | `ensureCommissionSetup(workspaceId)`: siembra idempotente |
| `apps/fotoffice/lib/commission/terms.ts` (nuevo) | Pura: vigencia de mandatos, quién vota. Servidor: `listActiveOfficeHolders`, `canVote` |
| `apps/fotoffice/lib/commission/team-membership.ts` (nuevo) | Crear/quitar la membresía STAFF que acompaña a los roles; sincronizar al iniciar sesión |
| `apps/fotoffice/lib/commission/validation.ts` (nuevo, puro) | Validación de formularios (rol, grilla, cargo, integrante, fechas) |
| `apps/fotoffice/lib/commission/emails.ts` (nuevo, puro) | Correos "te sumaron" y "un integrante quedó inactivo" |
| `apps/fotoffice/app/workspace/configuracion/comision/**` (nuevo) | Pantallas Integrantes, Cargos, Roles, editor de rol; acciones |
| `apps/fotoffice/components/shell/shell-nav.tsx` | Ítem "Comisión directiva" en Institución |
| `apps/fotoffice/lib/post-login.ts` | Llama a la sincronización |
| `apps/fotoffice/app/actions/members.ts` | Aviso al admin al suspender o dar de baja a un integrante |

---

### Task 1: Tablas de cargos y ajustes a las de la etapa 1

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (bloque "FOTOFFICE: roles personalizados" al final; `Workspace`; `User`; `Member`)
- Create: `packages/db/prisma/migrations/20261004000000_fotoffice_cargos_y_comision/migration.sql`

**Interfaces:**
- Produces: `prisma.workspaceOffice`, `prisma.workspaceOfficeTerm`; `WorkspaceRoleAssignment.userId: number | null`, `.memberId: string | null`, sin `positionTitle`; `WorkspaceCustomRole.archivedAt: Date | null`.

- [ ] **Step 1: Cambios en `WorkspaceCustomRole` y `WorkspaceRoleAssignment`**

En `WorkspaceCustomRole` agregar, debajo de `templateKey`:

```prisma
  /// Archivado al "borrarlo" con personas asignadas. Nada se borra (diseño §12.2).
  archivedAt  DateTime?
```

Reemplazar el modelo `WorkspaceRoleAssignment` completo por:

```prisma
/// Persona ↔ rol en un workspace. Persona = usuario (`userId`) o ficha de socio (`memberId`);
/// al menos uno. Un socio sin cuenta recibe el rol igual y entra cuando la active (§12.1.4).
model WorkspaceRoleAssignment {
  id           String    @id @default(cuid())
  workspaceId  String
  userId       Int?
  memberId     String?
  roleId       String
  startsAt     DateTime?
  /// Null = no vence.
  endsAt       DateTime?
  /// Quién hizo la asignación. Sin relación a propósito: no agrega otra back-relation a `User`.
  assignedById Int
  revokedAt    DateTime?
  createdAt    DateTime  @default(now())

  user   User?               @relation(fields: [userId], references: [id], onDelete: Cascade)
  member Member?             @relation(fields: [memberId], references: [id], onDelete: Cascade)
  role   WorkspaceCustomRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@index([workspaceId, userId])
  @@index([workspaceId, memberId])
  @@index([roleId])
}
```

- [ ] **Step 2: Modelos nuevos (al final del bloque)**

```prisma
/// Cargo de la comisión, definido por cada institución ("Tesorero", "Vocal titular").
model WorkspaceOffice {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  /// Integra la comisión y vota (diseño §12.1.1). Revisor de cuentas: false.
  votes       Boolean  @default(true)
  order       Int      @default(0)
  /// Plantilla de la que nació ("president", "auditor"…). Null si se creó de cero.
  templateKey String?
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  terms     WorkspaceOfficeTerm[]

  @@unique([workspaceId, name])
}

/// Mandato: una persona en un cargo por un período. Persona = socio o usuario (al menos uno).
model WorkspaceOfficeTerm {
  id           String    @id @default(cuid())
  workspaceId  String
  officeId     String
  memberId     String?
  userId       Int?
  startsAt     DateTime?
  /// Null = sin vencimiento cargado.
  endsAt       DateTime?
  revokedAt    DateTime?
  assignedById Int
  createdAt    DateTime  @default(now())

  office WorkspaceOffice @relation(fields: [officeId], references: [id], onDelete: Cascade)
  member Member?         @relation(fields: [memberId], references: [id], onDelete: Cascade)
  user   User?           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([workspaceId, officeId])
  @@index([workspaceId, memberId])
  @@index([workspaceId, userId])
}
```

- [ ] **Step 3: Back-relations**

- `model Workspace`: debajo de `customRoles WorkspaceCustomRole[]` agregar `offices WorkspaceOffice[]`.
- `model User`: debajo de `workspaceRoleAssignments WorkspaceRoleAssignment[]` agregar `workspaceOfficeTerms WorkspaceOfficeTerm[]`.
- `model Member`: al final de sus relaciones agregar:

```prisma
  roleAssignments WorkspaceRoleAssignment[]
  officeTerms     WorkspaceOfficeTerm[]
```

- [ ] **Step 4: Validar, generar y producir el SQL**

```bash
cd /Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite-wt-roles-2/packages/db
npx prisma validate && npx prisma generate
SCRATCH=/private/tmp/claude-501/-Users-danielcuart-Desktop-PROGRAMACIONES-dnx-suite-apps-fotoffice/f88e827b-5465-47c7-95e3-ad459e026a19/scratchpad
git show docs/fotoffice-roles-comision-directiva:packages/db/prisma/schema.prisma > "$SCRATCH/schema-etapa1.prisma"
mkdir -p prisma/migrations/20261004000000_fotoffice_cargos_y_comision
npx prisma migrate diff --from-schema-datamodel "$SCRATCH/schema-etapa1.prisma" --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261004000000_fotoffice_cargos_y_comision/migration.sql
cat prisma/migrations/20261004000000_fotoffice_cargos_y_comision/migration.sql
```
Expected: sólo sentencias sobre `WorkspaceCustomRole` (ADD `archivedAt`), `WorkspaceRoleAssignment` (DROP `positionTitle`, `userId` DROP NOT NULL, ADD `memberId`, índice, FK a `Member`), y CREATE de `WorkspaceOffice` / `WorkspaceOfficeTerm` con índices y FKs. **Nada sobre `Member`, `User` ni `Workspace`** (las back-relations no generan SQL). Si aparece otra cosa, detenerse y reportar.

- [ ] **Step 5: Encabezado y CHECKs**

Al principio del archivo:

```sql
-- Roles de FOTOFFICE, etapa 2: cargos y mandatos, asignación por ficha de socio, roles archivables.
-- Va DESPUÉS de 20261003000000_fotoffice_roles_personalizados. Sólo toca tablas de esa migración
-- (todavía sin datos) y crea dos nuevas. Se aplica a mano en la base de FOTOFFICE y después:
--   npx prisma migrate resolve --applied 20261004000000_fotoffice_cargos_y_comision
```

Al final:

```sql
-- Al menos una persona: usuario o ficha de socio. Prisma no modela CHECK; vive sólo acá.
ALTER TABLE "WorkspaceRoleAssignment"
  ADD CONSTRAINT "WorkspaceRoleAssignment_person_check" CHECK ("userId" IS NOT NULL OR "memberId" IS NOT NULL);
ALTER TABLE "WorkspaceOfficeTerm"
  ADD CONSTRAINT "WorkspaceOfficeTerm_person_check" CHECK ("userId" IS NOT NULL OR "memberId" IS NOT NULL);
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261004000000_fotoffice_cargos_y_comision
git commit -m "Tablas de cargos y mandatos de la Comisión directiva

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: La regla de niveles para quien ya tuvo roles, y asignaciones por ficha de socio

**Files:**
- Modify: `apps/fotoffice/lib/permissions/levels.ts` (`resolveModuleLevel`), `apps/fotoffice/lib/permissions/levels.test.ts`
- Modify: `apps/fotoffice/lib/permissions/module-access.ts` (`loadAssignments`), `apps/fotoffice/lib/permissions/module-access.test.ts`

**Interfaces:**
- Consumes: modelos de Task 1.
- Produces: misma API pública de la etapa 1 (`resolveModuleLevel`, `getModuleLevels`, `getModuleLevel`, `hasModuleLevel`). Cambia sólo el comportamiento descrito abajo.

- [ ] **Step 1: Ajustar las pruebas de `levels.test.ts`**

Reemplazar el caso `"si todas las asignaciones vencieron, vuelve a la compatibilidad"` por:

```ts
  it("quien tuvo roles y ya no tiene ninguno vigente no vuelve a la compatibilidad (§12.3)", () => {
    const vencida = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { endsAt: ayer });
    const revocada = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { revokedAt: ayer });
    expect(nivel({ assignments: [vencida] })).toBe("NONE");
    expect(nivel({ assignments: [revocada] })).toBe("NONE");
  });

  it("una asignación que todavía no empezó cuenta como 'tuvo roles': nada hasta que empiece", () => {
    const futura = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { startsAt: manana });
    expect(nivel({ assignments: [futura] })).toBe("NONE");
  });

  it("una asignación con inicio pasado y sin fin vale", () => {
    const vigente = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "VIEW" }], { startsAt: ayer });
    expect(nivel({ assignments: [vigente] })).toBe("VIEW");
  });

  it("si una de varias está revocada, valen las demás", () => {
    const revocada = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { revokedAt: ayer });
    const vigente = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "VIEW" }]);
    expect(nivel({ assignments: [revocada, vigente] })).toBe("VIEW");
  });
```

Run: `pnpm --filter fotoffice exec vitest run lib/permissions/levels.test.ts` → FAIL en los dos primeros.

- [ ] **Step 2: Cambiar `resolveModuleLevel`**

Reemplazar el bloque posterior a la línea de dueño/admin por:

```ts
  // Quien tuvo roles alguna vez (vigentes, vencidos, revocados o futuros) ya no usa la
  // compatibilidad de STAFF: si no, un ex tesorero volvería a ver el padrón (diseño §12.3).
  if (input.assignments.length > 0) {
    const active = input.assignments.filter((a) => isAssignmentActive(a, input.now));
    return maxLevel(
      active.flatMap((a) =>
        a.permissions.filter((p) => p.moduleKey === input.moduleKey).map((p) => p.level),
      ),
    );
  }
  return legacyStaffLevel(input.moduleKey);
```

Actualizar el comentario de la función: el paso 4 pasa a ser *"con asignaciones (cualquiera) → el máximo entre las vigentes, o NONE"*. Cambiar también el comentario de `LEGACY_STAFF_LEVELS` de *"mientras alguien no tenga roles asignados"* a *"mientras alguien nunca haya tenido roles asignados"*.

Run → PASS.

- [ ] **Step 3: `loadAssignments` trae también revocadas y las de su ficha de socio**

En `module-access.test.ts`, reemplazar el `where` esperado del test `"consulta sólo asignaciones de ESTA persona…"` por:

```ts
        where: {
          workspaceId: "ws-1",
          role: { workspaceId: "ws-1" },
          OR: [{ userId: 7 }, { member: { userId: 7, workspaceId: "ws-1" } }],
        },
```

y agregar:

```ts
  it("una asignación revocada llega a la regla (para no volver a la compatibilidad)", async () => {
    H.findMany.mockResolvedValue([
      { startsAt: null, endsAt: null, revokedAt: new Date("2026-01-01"), role: { permissions: [] } },
    ]);
    expect((await getModuleLevels(7, "ws-1")).members).toBe("NONE");
  });
```

En `module-access.ts`, el `where` de `loadAssignments` pasa a:

```ts
      // Sin filtrar revocadas: la regla necesita saber si la persona tuvo roles (§12.3).
      // Por usuario directo o por su ficha de socio en ESTE workspace: un socio que recibió el
      // rol antes de tener cuenta lo hereda al vincularla (§12.1.4).
      where: {
        workspaceId,
        role: { workspaceId },
        OR: [{ userId }, { member: { userId, workspaceId } }],
      },
```

Run: `pnpm --filter fotoffice exec vitest run lib/permissions` → PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/lib/permissions
git commit -m "Quien tuvo roles no vuelve al acceso de personal; los roles siguen a la ficha del socio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Plantillas y siembra

**Files:**
- Create: `apps/fotoffice/lib/commission/templates.ts`, `apps/fotoffice/lib/commission/templates.test.ts`
- Create: `apps/fotoffice/lib/commission/seed.ts`, `apps/fotoffice/lib/commission/seed.test.ts`

**Interfaces:**
- Produces:
  - `CASH_PROJECT_MONEY_ACTION = "cash.project_money"`
  - `type RoleTemplate = { key: string; name: string; description: string; permissions: readonly { moduleKey: string; level: "VIEW" | "MANAGE"; actions?: readonly string[] }[] }`
  - `type OfficeTemplate = { key: string; name: string; votes: boolean; order: number }`
  - `ROLE_TEMPLATES: readonly RoleTemplate[]`, `OFFICE_TEMPLATES: readonly OfficeTemplate[]`
  - `ensureCommissionSetup(workspaceId: string): Promise<{ seeded: boolean }>`

- [ ] **Step 1: Pruebas de las plantillas**

```ts
import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY } from "@/lib/modules/registry";
import { CASH_PROJECT_MONEY_ACTION, OFFICE_TEMPLATES, ROLE_TEMPLATES } from "./templates";

const keys = new Set(MODULE_REGISTRY.map((m) => m.key));
const rol = (key: string) => ROLE_TEMPLATES.find((r) => r.key === key)!;
const nivel = (key: string, mod: string) => rol(key).permissions.find((p) => p.moduleKey === mod)?.level;

describe("plantillas de roles", () => {
  it("sólo nombran módulos del catálogo (aunque estén planificados)", () => {
    for (const r of ROLE_TEMPLATES) for (const p of r.permissions) expect(keys.has(p.moduleKey)).toBe(true);
  });
  it("claves y nombres únicos", () => {
    expect(new Set(ROLE_TEMPLATES.map((r) => r.key)).size).toBe(ROLE_TEMPLATES.length);
    expect(new Set(ROLE_TEMPLATES.map((r) => r.name)).size).toBe(ROLE_TEMPLATES.length);
  });
  it("Tesorería gestiona Caja con la plata de proyectos", () => {
    const caja = rol("treasury").permissions.find((p) => p.moduleKey === "cash");
    expect(caja).toMatchObject({ level: "MANAGE" });
    expect(caja?.actions).toContain(CASH_PROJECT_MONEY_ACTION);
  });
  it("Presidencia y Secretaría gestionan Gobierno; el Revisor lo ve", () => {
    expect(nivel("president", "governance")).toBe("MANAGE");
    expect(nivel("secretary", "governance")).toBe("MANAGE");
    expect(nivel("auditor", "governance")).toBe("VIEW");
  });
  it("Comunicación nunca ve plata", () => {
    expect(nivel("communication", "cash")).toBeUndefined();
    expect(nivel("communication", "membership-dues")).toBeUndefined();
  });
  it("el Revisor de cuentas sólo lee", () => {
    for (const p of rol("auditor").permissions) expect(p.level).toBe("VIEW");
  });
});

describe("plantillas de cargos", () => {
  it("el Revisor de cuentas no vota; el resto sí", () => {
    for (const o of OFFICE_TEMPLATES) expect(o.votes).toBe(o.key !== "auditor");
  });
  it("orden estrictamente creciente", () => {
    const orden = OFFICE_TEMPLATES.map((o) => o.order);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(new Set(orden).size).toBe(orden.length);
  });
});
```

Run: `pnpm --filter fotoffice exec vitest run lib/commission/templates.test.ts` → FAIL (no existe).

- [ ] **Step 2: `templates.ts`**

```ts
/**
 * Plantillas de la Comisión directiva (diseño de Roles §5 y §12.4).
 *
 * Se copian a cada institución la primera vez que abre la Comisión directiva; desde ahí son
 * suyas: las renombra, cambia la grilla o las archiva. Nombrar módulos todavía planificados es a
 * propósito: cuando se encienda Gobierno, la Secretaría ya lo tiene, sin tocar nada.
 */

/** Acción sensible de Caja: reservar, gastar e ingresar plata de proyectos (§12.1.2). */
export const CASH_PROJECT_MONEY_ACTION = "cash.project_money";

export type RoleTemplate = {
  key: string;
  name: string;
  description: string;
  permissions: readonly { moduleKey: string; level: "VIEW" | "MANAGE"; actions?: readonly string[] }[];
};

export type OfficeTemplate = { key: string; name: string; votes: boolean; order: number };

const V = "VIEW" as const;
const M = "MANAGE" as const;

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: "president",
    name: "Presidencia",
    description: "Ve todo y conduce proyectos y reuniones. No carga plata.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "cash", level: V },
      { moduleKey: "bookings", level: V },
      { moduleKey: "raffles", level: V },
      { moduleKey: "courses-sales", level: V },
      { moduleKey: "website", level: V },
      { moduleKey: "communications", level: V },
      { moduleKey: "events", level: V },
      { moduleKey: "exhibitions", level: V },
      { moduleKey: "transparency", level: V },
      { moduleKey: "governance", level: M },
    ],
  },
  {
    key: "secretary",
    name: "Secretaría",
    description: "Padrón, altas, carnets, actas y reuniones.",
    permissions: [
      { moduleKey: "members", level: M },
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "governance", level: M },
    ],
  },
  {
    key: "treasury",
    name: "Tesorería",
    description: "Cuotas, Caja y la plata de los proyectos.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "membership-dues", level: M },
      { moduleKey: "cash", level: M, actions: [CASH_PROJECT_MONEY_ACTION] },
      { moduleKey: "governance", level: V },
    ],
  },
  {
    key: "auditor",
    name: "Revisor de cuentas",
    description: "Órgano fiscalizador: sólo lectura de la plata y de los proyectos.",
    permissions: [
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "cash", level: V },
      { moduleKey: "transparency", level: V },
      { moduleKey: "governance", level: V },
    ],
  },
  {
    key: "communication",
    name: "Comunicación",
    description: "Sitio, blog y correos. Ve la ficha y las redes de los socios; nunca la plata.",
    permissions: [
      { moduleKey: "website", level: M },
      { moduleKey: "communications", level: M },
      { moduleKey: "members", level: V },
      { moduleKey: "raffles", level: V },
      { moduleKey: "portfolio", level: V },
    ],
  },
  {
    key: "education",
    name: "Formación",
    description: "Cursos y evaluaciones.",
    permissions: [
      { moduleKey: "courses-sales", level: M },
      { moduleKey: "evaluaciones", level: M },
    ],
  },
  {
    key: "culture",
    name: "Cultura y eventos",
    description: "Eventos, muestras y sorteos.",
    permissions: [
      { moduleKey: "events", level: M },
      { moduleKey: "exhibitions", level: M },
      { moduleKey: "raffles", level: M },
      { moduleKey: "members", level: V },
    ],
  },
  {
    key: "spaces",
    name: "Espacios",
    description: "Reservas: agenda, espacios y tarifas.",
    permissions: [{ moduleKey: "bookings", level: M }],
  },
  {
    key: "partnerships",
    name: "Alianzas y beneficios",
    description: "Recomendados, partners y premios.",
    permissions: [{ moduleKey: "raffles", level: V }],
  },
  {
    key: "member-support",
    name: "Atención al socio",
    description: "Para personal administrativo: consulta socios, cuotas y reservas.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "bookings", level: V },
    ],
  },
  {
    key: "board-member",
    name: "Vocal",
    description: "Lectura general y proyectos.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "governance", level: V },
    ],
  },
];

export const OFFICE_TEMPLATES: readonly OfficeTemplate[] = [
  { key: "president", name: "Presidente", votes: true, order: 10 },
  { key: "vice-president", name: "Vicepresidente", votes: true, order: 20 },
  { key: "secretary", name: "Secretario", votes: true, order: 30 },
  { key: "pro-secretary", name: "Prosecretario", votes: true, order: 40 },
  { key: "treasurer", name: "Tesorero", votes: true, order: 50 },
  { key: "pro-treasurer", name: "Protesorero", votes: true, order: 60 },
  { key: "board-member", name: "Vocal titular", votes: true, order: 70 },
  { key: "alternate-board-member", name: "Vocal suplente", votes: true, order: 80 },
  { key: "auditor", name: "Revisor de cuentas", votes: false, order: 90 },
];
```

Run → PASS.

- [ ] **Step 3: Pruebas de la siembra**

`seed.test.ts` (mismo patrón de mock de `@repo/db` que `lib/permissions/module-access.test.ts`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  roleCount: vi.fn(),
  officeCount: vi.fn(),
  roleCreate: vi.fn(),
  officeCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  const tx = {
    workspaceCustomRole: { count: H.roleCount, create: H.roleCreate },
    workspaceOffice: { count: H.officeCount, createMany: H.officeCreateMany },
  };
  return {
    ...real,
    prisma: { ...tx, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => H.transaction(fn, tx) },
  };
});

const { ensureCommissionSetup } = await import("./seed");
const { OFFICE_TEMPLATES, ROLE_TEMPLATES } = await import("./templates");

beforeEach(() => {
  H.roleCount.mockReset().mockResolvedValue(0);
  H.officeCount.mockReset().mockResolvedValue(0);
  H.roleCreate.mockReset().mockResolvedValue({});
  H.officeCreateMany.mockReset().mockResolvedValue({ count: 0 });
  H.transaction.mockReset().mockImplementation((fn, tx) => fn(tx));
});

describe("ensureCommissionSetup", () => {
  it("un workspace sin nada recibe todas las plantillas, con sus permisos", async () => {
    expect(await ensureCommissionSetup("ws-1")).toEqual({ seeded: true });
    expect(H.roleCreate).toHaveBeenCalledTimes(ROLE_TEMPLATES.length);
    expect(H.roleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        name: "Tesorería",
        templateKey: "treasury",
        permissions: { create: expect.arrayContaining([expect.objectContaining({ moduleKey: "cash", level: "MANAGE", actions: ["cash.project_money"] })]) },
      }),
    });
    expect(H.officeCreateMany).toHaveBeenCalledWith({
      data: OFFICE_TEMPLATES.map((o) => ({ workspaceId: "ws-1", name: o.name, votes: o.votes, order: o.order, templateKey: o.key })),
      skipDuplicates: true,
    });
  });

  it("si ya tiene roles o cargos (aunque los haya borrado todos menos uno), no siembra nada", async () => {
    H.roleCount.mockResolvedValue(1);
    expect(await ensureCommissionSetup("ws-1")).toEqual({ seeded: false });
    expect(H.roleCreate).not.toHaveBeenCalled();
    expect(H.officeCreateMany).not.toHaveBeenCalled();
  });
});
```

Run → FAIL.

- [ ] **Step 4: `seed.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { OFFICE_TEMPLATES, ROLE_TEMPLATES } from "./templates";

/**
 * Siembra las plantillas la primera vez que la institución abre la Comisión directiva.
 *
 * Sólo si no tiene NINGÚN rol ni cargo (archivados incluidos): si ya armó los suyos, o borró
 * plantillas a propósito, volver a sembrar le devolvería lo que sacó. Corre en una transacción
 * para que dos pestañas abiertas a la vez no siembren dos veces; si igual chocan, la clave única
 * (workspace, nombre) hace fallar a la segunda y la pantalla se recarga con lo de la primera.
 */
export async function ensureCommissionSetup(workspaceId: string): Promise<{ seeded: boolean }> {
  return prisma.$transaction(async (tx) => {
    const [roles, offices] = await Promise.all([
      tx.workspaceCustomRole.count({ where: { workspaceId } }),
      tx.workspaceOffice.count({ where: { workspaceId } }),
    ]);
    if (roles > 0 || offices > 0) return { seeded: false };

    for (const t of ROLE_TEMPLATES) {
      await tx.workspaceCustomRole.create({
        data: {
          workspaceId,
          name: t.name,
          description: t.description,
          templateKey: t.key,
          permissions: {
            create: t.permissions.map((p) => ({ moduleKey: p.moduleKey, level: p.level, actions: [...(p.actions ?? [])] })),
          },
        },
      });
    }
    await tx.workspaceOffice.createMany({
      data: OFFICE_TEMPLATES.map((o) => ({ workspaceId, name: o.name, votes: o.votes, order: o.order, templateKey: o.key })),
      skipDuplicates: true,
    });
    return { seeded: true };
  });
}
```

Run: `pnpm --filter fotoffice exec vitest run lib/commission` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/commission
git commit -m "Plantillas de roles y cargos de la Comisión directiva

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mandatos vigentes y quién vota

**Files:**
- Create: `apps/fotoffice/lib/commission/terms.ts`, `apps/fotoffice/lib/commission/terms.test.ts`

**Interfaces:**
- Consumes: `isAssignmentActive` de `@/lib/permissions/levels` (misma regla de vigencia).
- Produces:
  - `type OfficeHolder = { termId: string; officeId: string; officeName: string; votes: boolean; memberId: string | null; userId: number | null; displayName: string; email: string | null; startsAt: Date | null; endsAt: Date | null }`
  - `listActiveOfficeHolders(workspaceId: string, now?: Date): Promise<OfficeHolder[]>` — ordenado por `office.order`, después por nombre.
  - `canVote(userId: number, workspaceId: string, now?: Date): Promise<boolean>`

- [ ] **Step 1: Pruebas**

Mockear `@repo/db` (`prisma.workspaceOfficeTerm.findMany`) igual que en `module-access.test.ts`. Filas de ejemplo con forma `{ id, officeId, memberId, userId, startsAt, endsAt, revokedAt, office: { name, votes, order, archivedAt }, member: { firstName, lastName, email, userId } | null, user: { name, email } | null }`. Casos:

```ts
it("sólo mandatos vigentes, de cargos no archivados", …)          // vencido, futuro, revocado y de cargo archivado quedan afuera
it("el nombre sale de la ficha del socio; si no hay ficha, del usuario", …)
it("ordena por el orden del cargo y después por nombre", …)
it("consulta sólo este workspace", …)                              // where: { workspaceId: "ws-1", revokedAt: null }
it("canVote: mandato vigente en cargo que vota → true", …)
it("canVote: Revisor de cuentas (votes=false) → false", …)
it("canVote: socio vinculado (member.userId) cuenta como el usuario", …)
it("canVote: un socio inactivo con cargo vigente sigue votando", …)  // member con status INACTIVE: no se filtra por estado (§12.1.3)
```

Escribir cada caso completo (filas mock + `expect`) siguiendo esos títulos.

Run → FAIL.

- [ ] **Step 2: Implementar**

```ts
import "server-only";
import { prisma } from "@repo/db";
import { isAssignmentActive } from "@/lib/permissions/levels";

/**
 * Quiénes integran hoy la Comisión directiva y quiénes votan (diseño de Roles §12.6).
 *
 * Gobierno lo usa para la votación, los asistentes de las reuniones y los avisos. El estado del
 * socio NO se mira a propósito: un integrante inactivo sigue en su cargo y sigue votando hasta
 * que la comisión decida otra cosa (§12.1.3); el admin ya recibió el aviso.
 */

export type OfficeHolder = {
  termId: string;
  officeId: string;
  officeName: string;
  votes: boolean;
  memberId: string | null;
  userId: number | null;
  displayName: string;
  email: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export async function listActiveOfficeHolders(workspaceId: string, now: Date = new Date()): Promise<OfficeHolder[]> {
  const rows = await prisma.workspaceOfficeTerm.findMany({
    where: { workspaceId, revokedAt: null, office: { archivedAt: null } },
    select: {
      id: true,
      officeId: true,
      memberId: true,
      userId: true,
      startsAt: true,
      endsAt: true,
      revokedAt: true,
      office: { select: { name: true, votes: true, order: true } },
      member: { select: { firstName: true, lastName: true, email: true, userId: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return rows
    .filter((r) => isAssignmentActive(r, now))
    .map((r) => ({
      termId: r.id,
      officeId: r.officeId,
      officeName: r.office.name,
      votes: r.office.votes,
      memberId: r.memberId,
      userId: r.userId ?? r.member?.userId ?? null,
      displayName: r.member
        ? `${r.member.firstName} ${r.member.lastName}`.trim()
        : (r.user?.name?.trim() || r.user?.email || "Sin nombre"),
      email: r.member?.email ?? r.user?.email ?? null,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      order: r.office.order,
    }))
    .sort((a, b) => a.order - b.order || a.displayName.localeCompare(b.displayName, "es"))
    .map(({ order: _order, ...holder }) => holder);
}

export async function canVote(userId: number, workspaceId: string, now: Date = new Date()): Promise<boolean> {
  const holders = await listActiveOfficeHolders(workspaceId, now);
  return holders.some((h) => h.votes && h.userId === userId);
}
```

Run: `pnpm --filter fotoffice exec vitest run lib/commission/terms.test.ts` → PASS.

- [ ] **Step 3: Commit** — mensaje: `Quiénes integran hoy la Comisión directiva y quiénes votan`.

---

### Task 5: La membresía de equipo que acompaña a los roles

**Files:**
- Create: `apps/fotoffice/lib/commission/team-membership.ts`, `apps/fotoffice/lib/commission/team-membership.test.ts`
- Modify: `apps/fotoffice/lib/post-login.ts` (llamada a la sincronización)

**Interfaces:**
- Produces:
  - `ensureStaffMembership(workspaceId: string, userId: number): Promise<"created" | "kept">` — crea `WorkspaceMembership` con `STAFF` si no existe; si existe (cualquier rol) no la toca.
  - `releaseStaffMembershipIfNoRoles(workspaceId: string, userId: number): Promise<"removed" | "kept">` — si la membresía es `STAFF` y la persona ya no tiene asignaciones vigentes (por usuario o por ficha), la borra. Dueño/admin: siempre `"kept"`.
  - `syncPendingTeamMemberships(userId: number): Promise<number>` — para cada asignación vigente cuya ficha de socio está vinculada a `userId` (o con `userId` directo), asegura la membresía STAFF en ese workspace. Devuelve cuántas creó.

- [ ] **Step 1: Pruebas** (mock de `@repo/db`: `workspaceMembership.findUnique/create/delete`, `workspaceRoleAssignment.findMany`)

```ts
it("crea STAFF cuando no hay membresía", …)
it("no toca una membresía existente de dueño, admin o STAFF", …)              // create no se llama
it("libera: borra STAFF si no quedan asignaciones vigentes", …)
it("libera: nunca borra dueño ni admin", …)
it("libera: conserva STAFF si queda alguna asignación vigente (por usuario o por ficha)", …)
it("sincroniza: crea membresías sólo en los workspaces con asignación vigente de su ficha", …)
it("sincroniza: una asignación vencida o revocada no crea nada", …)
```

Escribir cada caso completo con sus mocks y `expect`.

- [ ] **Step 2: Implementar** siguiendo las firmas. Puntos obligatorios:
  - `ensureStaffMembership` usa `upsert` con `update: {}` sobre `userId_workspaceId` (no pisa el rol de nadie).
  - `releaseStaffMembershipIfNoRoles` busca asignaciones con `revokedAt: null` y `OR: [{ userId }, { member: { userId, workspaceId } }]`, filtra con `isAssignmentActive` y sólo borra si `role === "STAFF"` y no queda ninguna.
  - `syncPendingTeamMemberships` busca asignaciones con `revokedAt: null` y `OR: [{ userId }, { member: { userId } }]`, filtra vigentes, agrupa por `workspaceId` y llama a `ensureStaffMembership` por cada uno.
  - Comentario de cabecera: por qué existe (sin `WorkspaceMembership` el panel no reconoce a la persona como equipo y `resolveModuleLevel` da NONE), y que a dueño/admin nunca se los toca.

- [ ] **Step 3: Llamarla al iniciar sesión**

En `lib/post-login.ts`, dentro de `resolveFotofficePostLoginDestination`, después de resolver el usuario y **antes** de `listUserProfiles`, agregar:

```ts
  // Un socio que recibió cargo o rol antes de tener cuenta entra al panel desde su primer
  // inicio de sesión con la cuenta vinculada (diseño de Roles §12.1.4).
  await syncPendingTeamMemberships(user.id);
```

(con el nombre real de la variable de usuario en ese punto). Ajustar `lib/post-login.test.ts` agregando el mock `vi.mock("@/lib/commission/team-membership", () => ({ syncPendingTeamMemberships: vi.fn().mockResolvedValue(0) }))` si el test importa `post-login.ts` real.

Run: `pnpm --filter fotoffice exec vitest run lib/commission lib/post-login.test.ts` → PASS.

- [ ] **Step 4: Commit** — mensaje: `La membresía de equipo acompaña a los roles y se activa al vincular la cuenta`.

---

### Task 6: Validación y correos (puros)

**Files:**
- Create: `apps/fotoffice/lib/commission/validation.ts` + test
- Create: `apps/fotoffice/lib/commission/emails.ts` + test

**Interfaces:**
- Produces (validation):
  - `parseRoleForm(fd: FormData): { ok: true; name: string; description: string | null } | { ok: false; error: string }` — nombre 2–60 caracteres sin espacios sobrantes; descripción ≤ 200.
  - `parsePermissionGrid(fd: FormData, editableModuleKeys: readonly string[]): { moduleKey: string; level: "NONE" | "VIEW" | "MANAGE"; actions: string[] }[]` — lee `level:<moduleKey>` y `action:<moduleKey>:<action>`; ignora claves fuera de `editableModuleKeys`; valor desconocido = `NONE`; acciones sólo si el nivel es `MANAGE`.
  - `parseOfficeForm(fd: FormData)` — nombre 2–60, `votes` = casilla.
  - `parseTermDates(fd: FormData): { ok: true; startsAt: Date | null; endsAt: Date | null } | { ok: false; error: string }` — campos `YYYY-MM-DD`; `startsAt` = 00:00 hora argentina (UTC−3) de ese día; `endsAt` = 23:59:59.999 hora argentina de ese día; error si fin < inicio.
- Produces (emails):
  - `buildAddedToCommissionEmail(input: { institution: string; personName: string; officeName: string | null; roleNames: string[]; hasAccount: boolean; panelUrl: string; endsAt: Date | null }): { subject: string; html: string; text: string }`
  - `buildMemberInactiveWithRoleEmail(input: { institution: string; personName: string; newStatus: "SUSPENDED" | "INACTIVE"; officeNames: string[]; roleNames: string[]; commissionUrl: string }): { subject: string; html: string; text: string }`

- [ ] **Step 1: Pruebas** — para validation, un caso por regla de cada firma (incluido: `endsAt` de `2026-12-31` es `2027-01-01T02:59:59.999Z`; fin antes del inicio da error; acción en un módulo con `VIEW` se descarta; clave de módulo no editable se ignora). Para emails, igual que `lib/members/invitation-email.test.ts`: el asunto nombra la institución; sin cuenta, el texto explica que va a entrar al panel cuando active su cuenta; con `endsAt`, la fecha aparece en formato argentino (`31/12/2026`); el HTML escapa `<script>` en nombres; no aparecen las palabras "workspace", "token" ni "membership".

- [ ] **Step 2: Implementar.** `emails.ts` reutiliza el estilo y `escapeHtml` de `lib/members/invitation-email.ts`: si esa función no está exportada, copiar la paleta `C` y `escapeHtml` a un archivo compartido nuevo `lib/communications/html.ts`, exportarlos e importarlos desde los dos (sin duplicar). Formatear fechas con `Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" })`.

Run: `pnpm --filter fotoffice exec vitest run lib/commission lib/members/invitation-email.test.ts` → PASS.

- [ ] **Step 3: Commit** — mensaje: `Validación y correos de la Comisión directiva`.

---

### Task 7: Acciones del servidor

**Files:**
- Create: `apps/fotoffice/app/workspace/configuracion/comision/actions.ts` (`"use server"`), `apps/fotoffice/app/workspace/configuracion/comision/actions.test.ts`
- Create: `apps/fotoffice/lib/commission/access.ts` (`requireCommissionAdmin()`)

**Interfaces:**
- Consumes: Tasks 3–6; `requireAuth`, `requireOwnWorkspace`, `canManageWorkspaceSettings`, `getEnabledModuleKeysForWorkspace`, `listModules`, `sendAndLogEmail`.
- Produces: `requireCommissionAdmin(): Promise<{ user: AuthUser; workspaceId: string }>` (redirige a `/workspace/configuracion` si no es dueño/admin) y estas acciones, todas `(prev, formData) => Promise<{ error: string | null; ok?: boolean }>`:

| Acción | Qué hace |
|---|---|
| `createRoleAction` | Crea rol (nombre único entre no archivados) con la grilla enviada |
| `updateRoleAction` | Cambia nombre/descr. y reemplaza la grilla **sólo de los módulos editables** (habilitados y AVAILABLE); los permisos de módulos no editables (p. ej. planificados) se conservan |
| `duplicateRoleAction` | Copia rol y permisos con nombre "<nombre> (copia)", "(copia 2)"… |
| `archiveRoleAction` | Exige `confirm=yes` si hay asignaciones vigentes; pone `archivedAt`, revoca sus asignaciones, renombra a "<nombre> (archivado dd/mm/aaaa)" para liberar el nombre y llama a `releaseStaffMembershipIfNoRoles` por cada persona afectada |
| `createOfficeAction` / `updateOfficeAction` / `archiveOfficeAction` / `moveOfficeAction` | Alta, nombre + "vota", archivar (revoca mandatos vigentes, exige `confirm=yes` si hay), subir/bajar orden |
| `addCommissionMemberAction` | Persona = `memberId` (socio del workspace) o `email` (usuario existente; si no existe: error *"No encontramos una cuenta con ese correo. Pedile que se registre en FOTOFFICE y volvé a intentar."*). Crea mandato (si eligió cargo) y asignaciones (roles elegidos, no archivados, del workspace) con las mismas fechas. Si la persona tiene usuario: `ensureStaffMembership`. Manda `buildAddedToCommissionEmail` si hay correo. Todo en una transacción salvo el correo |
| `updateCommissionMemberAction` | Cambia fechas del mandato y agrega/revoca roles de una persona |
| `removeCommissionMemberAction` | Revoca mandato y asignaciones de la persona; luego `releaseStaffMembershipIfNoRoles` si tiene usuario |

Reglas en todas: primera línea `const { user, workspaceId } = await requireCommissionAdmin();`; todo `findFirst/update` filtra por `workspaceId` (un id de otro workspace da *"No encontrado."*); al terminar `revalidatePath("/workspace/configuracion/comision", "layout")`.

- [ ] **Step 1: Pruebas** (mockear `@/lib/commission/access`, `@repo/db`, `@/lib/communications/send-and-log`, `@/lib/commission/team-membership`, `next/cache`). Casos mínimos:
  - sin permiso de admin, cada acción termina en el redirect de `requireCommissionAdmin` (probar una por grupo);
  - `updateRoleAction` conserva permisos de módulos no editables y reemplaza los editables;
  - `archiveRoleAction` sin `confirm` con asignaciones vigentes → error que nombra cuántas personas; con `confirm` → archiva, revoca y libera membresías;
  - `addCommissionMemberAction` con socio sin cuenta: crea mandato y asignaciones con `memberId`, **no** llama a `ensureStaffMembership`, manda el correo al email de la ficha;
  - `addCommissionMemberAction` con un `memberId` de otro workspace → `"No encontrado."` y nada creado;
  - `addCommissionMemberAction` con email inexistente → el mensaje exacto de la tabla;
  - `removeCommissionMemberAction` revoca y llama a `releaseStaffMembershipIfNoRoles`;
  - si el correo falla (`status !== "SENT"`), la acción igual devuelve `ok: true`.

- [ ] **Step 2: Implementar.** Las acciones sólo orquestan; la validación vive en `lib/commission/validation.ts`.

Run: `pnpm --filter fotoffice exec vitest run app/workspace/configuracion/comision lib/commission` → PASS.

- [ ] **Step 3: Commit** — mensaje: `Acciones de la Comisión directiva: roles, cargos e integrantes`.

---

### Task 8: Pantallas

**Files (nuevas, bajo `apps/fotoffice/app/workspace/configuracion/comision/`):**
- `layout.tsx` — `requireCommissionAdmin()`, `ensureCommissionSetup(workspaceId)`, encabezado "Comisión directiva" y pestañas **Integrantes · Cargos · Roles**.
- `page.tsx` (Integrantes) — `listActiveOfficeHolders` + personas con roles sin cargo; por persona: nombre, cargo, roles, mandato ("hasta 31/12/2027" / "sin vencimiento"), "Sin cuenta todavía" si no tiene usuario, "Inactivo" si la ficha no está ACTIVE. Botón "Sumar integrante" (formulario: buscar socio por nombre o número **o** correo de usuario no socio; cargo opcional; roles con casillas; desde/hasta). Acciones Editar y Quitar (con confirmación). Sección plegada "Historial": mandatos y asignaciones revocados o vencidos, más recientes primero.
- `cargos/page.tsx` — lista ordenada con nombre, casilla "Integra la comisión y vota", subir/bajar, archivar; alta.
- `roles/page.tsx` — lista de roles no archivados con descripción y cantidad de personas vigentes; Nuevo, Duplicar, Archivar (con confirmación que nombra a las personas afectadas).
- `roles/[roleId]/page.tsx` — editor: nombre, descripción y **grilla**: una fila por módulo AVAILABLE habilitado en el workspace (`getEnabledModuleKeysForWorkspace` + `listModules({ status: "AVAILABLE" })`, etiqueta del registro), radios Sin acceso / Ver / Gestionar; en la fila de Caja, casilla "Plata de proyectos" visible sólo con Gestionar. Debajo, en gris, "También tiene permisos en módulos que todavía no activaste: …" listando los planificados o apagados que el rol tiene.
- Formularios cliente (`*-form.tsx`) con `useActionState`, siguiendo `app/workspace/configuracion/palabras/palabras-form.tsx`.

**Modify:** `apps/fotoffice/components/shell/shell-nav.tsx` — en `institucion`, después de "Datos de la institución":

```tsx
        {
          href: "/workspace/configuracion/comision",
          label: "Comisión directiva",
          icon: Users,
          isActive: under("/workspace/configuracion/comision"),
        },
```

- [ ] **Step 1:** Leer en `apps/fotoffice/node_modules/next/dist/docs/` lo relativo a `params` asíncronos en páginas dinámicas, `useActionState` y `revalidatePath` antes de escribir las páginas.
- [ ] **Step 2:** Implementar las pantallas con los componentes y clases existentes (`PageHeader`, `fo-btn`, variables `--fo-*`). Sin colores nuevos. Todos los textos en vos; "socio" sale de `loadPersonVocabulary`.
- [ ] **Step 3:** Agregar a `lib/workspace-role-consistency.test.ts` un `it` que verifique que `comision/layout.tsx` llama a `requireCommissionAdmin` y que `actions.ts` lo llama en cada `export async function` (contar ocurrencias ≥ número de exports).
- [ ] **Step 4:** `pnpm --filter fotoffice test` → PASS.
- [ ] **Step 5: Commit** — mensaje: `Pantallas de la Comisión directiva: integrantes, cargos y roles`.

---

### Task 9: Aviso al admin cuando un integrante queda inactivo

**Files:**
- Modify: `apps/fotoffice/app/actions/members.ts` (`changeMemberStatusAction`)
- Create: `apps/fotoffice/lib/commission/inactive-notice.ts` + test

**Interfaces:**
- Produces: `notifyAdminsIfCommissionMemberInactive(input: { workspaceId: string; memberId: string; newStatus: "ACTIVE" | "SUSPENDED" | "INACTIVE"; now?: Date }): Promise<{ sent: number }>` — si `newStatus` no es ACTIVE y la ficha tiene mandato o asignación vigente, manda `buildMemberInactiveWithRoleEmail` a cada `WORKSPACE_OWNER`/`WORKSPACE_ADMIN` con correo. No revoca nada (§12.1.3).

- [ ] **Step 1: Pruebas:** ACTIVE no manda; sin cargo ni rol vigente no manda; con mandato vigente manda a dueño y admins (no a STAFF); con asignación vencida no manda; el correo nombra cargo y roles.
- [ ] **Step 2: Implementar** y llamarla en `changeMemberStatusAction` después del `updateMember` exitoso, sin `await` bloqueante para la respuesta: `void notifyAdminsIfCommissionMemberInactive({...}).catch((e) => console.error("[fotoffice][comision] aviso de inactivo", e));`.
- [ ] **Step 3:** Run focal + `pnpm --filter fotoffice test` → PASS.
- [ ] **Step 4: Commit** — mensaje: `Avisar al admin cuando un integrante de la comisión queda inactivo`.

---

### Task 10: Verificación y PR apilado

- [ ] **Step 1:** `pnpm --filter fotoffice test` → todo verde.
- [ ] **Step 2:** `NODE_OPTIONS=--max-old-space-size=8192 DATABASE_URL="postgresql://x:x@localhost:5432/x" AUTH_SECRET="x" pnpm --filter fotoffice build` → exit 0 con "Finished TypeScript".
- [ ] **Step 3:** `cd apps/fotoffice && npx eslint <archivos tocados>` → 0 errores.
- [ ] **Step 4:** Push y PR con base `docs/fotoffice-roles-comision-directiva`. Cuerpo: qué ve el admin; decisiones del 03/10; el SQL a aplicar **después** del de la etapa 1, con su `migrate resolve`; prueba sugerida después de desplegar (abrir Comisión directiva en SFPR, ver plantillas, sumar un integrante de prueba y quitarlo); pendientes para la etapa 2b (Caja a niveles con `cash.project_money`) y la 3 (selector Portal ⇄ Administración).

---

## Fuera de esta etapa

- Caja y Clientes a niveles y la comprobación de `cash.project_money` (etapa 2b, antes de la etapa 3 de Gobierno).
- Selector "Portal ⇄ Administración" y menú filtrado por rol (etapa 3). Hasta entonces, un socio con roles elige perfil al iniciar sesión (`/elegir-perfil`).
- Nombre "Comisión directiva" configurable desde Palabras.
- Invitar por correo a un no socio sin cuenta.
- Cargos públicos en Transparencia.
