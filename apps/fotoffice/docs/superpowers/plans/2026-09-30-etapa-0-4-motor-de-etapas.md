# Etapa 0.4 · Motor de etapas — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un motor de etapas genérico (circuitos, etapas con identidad propia, recorridos, historial, tareas con tilde, vencimientos, proyección, avance automático) estrenado en Captación con tablero, ficha de consulta y "Mis tareas".

**Architecture:** Tablas propias del motor (`lib/circuitos/`) que se enganchan a cualquier registro por `(subjectType, subjectId)`. Un adaptador por tipo de sujeto (hoy sólo Captación) sabe nombrarlo, enlazarlo y mantener su estado compatible (`ServiceSalesLead.status`). Las funciones de cálculo (vencimiento, proyección, "nunca retrocede", validación de movimiento) son puras; la escritura va en transacciones con control de concurrencia.

**Tech Stack:** Next.js 16 App Router, Prisma sobre `packages/db/prisma/schema.prisma`, Vitest 3 (entorno node, `lib/**/*.test.ts` y `app/**/*.test.ts`), Tailwind v4 con tokens `--fo-*`, lucide-react, pnpm. Arrastrar y soltar con la API nativa de HTML5 (sin librerías).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-30-etapa-0-4-motor-de-etapas-design.md`

## Global Constraints

- Rama `feat/fotoffice-motor-de-etapas` creada **desde `feat/fotoffice-ficha-estandar`** (PR 286, apilado sobre 281 y 277). Worktree propio `~/Desktop/PROGRAMACIONES/dnx-fotoffice-circuitos`.
- pnpm, nunca npm. **Ninguna dependencia nueva** (arrastrar y soltar con HTML5 nativo).
- Ninguna columna nueva en tablas existentes, **tampoco en `ServiceSalesLead`**; sólo tablas nuevas (relaciones inversas virtuales permitidas).
- Migración a mano en `packages/db/prisma/migrations/20261003120000_fotoffice_motor_de_etapas/migration.sql`; **no se aplica a ninguna base**; nada de `prisma migrate`/`db push` remotos.
- `workspaceId` siempre de la sesión; toda lectura/escritura de circuitos, etapas, recorridos, pasos, tareas y eventos filtra por workspace (las tablas hijas, a través de su padre con workspace). Ids ajenos → "no encontrado".
- Permisos (`puede(rol, capacidad)`, `apps/fotoffice/lib/access/policy.ts`): ver tablero/ficha/"Mis tareas" = guarda del módulo; mover, ganar, perder, tildar y crear tareas, cambiar vencimiento = `operar`; pasar con tareas obligatorias pendientes = `configurar`; circuitos, etapas, tareas modelo, reglas, motivos, predeterminado = `configurar`.
- Hora `America/Argentina/Buenos_Aires` (offset fijo `-03:00`); un vencimiento de N días vence al **final** del día (23:59:59.999 -03:00) de fecha de entrada + N; `days = 0` → sin vencimiento.
- Clases de circuito: `VENTA` (salidas `GANADA` / `PERDIDA`) y `TRABAJO` (salidas `TERMINADO` / `CANCELADO`). Perder o cancelar exige motivo.
- Tipos de sujeto: `CAPTACION` (único conectado); reservados `CONSULTA`, `PROYECTO`, `COBERTURA`.
- Eventos: `CONSULTA_RECIBIDA` (conectado), `PRESUPUESTO_ACEPTADO`, `CONTRATO_FIRMADO`, `SENA_COBRADA`, `BACKUP_TERMINADO`, `GALERIA_PUBLICADA` (declarados).
- Colores de etapa: la paleta de etiquetas de 0.3 (`gris`, `rojo`, `naranja`, `amarillo`, `verde`, `azul`, `violeta`, `rosa`), reutilizando `lib/ficha/formato.ts`.
- Captación vive en `/captacion` (tablero) y `/captacion/[id]` (ficha); `/dashboard/service-leads` redirige a `/captacion`; `/dashboard/service-leads/forms` (formularios) no cambia.
- Textos en español rioplatense.
- Pruebas `pnpm --filter fotoffice exec vitest run <ruta>`; tipos `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit`; build igual con `build`. Disco casi lleno: borrar `apps/fotoffice/.next/cache` después de cada build. No commitear `apps/*/tsconfig.tsbuildinfo`.
- Commits en español, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final; sin merge nunca.

## Decisiones tomadas al planificar (rulings)

1. **Semillas en código, no en SQL.** Los 4 embudos y 17 flujos de DNX, los motivos y el circuito mínimo de las demás organizaciones se cargan con `asegurarCircuitos(workspaceId, slug)` (idempotente: sólo si el workspace no tiene ningún circuito), llamada al abrir Captación o Configuración → Circuitos. Los datos quedan en TypeScript, revisables y probados; el SQL es sólo DDL. (El spec §4.1 decía "en el mismo SQL".)
2. **Enganche de consultas existentes en código.** `engancharConsultas(workspaceId)` (idempotente: sólo consultas sin recorrido) corre justo después de `asegurarCircuitos` al abrir el tablero.
3. **Historial de la consulta en su propia ficha.** Las consultas de Captación no son todavía una persona de la ficha 0.3 (no tienen cliente); el historial de etapas se muestra en `/captacion/[id]`. El proveedor "Etapas" para la línea de tiempo de personas llega con Consultas (etapa 1), cuando la consulta se vincule a un contacto.
4. **Limpieza de `createServiceLead`:** se quitan los `console.log` que imprimen el branding y el slug (hoy vuelcan datos a los logs) al conectar el evento `CONSULTA_RECIBIDA`.

## Mapa de archivos

- Base: `packages/db/prisma/schema.prisma`; `packages/db/prisma/migrations/20261003120000_fotoffice_motor_de_etapas/migration.sql`; `packages/db/docs/MIGRACION-MOTOR-DE-ETAPAS.md`.
- Motor `apps/fotoffice/lib/circuitos/`: `constantes.ts`, `calculos.ts` (puro), `semillas/dnx.ts`, `semillas/minimo.ts`, `semillas/asegurar.ts`, `recorridos.ts`, `tareas.ts`, `eventos.ts`, `informe.ts`, `configuracion.ts`, `acceso.ts`, `sujetos/tipos.ts`, `sujetos/captacion.ts`, `sujetos/index.ts`; pruebas al lado.
- Acciones: `apps/fotoffice/app/actions/circuitos.ts`; `apps/fotoffice/app/workspace/configuracion/circuitos/{page.tsx,actions.ts,*.tsx}`.
- Captación: `apps/fotoffice/app/(shell)/captacion/{page.tsx,[id]/page.tsx}`, `apps/fotoffice/lib/service-leads/listado.tsx`, `apps/fotoffice/app/dashboard/service-leads/page.tsx` (redirección), `apps/fotoffice/components/shell/shell-nav.tsx`, `apps/fotoffice/lib/modules/registry.ts`, `apps/fotoffice/lib/listado/registro.ts`, `apps/fotoffice/app/actions/service-lead.ts`.
- Componentes `apps/fotoffice/components/circuitos/`: `tablero.tsx`, `tarjeta.tsx`, `mover-a.tsx`, `dialogo-perdida.tsx`, `recorrido.tsx`, `tareas.tsx`, `proyeccion.tsx`, `mis-tareas.tsx`, `informe.tsx`.
- Inicio: `apps/fotoffice/app/(shell)/dashboard/page.tsx` ("Mis tareas").

---

### Task 1: Tablas y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261003120000_fotoffice_motor_de_etapas/migration.sql`
- Test: `apps/fotoffice/lib/circuitos/migracion.test.ts`

**Interfaces:**
- Produces: modelos `FotofficeCircuit`, `FotofficeStage`, `FotofficeStageTaskTemplate`, `FotofficeStageRule`, `FotofficeLossReason`, `FotofficeJourney`, `FotofficeJourneyStep`, `FotofficeTask`, `FotofficeProcessedEvent`.

- [ ] **Step 1: Worktree**

```bash
cd ~/Desktop/PROGRAMACIONES/dnx-suite
git fetch origin
git worktree add -b feat/fotoffice-motor-de-etapas ../dnx-fotoffice-circuitos origin/feat/fotoffice-ficha-estandar
cd ../dnx-fotoffice-circuitos && pnpm install --frozen-lockfile
```

- [ ] **Step 2: Modelos** (sección FOTOFFICE del schema)

```prisma
/// Circuito de etapas (embudo de venta o flujo de trabajo). Etapa 0.4.
model FotofficeCircuit {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  /// VENTA | TRABAJO
  kind        String
  isActive    Boolean  @default(true)
  /// Uno por clase y workspace (índice único parcial en el SQL).
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())

  workspace Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  stages    FotofficeStage[]
  journeys  FotofficeJourney[]

  @@unique([workspaceId, name])
  @@index([workspaceId, kind, isActive])
}

model FotofficeStage {
  id           String    @id @default(cuid())
  circuitId    String
  name         String
  color        String    @default("gris")
  order        Int
  /// 0 = sin vencimiento.
  days         Int       @default(0)
  requireTasks Boolean   @default(false)
  /// Sólo circuitos de VENTA de Captación: NEW | CONTACTED | QUOTED | INTERESTED.
  leadStatus   String?
  archivedAt   DateTime?
  createdAt    DateTime  @default(now())

  circuit   FotofficeCircuit             @relation(fields: [circuitId], references: [id], onDelete: Cascade)
  templates FotofficeStageTaskTemplate[]
  rules     FotofficeStageRule[]
  journeys  FotofficeJourney[]
  tasks     FotofficeTask[]
  stepsFrom FotofficeJourneyStep[]       @relation("StepFrom")
  stepsTo   FotofficeJourneyStep[]       @relation("StepTo")

  @@index([circuitId, order])
}

model FotofficeStageTaskTemplate {
  id       String  @id @default(cuid())
  stageId  String
  title    String
  days     Int     @default(0)
  required Boolean @default(false)
  order    Int

  stage FotofficeStage @relation(fields: [stageId], references: [id], onDelete: Cascade)

  @@index([stageId, order])
}

model FotofficeStageRule {
  id      String @id @default(cuid())
  stageId String
  event   String

  stage FotofficeStage @relation(fields: [stageId], references: [id], onDelete: Cascade)

  @@unique([stageId, event])
}

model FotofficeLossReason {
  id          String  @id @default(cuid())
  workspaceId String
  name        String
  order       Int     @default(0)
  isActive    Boolean @default(true)

  workspace Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  journeys  FotofficeJourney[]

  @@unique([workspaceId, name])
}

/// El recorrido de un registro por un circuito.
model FotofficeJourney {
  id             String    @id @default(cuid())
  workspaceId    String
  circuitId      String
  /// VENTA | TRABAJO — copia de la clase del circuito, para el índice único parcial.
  kind           String
  /// CAPTACION | CONSULTA | PROYECTO | COBERTURA
  subjectType    String
  subjectId      String
  /// null cuando el recorrido terminó.
  stageId        String?
  /// GANADA | PERDIDA | TERMINADO | CANCELADO
  outcome        String?
  lossReasonId   String?
  enteredStageAt DateTime  @default(now())
  stageDueAt     DateTime?
  ownerUserId    Int?
  closedAt       DateTime?
  createdAt      DateTime  @default(now())

  workspace  Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  circuit    FotofficeCircuit     @relation(fields: [circuitId], references: [id], onDelete: Restrict)
  stage      FotofficeStage?      @relation(fields: [stageId], references: [id], onDelete: Restrict)
  lossReason FotofficeLossReason? @relation(fields: [lossReasonId], references: [id], onDelete: SetNull)
  steps      FotofficeJourneyStep[]
  tasks      FotofficeTask[]
  processed  FotofficeProcessedEvent[]

  @@index([workspaceId, subjectType, subjectId])
  @@index([circuitId, stageId])
}

model FotofficeJourneyStep {
  id                     String   @id @default(cuid())
  journeyId              String
  fromStageId            String?
  toStageId              String?
  outcome                String?
  note                   String?
  auto                   Boolean  @default(false)
  event                  String?
  forcedWithPendingTasks Boolean  @default(false)
  actorUserId            Int?
  actorLabel             String
  createdAt              DateTime @default(now())

  journey   FotofficeJourney @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  fromStage FotofficeStage?  @relation("StepFrom", fields: [fromStageId], references: [id], onDelete: SetNull)
  toStage   FotofficeStage?  @relation("StepTo", fields: [toStageId], references: [id], onDelete: SetNull)

  @@index([journeyId, createdAt])
}

model FotofficeTask {
  id              String    @id @default(cuid())
  workspaceId     String
  journeyId       String?
  stageId         String?
  subjectType     String
  subjectId       String
  title           String
  dueAt           DateTime?
  assigneeUserId  Int?
  required        Boolean   @default(false)
  doneAt          DateTime?
  doneByUserId    Int?
  createdByUserId Int?
  createdAt       DateTime  @default(now())

  workspace Workspace         @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  journey   FotofficeJourney? @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  stage     FotofficeStage?   @relation(fields: [stageId], references: [id], onDelete: SetNull)

  @@index([workspaceId, assigneeUserId, doneAt, dueAt])
  @@index([journeyId])
}

model FotofficeProcessedEvent {
  id        String   @id @default(cuid())
  journeyId String
  event     String
  sourceRef String
  createdAt DateTime @default(now())

  journey FotofficeJourney @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@unique([journeyId, event, sourceRef])
}
```

Relaciones inversas virtuales en `Workspace` (`fotofficeCircuits`, `fotofficeLossReasons`, `fotofficeJourneys`, `fotofficeTasks`).

- [ ] **Step 3: `migration.sql`** — `CREATE TABLE` de las nueve tablas con tipos, índices y FKs como Prisma los generaría (usar `prisma migrate diff --from-schema-datamodel <schema de la rama base> --to-schema-datamodel <schema nuevo> --script` sin base, como en 0.3), más:

```sql
-- Un solo circuito predeterminado por clase y workspace.
CREATE UNIQUE INDEX "FotofficeCircuit_predeterminado" ON "FotofficeCircuit"("workspaceId", "kind") WHERE "isDefault";
-- Un solo recorrido abierto por sujeto y clase.
CREATE UNIQUE INDEX "FotofficeJourney_abierto" ON "FotofficeJourney"("workspaceId", "subjectType", "subjectId", "kind") WHERE "closedAt" IS NULL;
-- Clase y salida válidas.
ALTER TABLE "FotofficeCircuit" ADD CONSTRAINT "FotofficeCircuit_kind" CHECK ("kind" IN ('VENTA','TRABAJO'));
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_outcome" CHECK ("outcome" IS NULL OR "outcome" IN ('GANADA','PERDIDA','TERMINADO','CANCELADO'));
-- Abierto ⇔ tiene etapa; cerrado ⇔ tiene salida.
ALTER TABLE "FotofficeJourney" ADD CONSTRAINT "FotofficeJourney_estado" CHECK (("closedAt" IS NULL AND "stageId" IS NOT NULL AND "outcome" IS NULL) OR ("closedAt" IS NOT NULL AND "stageId" IS NULL AND "outcome" IS NOT NULL));
```

- [ ] **Step 4:** `prisma validate` y `generate` (DATABASE_URL ficticia si hace falta; nunca conectar).

- [ ] **Step 5: Prueba de fuente** (`migracion.test.ts`): no altera tablas existentes (`ServiceSalesLead`, `Workspace`, `Client`, `Member`, `User`), no hay `DROP`/`DELETE`/`UPDATE`; crea las nueve tablas; contiene los dos índices parciales y los tres `CHECK`.

- [ ] **Step 6:** vitest + tsc de fotoffice, compramelafoto, clickaton, fotorank. **Step 7: Commit** — `Motor de etapas: tablas de circuitos, recorridos y tareas (SQL sin aplicar)`.

---

### Task 2: Constantes y cálculos puros

**Files:**
- Create: `apps/fotoffice/lib/circuitos/constantes.ts`, `apps/fotoffice/lib/circuitos/calculos.ts`
- Test: `apps/fotoffice/lib/circuitos/calculos.test.ts`

**Interfaces:**
- Produces:

```ts
// constantes.ts
export const CLASES = ["VENTA", "TRABAJO"] as const;
export type Clase = (typeof CLASES)[number];
export const SALIDAS: Record<Clase, { exito: string; fracaso: string }> = {
  VENTA: { exito: "GANADA", fracaso: "PERDIDA" },
  TRABAJO: { exito: "TERMINADO", fracaso: "CANCELADO" },
};
export const ETIQUETA_SALIDA: Record<string, string> = { GANADA: "Ganada", PERDIDA: "Perdida", TERMINADO: "Terminado", CANCELADO: "Cancelado" };
export const TIPOS_SUJETO = ["CAPTACION", "CONSULTA", "PROYECTO", "COBERTURA"] as const;
export type TipoSujeto = (typeof TIPOS_SUJETO)[number];
export const EVENTOS = ["CONSULTA_RECIBIDA", "PRESUPUESTO_ACEPTADO", "CONTRATO_FIRMADO", "SENA_COBRADA", "BACKUP_TERMINADO", "GALERIA_PUBLICADA"] as const;
export type Evento = (typeof EVENTOS)[number];
export const ETIQUETA_EVENTO: Record<Evento, string> = {
  CONSULTA_RECIBIDA: "Llegó una consulta nueva",
  PRESUPUESTO_ACEPTADO: "El cliente aceptó el presupuesto",
  CONTRATO_FIRMADO: "Se firmó el contrato",
  SENA_COBRADA: "Se cobró la seña",
  BACKUP_TERMINADO: "DNX FLUX terminó el backup",
  GALERIA_PUBLICADA: "Se publicó la galería",
};
export const EVENTOS_CONECTADOS: readonly Evento[] = ["CONSULTA_RECIBIDA"];
export const ESTADOS_CAPTACION = ["NEW", "CONTACTED", "QUOTED", "INTERESTED"] as const;
```

```ts
// calculos.ts
export type EtapaCalculo = { id: string; order: number; days: number; archivedAt: Date | null };
/** Fin del día (Buenos Aires) de `entrada` + `dias`; null si dias === 0. */
export function vencimientoDeEtapa(entrada: Date, dias: number): Date | null;
export function estaVencida(dueAt: Date | null, ahora: Date): boolean; // dueAt !== null && ahora > dueAt
export function vencimientoDeTarea(entrada: Date, dias: number): Date;   // fin del día de entrada + dias (dias 0 → fin del día de entrada)
/** Encadena las etapas activas desde la actual. Si la actual ya venció, arranca desde hoy. */
export function proyeccion(etapas: EtapaCalculo[], actualId: string, enteredAt: Date, dueAt: Date | null, hoy: Date):
  { desdeHoy: boolean; etapas: { id: string; inicio: Date; fin: Date | null }[]; fin: Date | null };
/** ¿Avanzar a `destinoId` sería retroceder o quedarse? (compara `order` dentro del circuito) */
export function esRetroceso(etapas: EtapaCalculo[], actualId: string, destinoId: string): boolean;
export type ValidacionMovimiento = { ok: true } | { ok: false; motivo: "OTRO_CIRCUITO" | "ARCHIVADA" | "MISMA_ETAPA" | "TAREAS_PENDIENTES"; pendientes?: string[] };
export function validarMovimiento(opts: {
  etapas: EtapaCalculo[]; actualId: string; destinoId: string;
  requiereTareas: boolean; pendientesObligatorias: string[]; forzar: boolean; puedeForzar: boolean;
}): ValidacionMovimiento;
```

Reglas: `requiereTareas` es la marca de la etapa **actual**; con pendientes obligatorias y sin `forzar && puedeForzar` → `TAREAS_PENDIENTES` con los títulos. Mover a una etapa archivada → `ARCHIVADA`. `proyeccion` ignora etapas archivadas y las de orden menor a la actual; `fin` es null si alguna etapa restante tiene `days = 0`… **no**: una etapa con 0 días suma 0 días (su fin = su inicio). `fin` es null sólo si no quedan etapas con días (todas 0) — entonces `fin` = inicio de la actual.

- [ ] **Step 1: Pruebas que fallan**

```ts
import { describe, expect, it } from "vitest";
import { esRetroceso, estaVencida, proyeccion, validarMovimiento, vencimientoDeEtapa, vencimientoDeTarea } from "./calculos";

const d = (s: string) => new Date(s);
const E = (id: string, order: number, days: number, archivedAt: Date | null = null) => ({ id, order, days, archivedAt });

describe("vencimientos en hora de Buenos Aires", () => {
  it("2 días desde el 30/09 22:00 AR vence el 02/10 al final del día", () =>
    expect(vencimientoDeEtapa(d("2026-10-01T01:00:00Z"), 2)?.toISOString()).toBe("2026-10-03T02:59:59.999Z"));
  it("0 días = sin vencimiento", () => expect(vencimientoDeEtapa(d("2026-10-01T12:00:00Z"), 0)).toBeNull());
  it("tarea de 0 días vence al final del día de entrada", () =>
    expect(vencimientoDeTarea(d("2026-10-01T12:00:00Z"), 0).toISOString()).toBe("2026-10-02T02:59:59.999Z"));
  it("vencida sólo si pasó el instante", () => {
    expect(estaVencida(d("2026-10-02T02:59:59.999Z"), d("2026-10-02T02:59:59.999Z"))).toBe(false);
    expect(estaVencida(d("2026-10-02T02:59:59.999Z"), d("2026-10-02T03:00:00Z"))).toBe(true);
    expect(estaVencida(null, d("2030-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("esRetroceso", () => {
  const etapas = [E("a", 0, 1), E("b", 1, 1), E("c", 2, 1)];
  it("adelante no, atrás o igual sí", () => {
    expect(esRetroceso(etapas, "a", "c")).toBe(false);
    expect(esRetroceso(etapas, "c", "a")).toBe(true);
    expect(esRetroceso(etapas, "b", "b")).toBe(true);
  });
});

describe("validarMovimiento", () => {
  const etapas = [E("a", 0, 1), E("b", 1, 1), E("x", 2, 1, d("2026-01-01T00:00:00Z"))];
  const base = { etapas, actualId: "a", destinoId: "b", requiereTareas: true, pendientesObligatorias: ["Llamar"], forzar: false, puedeForzar: false };
  it("tareas pendientes bloquean", () => expect(validarMovimiento(base)).toEqual({ ok: false, motivo: "TAREAS_PENDIENTES", pendientes: ["Llamar"] }));
  it("forzar sin permiso sigue bloqueado", () => expect(validarMovimiento({ ...base, forzar: true }).ok).toBe(false));
  it("forzar con permiso pasa", () => expect(validarMovimiento({ ...base, forzar: true, puedeForzar: true })).toEqual({ ok: true }));
  it("sin marca de tareas pasa", () => expect(validarMovimiento({ ...base, requiereTareas: false })).toEqual({ ok: true }));
  it("etapa archivada, de otro circuito o la misma", () => {
    expect(validarMovimiento({ ...base, requiereTareas: false, destinoId: "x" })).toMatchObject({ motivo: "ARCHIVADA" });
    expect(validarMovimiento({ ...base, requiereTareas: false, destinoId: "zzz" })).toMatchObject({ motivo: "OTRO_CIRCUITO" });
    expect(validarMovimiento({ ...base, requiereTareas: false, destinoId: "a" })).toMatchObject({ motivo: "MISMA_ETAPA" });
  });
});

describe("proyeccion", () => {
  const etapas = [E("a", 0, 2), E("b", 1, 3), E("c", 2, 0), E("z", 3, 5, d("2026-01-01T00:00:00Z"))];
  it("encadena desde el vencimiento de la actual e ignora archivadas", () => {
    const p = proyeccion(etapas, "a", d("2026-10-01T12:00:00Z"), d("2026-10-04T02:59:59.999Z"), d("2026-10-01T15:00:00Z"));
    expect(p.desdeHoy).toBe(false);
    expect(p.etapas.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(p.fin?.toISOString()).toBe("2026-10-07T02:59:59.999Z");
  });
  it("si la actual venció, calcula desde hoy", () => {
    const p = proyeccion(etapas, "a", d("2026-09-01T12:00:00Z"), d("2026-09-04T02:59:59.999Z"), d("2026-10-01T15:00:00Z"));
    expect(p.desdeHoy).toBe(true);
    expect(p.etapas[1].inicio.toISOString() >= "2026-10-01").toBe(true);
  });
});
```

- [ ] **Step 2–4:** fallan → implementar (reusar `hoyEnBuenosAires` de `lib/listado/periodos.ts` para el día calendario; fin del día = `new Date(\`${ymd}T23:59:59.999-03:00\`)`) → pasan.
- [ ] **Step 5: Commit** — `Motor de etapas: vencimientos, proyección y reglas de movimiento`.

---

### Task 3: Semillas y circuitos iniciales

**Files:**
- Create: `apps/fotoffice/lib/circuitos/semillas/{dnx.ts,minimo.ts,asegurar.ts}`
- Test: `apps/fotoffice/lib/circuitos/semillas/semillas.test.ts`

**Interfaces:**
- Produces:
  - `type SemillaCircuito = { name: string; kind: Clase; isDefault?: boolean; stages: { name: string; days: number; color?: string; leadStatus?: string; tasks?: { title: string; days?: number; required?: boolean }[] }[] }`.
  - `CIRCUITOS_DNX: SemillaCircuito[]` (4 VENTA + 17 TRABAJO), `MOTIVOS_INICIALES = ["Precio", "Fecha no disponible", "Eligió a otro", "No respondió", "Canceló el evento", "Otro"]`, `CIRCUITO_MINIMO: SemillaCircuito` ("Circuito de ventas", VENTA, default, etapas Nueva (NEW) → Contactada (CONTACTED) → Presupuesto enviado (QUOTED) → Interesada (INTERESTED), 2/2/3/5 días).
  - `asegurarCircuitos(workspaceId: string, slug: string): Promise<void>` — si el workspace ya tiene algún circuito, no hace nada; si no, en una transacción crea los de `slug === "dnx-estudio" ? CIRCUITOS_DNX : [CIRCUITO_MINIMO]` y los motivos iniciales; tolera la carrera (P2002 en `@@unique([workspaceId, name])` → ignora).
- Contenido de `CIRCUITOS_DNX`: **copiar exactamente** de `apps/fotoffice/docs/alboom/09-configuracion-real-dnx.md` (secciones "Etapas de los embudos de venta" y "Etapas y tareas de los flujos de trabajo"): nombres, días y tareas (las frases en cursiva de cada etapa se parten en tareas, una por idea; la lista de Selpix se parte en sus ítems). Correcciones: "oportunidnad" → "oportunidad", "Confecciónar" → "Confeccionar", "Eidción" → "Edición", "Instalr" → "Instalar", "Impresion" → "Impresión", "Proyeccion" → "Proyección". **"Stand de glitter": su etapa "Configurar plataforma (20)" sin tareas.** "Embudo de Ventas DNX 2022" es el predeterminado de VENTA, con `leadStatus`: Recepción de la oportunidad = NEW, WSP - Recepción del Presupuesto = CONTACTED, Coordinar entrevista = QUOTED, Cliente potencial = INTERESTED. Ningún flujo de TRABAJO es predeterminado. Colores: VENTA en azul/violeta alternados; las etapas "Finalizado" en verde; el resto gris.
- Si `docs/alboom/09-configuracion-real-dnx.md` no está en esta rama, leerlo de `origin/docs/fotoffice-crm-alboom` con `git show origin/docs/fotoffice-crm-alboom:apps/fotoffice/docs/alboom/09-configuracion-real-dnx.md`.

- [ ] **Step 1: Pruebas que fallan**: 4 circuitos VENTA y 17 TRABAJO; exactamente un VENTA predeterminado y ninguno TRABAJO; etapas por circuito = la tabla del documento (Colaboradores 2, DNX 2022 6, Plataforma 360 1, Workshops 4; Base 360° 3, Cobertura foto 7, Cobertura video 6, Invitación web 3, Placa 6, Videos RRSS 6, Video final 5, 2do fotógrafo 3, Fotolibro 10, Impresión fotos 4, Números de mesa 5, Laboratorio 5, Pendrive 3, Publicar video 4, Selpix 3, Sesión 8, Glitter 1); ningún nombre contiene las erratas; Stand de glitter sin tareas; nombres de circuito únicos; `asegurarCircuitos` con `vi.mock("@repo/db")`: no escribe si ya hay circuitos; con slug `dnx-estudio` crea 21 circuitos + 6 motivos; con otro slug crea 1 + 6.
- [ ] **Step 2–4.** **Step 5: Commit** — `Motor de etapas: embudos y flujos de DNX cargados desde Alboom`.

---

### Task 4: Sujetos y recorridos (mover, cerrar, historial, tareas de etapa)

**Files:**
- Create: `apps/fotoffice/lib/circuitos/sujetos/{tipos.ts,captacion.ts,index.ts}`, `apps/fotoffice/lib/circuitos/recorridos.ts`, `apps/fotoffice/lib/circuitos/acceso.ts`
- Test: `apps/fotoffice/lib/circuitos/recorridos.test.ts`, `apps/fotoffice/lib/circuitos/sujetos/captacion.test.ts`

**Interfaces:**
- Consumes: Tareas 1–3; `puede`; `etiquetaDeUsuario` (`lib/listado/acceso.ts`).
- Produces:
  - `type Sujeto = { tipo: TipoSujeto; id: string }`; `type Adaptador = { moduleKey: string; existe(tx, workspaceId, id): Promise<boolean>; nombre(workspaceId, ids: string[]): Promise<Map<string, { titulo: string; subtitulo?: string; href: string }>>; alCambiarEtapa?(tx, workspaceId, id, etapa: { leadStatus: string | null } | null, salida: string | null): Promise<void> }`; `adaptadorDe(tipo): Adaptador | null` (sólo `CAPTACION`).
  - Captación: `existe` = `serviceSalesLead.count({ where: { id, workspaceId } })`; `nombre` = nombre + tipo/fecha de evento, `href: /captacion/<id>`; `alCambiarEtapa`: salida `GANADA` → status `WON`, `PERDIDA` → `LOST`, etapa con `leadStatus` → ese status, etapa sin `leadStatus` → no toca el status (usa `updateMany({ where: { id, workspaceId } })`).
  - `type CtxCircuitos = { workspaceId: string; userId: number | null; userLabel: string; role: string | null }` (`userId: null`, `userLabel: "Sistema"` para lo automático).
  - `contextoDeCircuitos(): Promise<CtxCircuitos | null>` en `acceso.ts` (sesión → workspace activo → `puede(role, "operar")`; null ante cualquier falta; nunca redirige).
  - `iniciarRecorrido(ctx, sujeto, circuitoId?: string): Promise<{ journeyId: string }>` — circuito del workspace (o el predeterminado de la clase VENTA para Captación), primera etapa activa, crea recorrido + paso inicial (fromStageId null) + tareas de la etapa; si ya hay uno abierto de esa clase lo devuelve (idempotente).
  - `mover(ctx, journeyId, destinoId, opts: { nota?: string; forzar?: boolean; esperado?: Date; auto?: { evento: string } }): Promise<{ ok: true } | { ok: false; error: string; pendientes?: string[] }>` — en una transacción: carga el recorrido del workspace y sus etapas; `validarMovimiento` (puedeForzar = `puede(ctx.role,"configurar")`); control de concurrencia: `updateMany({ where: { id, workspaceId, stageId: actual, enteredStageAt: esperado ?? leído } })` y si `count !== 1` → "Esta consulta cambió mientras tanto."; nuevo `stageDueAt` con `vencimientoDeEtapa`; crea el paso (con `forcedWithPendingTasks` si correspondió; `auto`/`event`); crea las tareas modelo de la etapa destino con `vencimientoDeTarea` y responsable = `ownerUserId`; llama `alCambiarEtapa`.
  - `cerrar(ctx, journeyId, salida: string, lossReasonId?: string, nota?: string)` — valida que la salida sea de la clase del circuito; fracaso exige motivo activo del workspace ("Elegí un motivo."); cierra (`stageId: null`, `outcome`, `closedAt`), paso con `outcome`, `alCambiarEtapa(null, salida)`.
  - `cambiarVencimiento(ctx, journeyId, dueAt: Date | null, nota: string)` — paso con nota "Vencimiento cambiado a …".
  - `asignarResponsable(ctx, journeyId, userId | null)` — sólo miembros del workspace.
  - Mensajes exactos: "No encontramos ese registro.", "Esa etapa no es de este circuito.", "Esa etapa está archivada.", "Ya está en esa etapa.", "Faltan tareas obligatorias: <lista>.", "Esta consulta cambió mientras tanto.".

- [ ] **Step 1: Pruebas que fallan** (con `vi.mock("@repo/db")` y un `tx` en memoria como en `lib/ficha/adjuntos.test.ts`): iniciar crea recorrido + paso + tareas con vencimientos exactos; iniciar dos veces devuelve el mismo; mover crea paso y tareas nuevas, actualiza vencimiento y el status de la consulta según `leadStatus`; mover con `esperado` viejo → "cambió mientras tanto" y nada escrito; tareas obligatorias bloquean y `configurar` las fuerza con `forcedWithPendingTasks`; cerrar PERDIDA sin motivo → error; con motivo → status LOST; recorrido de otro workspace → no encontrado.
- [ ] **Step 2–4.** **Step 5: Commit** — `Motor de etapas: recorridos, movimientos con historial y tareas de etapa`.

---

### Task 5: Avance automático y Captación conectada

**Files:**
- Create: `apps/fotoffice/lib/circuitos/eventos.ts`
- Modify: `apps/fotoffice/app/actions/service-lead.ts`
- Test: `apps/fotoffice/lib/circuitos/eventos.test.ts`, `apps/fotoffice/app/actions/service-lead.test.ts` (nuevo o existente)

**Interfaces:**
- Produces:
  - `notificarEvento(workspaceId, sujeto: Sujeto, evento: Evento, sourceRef: string): Promise<{ movido: boolean }>` — nunca lanza (captura y registra con `console.error` sin datos personales). Para `CONSULTA_RECIBIDA`: `iniciarRecorrido` con ctx Sistema (si no hay circuito, llama antes `asegurarCircuitos`). Para los demás: busca recorrido abierto del sujeto, regla de ese evento en el circuito, `esRetroceso` → no mueve; inserta `FotofficeProcessedEvent` (si choca → ya procesado, no mueve); `mover(... { auto: { evento } })`.
  - `engancharConsultas(workspaceId): Promise<{ enganchadas: number }>` — consultas del workspace sin recorrido VENTA: NEW → primera etapa; CONTACTED/QUOTED/INTERESTED → etapa con ese `leadStatus` en el circuito predeterminado (o la primera); WON/LOST → recorrido creado y cerrado como GANADA/PERDIDA con motivo "Otro" y nota "Importada con su estado anterior"; en lotes de 200; idempotente.
  - `createServiceLead`: después del `create`, `await notificarEvento(branding.workspaceId, { tipo: "CAPTACION", id: creado.id }, "CONSULTA_RECIBIDA", creado.id)`; se quitan los tres `console.log` de slug/branding/workspace (ruling 4). Una falla del motor **no** hace fallar el alta de la consulta.

- [ ] **Step 1: Pruebas que fallan**: evento con regla avanza; hacia atrás no; repetido no mueve dos veces; sin recorrido o sin regla → `{ movido: false }` sin lanzar; `CONSULTA_RECIBIDA` crea el recorrido en la primera etapa; `engancharConsultas` mapea los seis estados y no duplica; `createServiceLead` sigue devolviendo `success: true` aunque `notificarEvento` falle, y no hay `console.log` en el archivo.
- [ ] **Step 2–4.** **Step 5: Commit** — `Motor de etapas: avance automático y consultas nuevas enganchadas al embudo`.

---

### Task 6: Tareas y "Mis tareas"

**Files:**
- Create: `apps/fotoffice/lib/circuitos/tareas.ts`, `apps/fotoffice/app/actions/circuitos.ts`
- Test: `apps/fotoffice/lib/circuitos/tareas.test.ts`, `apps/fotoffice/app/actions/circuitos.test.ts`

**Interfaces:**
- Produces:
  - `tildarTarea(ctx, id, hecha: boolean)`, `crearTareaSuelta(ctx, journeyId, { titulo, dueAt?, assigneeUserId? })` (título 1–200), `borrarTareaSuelta(ctx, id)` (sólo las sin plantilla y sólo `operar`), `tareasDeRecorrido(workspaceId, journeyId)`.
  - `misTareas(ctx, hoy: Date): Promise<{ vencidas: TareaVista[]; hoy: TareaVista[]; proximas: TareaVista[] }>` — asignadas a `ctx.userId`, sin hacer, del workspace; vencidas = `dueAt` antes del inicio de hoy (AR); hoy = dentro de hoy; próximas = hasta 7 días; cada una con `titulo`, `vence`, `sujeto` (vía adaptador: título + href) y `etapa`.
  - Acciones (`"use server"`, sólo funciones async; validan forma → `contextoDeCircuitos` → capacidad → pertenencia): `moverAction({ journeyId, destinoId, nota?, forzar?, esperado? })`, `cerrarAction({ journeyId, salida, lossReasonId?, nota? })`, `tildarTareaAction`, `crearTareaAction`, `borrarTareaAction`, `cambiarVencimientoAction`, `asignarResponsableAction`. Cada una revalida `/captacion` y `/captacion/<id>` (vía adaptador) y `/dashboard`.

- [ ] **Step 1: Pruebas que fallan**: tildar tarea de otro workspace → no encontrado; crear tarea suelta valida el título; `misTareas` agrupa bien en los bordes de medianoche AR; acciones: sin contexto no llaman al motor, forma inválida rechazada, `forzar` sin `configurar` no fuerza.
- [ ] **Step 2–4.** **Step 5: Commit** — `Motor de etapas: tareas con tilde y Mis tareas`.

---

### Task 7: Configuración → Circuitos

**Files:**
- Create: `apps/fotoffice/lib/circuitos/configuracion.ts`, `apps/fotoffice/app/workspace/configuracion/circuitos/{page.tsx,actions.ts,circuitos-lista.tsx,editor-etapas.tsx,motivos.tsx}`
- Modify: el menú de Configuración (mismos tres lugares que usó Configuración → Ficha en 0.3: `components/shell/shell-nav.tsx`, el layout y la página de Configuración)
- Test: `apps/fotoffice/lib/circuitos/configuracion.test.ts`, prueba de fuente de la página

**Interfaces:**
- Produces (todas exigen `configurar` adentro y filtran por workspace):
  - Circuitos: `crearCircuito({ name, kind })` (con una etapa "Nueva" de 0 días), `renombrarCircuito`, `clonarCircuito(id, nuevoNombre)` (copia etapas, tareas modelo y reglas; no copia recorridos), `activarCircuito(id, activo)` (no se puede desactivar el predeterminado), `marcarPredeterminado(id)` (desmarca el anterior de la misma clase en la misma transacción).
  - Etapas: `crearEtapa(circuitId, { name, days, color })` (al final), `editarEtapa(id, { name, days, color, requireTasks, leadStatus })` (`leadStatus` sólo en VENTA y sólo de `ESTADOS_CAPTACION`), `reordenarEtapas(circuitId, idsEnOrden)` (exige exactamente las etapas no archivadas del circuito; reescribe `order` 0..n; **no toca recorridos**), `archivarEtapa(id)` (no si es la única activa), `desarchivarEtapa(id)`, `borrarEtapa(id)` (sólo si ningún recorrido ni paso la usa; si no → "Esta etapa tiene registros: archivala.").
  - Tareas modelo: `guardarTareasModelo(stageId, [{ title, days, required }])` (reemplaza la lista).
  - Reglas: `guardarReglas(stageId, eventos: Evento[])`.
  - Motivos: `crearMotivo`, `renombrarMotivo`, `activarMotivo`, `ordenarMotivos` (no se puede desactivar el último activo).
  - Página: `requireActiveWorkspaceRole` + `configurar` antes de leer; llama `asegurarCircuitos` al abrir; lista de circuitos por clase con su predeterminado; editor de etapas con arrastrar y soltar (HTML5) **y** botones subir/bajar (accesibles); por etapa: días, color, "exige tareas completas", estado de Captación equivalente (sólo VENTA), tareas modelo (una por línea con días y obligatoria), reglas (casillas por evento, con "Todavía no conectado" en los eventos fuera de `EVENTOS_CONECTADOS`); motivos de pérdida.

- [ ] **Step 1: Pruebas que fallan**: reordenar no cambia el `stageId` de ningún recorrido (mock que verifica que no hay escrituras a `fotofficeJourney`); reordenar con ids ajenos o incompletos → error; borrar etapa usada → mensaje exacto; marcar predeterminado desmarca el anterior; clonar copia etapas/tareas/reglas; sin `configurar` → error antes de leer.
- [ ] **Step 2–4.** **Step 5: Commit** — `Motor de etapas: configuración de circuitos, etapas, tareas modelo y motivos`.

---

### Task 8: Captación dentro del panel y "Modo lista"

**Files:**
- Create: `apps/fotoffice/app/(shell)/captacion/page.tsx` (armazón con pestañas Tablero / Lista), `apps/fotoffice/lib/service-leads/listado.tsx`
- Modify: `apps/fotoffice/app/dashboard/service-leads/page.tsx` (→ `redirect("/captacion")`), `apps/fotoffice/components/shell/shell-nav.tsx` (el ítem "Consultas" apunta a `/captacion`), `apps/fotoffice/lib/modules/registry.ts` (`route: "/captacion"`), `apps/fotoffice/lib/listado/registro.ts` (entrada `captacion`, `moduleKey: SERVICE_LEADS_MODULE_KEY`, `ruta: "/captacion"`), `apps/fotoffice/lib/service-leads/access.ts` (exigir también el módulo encendido, como los demás guardas)
- Test: `apps/fotoffice/lib/service-leads/listado.test.ts`

**Interfaces:**
- Produces: `listadoCaptacion: DefinicionListado<FilaCaptacion>` (patrón de `lib/clients/listado.tsx`): búsqueda por nombre, correo, teléfono, tipo de evento; filtros `circuito` (relación: circuitos VENTA del workspace), `etapa` (relación: etapas del circuito elegido o de cualquiera), `resultado` (opción: abierta / GANADA / PERDIDA), `vencidas` (sí/no: `stageDueAt < ahora`), `evento` (período sobre `eventDate`), `alta` (período sobre `createdAt`); columnas: nombre (enlace a la ficha), tipo de evento, fecha del evento, etapa (chip con color) o resultado, días en la etapa, vence, alta; órdenes: alta (desc por defecto), fecha del evento, nombre; sin acciones en lote en esta etapa; exportar con las columnas visibles + correo y teléfono; `traerPorIds` con validación de id y orden. El `where` usa la relación inversa del recorrido (`FotofficeJourney` con `subjectType: "CAPTACION"`, `subjectId`): como no hay FK entre `ServiceSalesLead` y `FotofficeJourney`, resolver los filtros de circuito/etapa/resultado/vencidas con una subconsulta de ids (`journey.findMany({ select: { subjectId } })` acotada al workspace) — documentar el costo y limitarla por workspace.
- Página `/captacion`: guarda `requireServiceLeadsStaff`; `asegurarCircuitos` + `engancharConsultas` al abrir; `?vista=lista` muestra `<Listado def={listadoCaptacion} …>`; sin `vista` muestra el tablero (Tarea 9).

- [ ] **Step 1: Pruebas que fallan**: `where` siempre con `workspaceId`; filtros de circuito/etapa/resultado/vencidas traducidos a la subconsulta acotada; claves de filtro no reservadas; `/dashboard/service-leads` redirige (prueba de fuente); el guarda exige el módulo.
- [ ] **Step 2–4.** **Step 5: Commit** — `Captación pasa al panel con su lista estándar`.

---

### Task 9: El tablero

**Files:**
- Create: `apps/fotoffice/components/circuitos/{tablero.tsx,tarjeta.tsx,mover-a.tsx,dialogo-perdida.tsx}`, `apps/fotoffice/lib/circuitos/tablero.ts`
- Modify: `apps/fotoffice/app/(shell)/captacion/page.tsx`
- Test: `apps/fotoffice/lib/circuitos/tablero.test.ts`, prueba de fuente de componentes

**Interfaces:**
- Produces:
  - `cargarTablero(ctx, circuitoId | null, filtros: { responsable?: number; soloVencidas?: boolean }, ahora: Date): Promise<{ circuito; circuitos; columnas: { etapa; tarjetas: TarjetaVista[] }[]; responsables }>` — circuito VENTA elegido o el predeterminado; etapas no archivadas en orden; recorridos abiertos de ese circuito (tope 300 por columna, con "y N más" → enlace al Modo lista filtrado); `TarjetaVista = { journeyId, sujeto: { titulo, subtitulo, href }, diasEnEtapa, vencida, tareas: { hechas, total }, enteredStageAt }`.
  - `<Tablero>` (client): columnas con scroll horizontal; arrastrar tarjetas (HTML5 `draggable`, `onDragOver`, `onDrop`) a otra columna → `moverAction` con `esperado = enteredStageAt`; zonas "Ganada" y "Perdida" a la derecha (Perdida abre `<DialogoPerdida>` con motivos activos y nota); errores en línea ("Esta consulta cambió mientras tanto" → refresca); si la respuesta es "Faltan tareas obligatorias", muestra la lista y, si el rol puede, un botón "Pasar igual" que reintenta con `forzar: true`. En pantallas < 768 px no hay arrastre: cada tarjeta tiene "Mover a…" (`<MoverA>`, un `<select>` con etapas y salidas) que también está siempre disponible con teclado.
  - Barra: selector de circuito, filtro de responsable, casilla "Sólo vencidas", enlace "Modo lista".

- [ ] **Step 1: Pruebas que fallan**: `cargarTablero` acota por workspace y circuito, respeta el orden de etapas, calcula días y vencidas en hora AR, aplica filtros y el tope por columna; prueba de fuente: la tarjeta tiene `draggable` y un control "Mover a…", el tablero no importa `@repo/db`.
- [ ] **Step 2–4:** implementar; tsc y build.
- [ ] **Step 5: Commit** — `Captación: tablero por etapas con arrastrar y soltar`.

---

### Task 10: Ficha de la consulta

**Files:**
- Create: `apps/fotoffice/app/(shell)/captacion/[id]/page.tsx`, `apps/fotoffice/components/circuitos/{recorrido.tsx,tareas.tsx,proyeccion.tsx}`
- Test: prueba de fuente + pruebas de helpers puros que se extraigan

**Interfaces:**
- Produces: página con guarda `requireServiceLeadsStaff` → consulta del workspace (si no, `notFound()`) → recorrido abierto o el último cerrado:
  - Datos de la consulta (nombre, correo, teléfono con WhatsApp, tipo/subtipo/fecha/lugar del evento, mensaje, formulario de origen, alta).
  - Recorrido: barra de etapas del circuito (la actual resaltada; clic en otra = mover, con nota opcional), responsable (selector), vencimiento de la etapa (editable con nota), botones "Ganada" / "Perdida" (con motivo).
  - Tareas de la etapa actual y pendientes de etapas anteriores: tildar, agregar suelta, borrar suelta.
  - Proyección (`proyeccion`): tabla de etapas restantes con inicio y fin estimados y total; aviso "Los plazos se calcularon desde hoy porque la etapa está vencida." cuando `desdeHoy`.
  - Historial: pasos en orden inverso (fecha AR, quién — "Sistema" si auto, con el evento —, de → a, nota, "avanzó con tareas pendientes" si corresponde).

- [ ] **Step 1: Prueba de fuente que falla**: el guarda corre antes de leer; `notFound` con id ajeno; componentes cliente sin `@repo/db`.
- [ ] **Step 2–4.** **Step 5: Commit** — `Captación: ficha de la consulta con recorrido, tareas, proyección e historial`.

---

### Task 11: "Mis tareas" en el inicio e informe por circuito

**Files:**
- Create: `apps/fotoffice/components/circuitos/{mis-tareas.tsx,informe.tsx}`, `apps/fotoffice/lib/circuitos/informe.ts`
- Modify: `apps/fotoffice/app/(shell)/dashboard/page.tsx`, `apps/fotoffice/app/(shell)/captacion/page.tsx` (pestaña "Informe")
- Test: `apps/fotoffice/lib/circuitos/informe.test.ts`

**Interfaces:**
- Produces:
  - Inicio: bloque "Mis tareas" (vencidas / hoy / próximos 7 días) con `misTareas`, tilde en línea (`tildarTareaAction`) y enlace al registro; sólo si el usuario tiene `operar` y el módulo de Captación está encendido; si no hay tareas, no se muestra.
  - `informeCircuito(workspaceId, circuitId, desde: Date, hasta: Date): Promise<{ etapas: { id; nombre; diasPromedio: number | null; pasaron: number; perdidasDesdeAca: number }[]; ganadas: number; perdidas: number; motivos: { nombre; cantidad }[] }>` — días promedio = promedio de (salida − entrada) de los pasos que salieron de esa etapa en el período; perdidas desde acá = cierres PERDIDA/CANCELADO cuyo `fromStageId` es la etapa.
  - Pestaña "Informe" en `/captacion?vista=informe` con período (atajos de `lib/listado/periodos.ts`) y circuito.

- [ ] **Step 1: Pruebas que fallan**: promedio correcto con pasos sintéticos; etapas sin pasos → `null`; aislamiento por workspace; período en hora AR.
- [ ] **Step 2–4.** **Step 5: Commit** — `Motor de etapas: Mis tareas en el inicio e informe por circuito`.

---

### Task 12: Documento de migración y verificación completa

**Files:**
- Create: `packages/db/docs/MIGRACION-MOTOR-DE-ETAPAS.md`

- [ ] **Step 1:** documento con la estructura de `MIGRACION-FICHA-ESTANDAR.md`: qué hace (nueve tablas; sin datos: las semillas y el enganche corren en código al abrir Captación o Configuración → Circuitos); **en negrita**: Captación, su ficha, el inicio ("Mis tareas") y el alta de consultas usan estas tablas, así que el código antes que el SQL rompe esas pantallas (el alta de consultas no se rompe porque el motor nunca hace fallar el alta, pero la consulta queda sin recorrido hasta abrir el tablero); orden (0.1, 0.2, 0.3 fusionadas → rebasar → SQL staging + `next dev` → SQL FOTOFFICE `divine-hall-10689679`/`development` → fusionar); checksum `shasum -a 256`; verificación (tablas vacías tras el SQL; después de abrir Captación en DNX: 21 circuitos, 6 motivos, un recorrido por consulta); vuelta atrás (código primero, luego `DROP TABLE` de las nueve y borrar la fila de `_prisma_migrations`; `ServiceSalesLead.status` nunca dejó de actualizarse, así que Captación vieja sigue funcionando).
- [ ] **Step 2: Verificación completa**

```bash
pnpm --filter fotoffice exec vitest run
NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit
NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice build
for app in compramelafoto clickaton fotorank; do NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter $app exec tsc --noEmit; done
```

- [ ] **Step 3:** prueba manual para Daniel en el PR: abrir Captación en DNX (se cargan los circuitos), arrastrar una consulta, tildar tareas, perder una con motivo, ver la ficha con proyección e historial, reordenar etapas en Configuración y ver que ninguna consulta cambió de etapa, "Mis tareas" en el inicio, y una consulta nueva desde el formulario público entra sola en la primera etapa.
- [ ] **Step 4: Commit** — `Motor de etapas: documento de migración`.

---

## Autorrevisión del plan

- **Cobertura del spec:** §3.1 → T7; §3.2 → T3; §3.3 → T8, T9; §3.4 → T4, T6, T11; §3.5 → T2, T4, T10, T11; §3.6 → T5; §3.7 → T5, T8; §4.1 → T1; §4.2 → T2, T4, T5; §4.3 → T4, T6, T7; §5 → T4 (concurrencia, otro circuito, archivada), T7 (borrar), T5 (eventos); §6 → pruebas de cada tarea; §7 → tablero de avance después del merge; §8 → T12. Desvíos del spec registrados como rulings 1–3.
- **Nombres consistentes:** `Clase`, `SALIDAS`, `Evento`, `EVENTOS_CONECTADOS`, `TipoSujeto`, `vencimientoDeEtapa`, `vencimientoDeTarea`, `estaVencida`, `proyeccion`, `esRetroceso`, `validarMovimiento`, `CIRCUITOS_DNX`, `CIRCUITO_MINIMO`, `MOTIVOS_INICIALES`, `asegurarCircuitos`, `Sujeto`, `Adaptador`, `adaptadorDe`, `CtxCircuitos`, `contextoDeCircuitos`, `iniciarRecorrido`, `mover`, `cerrar`, `cambiarVencimiento`, `asignarResponsable`, `notificarEvento`, `engancharConsultas`, `tildarTarea`, `crearTareaSuelta`, `misTareas`, `listadoCaptacion`, `cargarTablero`, `informeCircuito`.
- **Riesgo conocido:** los filtros por etapa/circuito del Modo lista usan una subconsulta de ids por workspace (no hay FK); con miles de consultas por workspace es aceptable, documentado en T8.
