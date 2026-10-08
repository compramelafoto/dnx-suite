# Perfil de precios del workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar en FOTOFFICE un perfil completo de ¿Cuánto Cobro? por workspace, editarlo en Configuración → Precios y que Presupuestos lo use.

**Architecture:** Tabla nueva `FotofficePerfilPrecios` (1 fila por workspace, `profileData` JSON = `CuantoCobroProfileInput`). Módulos puros en `lib/precios/` (normalizar/validar, resumen) y uno de servidor (leer/guardar con permiso `configurar`). El panel de presupuestos deja de pedir el perfil corto (`PerfilPanel`) y calcula con el perfil completo del workspace; un ítem ya calculado conserva su perfil guardado.

**Tech Stack:** Next.js (App Router, ver `node_modules/next/dist/docs/` antes de tocar rutas), React, Prisma (`@repo/db`), Vitest, `@repo/cuanto-cobro-core`.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-perfil-de-precios-design.md`

## Global Constraints

- Worktree: `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/perfil-precios`, rama `feat/fotoffice-perfil-precios`. Nunca hacer checkout ni commits en el árbol principal.
- Textos visibles en español rioplatense (vos), sin tecnicismos. Código y nombres en español, como el resto de `lib/presupuestos`.
- Permiso para ver/editar el perfil y cualquier número de costo: `puedeEnContexto(ctx, "configurar")` (igual que `veCostos`). Sin permiso: no leer la tabla.
- Tamaño máximo de `profileData` serializado: 200 KB (`200 * 1024` caracteres).
- La migración NO se aplica a ninguna base desde el código; Daniel la aplica a mano. Sin staging.
- Tests: `pnpm --filter fotoffice test -- <ruta>` desde la raíz del worktree (vitest). Typecheck: `pnpm --filter fotoffice typecheck` (si muere por memoria, `NODE_OPTIONS=--max-old-space-size=8192`; ojo: puede salir 0 tras morir — revisar la salida).
- Después de cambiar `schema.prisma`: `pnpm --filter @repo/db exec prisma generate`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tabla `FotofficePerfilPrecios` (schema + SQL + prueba de migración + base en memoria)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar modelo después de `FotofficePropuestaModelo`; relación inversa en `model Workspace` junto a `fotofficePresupuestoAjustes FotofficePresupuestoAjustes?`, línea ~7199)
- Create: `packages/db/prisma/migrations/20261022120000_fotoffice_perfil_precios/migration.sql`
- Create: `apps/fotoffice/lib/precios/migracion.test.ts`
- Modify: `apps/fotoffice/lib/circuitos/base-en-memoria.ts` (agregar `"fotofficePerfilPrecios"` a `TABLAS`, valores por omisión y único por `workspaceId`)

**Interfaces:**
- Produces: modelo Prisma `fotofficePerfilPrecios` con campos `id, workspaceId (unique), schemaVersion Int, profileData Json, source String?, updatedAt, updatedByUserId Int?`.

- [ ] **Step 1: Prueba de migración (falla)**

```ts
// apps/fotoffice/lib/precios/migracion.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261022120000_fotoffice_perfil_precios/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

describe("migración del perfil de precios", () => {
  it("crea sólo la tabla del perfil y no toca ninguna otra", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).toContain(`CREATE TABLE "FotofficePerfilPrecios"`);
    expect(sql).not.toMatch(/ALTER TABLE "(?!FotofficePerfilPrecios")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });
  it("un perfil por workspace, y se borra con el workspace", () => {
    expect(sql).toContain(`CREATE UNIQUE INDEX "FotofficePerfilPrecios_workspaceId_key" ON "FotofficePerfilPrecios"("workspaceId")`);
    expect(sql).toMatch(/FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
  });
  it("el esquema de Prisma tiene el modelo con las mismas columnas", () => {
    const m = schema.match(/\nmodel FotofficePerfilPrecios \{[\s\S]*?\n\}/)?.[0] ?? "";
    for (const col of ["workspaceId", "schemaVersion", "profileData", "source", "updatedAt", "updatedByUserId"]) expect(m).toContain(col);
    expect(schema).toMatch(/fotofficePerfilPrecios\s+FotofficePerfilPrecios\?/);
  });
});
```

- [ ] **Step 2:** `pnpm --filter fotoffice test -- lib/precios/migracion.test.ts` → FAIL (no existe el SQL).

- [ ] **Step 3: Modelo y SQL**

```prisma
/// Perfil de precios de ¿Cuánto Cobro? del workspace (Configuración → Precios). `profileData` es un
/// `CuantoCobroProfileInput` completo (mismo formato que `CuantoCobroFinancialProfile` de CLF).
/// Lo leen Presupuestos y, más adelante, el asistente de ventas. Sólo `configurar` lo ve.
model FotofficePerfilPrecios {
  id              String   @id @default(cuid())
  workspaceId     String   @unique
  schemaVersion   Int      @default(1)
  profileData     Json
  /// "manual" | "clf-import"
  source          String?
  updatedAt       DateTime @updatedAt
  updatedByUserId Int?

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

En `model Workspace`: `fotofficePerfilPrecios FotofficePerfilPrecios?`.

```sql
-- Perfil de precios del workspace (Configuración → Precios). Crea UNA tabla nueva,
-- `FotofficePerfilPrecios`, y no toca ninguna tabla existente.
-- NO SE APLICA A NINGUNA BASE desde el código: se corre a mano en la base de FOTOFFICE
-- ANTES de publicar el código que la usa, y después `prisma migrate resolve --applied`.

-- CreateTable
CREATE TABLE "FotofficePerfilPrecios" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "profileData" JSONB NOT NULL,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" INTEGER,

    CONSTRAINT "FotofficePerfilPrecios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FotofficePerfilPrecios_workspaceId_key" ON "FotofficePerfilPrecios"("workspaceId");

-- AddForeignKey
ALTER TABLE "FotofficePerfilPrecios" ADD CONSTRAINT "FotofficePerfilPrecios_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Base en memoria: agregar a `TABLAS` (comentario `// Perfil de precios del workspace.`), por omisión `fotofficePerfilPrecios: () => ({ schemaVersion: 1, source: null, updatedAt: new Date(), updatedByUserId: null })`, únicos `fotofficePerfilPrecios: [{ columnas: ["workspaceId"] }]`.

- [ ] **Step 4:** `pnpm --filter @repo/db exec prisma generate` y `pnpm --filter fotoffice test -- lib/precios/migracion.test.ts` → PASS.
- [ ] **Step 5:** Commit `Agregar la tabla del perfil de precios de FOTOFFICE`.

---

### Task 2: Perfil puro — normalizar, validar y resumir

**Files:**
- Create: `apps/fotoffice/lib/precios/perfil-datos.ts`, `apps/fotoffice/lib/precios/resumen.ts`
- Test: `apps/fotoffice/lib/precios/perfil-datos.test.ts`, `apps/fotoffice/lib/precios/resumen.test.ts`

**Interfaces:**
- Produces:
  - `MAX_PERFIL_BYTES = 200 * 1024`
  - `normalizarPerfil(raw: unknown): CuantoCobroProfileInput | null` — null si no es objeto; si lo es, `{...INITIAL_CUANTO_COBRO_PROFILE, ...raw}` con `timeDistribution` mezclada con la inicial y `personalExpenseGroups` filtrado a grupos válidos (strings en id/title, items con id/label/amount string, isCustom boolean→default false). Conserva `equipmentInventory` tal cual. Fuerza `currency: "ARS"` si viene vacío.
  - `validarPerfil(raw: unknown): { ok: true; perfil: CuantoCobroProfileInput } | { ok: false; error: string }` — errores en español: no objeto → "Los datos del perfil no son válidos."; JSON > 200 KB → "El perfil es demasiado grande."; distribución que no suma 100 (con tolerancia 0,5; sólo si `weeklyHours` > 0) → "La distribución del tiempo tiene que sumar 100%."; monto no numérico en cualquier campo de monto o renglón de gasto (no vacío y `parseCuantoCobroAmount` da null) → `"Revisá el monto de «<etiqueta>»."`; posicionamiento fuera de la lista → "Elegí un posicionamiento comercial.".
  - `perfilesIguales(a: CuantoCobroProfileInput, b: CuantoCobroProfileInput): boolean` — compara `JSON.stringify` de ambos normalizados con claves ordenadas.
  - `resumirPerfil(p: CuantoCobroProfileInput): ResumenPerfil` con
    `type ResumenPerfil = { completo: boolean; faltan: string[]; necesidadMensual: number; horasFacturablesMes: number; valorHora: number | null; gastosPersonales: number; gastosNegocio: number; reservas: number }`.
    Usa `getProfileMonthlyNeed`, `computeMonthlyBillableHours(p.weeklyHours, p.timeDistribution)`, `getProfileHourlyRate`; `faltan` = unión de `getCuantoCobroMissingFields(step, p, INITIAL_CUANTO_COBRO_QUOTE)` para los pasos de perfil (leer en `packages/cuanto-cobro-core/src/calculate-cuanto-cobro.ts` la constante `PROFILE_RESULT_STEPS`; si no está exportada, replicar la lista de ids en una constante local con comentario) ; `completo = faltan.length === 0`.

- [ ] **Step 1: Pruebas (fallan)** — en `perfil-datos.test.ts` usar `createBaseCompleteProfile` de `@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures`:
  - normaliza null/array/string → null; objeto parcial `{ weeklyHours: "40" }` → trae todas las claves de `INITIAL_CUANTO_COBRO_PROFILE` y `weeklyHours: "40"`;
  - conserva `equipmentInventory` igual por referencia de valor (`toEqual`);
  - descarta grupos sin `items` array y renglones sin `label`;
  - `validarPerfil(createBaseCompleteProfile())` ok;
  - distribución 50/20/0/0/0/0 con `weeklyHours:"40"` → error de 100%;
  - renglón con amount `"abc"` → mensaje con su etiqueta;
  - objeto con un string de 250 KB → "demasiado grande";
  - `perfilesIguales` true para el mismo perfil con claves en otro orden, false si cambia un monto.
  En `resumen.test.ts`: con `createBaseCompleteProfile()` → `completo` true, `valorHora` > 0, `necesidadMensual` igual a `getProfileMonthlyNeed(perfil)`; con `INITIAL_CUANTO_COBRO_PROFILE` → `completo` false y `faltan.length > 0`, `valorHora` null.
- [ ] **Step 2:** correr → FAIL.
- [ ] **Step 3:** implementar ambos archivos (puros: sin `server-only`, sin prisma; importan sólo de `@repo/cuanto-cobro-core`).
- [ ] **Step 4:** correr → PASS.
- [ ] **Step 5:** Commit `Normalizar, validar y resumir el perfil de precios`.

---

### Task 3: Leer y guardar el perfil (servidor)

**Files:**
- Create: `apps/fotoffice/lib/precios/perfil.ts`
- Test: `apps/fotoffice/lib/precios/perfil.test.ts`

**Interfaces:**
- Consumes: `normalizarPerfil`, `validarPerfil` (Task 2); `CtxPresupuestos` y `veCostos` de `lib/presupuestos/acceso.ts`.
- Produces:
  - `leerPerfilPrecios(ctx: CtxPresupuestos): Promise<PerfilGuardado | null>` — sin `veCostos(ctx)` devuelve null SIN leer. `type PerfilGuardado = { perfil: CuantoCobroProfileInput; source: string | null; actualizado: Date }`. Fila con JSON inválido → null.
  - `guardarPerfilPrecios(ctx: CtxPresupuestos, datos: unknown): Promise<{ ok: true } | { ok: false; error: string }>` — sin permiso: `{ ok:false, error: "Sólo el dueño o un administrador pueden configurar los precios." }`; valida con `validarPerfil`; `upsert` por `workspaceId` con `profileData`, `schemaVersion: 1`, `source: "manual"`, `updatedByUserId: ctx.userId`; ante excepción `{ ok:false, error:"No se pudo guardar el perfil." }`.

- [ ] **Step 1: Pruebas (fallan)** con la base en memoria (patrón de `lib/presupuestos/pantallas.test.ts`: `vi.hoisted` + `crearBaseEnMemoria`, `vi.mock("server-only")`, `vi.mock("@repo/db")`, contextos `DUENO`, `EQUIPO` (STAFF), `LECTOR`):
  - sin perfil → `leerPerfilPrecios(DUENO)` null;
  - `guardarPerfilPrecios(DUENO, createBaseCompleteProfile())` ok y luego leer devuelve `perfil` igual y `source: "manual"`;
  - guardar dos veces deja UNA fila (`B.tablas.fotofficePerfilPrecios` o equivalente: mirar cómo exponen filas otras pruebas);
  - `EQUIPO` y `LECTOR`: guardar → error de permiso y no escribe; leer → null (y espiar que no se llamó `findUnique`);
  - otro workspace no ve el perfil;
  - datos inválidos → error de `validarPerfil`, sin escribir.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (`import "server-only"`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `Leer y guardar el perfil de precios con permiso de configurar`.

---

### Task 4: El cálculo de presupuestos usa el perfil completo

**Files:**
- Modify: `apps/fotoffice/lib/presupuestos/panel-cuanto-cobro.ts`, `lib/presupuestos/editor-datos.ts`, `lib/presupuestos/editor.ts`
- Test: `lib/presupuestos/panel-cuanto-cobro.test.ts`, `lib/presupuestos/pantallas.test.ts`, `lib/presupuestos/editor.test.ts`

**Interfaces:**
- Consumes: `leerPerfilPrecios` (Task 3), `normalizarPerfil`, `perfilesIguales` (Task 2).
- Produces (en `panel-cuanto-cobro.ts`):
  - Se ELIMINAN `PerfilPanel`, `PERFIL_VACIO`, `perfilAlMotor`, `perfilDesdeMotor`, `distribucion`, `sumaGastos`.
  - `entradaDelPanel(perfil: CuantoCobroProfileInput, trabajo: TrabajoPanel, tipoDeTrabajo?: string): EntradaMotor`
  - `perfilParaPanel(item: { calculo: { entrada: unknown } | null } | null, perfilDelWorkspace: CuantoCobroProfileInput | null): { perfil: CuantoCobroProfileInput | null; origen: "item" | "workspace" | "ninguno"; desactualizado: boolean }` — si el ítem tiene perfil guardado (normalizado) → origen `"item"`, `desactualizado = perfilDelWorkspace !== null && !perfilesIguales(guardado, perfilDelWorkspace)`; si no, el del workspace (`"workspace"`) o `{ perfil:null, origen:"ninguno", desactualizado:false }`.
  - `calcularItemDelPanel(perfil: CuantoCobroProfileInput, trabajo, tipoDeTrabajo, datos, ahora?)` y `armarItemsDelAsistente(perfil: CuantoCobroProfileInput, trabajos, tipoDeTrabajo, opciones)` — misma lógica, perfil completo.
- En `editor-datos.ts`: reemplazar `ultimoPerfilDelWorkspace` por `perfilDelWorkspace(ctx: CtxPresupuestos): Promise<CuantoCobroProfileInput | null>` = `(await leerPerfilPrecios(ctx))?.perfil ?? null` (sin `veCostos`, null sin leer — ya lo garantiza `leerPerfilPrecios`). Actualizar el comentario.
- En `editor.ts`: `perfil: CuantoCobroProfileInput | null` en `internos` y en los args (líneas ~33 y ~68).

- [ ] **Step 1: Ajustar pruebas (fallan)**:
  - `panel-cuanto-cobro.test.ts`: reemplazar `PERFIL: PerfilPanel` por `const PERFIL = createBaseCompleteProfile()`; borrar pruebas de `perfilAlMotor`/`perfilDesdeMotor`/"perfil corto"; mantener las de cálculo/asistente con el perfil completo; nuevas: `perfilParaPanel(itemCalculado, otroPerfil)` → origen `"item"` y `desactualizado: true`; con el mismo perfil → `desactualizado: false`; `perfilParaPanel({calculo:null}, PERFIL)` → origen `"workspace"`; `perfilParaPanel({calculo:null}, null)` → `"ninguno"`.
  - `pantallas.test.ts` (líneas ~56-65 y ~176-178): `D.perfilDelWorkspace` — EQUIPO/LECTOR null; DUENO null sin fila; tras crear fila `fotofficePerfilPrecios` para `ws-1` con `profileData: createBaseCompleteProfile()` → igual a ese perfil; otro workspace null. Regla de fuente: la página usa `perfilDelWorkspace(ctx)` en lugar de `ultimoPerfilDelWorkspace`.
  - `editor.test.ts`: `PERFIL` pasa a ser un `CuantoCobroProfileInput`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. Actualizar el comentario de cabecera de `panel-cuanto-cobro.ts`: "El perfil sale de Configuración → Precios (`FotofficePerfilPrecios`); el panel sólo pide el trabajo".
- [ ] **Step 4:** `pnpm --filter fotoffice test -- lib/presupuestos` → PASS.
- [ ] **Step 5:** Commit `Calcular presupuestos con el perfil de precios del workspace`.

---

### Task 5: Pantallas del editor: panel y asistente sin formulario de perfil

**Files:**
- Modify: `apps/fotoffice/components/presupuestos/panel-cuanto-cobro.tsx`, `components/presupuestos/asistente-cuanto-cobro.tsx`, `components/presupuestos/editor-presupuesto.tsx`, `app/(shell)/presupuestos/[id]/page.tsx`
- Test: `lib/presupuestos/pantallas.test.ts` (reglas de fuente)

**Interfaces:**
- Consumes: `perfilParaPanel`, `calcularItemDelPanel`, `armarItemsDelAsistente` (Task 4); `resumirPerfil` (Task 2).
- Produces: `PanelCuantoCobro({ item, perfilDelWorkspace: CuantoCobroProfileInput | null, onUsar: (item: ItemPresupuesto) => void, onCerrar })`; `AsistenteCuantoCobro` con `perfilDelWorkspace` y `onAgregar(items)`.

Comportamiento:
- Borrar `CamposPerfil` y el botón "Tu perfil (gastos y horas)".
- Nuevo componente `PerfilEnUso({ perfil })` en `panel-cuanto-cobro.tsx`: una línea "Valor de tu hora: $X · Perfil de Configuración → Precios" con enlace `/workspace/configuracion/precios` (usa `resumirPerfil` y `pesos`).
- Panel: `const { perfil: guardado, origen, desactualizado } = perfilParaPanel(item, perfilDelWorkspace)`; estado `perfil` inicializado con `guardado`. Si `perfil === null`: mostrar tarjeta "Para calcular con ¿Cuánto Cobro? primero cargá tu perfil de precios." + enlace "Ir a Configuración → Precios" y no mostrar el resultado. Si `desactualizado`: aviso "Este ítem se calculó con un perfil anterior." + botón "Recalcular con mi perfil actual" que hace `setPerfil(perfilDelWorkspace)`.
- Asistente: si no hay perfil del workspace, mismo aviso con enlace; si hay, usa ese.
- `editor-presupuesto.tsx`: quitar el estado `perfil`/`setPerfil` (línea ~111) y pasar `datos.internos?.perfil ?? null` como `perfilDelWorkspace`; `onUsar`/`onAgregar` ya no reciben perfil.
- `page.tsx`: `perfilDelWorkspace(ctx)` en lugar de `ultimoPerfilDelWorkspace(ctx)` (sigue dentro de `detalle.veCostos ? … : …`).
- Reglas de fuente en `pantallas.test.ts`: el panel contiene `perfilParaPanel(item, perfilDelWorkspace)` y `/workspace/configuracion/precios`; ningún componente de `components/presupuestos` importa `PerfilPanel` ni `CamposPerfil`.

- [ ] **Step 1:** actualizar reglas de fuente → FAIL. **Step 2:** implementar. **Step 3:** `pnpm --filter fotoffice test -- lib/presupuestos` PASS y `pnpm --filter fotoffice typecheck` sin errores.
- [ ] **Step 4:** Commit `Panel de ¿Cuánto Cobro? con el perfil de Configuración → Precios`.

---

### Task 6: Configuración → Precios

**Files:**
- Create: `apps/fotoffice/app/workspace/configuracion/precios/page.tsx`, `.../precios/perfil-form.tsx` (cliente), `.../precios/actions.ts`
- Test: `apps/fotoffice/app/workspace/configuracion/precios/actions.test.ts`
- Modify: `apps/fotoffice/app/workspace/configuracion/page.tsx` (tarjeta "Precios" junto a la de Presupuestos, visible con `configurar`, SIN depender de `presupuestosVisible`)

**Interfaces:**
- Consumes: `leerPerfilPrecios`, `guardarPerfilPrecios` (Task 3); `resumirPerfil`, `validarPerfil` (Task 2).
- Produces: `guardarPerfilPreciosAction(perfil: unknown): Promise<{ ok: true } | { ok: false; error: string }>` ("use server"; contexto como en `configuracion/presupuestos/actions.ts`: `requireActiveWorkspaceRole`, `puede(role,"configurar")`, `etiquetaDeUsuario`; `revalidatePath("/workspace/configuracion/precios")`).

Página (`dynamic = "force-dynamic"`): sin `configurar` → mensaje "Sólo el dueño o un administrador pueden configurar los precios." sin leer nada. Con permiso: `PageHeader title="Precios" description="Tus costos, tus horas y tu forma de trabajar. Con esto ¿Cuánto Cobro? calcula tus presupuestos."`, aviso si `source === "clf-import"` ("Importado de ¿Cuánto Cobro? de CompraMeLaFoto."), y `<PerfilForm inicial={perfil ?? INITIAL_CUANTO_COBRO_PROFILE} />`.

Formulario (cliente, estado = `CuantoCobroProfileInput`; reutilizar `CampoTexto` exportado de `components/presupuestos/panel-cuanto-cobro.tsx`; clases `fo-card`, `fo-input`, `fo-btn`):
1. **Ingresos**: select "¿Vivís sólo de la fotografía?" (sí/no) → `livesOnlyFromPhotography`; si no, "Otros ingresos del mes ($)".
2. **Gastos personales**: por grupo, título editable + renglones (etiqueta, monto, botón "Quitar") + "Agregar renglón"; "Agregar grupo"; "Quitar grupo". Subtotal por grupo. Ids nuevos con `crypto.randomUUID()`; renglones nuevos `isCustom: true`.
3. **Negocio**: alquiler, software, publicidad, colaboradores (cantidad), costo mensual del equipo (si cantidad > 0).
4. **Tiempo**: horas por semana; seis porcentajes (Coberturas — "lo único que se cobra", Edición, Administración, Ventas, Publicidad, Capacitación) con total en vivo y en rojo si ≠ 100.
5. **Equipo**: renovación mensual ($); cámara principal: nombre (`primaryCameraCustomName`), vida útil del obturador, disparos actuales, valor de reposición. Si `equipmentInventory` existe: "Tenés un inventario de equipo cargado; se conserva."
6. **Reservas**: fondo de emergencia, ahorro y vacaciones.
7. **Posicionamiento**: select con `COMMERCIAL_POSITIONING_OPTIONS` (título + descripción si existe).
8. **Resumen en vivo** (tarjeta fija arriba en móvil, columna en escritorio): necesidad mensual, horas que se cobran por mes, valor de tu hora, y si `!completo` la lista "Te falta completar" con `faltan`.
Botón "Guardar" llama la action; muestra error o "Perfil guardado." (`role="status"`). Validación previa en el cliente con `validarPerfil` (mismo mensaje).

- [ ] **Step 1: Pruebas de la action (fallan)** — mockear `@/lib/access/active-context` (`requireActiveWorkspaceRole`), `next/cache`, y `@/lib/precios/perfil` (espía): sin `configurar` → error y no llama `guardarPerfilPrecios`; con permiso pasa el contexto de sesión (workspaceId del contexto, nunca del argumento) y devuelve lo de `guardarPerfilPrecios`; llama `revalidatePath`. Prueba de fuente: la página no importa `prisma` directo y chequea `puede(role, "configurar")` antes de `leerPerfilPrecios`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** tests PASS + typecheck.
- [ ] **Step 5:** Commit `Configuración → Precios: el perfil de ¿Cuánto Cobro? del workspace`.

---

### Task 7: Script de importación del perfil de CLF

**Files:**
- Create: `apps/fotoffice/scripts/importar-perfil-precios-clf.ts`, `apps/fotoffice/lib/precios/importar-clf.ts` (lógica pura testeable)
- Test: `apps/fotoffice/lib/precios/importar-clf.test.ts`

**Interfaces:**
- Produces: `planDeImportacion(args: { perfilClf: unknown; existente: boolean; aplicar: boolean; pisar: boolean }): { accion: "escribir" | "nada"; motivo: string; perfil: CuantoCobroProfileInput | null }` — perfil CLF inválido → nada ("El perfil de CLF no es válido: …"); existente sin `pisar` → nada ("El workspace ya tiene perfil; usá --pisar."); sin `aplicar` → nada ("En seco: no se escribió nada.") pero con `perfil`; si no, escribir.

Script (`tsx`; ver cómo corren otros scripts en `apps/fotoffice/scripts/` y `package.json`): args `--email <correo> --workspace <slug> [--aplicar] [--pisar]`. Lee CLF con un `PrismaClient` de `@repo/db` con `datasourceUrl: process.env.DATABASE_URL_CLF` (`cuantoCobroFinancialProfile` por `user.email`), y FOTOFFICE con `process.env.DATABASE_URL` (workspace por `fotofficeWorkspaceBranding.publicSlug`; si no está, por `workspace.slug` — verificar el campo real en el schema). Imprime sólo: correo, workspace, cantidad de grupos de gastos, resumen `completo`/`faltan`, acción y motivo. NUNCA montos. Escribe con `upsert` `source: "clf-import"`, `updatedByUserId: null`. Si falta alguna variable de entorno, sale con mensaje claro.

- [ ] **Step 1:** pruebas de `planDeImportacion` (los 4 casos) → FAIL. **Step 2:** implementar. **Step 3:** PASS + typecheck.
- [ ] **Step 4:** Commit `Script para importar el perfil de ¿Cuánto Cobro? de CompraMeLaFoto`.

---

### Task 8: Verificación final

- [ ] `pnpm --filter fotoffice test` completo → todo verde (anotar cantidad).
- [ ] `pnpm --filter fotoffice typecheck` (revisar salida, no sólo el código de salida).
- [ ] `pnpm --filter fotoffice build`.
- [ ] Rama Neon de prueba hija de `development` (proyecto `divine-hall-10689679`), aplicar el SQL ahí, `next dev --webpack` con esa base: cargar perfil en Configuración → Precios, ver resumen, armar un renglón calculado en un presupuesto, cambiar el perfil y ver "Recalcular con mi perfil actual". Borrar la rama al terminar.
- [ ] Abrir PR con: qué cambia, SQL a aplicar (con checksum `shasum -a 256` del archivo), comando de `migrate resolve`, comando del script de importación en seco y con `--aplicar`.
