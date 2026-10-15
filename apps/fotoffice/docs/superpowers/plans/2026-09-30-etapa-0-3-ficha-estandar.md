# Etapa 0.3 · Ficha estándar — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una ficha común para Cliente y Socio con línea de tiempo única (armada al leer), notas con categoría, etiquetas, adjuntos privados y personas relacionadas.

**Architecture:** Las piezas nuevas se guardan sobre "la persona" (el cliente si existe; si no, el socio). La línea de tiempo es un motor puro que mezcla eventos de proveedores (historial del socio, historial nuevo del cliente, Caja, cuotas, carnets, notas, adjuntos, eventos de persona) con paginación por cursor. Los adjuntos van a un bucket R2 privado con URL firmada de subida (PUT directo) y de descarga (5 minutos).

**Tech Stack:** Next.js 16 App Router (server components, server actions, route handlers), Prisma sobre `packages/db/prisma/schema.prisma`, Vitest 3 (`lib/**/*.test.ts`, `app/**/*.test.ts`, entorno node), Tailwind v4 con tokens `--fo-*`, lucide-react, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-30-etapa-0-3-ficha-estandar-design.md`

## Global Constraints

- Rama `feat/fotoffice-ficha-estandar` creada **desde `feat/fotoffice-listado-estandar`** (PR 281, que a su vez está sobre PR 277). Worktree propio `~/Desktop/PROGRAMACIONES/dnx-fotoffice-ficha`.
- pnpm, nunca npm. Única dependencia nueva permitida: `@aws-sdk/s3-request-presigner` con rango `^3.972.0` (el mismo que ya usan compramelafoto, fotorank y subilafoto; el lockfile no cambia de versión). Ninguna otra.
- No agregar columnas a `Workspace`, `WorkspaceMembership`, `WorkspaceFeatureModule` ni a ninguna tabla que lean otras apps; **tampoco a `Client` ni a `Member`**. Sólo tablas nuevas (relaciones inversas virtuales permitidas).
- Migración a mano en `packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql`; **no se aplica a ninguna base**. Nada de `prisma migrate` contra bases remotas, ni `db push`.
- No se crean buckets, CORS ni variables en Vercel: eso lo hace Daniel (documentado en la Tarea 13).
- `workspaceId` siempre de la sesión. Toda lectura/escritura de notas, etiquetas, adjuntos, relaciones y eventos filtra por workspace. Ids ajenos → "no encontrado", sin distinguir.
- Permisos (`puede(rol, capacidad)` de `apps/fotoffice/lib/access/policy.ts`): escribir notas, poner etiquetas, subir/bajar adjuntos, vincular personas = `operar`; editar/borrar notas ajenas, restaurar adjuntos, catálogos = `configurar`; ver eventos de plata = `verDinero`.
- Notas: hasta 4.000 caracteres; máximo 3 fijadas por persona.
- Adjuntos: tipos `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; máximo 10 MB (10 485 760 bytes); clave `adjuntos/<workspaceId>/<uuid>`; enlace de descarga 300 segundos; purga a los 30 días de borrado; `PENDIENTE` de más de 24 h se limpia.
- Etiquetas: nombre 1–40 caracteres, único por workspace sin distinguir mayúsculas ni acentos (`nameKey`); paleta fija de 8 colores: `gris`, `rojo`, `naranja`, `amarillo`, `verde`, `azul`, `violeta`, `rosa`.
- Categorías de notas de DNX Estudio (workspace con slug `dnx-estudio`), en este orden: URGENTE, Coordinación, Correcciones, Hacer contrato, Contacto por Teléfono, Correo, Presupuesto, Visita, Recordatorio, Envío de Material, Revisión, Selección de Pruebas, Otro. Los demás workspaces: una sola, "General".
- Línea de tiempo: 30 eventos por página; hora `America/Argentina/Buenos_Aires`.
- Textos en español rioplatense; en Socios, vocabulario del workspace (`loadPersonVocabulary`, `aplicarVocabulario`).
- Pruebas `pnpm --filter fotoffice exec vitest run <ruta>`; tipos `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit`; build `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice build`.
- Commits en español, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final; sin merge nunca.

## Decisiones tomadas al planificar (rulings)

1. **Tabla de eventos de persona.** Además de `ClientAudit` (cambios de datos del cliente, mismo formato que `MemberAudit`), se agrega `FotofficePersonEvent` para los eventos de las piezas nuevas (etiqueta puesta/quitada, relación creada/borrada, nota borrada, adjunto subido/borrado/restaurado, vínculo cliente-socio). Así no se toca el enum compartido `MemberAuditAction`. Es la "tabla del nuevo historial" que el spec §3.6 nombra como fuente.
2. **Categoría de la nota opcional.** Las notas convertidas desde "Observaciones" quedan con `categoryId = NULL` y se muestran como "Observaciones". Las categorías se crean en código la primera vez que se usan (`asegurarCategorias`), no en el SQL: el SQL sólo convierte los textos.
3. **Firmador de S3** como única dependencia nueva (ver Global Constraints).
4. **Notas viejas en formularios:** el campo `notes` desaparece de `ClientForm` y de `MemberForm`; las acciones dejan de escribirlo (la columna queda intacta en la base).

## Mapa de archivos

**Base**
- `packages/db/prisma/schema.prisma` (8 modelos nuevos + relaciones inversas).
- `packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql`.
- `packages/db/docs/MIGRACION-FICHA-ESTANDAR.md`.

**Motor y dominio (`apps/fotoffice/lib/ficha/`)**
- `persona.ts` — referencia de persona, dueño de las piezas, resolución en el workspace.
- `eventos.ts` — escribir `FotofficePersonEvent`; `diffCampos` para `ClientAudit`.
- `mudanza.ts` — mover piezas del socio al cliente al vincularlos.
- `notas.ts`, `categorias.ts` — notas y catálogo.
- `etiquetas.ts` — catálogo, asignación, `nameKey`.
- `adjuntos.ts`, `adjuntos-r2.ts`, `adjuntos-reglas.ts` — reglas puras, cliente R2 privado, flujo.
- `relaciones.ts`, `vinculos.ts` — relaciones y catálogo de vínculos con su inverso.
- `linea-de-tiempo.ts` — tipo `EventoFicha`, mezcla y paginación.
- `proveedores/*.ts` — un archivo por fuente.
- Pruebas `*.test.ts` al lado de cada uno.

**Acciones y rutas**
- `apps/fotoffice/app/actions/ficha.ts` — notas, etiquetas, relaciones, adjuntos, "ver más".
- `apps/fotoffice/app/api/cron/adjuntos/route.ts` + `apps/fotoffice/vercel.json`.
- `apps/fotoffice/app/workspace/configuracion/ficha/page.tsx` + `actions.ts` — catálogos.

**Componentes (`apps/fotoffice/components/ficha/`)**
- `encabezado-ficha.tsx`, `datos-ficha.tsx`, `linea-de-tiempo.tsx`, `caja-de-nota.tsx`, `nota.tsx`, `etiquetas.tsx`, `adjuntos.tsx`, `personas-relacionadas.tsx`, `ficha.tsx` (armazón de dos columnas).

**Fichas**
- `apps/fotoffice/app/(shell)/clientes/[clientId]/page.tsx`, `clientes/actions.ts`, `clientes/client-form.tsx`.
- `apps/fotoffice/app/(shell)/members/[id]/page.tsx`, `components/members/member-form.tsx`, `app/actions/members.ts`.

**Listados**
- `apps/fotoffice/lib/clients/listado.tsx`, `apps/fotoffice/lib/members/listado.tsx` (filtro y lote de etiqueta).

---

### Task 1: Tablas nuevas y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql`
- Test: `apps/fotoffice/lib/ficha/migracion.test.ts`

**Interfaces:**
- Produces: modelos `FotofficeNoteCategory`, `FotofficeNote`, `FotofficeTag`, `FotofficeTagAssignment`, `FotofficeAttachment`, `FotofficePersonRelation`, `FotofficePersonEvent`, `ClientAudit` (accesibles como `prisma.fotofficeNoteCategory`, etc.).

- [ ] **Step 1: Crear worktree y rama**

```bash
cd ~/Desktop/PROGRAMACIONES/dnx-suite
git fetch origin
git worktree add -b feat/fotoffice-ficha-estandar ../dnx-fotoffice-ficha origin/feat/fotoffice-listado-estandar
cd ../dnx-fotoffice-ficha && pnpm install --frozen-lockfile
```

- [ ] **Step 2: Modelos en el schema** (sección FOTOFFICE, junto a `FotofficeListView`)

```prisma
/// Catálogo de categorías de notas por workspace (etapa 0.3).
model FotofficeNoteCategory {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  order       Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  workspace Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  notes     FotofficeNote[]

  @@unique([workspaceId, name])
  @@index([workspaceId, isActive, order])
}

/// Nota sobre una persona: exactamente uno de clientId/memberId (CHECK en el SQL).
model FotofficeNote {
  id           String    @id @default(cuid())
  workspaceId  String
  clientId     String?
  memberId     String?
  /// NULL = "Observaciones" convertidas desde Client.notes / Member.notes.
  categoryId   String?
  body         String
  pinned       Boolean   @default(false)
  authorUserId Int?
  authorLabel  String
  editedAt     DateTime?
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())

  workspace Workspace              @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client?                @relation(fields: [clientId], references: [id], onDelete: Cascade)
  member    Member?                @relation(fields: [memberId], references: [id], onDelete: Cascade)
  category  FotofficeNoteCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  author    User?                  @relation("FotofficeNoteAuthor", fields: [authorUserId], references: [id], onDelete: SetNull)

  @@index([workspaceId, clientId, createdAt])
  @@index([workspaceId, memberId, createdAt])
}

model FotofficeTag {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  /// name sin mayúsculas ni acentos: la unicidad se decide por acá.
  nameKey     String
  /// gris | rojo | naranja | amarillo | verde | azul | violeta | rosa
  color       String   @default("gris")
  createdAt   DateTime @default(now())

  workspace   Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  assignments FotofficeTagAssignment[]

  @@unique([workspaceId, nameKey])
}

/// Exactamente uno de clientId/memberId (CHECK en el SQL). Única por etiqueta + persona (índices parciales).
model FotofficeTagAssignment {
  id              String   @id @default(cuid())
  workspaceId     String
  tagId           String
  clientId        String?
  memberId        String?
  createdByUserId Int?
  createdAt       DateTime @default(now())

  workspace Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tag       FotofficeTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  client    Client?      @relation(fields: [clientId], references: [id], onDelete: Cascade)
  member    Member?      @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([workspaceId, tagId])
  @@index([clientId])
  @@index([memberId])
}

model FotofficeAttachment {
  id               String    @id @default(cuid())
  workspaceId      String
  clientId         String?
  memberId         String?
  /// adjuntos/<workspaceId>/<uuid> — nunca sale al navegador.
  storageKey       String    @unique
  fileName         String
  contentType      String
  sizeBytes        Int
  /// PENDIENTE | LISTO | BORRADO
  status           String    @default("PENDIENTE")
  uploadedByUserId Int?
  uploadedByLabel  String
  deletedAt        DateTime?
  purgeAfter       DateTime?
  createdAt        DateTime  @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client?   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  member    Member?   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([workspaceId, clientId, createdAt])
  @@index([workspaceId, memberId, createdAt])
  @@index([status, purgeAfter])
}

/// Vínculo entre dos personas del mismo workspace. `kind` es la clave del catálogo desde el lado "from".
model FotofficePersonRelation {
  id              String   @id @default(cuid())
  workspaceId     String
  fromClientId    String?
  fromMemberId    String?
  toClientId      String?
  toMemberId      String?
  kind            String
  customLabel     String?
  note            String?
  createdByUserId Int?
  createdAt       DateTime @default(now())

  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  fromClient Client?   @relation("RelationFromClient", fields: [fromClientId], references: [id], onDelete: Cascade)
  fromMember Member?   @relation("RelationFromMember", fields: [fromMemberId], references: [id], onDelete: Cascade)
  toClient   Client?   @relation("RelationToClient", fields: [toClientId], references: [id], onDelete: Cascade)
  toMember   Member?   @relation("RelationToMember", fields: [toMemberId], references: [id], onDelete: Cascade)

  @@index([workspaceId, fromClientId])
  @@index([workspaceId, fromMemberId])
  @@index([workspaceId, toClientId])
  @@index([workspaceId, toMemberId])
}

/// Eventos de las piezas de la ficha (etiquetas, relaciones, notas borradas, adjuntos, vínculo cliente-socio).
model FotofficePersonEvent {
  id          String   @id @default(cuid())
  workspaceId String
  clientId    String?
  memberId    String?
  /// ETIQUETA_PUESTA | ETIQUETA_QUITADA | RELACION_CREADA | RELACION_BORRADA | NOTA_BORRADA |
  /// ADJUNTO_SUBIDO | ADJUNTO_BORRADO | ADJUNTO_RESTAURADO | SOCIO_VINCULADO | SOCIO_DESVINCULADO
  kind        String
  detail      Json?
  actorUserId Int?
  actorLabel  String
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client?   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  member    Member?   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([workspaceId, clientId, createdAt])
  @@index([workspaceId, memberId, createdAt])
}

/// Historial de cambios de datos del cliente. Mismo formato que MemberAudit.
model ClientAudit {
  id          String   @id @default(cuid())
  workspaceId String
  clientId    String
  /// CREATED | UPDATED
  action      String
  actorUserId Int?
  actorLabel  String
  /// { campo: { before, after } } — sólo los campos que cambiaron.
  changesJson Json?
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([workspaceId, clientId, createdAt])
}
```

Agregar las relaciones inversas (campos virtuales, sin columnas): en `Workspace` una lista por cada modelo; en `User` `fotofficeNotes FotofficeNote[] @relation("FotofficeNoteAuthor")`; en `Client`: `fotofficeNotes`, `fotofficeTags FotofficeTagAssignment[]`, `fotofficeAttachments`, `fotofficeEvents FotofficePersonEvent[]`, `audits ClientAudit[]`, `relationsFrom FotofficePersonRelation[] @relation("RelationFromClient")`, `relationsTo … @relation("RelationToClient")`; en `Member` lo mismo con `RelationFromMember`/`RelationToMember` (sin `audits`).

- [ ] **Step 3: `migration.sql`** — `CREATE TABLE` de las ocho tablas con los tipos y FKs que corresponden a los modelos (convención de nombres de Prisma, como `20261001120000_fotoffice_listado_estandar`), más:

```sql
-- Exactamente una persona por fila.
ALTER TABLE "FotofficeNote" ADD CONSTRAINT "FotofficeNote_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficeTagAssignment" ADD CONSTRAINT "FotofficeTagAssignment_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficeAttachment" ADD CONSTRAINT "FotofficeAttachment_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficePersonEvent" ADD CONSTRAINT "FotofficePersonEvent_una_persona" CHECK (("clientId" IS NULL) <> ("memberId" IS NULL));
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_from" CHECK (("fromClientId" IS NULL) <> ("fromMemberId" IS NULL));
ALTER TABLE "FotofficePersonRelation" ADD CONSTRAINT "FotofficePersonRelation_to" CHECK (("toClientId" IS NULL) <> ("toMemberId" IS NULL));

-- Una etiqueta una sola vez por persona.
CREATE UNIQUE INDEX "FotofficeTagAssignment_tag_cliente" ON "FotofficeTagAssignment"("tagId", "clientId") WHERE "clientId" IS NOT NULL;
CREATE UNIQUE INDEX "FotofficeTagAssignment_tag_socio" ON "FotofficeTagAssignment"("tagId", "memberId") WHERE "memberId" IS NOT NULL;

-- Conversión única de "Observaciones" (idempotente: sólo si la persona no tiene ya una nota sin categoría).
INSERT INTO "FotofficeNote" ("id","workspaceId","clientId","memberId","categoryId","body","pinned","authorUserId","authorLabel","createdAt")
SELECT 'obs_c_' || c."id", c."workspaceId", c."id", NULL, NULL, c."notes", true, NULL, 'Importado', c."createdAt"
FROM "Client" c
WHERE c."notes" IS NOT NULL AND btrim(c."notes") <> ''
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "FotofficeNote" ("id","workspaceId","clientId","memberId","categoryId","body","pinned","authorUserId","authorLabel","createdAt")
SELECT 'obs_m_' || m."id", m."workspaceId",
       (SELECT c."id" FROM "Client" c WHERE c."memberId" = m."id"),
       CASE WHEN EXISTS (SELECT 1 FROM "Client" c WHERE c."memberId" = m."id") THEN NULL ELSE m."id" END,
       NULL, m."notes", true, NULL, 'Importado', m."createdAt"
FROM "Member" m
WHERE m."notes" IS NOT NULL AND btrim(m."notes") <> ''
ON CONFLICT ("id") DO NOTHING;
```

(Los ids `obs_c_…` / `obs_m_…` hacen la conversión idempotente: volver a correr el SQL no duplica.)

- [ ] **Step 4: Validar y generar** — `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate` (con una `DATABASE_URL` ficticia si hace falta; nunca conectar a una base).

- [ ] **Step 5: Prueba de fuente (`migracion.test.ts`)**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "..", "packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql"),
  "utf8",
);

describe("migración de la ficha estándar", () => {
  it("no altera tablas compartidas ni borra nada", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(Workspace|WorkspaceMembership|WorkspaceFeatureModule|User|Member|Client|CashMovement)"/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "(Client|Member)"/);
  });
  it("crea las ocho tablas", () => {
    for (const t of ["FotofficeNoteCategory", "FotofficeNote", "FotofficeTag", "FotofficeTagAssignment", "FotofficeAttachment", "FotofficePersonRelation", "FotofficePersonEvent", "ClientAudit"]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    }
  });
  it("exige exactamente una persona por fila y convierte observaciones de forma idempotente", () => {
    expect(sql.match(/<> \("memberId" IS NULL\)/g)?.length).toBe(4);
    expect(sql).toMatch(/'obs_c_' \|\| c\."id"/);
    expect(sql).toMatch(/'obs_m_' \|\| m\."id"/);
    expect(sql.match(/ON CONFLICT \("id"\) DO NOTHING/g)?.length).toBe(2);
  });
});
```

- [ ] **Step 6: Correr** — `pnpm --filter fotoffice exec vitest run lib/ficha/migracion.test.ts` → PASS. tsc de fotoffice, compramelafoto, clickaton y fotorank sin errores (el cliente Prisma cambió).

- [ ] **Step 7: Commit** — `Ficha estándar: tablas de notas, etiquetas, adjuntos, relaciones e historial (SQL sin aplicar)`.

---

### Task 2: La persona y sus eventos

**Files:**
- Create: `apps/fotoffice/lib/ficha/persona.ts`, `apps/fotoffice/lib/ficha/eventos.ts`
- Test: `apps/fotoffice/lib/ficha/persona.test.ts`, `apps/fotoffice/lib/ficha/eventos.test.ts`

**Interfaces:**
- Produces:
  - `type PersonaRef = { clientId: string | null; memberId: string | null }` (al menos uno no nulo).
  - `type Dueno = { clientId: string } | { memberId: string }`.
  - `duenoDe(p: PersonaRef): Dueno` — el cliente si existe; si no, el socio.
  - `wherePersona(workspaceId: string, p: PersonaRef): Prisma.FotofficeNoteWhereInput` (y equivalentes genéricos) — `{ workspaceId, OR: [{ clientId }, { memberId }] }` con los ids no nulos, para leer lo guardado de los dos lados.
  - `resolverPersonaPorCliente(workspaceId, clientId): Promise<PersonaRef | null>` y `resolverPersonaPorSocio(workspaceId, memberId): Promise<PersonaRef | null>` — leen `Client.memberId` / `Member.client` dentro del workspace; `null` si no existe o es de otro workspace.
  - `type Actor = { userId: number | null; label: string }`.
  - `registrarEventoPersona(db, { workspaceId, dueno, kind, detail?, actor })`.
  - `diffCampos(antes: Record<string, unknown>, despues: Record<string, unknown>, campos: readonly string[]): Record<string, { before: unknown; after: unknown }>` — sólo lo que cambió; normaliza `""` y `null` como iguales; fechas por `getTime()`.

- [ ] **Step 1: Pruebas que fallan**

```ts
// persona.test.ts
import { describe, expect, it } from "vitest";
import { duenoDe, wherePersona } from "./persona";

describe("duenoDe", () => {
  it("el cliente manda cuando existe", () => expect(duenoDe({ clientId: "c1", memberId: "m1" })).toEqual({ clientId: "c1" }));
  it("un socio sin cliente es dueño de lo suyo", () => expect(duenoDe({ clientId: null, memberId: "m1" })).toEqual({ memberId: "m1" }));
  it("sin ninguno es un error de programación", () => expect(() => duenoDe({ clientId: null, memberId: null })).toThrow());
});

describe("wherePersona", () => {
  it("lee los dos lados y siempre filtra por workspace", () =>
    expect(wherePersona("w1", { clientId: "c1", memberId: "m1" })).toEqual({ workspaceId: "w1", OR: [{ clientId: "c1" }, { memberId: "m1" }] }));
  it("un solo lado", () => expect(wherePersona("w1", { clientId: null, memberId: "m1" })).toEqual({ workspaceId: "w1", OR: [{ memberId: "m1" }] }));
});
```

```ts
// eventos.test.ts
import { describe, expect, it } from "vitest";
import { diffCampos } from "./eventos";

describe("diffCampos", () => {
  const campos = ["firstName", "email", "phone", "birthDate"] as const;
  it("sólo lo que cambió", () =>
    expect(diffCampos({ firstName: "Ana", email: "a@x", phone: "1" }, { firstName: "Ana", email: "b@x", phone: "1" }, campos)).toEqual({
      email: { before: "a@x", after: "b@x" },
    }));
  it("vacío y nulo son lo mismo", () => expect(diffCampos({ phone: "" }, { phone: null }, campos)).toEqual({}));
  it("fechas por valor", () =>
    expect(diffCampos({ birthDate: new Date("2000-01-01") }, { birthDate: new Date("2000-01-01") }, campos)).toEqual({}));
  it("ignora campos no listados", () => expect(diffCampos({ secreto: 1 }, { secreto: 2 }, campos)).toEqual({}));
});
```

- [ ] **Step 2: Correr y ver que fallan.**

- [ ] **Step 3: Implementar**

```ts
// persona.ts
import "server-only";
import { prisma } from "@repo/db";

export type PersonaRef = { clientId: string | null; memberId: string | null };
export type Dueno = { clientId: string } | { memberId: string };

export function duenoDe(p: PersonaRef): Dueno {
  if (p.clientId) return { clientId: p.clientId };
  if (p.memberId) return { memberId: p.memberId };
  throw new Error("PersonaRef sin cliente ni socio");
}

export function wherePersona(workspaceId: string, p: PersonaRef) {
  const OR: ({ clientId: string } | { memberId: string })[] = [];
  if (p.clientId) OR.push({ clientId: p.clientId });
  if (p.memberId) OR.push({ memberId: p.memberId });
  return { workspaceId, OR };
}

export async function resolverPersonaPorCliente(workspaceId: string, clientId: string): Promise<PersonaRef | null> {
  const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true, memberId: true } });
  return c ? { clientId: c.id, memberId: c.memberId } : null;
}

export async function resolverPersonaPorSocio(workspaceId: string, memberId: string): Promise<PersonaRef | null> {
  const m = await prisma.member.findFirst({ where: { id: memberId, workspaceId }, select: { id: true, client: { select: { id: true } } } });
  return m ? { clientId: m.client?.id ?? null, memberId: m.id } : null;
}
```

(Si `Member.client` tiene otro nombre en el schema, usar el real: es la relación inversa de `Client.memberId`.)

```ts
// eventos.ts
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { Dueno } from "./persona";

export type Actor = { userId: number | null; label: string };
type Db = Pick<typeof prisma, "fotofficePersonEvent"> | Prisma.TransactionClient;

export async function registrarEventoPersona(
  db: Db,
  e: { workspaceId: string; dueno: Dueno; kind: string; detail?: Prisma.InputJsonValue; actor: Actor },
): Promise<void> {
  await db.fotofficePersonEvent.create({
    data: {
      workspaceId: e.workspaceId,
      ...e.dueno,
      kind: e.kind,
      detail: e.detail,
      actorUserId: e.actor.userId,
      actorLabel: e.actor.label,
    },
  });
}

function normal(v: unknown): unknown {
  if (v === "" || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  return v;
}

export function diffCampos(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: readonly string[],
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  for (const c of campos) {
    if (normal(antes[c]) !== normal(despues[c])) out[c] = { before: antes[c] ?? null, after: despues[c] ?? null };
  }
  return out;
}
```

- [ ] **Step 4: Correr** → PASS. **Step 5: Commit** — `Ficha estándar: la persona, su dueño y los eventos`.

---

### Task 3: Historial del cliente y vínculo con el socio

**Files:**
- Create: `apps/fotoffice/lib/ficha/mudanza.ts`, `apps/fotoffice/lib/clients/audit.ts`
- Modify: `apps/fotoffice/app/(shell)/clientes/actions.ts`
- Test: `apps/fotoffice/lib/ficha/mudanza.test.ts`, `apps/fotoffice/lib/clients/audit.test.ts`

**Interfaces:**
- Consumes: `diffCampos`, `registrarEventoPersona`, `Actor` (Tarea 2); `etiquetaDeUsuario` de `lib/listado/acceso.ts`.
- Produces:
  - `CAMPOS_AUDITADOS_CLIENTE` (los campos de `parseClientForm` menos `notes`), `ETIQUETAS_CAMPO_CLIENTE: Record<string, string>` en `lib/clients/audit.ts`.
  - `mudarPiezasDelSocioAlCliente(tx, { workspaceId, memberId, clientId }): Promise<{ notas: number; etiquetas: number; adjuntos: number; relaciones: number; eventos: number }>` — actualiza `memberId → clientId` en notas, adjuntos, eventos; en etiquetas, mueve las que el cliente no tiene y borra las repetidas; en relaciones, cambia `fromMemberId`/`toMemberId` por `fromClientId`/`toClientId` y borra las que quedarían duplicadas o apuntando a sí mismas.

Cambios en `clientes/actions.ts`:
- `saveClientAction` (edición): dentro de `prisma.$transaction`, leer el cliente, `update`, calcular `diffCampos(antes, v, CAMPOS_AUDITADOS_CLIENTE)`, y si hay cambios crear `ClientAudit { action: "UPDATED", changesJson }`. Alta: `ClientAudit { action: "CREATED" }` en la misma transacción que el `create`. El actor es `{ userId: user.id, label: etiquetaDeUsuario(user) }`.
- `linkClientToMemberAction`: en una transacción, `update` del vínculo; si vincula, `mudarPiezasDelSocioAlCliente` y evento `SOCIO_VINCULADO` (detail `{ memberId }`) sobre el cliente; si desvincula (`memberId` null), evento `SOCIO_DESVINCULADO` con el socio anterior. Las piezas no vuelven al socio al desvincular (quedan en el cliente).
- `parseClientForm` ya no lee `notes` (Tarea 11 saca el campo del formulario; acá se deja de escribir para que la columna quede intacta).

- [ ] **Step 1: Pruebas que fallan**: `audit.test.ts` — `CAMPOS_AUDITADOS_CLIENTE` no incluye `notes`; cada campo tiene etiqueta en español. `mudanza.test.ts` — con `vi.mock("@repo/db")` y un `tx` falso: todas las operaciones filtran por `workspaceId`; una etiqueta que ya tiene el cliente se borra del socio en vez de moverse; una relación socio→cliente mismo se borra; devuelve los conteos.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Implementar** `mudanza.ts`, `audit.ts` y los cambios de `actions.ts`. Una prueba de fuente sobre `clientes/actions.ts` verifica que `clientAudit.create` y `mudarPiezasDelSocioAlCliente` se llaman dentro de `$transaction`.
- [ ] **Step 4: Correr** `pnpm --filter fotoffice exec vitest run lib/ficha lib/clients` y tsc → PASS.
- [ ] **Step 5: Commit** — `Clientes guardan su historial y el vínculo con el socio junta las piezas`.

---

### Task 4: Notas y categorías

**Files:**
- Create: `apps/fotoffice/lib/ficha/categorias.ts`, `apps/fotoffice/lib/ficha/notas.ts`, `apps/fotoffice/app/actions/ficha.ts`
- Test: `apps/fotoffice/lib/ficha/categorias.test.ts`, `apps/fotoffice/lib/ficha/notas.test.ts`, `apps/fotoffice/app/actions/ficha.test.ts`

**Interfaces:**
- Consumes: Tareas 2 y 3.
- Produces:
  - `CATEGORIAS_DNX: readonly string[]` (las 13 de Global Constraints, en ese orden), `categoriasIniciales(slug: string): readonly string[]` (`dnx-estudio` → `CATEGORIAS_DNX`; otros → `["General"]`), `asegurarCategorias(workspaceId, slug): Promise<void>` (crea las iniciales sólo si el workspace no tiene ninguna; tolera la carrera por el `@@unique`), `listarCategorias(workspaceId): Promise<{ id; name }[]>` (activas, por `order`).
  - `validarNota({ body, categoryId }): { ok: true; body: string } | { ok: false; error: string }` (recorta; 1–4.000 caracteres).
  - `puedeModificarNota(ctx: { role: string | null; userId: number }, nota: { authorUserId: number | null }): boolean` (autor, o `configurar`).
  - `crearNota`, `editarNota`, `borrarNota` (soft: `deletedAt` + evento `NOTA_BORRADA` sin el texto), `fijarNota` (máximo 3 fijadas por persona → error "Ya hay 3 notas fijadas: desfijá una primero."), `listarNotas(workspaceId, persona, { antesDe?, take })`.
  - Acciones en `app/actions/ficha.ts` (`"use server"`, sólo funciones async): `crearNotaAction`, `editarNotaAction`, `borrarNotaAction`, `fijarNotaAction`. Cada una: resuelve el contexto con un guarda común `contextoDeFicha(persona: { tipo: "CLIENTE" | "SOCIO"; id: string })` (nuevo, en `lib/ficha/acceso.ts`: sesión → workspace activo → módulo `clients` o `members` encendido → `puede(role, "operar")` → `resolverPersonaPor…`; devuelve `null` ante cualquier falta, sin redirigir), exige la capacidad, valida que la nota pertenezca a la persona y al workspace, y hace `revalidatePath` de la ficha.

- [ ] **Step 1: Pruebas que fallan** — `categoriasIniciales("dnx-estudio")` devuelve las 13 en orden; `categoriasIniciales("sfpr")` → `["General"]`; `validarNota` rechaza vacío, sólo espacios y 4.001 caracteres; `puedeModificarNota` (autor sí; Equipo ajeno no; Administrador ajeno sí); acciones: sin contexto → error y no escribe; nota de otra persona → "No encontramos esa nota."; fijar la cuarta → el mensaje exacto.
- [ ] **Step 2–4:** fallan → implementar → pasan (+ tsc).
- [ ] **Step 5: Commit** — `Ficha estándar: notas con categoría, fijadas y con autor`.

---

### Task 5: Etiquetas

**Files:**
- Create: `apps/fotoffice/lib/ficha/etiquetas.ts`
- Modify: `apps/fotoffice/app/actions/ficha.ts`
- Test: `apps/fotoffice/lib/ficha/etiquetas.test.ts`

**Interfaces:**
- Produces:
  - `COLORES_ETIQUETA = ["gris","rojo","naranja","amarillo","verde","azul","violeta","rosa"] as const`, `claveDeEtiqueta(nombre): string` (minúsculas, sin acentos, espacios colapsados), `validarNombreEtiqueta(raw): string | null` (1–40).
  - `buscarEtiquetas(workspaceId, texto, take = 10)`, `etiquetasDePersona(workspaceId, persona)`, `ponerEtiqueta(ctx, persona, { tagId } | { nombre })` (crea si no existe; si ya la tiene no hace nada; evento `ETIQUETA_PUESTA` con `{ tagId, nombre }`), `quitarEtiqueta(ctx, persona, tagId)` (evento `ETIQUETA_QUITADA`).
  - Catálogo (`configurar`): `renombrarEtiqueta`, `cambiarColor`, `unirEtiquetas(origenId, destinoId)` (reasigna sin duplicar y borra el origen), `borrarEtiqueta` (evento `ETIQUETA_QUITADA` en cada persona que la tenía, dentro de la misma transacción).
  - Acciones: `ponerEtiquetaAction`, `quitarEtiquetaAction`, `buscarEtiquetasAction` (≤10, texto ≥1).

- [ ] **Step 1: Pruebas que fallan** — `claveDeEtiqueta("  Egresado  2025 ")` = `"egresado 2025"`; `claveDeEtiqueta("VÍP")` = `"vip"`; "Vip" y "VIP" chocan; poner la misma dos veces no duplica ni genera dos eventos; unir mueve sin duplicados; borrar deja un evento por persona.
- [ ] **Step 2–4.** **Step 5: Commit** — `Ficha estándar: etiquetas con catálogo por organización`.

---

### Task 6: Etiquetas en los listados

**Files:**
- Modify: `apps/fotoffice/lib/clients/listado.tsx`, `apps/fotoffice/lib/members/listado.tsx` (+ sus pruebas)

**Interfaces:**
- Consumes: 0.2 (`FiltroDef` tipo `relacion` con `conBuscador`, `AccionLote`), Tarea 5.
- Produces: en ambas definiciones, filtro `etiqueta` (relación con buscador → `fotofficeTags: { some: { tagId } }` en clientes; en socios `OR` entre asignaciones del socio y del cliente vinculado: `OR: [{ fotofficeTags: { some: { tagId } } }, { client: { fotofficeTags: { some: { tagId } } } }]`, envuelto en `AND` para no pisar el `OR` de la búsqueda); columna secundaria "Etiquetas" (chips); acción en lote `etiqueta` ("Agregar o quitar etiqueta", `operar`, máximo 5.000, parámetro = etiquetas del workspace con opciones `"+<id>"` "Agregar X" y `"-<id>"` "Quitar X"), cuyo `aplicar` usa `ponerEtiqueta`/`quitarEtiqueta` con el dueño correcto de cada fila (socio con cliente → cliente) y cuenta fallidos.

- [ ] **Step 1: Pruebas que fallan** — `whereClientes` con `etiqueta` y `whereSocios` con `etiqueta` + búsqueda (el `OR` de la búsqueda sigue intacto); `aplicar` de socios pone la etiqueta sobre el cliente vinculado; `validarRelacion` de `etiqueta` rechaza una etiqueta de otro workspace.
- [ ] **Step 2–4.** **Step 5: Commit** — `Listados: filtrar y etiquetar en lote a clientes y socios`.

---

### Task 7: Adjuntos privados — reglas y almacenamiento

**Files:**
- Modify: `apps/fotoffice/package.json` (agregar `"@aws-sdk/s3-request-presigner": "^3.972.0"`), `pnpm-lock.yaml` (vía `pnpm install`)
- Create: `apps/fotoffice/lib/ficha/adjuntos-reglas.ts`, `apps/fotoffice/lib/ficha/adjuntos-r2.ts`
- Test: `apps/fotoffice/lib/ficha/adjuntos-reglas.test.ts`, `apps/fotoffice/lib/ficha/adjuntos-r2.test.ts`

**Interfaces:**
- Produces:
  - `TIPOS_PERMITIDOS` (los de Global Constraints), `TAMANO_MAXIMO = 10_485_760`, `SEGUNDOS_ENLACE = 300`, `DIAS_PURGA = 30`, `HORAS_PENDIENTE = 24`.
  - `validarArchivo({ nombre, tipo, tamano }): { ok: true; nombre: string } | { ok: false; error: string }` — nombre recortado a 180 caracteres sin barras ni caracteres de control; mensajes: "Ese tipo de archivo no se puede adjuntar." / "El archivo supera los 10 MB."
  - `claveDeAdjunto(workspaceId: string, uuid: string): string` → `adjuntos/<workspaceId>/<uuid>`.
  - `adjuntosR2Configurado(): boolean` (requiere `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` y `R2_PRIVATE_BUCKET`).
  - `urlDeSubida(clave, tipo, tamano): Promise<string>` (PUT firmado, `ContentType` y `ContentLength` fijados, vence en 600 s), `urlDeDescarga(clave, nombre): Promise<string>` (GET firmado 300 s con `ResponseContentDisposition: attachment; filename*=UTF-8''<nombre codificado>`), `tamanoReal(clave): Promise<number | null>` (HEAD), `borrarObjeto(clave)`. Usa su propio `S3Client` con las mismas credenciales R2 y el bucket `R2_PRIVATE_BUCKET`; nunca el bucket público.

- [ ] **Step 1:** agregar la dependencia y correr `pnpm install`; verificar con `git diff pnpm-lock.yaml` que sólo cambia el importer de `apps/fotoffice` y que no aparece ninguna versión nueva de `@aws-sdk/*`.
- [ ] **Step 2: Pruebas que fallan** — tipos permitidos y rechazados (`.exe`, `text/html`, `image/svg+xml`); 10 MB exactos pasa, un byte más no; nombre con `../` queda sin barras; `claveDeAdjunto` no incluye el nombre original; `adjuntos-r2.test.ts` con `vi.mock("@aws-sdk/s3-request-presigner")`: el `Bucket` es `R2_PRIVATE_BUCKET`, el vencimiento de descarga es 300 y el de subida 600.
- [ ] **Step 3–4.** **Step 5: Commit** — `Adjuntos privados: reglas y bucket R2 aparte con enlaces firmados`.

---

### Task 8: Adjuntos — flujo, acciones y limpieza programada

**Files:**
- Create: `apps/fotoffice/lib/ficha/adjuntos.ts`, `apps/fotoffice/app/api/cron/adjuntos/route.ts`
- Modify: `apps/fotoffice/app/actions/ficha.ts`, `apps/fotoffice/vercel.json`
- Test: `apps/fotoffice/lib/ficha/adjuntos.test.ts`, `apps/fotoffice/app/api/cron/adjuntos/route.test.ts`

**Interfaces:**
- Produces:
  - `pedirSubida(ctx, persona, { nombre, tipo, tamano }) → { id, url } | { error }` — valida, crea la fila `PENDIENTE` con la clave, devuelve la URL firmada (nunca la clave).
  - `confirmarSubida(ctx, id) → { ok } | { error }` — la fila es del workspace y `PENDIENTE`; `tamanoReal` existe y coincide con `sizeBytes` (si no: borra objeto y fila, error "La subida no se completó. Probá de nuevo."); pasa a `LISTO` y evento `ADJUNTO_SUBIDO`.
  - `enlaceDeDescarga(ctx, id) → { url } | { error }` — sólo `LISTO` y del workspace.
  - `borrarAdjunto(ctx, id)` → `BORRADO`, `deletedAt = now`, `purgeAfter = now + 30 días`, evento; `restaurarAdjunto(ctx, id)` (`configurar`, sólo si `purgeAfter > now`) → `LISTO`, evento.
  - `purgarAdjuntos(ahora) → { purgados, pendientesLimpios }` — borra del bucket y de la base los `BORRADO` con `purgeAfter <= ahora` y los `PENDIENTE` con `createdAt <= ahora - 24 h`; si falla un objeto, sigue con los demás y lo cuenta.
  - Acciones: `pedirSubidaAction`, `confirmarSubidaAction`, `enlaceDeDescargaAction`, `borrarAdjuntoAction`, `restaurarAdjuntoAction` (todas con `contextoDeFicha` primero; si `!adjuntosR2Configurado()` → "Los adjuntos todavía no están habilitados.").
  - Cron `POST /api/cron/adjuntos` con `isAuthorizedCronRequest` como `app/api/cron/sorteos/route.ts`, `maxDuration = 300`; en `vercel.json`: `{ "path": "/api/cron/adjuntos", "schedule": "40 4 * * *" }`.

- [ ] **Step 1: Pruebas que fallan** — con `vi.mock` de `@repo/db` y de `./adjuntos-r2`: `pedirSubida` no devuelve la clave; `confirmarSubida` con tamaño distinto borra y da el error exacto; descarga de un `BORRADO` o de otro workspace → "No encontramos ese adjunto."; restaurar pasado el plazo → error; `purgarAdjuntos` respeta las fechas exactas (29 días no, 30 sí) y sigue si un borrado falla; la ruta del cron responde 401 sin secreto.
- [ ] **Step 2–4.** **Step 5: Commit** — `Adjuntos privados: subir directo, bajar con enlace que vence y purga a los 30 días`.

---

### Task 9: Personas relacionadas

**Files:**
- Create: `apps/fotoffice/lib/ficha/vinculos.ts`, `apps/fotoffice/lib/ficha/relaciones.ts`
- Modify: `apps/fotoffice/app/actions/ficha.ts`
- Test: `apps/fotoffice/lib/ficha/vinculos.test.ts`, `apps/fotoffice/lib/ficha/relaciones.test.ts`

**Interfaces:**
- Produces:
  - `VINCULOS`: lista de `{ clave, desde, hacia }` — `madre-padre` ("Madre o padre" / "Hijo o hija"), `pareja` ("Pareja" / "Pareja"), `hermano` ("Hermano o hermana" / "Hermano o hermana"), `abuelo` ("Abuelo o abuela" / "Nieto o nieta"), `tio` ("Tío o tía" / "Sobrino o sobrina"), `proveedor` ("Proveedor" / "Cliente"), `empleado` ("Empleado" / "Empleador"), `amigo` ("Amigo o amiga" / "Amigo o amiga"), `otro` (texto libre en los dos lados).
  - `etiquetaDelVinculo(clave, lado: "desde" | "hacia", customLabel?): string`.
  - `relacionesDePersona(workspaceId, persona)` → `{ id, otra: { tipo, id, nombre, href }, etiqueta, nota }[]` leyendo los dos sentidos y las dos formas (cliente/socio) de la persona.
  - `crearRelacion(ctx, persona, { otra: PersonaRef | { nuevoCliente: { nombre, telefono } }, clave, customLabel?, nota? })` — la otra persona tiene que ser del workspace; no puede ser la misma; no se permite repetido (en cualquier sentido) → "Ya están vinculadas."; `otro` exige `customLabel` 1–40; nota ≤ 200; el alta rápida crea un `Client` con el número siguiente (reusar `nextClientNumber` + reintento como `saveClientAction`) y `ClientAudit CREATED`; evento `RELACION_CREADA` en las dos personas.
  - `borrarRelacion(ctx, persona, id)` — evento `RELACION_BORRADA` en las dos.
  - Acciones: `crearRelacionAction`, `borrarRelacionAction`, `buscarPersonasAction(texto)` (clientes y socios del workspace, ≤10, por nombre/documento/teléfono).

- [ ] **Step 1: Pruebas que fallan** — cada vínculo tiene sus dos lados en español; desde el otro lado "madre-padre" se lee "Hijo o hija"; repetido en sentido inverso → error; persona de otro workspace → "No encontramos a esa persona."; alta rápida crea el cliente y dos eventos.
- [ ] **Step 2–4.** **Step 5: Commit** — `Ficha estándar: personas relacionadas con vínculo de los dos lados`.

---

### Task 10: Línea de tiempo (motor y proveedores)

**Files:**
- Create: `apps/fotoffice/lib/ficha/linea-de-tiempo.ts`, `apps/fotoffice/lib/ficha/proveedores/{notas,eventos-persona,historial-cliente,historial-socio,caja,cuotas,carnets,adjuntos}.ts`
- Modify: `apps/fotoffice/app/actions/ficha.ts` (`verMasAction`)
- Test: `apps/fotoffice/lib/ficha/linea-de-tiempo.test.ts`, `apps/fotoffice/lib/ficha/proveedores/proveedores.test.ts`

**Interfaces:**
- Produces:

```ts
export type TipoEvento = "notas" | "cambios" | "plata" | "portal" | "carnets" | "adjuntos";
export type EventoFicha = {
  id: string;            // único entre proveedores: "<proveedor>:<id>"
  tipo: TipoEvento;
  fecha: Date;
  actor: string | null;
  titulo: string;
  detalle?: string;
  enlace?: string;
  cambios?: { campo: string; antes: string; despues: string }[];
};
export type Proveedor = {
  clave: string;
  tipo: TipoEvento | TipoEvento[];
  capacidad?: "verDinero";
  traer: (ctx: { workspaceId: string }, persona: PersonaRef, antesDe: Date | null, take: number) => Promise<EventoFicha[]>;
};
export type PaginaLinea = { eventos: EventoFicha[]; siguiente: string | null; fallaron: string[] };
export function cursorDe(e: EventoFicha): string;               // `${fecha.toISOString()}|${id}`
export function leerCursor(c: string | null): { fecha: Date; id: string } | null;
export async function armarLinea(opts: {
  proveedores: Proveedor[]; ctx: { workspaceId: string; role: string | null }; persona: PersonaRef;
  filtro: TipoEvento | null; cursor: string | null; take?: number;
}): Promise<PaginaLinea>;
```

- Reglas de `armarLinea`: descarta proveedores cuya `capacidad` no cumple `puede(role, …)`; filtra por `tipo`; pide a cada proveedor `take + 1` eventos anteriores a la fecha del cursor (inclusive, y luego descarta los que en empate de fecha tienen `id >= cursor.id` para no repetir); ordena por fecha desc y `id` desc; corta en `take` (30); `siguiente` = cursor del último si hubo más; un proveedor que lanza error se omite y su clave va a `fallaron`.
- Proveedores (cada uno filtra por `workspaceId` y por los ids de la persona; lee sólo `take` filas):
  - `notas` (no borradas; las fijadas **no** van acá: la pantalla las muestra aparte con `listarNotas`), `eventos-persona` (`FotofficePersonEvent` → tipos `cambios`/`adjuntos`/`notas` según `kind`), `historial-cliente` (`ClientAudit` con `ETIQUETAS_CAMPO_CLIENTE`), `historial-socio` (`MemberAudit` con las etiquetas de `lib/members/audit-labels.ts`; las acciones `INVITE_*` y `USER_*` como `portal`), `caja` (`CashMovement` del cliente, `verDinero`, enlace `/caja/movimientos?ver=<id>`), `cuotas` (`MembershipCharge` generadas y `MembershipPayment` `ACREDITADO`, `verDinero`), `carnets` (`MemberCardEvent` de las tarjetas del socio), `adjuntos` (filas `LISTO`, con nombre y tamaño).
- `verMasAction(persona, filtro, cursor)` devuelve la página siguiente ya serializable.

- [ ] **Step 1: Pruebas que fallan (`linea-de-tiempo.test.ts`)** con proveedores falsos: mezcla de tres fuentes ordenada; empate de fecha ordenado por id y sin repetidos entre páginas; 65 eventos → páginas de 30, 30, 5 y `siguiente` null al final; `plata` desaparece sin `verDinero` (Equipo sí la ve, Colaborador no); un proveedor que lanza → `fallaron: ["caja"]` y el resto se muestra; filtro `notas` sólo trae notas.
- [ ] **Step 2: Pruebas de proveedores** con `vi.mock("@repo/db")`: cada uno pone `workspaceId` y los ids de la persona en el `where`, respeta `antesDe` y `take`.
- [ ] **Step 3–4.** **Step 5: Commit** — `Ficha estándar: una línea de tiempo que junta todas las fuentes`.

---

### Task 11: Componentes de la ficha y configuración de catálogos

**Files:**
- Create: `apps/fotoffice/components/ficha/{ficha,encabezado-ficha,datos-ficha,linea-de-tiempo,caja-de-nota,nota,etiquetas,adjuntos,personas-relacionadas}.tsx`, `apps/fotoffice/lib/ficha/acceso.ts` (si no quedó en la Tarea 4), `apps/fotoffice/app/workspace/configuracion/ficha/page.tsx`, `apps/fotoffice/app/workspace/configuracion/ficha/actions.ts`
- Test: `apps/fotoffice/lib/ficha/componentes.test.ts` (fuente) y pruebas de helpers puros que se extraigan

**Interfaces:**
- Produces: `<Ficha persona encabezado datos lateral />` (server): arma encabezado, dos columnas `lg:grid-cols-[1fr_360px]`, línea de tiempo con notas fijadas arriba (`listarNotas` con `pinned`), la primera página (`armarLinea`), y la columna lateral con `DatosFicha`, `PersonasRelacionadas`, `Adjuntos`. Componentes client: `CajaDeNota` (categoría + texto, `useActionState`), `Nota` (editar/borrar/fijar según `puedeModificarNota`), `LineaDeTiempo` (filtros como botones, "Ver más" con `verMasAction`, aviso si `fallaron`), `Etiquetas` (chips con color, autocompletar con `buscarEtiquetasAction`, crear al Enter), `Adjuntos` (input múltiple + arrastrar; por archivo: `pedirSubidaAction` → `fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type } })` con progreso vía `XMLHttpRequest` → `confirmarSubidaAction`; descargar con `enlaceDeDescargaAction` y `window.location.assign`; borrar con confirmación; restaurar para `configurar`), `PersonasRelacionadas` (buscador con `buscarPersonasAction`, selector de vínculo, alta rápida). Formatos de fecha en hora de Buenos Aires. Clases `fo-*`, íconos lucide, sin librerías nuevas.
- Configuración → Ficha (`configurar`): categorías de notas (alta, renombrar, ordenar con subir/bajar, desactivar) y etiquetas (renombrar, color, unir, borrar con confirmación que dice a cuántas personas afecta). Entrada en el menú de Configuración junto a Equipo y Módulos.

- [ ] **Step 1: Prueba de fuente que falla** — `ficha.tsx` es server; los client llevan `"use client"`; ningún componente importa `@repo/db`; `adjuntos.tsx` nunca maneja `storageKey`; la página de configuración exige `configurar` antes de leer datos.
- [ ] **Step 2–4:** implementar; tsc y build.
- [ ] **Step 5: Commit** — `Ficha estándar: componentes y configuración de categorías y etiquetas`.

---

### Task 12: Fichas de Cliente y Socio con la ficha estándar

**Files:**
- Modify: `apps/fotoffice/app/(shell)/clientes/[clientId]/page.tsx`, `apps/fotoffice/app/(shell)/clientes/client-form.tsx`, `apps/fotoffice/lib/clients/client-form.ts`, `apps/fotoffice/app/(shell)/members/[id]/page.tsx`, `apps/fotoffice/components/members/member-form.tsx`, `apps/fotoffice/lib/members/schema.ts` y el mapeo del formulario de socios en `app/actions/members.ts`
- Test: pruebas existentes de clientes y socios siguen verdes; prueba de fuente nueva `apps/fotoffice/lib/ficha/fichas.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - **Cliente**: `requireClientsStaff()` sin cambios → `resolverPersonaPorCliente` (si null → `notFound()`) → `asegurarCategorias` → `<Ficha>` con: encabezado (nombre, tipo, socio N° con enlace a `/members/<id>` si está vinculado, etiquetas, teléfono/WhatsApp/correo), datos = el `ClientForm` actual (sin `notes`) dentro de `DatosFicha`, la sección "¿Es socio?" en la columna lateral. La lista "Consumo" desaparece: esos movimientos ahora están en la línea de tiempo (tipo Plata).
  - **Socio**: `requireMembersContext()` sin cambios → `resolverPersonaPorSocio` → `<Ficha>` con: encabezado (avatar, nombre, N°, estado, categoría, etiquetas, "Cliente N° X" con enlace si está vinculado, botones Volver/Editar), columna lateral con las tarjetas que hoy existen (Identidad, Contacto, Información societaria, Acceso, Registrar pago, Recomendaciones) y relaciones/adjuntos; la sección "Observaciones" y `MemberAuditLog` salen (su contenido ya está en notas y en la línea de tiempo). Los permisos de hoy (`canManage`, `canOperateWorkspaceCollection`) siguen decidiendo qué tarjetas y botones se ven.
  - Los formularios de alta/edición de cliente y socio dejan de mostrar y de enviar `notes`; `parseClientForm` y el esquema de socios dejan de leerlo (la columna queda intacta).

- [ ] **Step 1: Prueba de fuente que falla** — las dos páginas usan `<Ficha`; ninguna usa `member.notes`/`client.notes`; los formularios no tienen `name="notes"`; los guardas siguen primero.
- [ ] **Step 2–4:** implementar; `pnpm --filter fotoffice exec vitest run lib/clients lib/members lib/ficha app/actions` y tsc → PASS.
- [ ] **Step 5: Commit** — `Clientes y socios usan la ficha estándar`.

---

### Task 13: Documentación, infraestructura y verificación completa

**Files:**
- Create: `packages/db/docs/MIGRACION-FICHA-ESTANDAR.md`
- Modify: `apps/fotoffice/.env.example` (o el archivo de ejemplo que exista) con `R2_PRIVATE_BUCKET=`

- [ ] **Step 1: `MIGRACION-FICHA-ESTANDAR.md`** con la misma estructura que `MIGRACION-LISTADO-ESTANDAR.md`: qué hace (ocho tablas + conversión de Observaciones, idempotente); **en negrita**: las fichas de Cliente y Socio leen estas tablas en cada carga, así que el código antes que el SQL rompe las dos fichas; orden (0.1 y 0.2 fusionadas → rebasar → buckets y CORS → variables en Vercel → SQL staging + `next dev` → SQL FOTOFFICE `divine-hall-10689679`/`development` → fusionar); checksum (`shasum -a 256`); verificación (conteo de notas `obs_%` igual al de clientes y socios con `notes` no vacío); vuelta atrás (código primero, después `DROP TABLE` de las ocho y borrar la fila de `_prisma_migrations`; las columnas `notes` nunca se tocaron).
- [ ] **Step 2: Sección de infraestructura** en el mismo documento: crear `fotoffice-private-prod` y `fotoffice-private-staging` sin dominio público; CORS `[{ "AllowedOrigins": ["<dominio de FOTOFFICE en producción>", "<dominio de staging>"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]` (los dominios reales se leen de la configuración de Vercel del proyecto; no inventarlos: dejar el lugar marcado para Daniel si no se pueden verificar); variable `R2_PRIVATE_BUCKET` en Production y Preview; comprobar con un preflight `OPTIONS` que responde 204 con `Access-Control-Allow-Methods: PUT` (así se verificó `fotorank-private-prod`).
- [ ] **Step 3: Verificación completa**

```bash
pnpm --filter fotoffice exec vitest run
NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit
NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice build
for app in compramelafoto clickaton fotorank; do NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter $app exec tsc --noEmit; done
```

- [ ] **Step 4:** prueba manual en el navegador queda para Daniel (ninguna base tiene las tablas y no hay bucket): anotar la lista en el PR — ver la ficha de un cliente con movimientos, escribir y fijar una nota, poner una etiqueta y filtrar por ella en el listado, subir un PDF de 8 MB y bajarlo, vincular dos personas, ver las "Observaciones" como primera nota.
- [ ] **Step 5: Commit** — `Ficha estándar: documento de migración e infraestructura de adjuntos`.

---

## Autorrevisión del plan

- **Cobertura del spec:** §3.1 → T11–12; §3.2 → T1 (conversión), T4, T11; §3.3 → T5, T6, T11; §3.4 → T7, T8, T11, T13; §3.5 → T9, T11; §3.6 → T10; §4.1 → T2, T3; §4.2 → T10; §4.3 → T11; §4.4 → T1 (+ `FotofficePersonEvent`, ruling 1); §4.5 → T4–T9 (`contextoDeFicha` + capacidades); §5 → T7, T8, T13; §6 → T8 (tamaño, pendientes, vencido), T2/T4/T9 (ajenos), T3 (vincular sin duplicar), T10 (fuente que falla); §7 → pruebas de cada tarea; §8 → criterios del tablero después del merge; §9 → T13.
- **Nombres consistentes:** `PersonaRef`, `Dueno`, `duenoDe`, `wherePersona`, `resolverPersonaPorCliente`, `resolverPersonaPorSocio`, `Actor`, `registrarEventoPersona`, `diffCampos`, `mudarPiezasDelSocioAlCliente`, `contextoDeFicha`, `asegurarCategorias`, `ponerEtiqueta`, `quitarEtiqueta`, `pedirSubida`, `confirmarSubida`, `enlaceDeDescarga`, `purgarAdjuntos`, `crearRelacion`, `EventoFicha`, `Proveedor`, `armarLinea`, `verMasAction`.
- **Riesgos conocidos:** el nombre de la relación inversa `Member.client` debe verificarse en el schema (T2); los dominios de CORS (T13) no se inventan.
