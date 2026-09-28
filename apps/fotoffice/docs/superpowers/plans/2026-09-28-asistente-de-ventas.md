# Asistente de ventas — Etapa 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un módulo `sales-assistant` de FOTOFFICE que lee el embudo de Alboom, le pide a Claude una acción y un mensaje por oportunidad, y muestra una bandeja diaria con botón de WhatsApp.

**Architecture:** Lógica pura con tests en `lib/sales-assistant/` (qué analizar, qué cerrar, orden, teléfono, contexto para Claude, mapeo de Alboom). Un cliente HTTP de Alboom que usa su API interna con token Bearer. Un orquestador `sincronizarWorkspace` que llama un cron diario y un botón. Cuatro tablas `FotofficeSales*` y la credencial en `WorkspaceIntegration`. Pantallas bajo `app/(shell)/ventas`.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions; leer `node_modules/next/dist/docs/` antes de escribir código de Next), Prisma (`@repo/db`), Vitest, zod 3, `@anthropic-ai/sdk` (nuevo, sólo en `apps/fotoffice`).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-28-asistente-de-ventas-design.md`

## Global Constraints

- Todo el código vive en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/asistente-ventas`, rama `feat/fotoffice-asistente-ventas`. Nunca trabajar en el árbol principal de `dnx-suite`.
- Clave del módulo: `sales-assistant`. Ruta: `/ventas`. Etiqueta: "Asistente de ventas".
- Integración: `provider: "ALBOOM"`, `integrationKey: "alboom-crm"`.
- Modelos Prisma con prefijo `FotofficeSales`. Estados como `String`, nunca enum. Toda consulta lleva `workspaceId`.
- Modelo de IA: `process.env.FOTOFFICE_SALES_AI_MODEL ?? "claude-opus-5"`. Sin `ANTHROPIC_API_KEY` el módulo funciona sin sugerencias.
- A Claude nunca se le mandan teléfono, email ni apellido.
- Nada escribe en Alboom. Sólo `POST /api/users/login` y lecturas.
- Nada se envía solo: WhatsApp sólo por enlace `wa.me` que abre el usuario.
- Textos de pantalla en español rioplatense, con voseo.
- Tests: Vitest, al lado del archivo (`foo.ts` → `foo.test.ts`). Correr con `pnpm --filter fotoffice test`.
- Comentarios en español, con la densidad y el tono de `lib/coverages/*`.
- Commits pequeños por tarea, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` siempre con rutas explícitas.

## Datos que ya se conocen de Alboom (verificados el 2026-09-28)

- Base: `https://{subdominio}.alboomcrm.com/api`.
- Login: `POST /api/users/login`, con cuerpo JSON `{ email, password, type: "simple", login_time, keepme: true }`.
  - `login_time` es la hora local en ISO sin la `Z` (`YYYY-MM-DDTHH:mm:ss.sss`).
  - Si sale bien, responde `{ status: "ok", token, data: {...} }`. Cualquier otro `status` es credencial rechazada.
- Autorización de cada pedido: encabezado `Authorization: Bearer {token}`.
- Oportunidades: `POST /api/leads/paginate`, con cuerpo `{ pageNumber, pageSize, sortBy: "id", sortDir: "DESC", pipeline: "all", stage: "all", searchTerm: "" }`.
  - Responde `{ rows: AlboomLeadRow[], count }`.
  - `status_id` `"421"` = Abierto. Se filtra también del lado nuestro.
- Actividades: `POST /api/activities/paginate` con `{ type: "leads", id: leadId, offset: 0, count: 50, searchTerm: "" }`. Responde `{ rows: [{ text, created }] }`.
- Correos: `GET /api/mails/leads/{leadId}/0/50`. Responde `{ rows: [{ subject, body, created, message_type, to_mail }] }`; `body` es HTML.
- Embudos: `GET /api/stages/list?type=lead_stage`. Responde `{ stage_list: [{id, name}], stages: { [pipelineId]: [{id, stage, name}] } }`.

---

## File Structure

```
apps/fotoffice/
  lib/sales-assistant/
    constants.ts              clave, acciones, estados, resultados, zona horaria, límites
    opportunity.ts            tipo OportunidadVenta y Movimiento
    phone.ts (+test)          normalizarTelefonoArgentino
    needs-analysis.ts (+test) necesitaAnalisis
    cleanup.ts (+test)        esCandidataACerrar
    priority.ts (+test)       ordenarBandeja
    prompt.ts (+test)         SYSTEM_PROMPT, armarContexto, SugerenciaSchema
    analyzer.ts (+test)       analizarOportunidad (única llamada a Claude)
    alboom/types.ts           tipos del JSON de Alboom
    alboom/mapper.ts (+test)  mapearOportunidad, movimientosDesde
    alboom/fixtures/*.json    JSON reales anonimizados
    alboom/client.ts (+test)  crearClienteAlboom (login, leads, detalle, embudos)
    alboom/credentials.ts     guardar, leer y borrar credencial
    repository.ts             acceso a Prisma
    sync.ts (+test)           sincronizarWorkspace
    access.ts                 requireSalesAssistantManager
    aislamiento.test.ts       barrido de workspaceId
  lib/integrations/store.ts         + saveSecretIntegration, readIntegrationSecret
  lib/integrations/registry.ts      + entrada alboom-crm, provider "ALBOOM"
  lib/modules/registry.ts           + módulo sales-assistant
  lib/modules/submodules.ts         + VENTAS
  components/shell/shell-nav.tsx    + sección
  components/shell/shell-sidebar.tsx + prop
  app/(shell)/layout.tsx            + flag
  app/(shell)/ventas/page.tsx       bandeja
  app/(shell)/ventas/[id]/page.tsx  detalle
  app/(shell)/ventas/configuracion/page.tsx
  app/(shell)/ventas/actions.ts
  app/(shell)/ventas/suggestion-card.tsx   (client component)
  app/api/cron/ventas/route.ts
  vercel.json                       + cron
packages/db/prisma/schema.prisma    + 4 modelos
packages/db/prisma/migrations/20260928120000_fotoffice_sales_assistant/migration.sql
```

---

### Task 1: Base del módulo — constantes, tipo de oportunidad, dependencia, registro

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/constants.ts`
- Create: `apps/fotoffice/lib/sales-assistant/opportunity.ts`
- Modify: `apps/fotoffice/lib/modules/registry.ts` (agregar la entrada después de `COVERAGES_MODULE_KEY`)
- Modify: `apps/fotoffice/package.json` (dependencia)

**Interfaces:**
- Produces: `SALES_ASSISTANT_MODULE_KEY = "sales-assistant"`, `ALBOOM_INTEGRATION_KEY = "alboom-crm"`, los tipos `AccionVenta`, `PrioridadVenta`, `EstadoSugerencia`, `ResultadoSeguimiento` y `TipoSeguimiento`, las listas `ACCIONES`, `PRIORIDADES` y `RESULTADOS`, y las constantes `SALES_TIME_ZONE`, `UMBRALES_EVENTO_DIAS`, `ANALISIS_EN_PARALELO`, `MAX_ANALISIS_POR_CORRIDA`, `MIN_MINUTOS_ENTRE_CORRIDAS` y `DEFAULT_WAIT_DAYS`/`DEFAULT_STALE_DAYS`. También `OportunidadVenta` y `Movimiento`.

- [ ] **Step 1: Crear `constants.ts`**

```ts
/**
 * Constantes del Asistente de ventas.
 *
 * Ver docs/superpowers/specs/2026-09-28-asistente-de-ventas-design.md
 */
export const SALES_ASSISTANT_MODULE_KEY = "sales-assistant";
export const ALBOOM_INTEGRATION_KEY = "alboom-crm";
export const ALBOOM_PROVIDER = "ALBOOM";

export const SALES_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const ACCIONES = [
  "ESCRIBIR",
  "PEDIR_SENA",
  "COORDINAR_ENTREVISTA",
  "ESPERAR",
  "CERRAR_PERDIDA",
  "REVISAR_A_MANO",
] as const;
export type AccionVenta = (typeof ACCIONES)[number];

export const ETIQUETA_ACCION: Record<AccionVenta, string> = {
  ESCRIBIR: "Escribir",
  PEDIR_SENA: "Pedir seña",
  COORDINAR_ENTREVISTA: "Coordinar entrevista",
  ESPERAR: "Esperar",
  CERRAR_PERDIDA: "Cerrar como perdida",
  REVISAR_A_MANO: "Revisar a mano",
};

/** Acciones que llevan un mensaje para mandar hoy. */
export const ACCIONES_CON_MENSAJE: readonly AccionVenta[] = [
  "ESCRIBIR",
  "PEDIR_SENA",
  "COORDINAR_ENTREVISTA",
];

export const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"] as const;
export type PrioridadVenta = (typeof PRIORIDADES)[number];

export type EstadoSugerencia =
  | "PENDIENTE"
  | "ENVIADA"
  | "POSPUESTA"
  | "DESCARTADA"
  | "REEMPLAZADA";

export const RESULTADOS = [
  "NO_CONTESTO",
  "INTERESADO",
  "PIDIO_DESCUENTO",
  "LO_PIENSA",
  "NO_VA",
] as const;
export type ResultadoSeguimiento = (typeof RESULTADOS)[number];

export const ETIQUETA_RESULTADO: Record<ResultadoSeguimiento, string> = {
  NO_CONTESTO: "No contestó",
  INTERESADO: "Le interesa",
  PIDIO_DESCUENTO: "Pidió descuento",
  LO_PIENSA: "Lo está pensando",
  NO_VA: "No va",
};

export type TipoSeguimiento = "MENSAJE_ENVIADO" | "RESULTADO" | "NOTA";

export type EstadoSync = "OK" | "ERROR_LOGIN" | "ERROR_ALBOOM" | "PARCIAL";

/** Cuando el evento cruza uno de estos umbrales (días que faltan), se vuelve a analizar. */
export const UMBRALES_EVENTO_DIAS = [60, 30, 14] as const;

export const DEFAULT_WAIT_DAYS = 3;
export const DEFAULT_STALE_DAYS = 120;

/** Análisis simultáneos contra Claude. */
export const ANALISIS_EN_PARALELO = 4;
/** Techo por corrida: la función de Vercel dura 300 s. Lo que sobra queda para la próxima. */
export const MAX_ANALISIS_POR_CORRIDA = 40;
/** "Actualizar ahora" no puede correr más de una vez cada tanto por workspace. */
export const MIN_MINUTOS_ENTRE_CORRIDAS = 10;
```

- [ ] **Step 2: Crear `opportunity.ts`**

```ts
/**
 * La oportunidad tal como la entiende el analizador. No sabe de Alboom: el día que existan las
 * consultas propias de FOTOFFICE, son otra fuente que produce este mismo tipo.
 */
export type Movimiento = {
  fecha: Date;
  tipo: "ETAPA" | "CORREO" | "NOTA" | "OTRO";
  texto: string;
};

export type OportunidadVenta = {
  fuente: "ALBOOM";
  idExterno: string;
  titulo: string;
  tipoEvento: string | null;
  nombreCliente: string;
  apellidoCliente: string | null;
  telefono: string | null;
  email: string | null;
  fechaEvento: Date | null;
  lugar: string | null;
  ciudad: string | null;
  invitados: string | null;
  origen: string | null;
  descripcionCliente: string | null;
  embudo: string;
  etapa: string;
  etapaOrden: number;
  etapasTotal: number;
  abierta: boolean;
  creadaEn: Date;
  presupuestoEnviadoEn: Date | null;
  modificadaEn: Date;
  movimientos: Movimiento[];
};
```

- [ ] **Step 3: Registrar el módulo en `lib/modules/registry.ts`**

Agregar el import `import { SALES_ASSISTANT_MODULE_KEY } from "@/lib/sales-assistant/constants";` y esta entrada inmediatamente después de la de `COVERAGES_MODULE_KEY`:

```ts
  {
    key: SALES_ASSISTANT_MODULE_KEY,
    label: "Asistente de ventas",
    description:
      "Lee tu embudo de ventas, te dice qué hacer con cada oportunidad y te deja el mensaje de WhatsApp escrito.",
    category: "GENERAL",
    order: 67,
    route: "/ventas",
    status: "AVAILABLE",
  },
```

- [ ] **Step 4: Agregar la dependencia**

Run (desde la raíz del worktree): `pnpm --filter fotoffice add @anthropic-ai/sdk`
Después verificar que `apps/fotoffice/package.json` la tenga y que `pnpm-lock.yaml` cambió.

- [ ] **Step 5: Verificar que compila y que los tests existentes pasan**

Run: `pnpm --filter fotoffice exec tsc --noEmit -p . 2>&1 | tail -5` y `pnpm --filter fotoffice test 2>&1 | tail -5`
Expected: sin errores nuevos. Si ya había errores de tipos antes de este cambio, anotarlos y comparar.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/constants.ts apps/fotoffice/lib/sales-assistant/opportunity.ts apps/fotoffice/lib/modules/registry.ts apps/fotoffice/package.json pnpm-lock.yaml
git commit -m "Base del módulo Asistente de ventas en FOTOFFICE"
```

---

### Task 2: Tablas y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (agregar los modelos al final del bloque de FOTOFFICE, y los campos de relación en `model Workspace`, junto a `coverageSettings`)
- Create: `packages/db/prisma/migrations/20260928120000_fotoffice_sales_assistant/migration.sql`

**Interfaces:**
- Produces: los delegados Prisma `prisma.fotofficeSalesSettings`, `prisma.fotofficeSalesOpportunity`, `prisma.fotofficeSalesSuggestion` y `prisma.fotofficeSalesFollowUp`, con los campos de abajo.

- [ ] **Step 1: Agregar los modelos a `schema.prisma`**

```prisma
/// ─────────────────────────────────────────────────────────────────────────────
/// ASISTENTE DE VENTAS
/// Ver apps/fotoffice/docs/superpowers/specs/2026-09-28-asistente-de-ventas-design.md
/// ─────────────────────────────────────────────────────────────────────────────

model FotofficeSalesSettings {
  id                String    @id @default(cuid())
  workspaceId       String    @unique
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  /// Nombres de embudo de Alboom incluidos. Vacío = ninguno elegido todavía.
  pipelinesIncluded String[]  @default([])
  signature         String?
  voiceNotes        String?
  waitDays          Int       @default(3)
  staleDays         Int       @default(120)
  lastSyncAt        DateTime?
  /// OK | ERROR_LOGIN | ERROR_ALBOOM | PARCIAL
  lastSyncStatus    String?
  lastSyncMessage   String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

model FotofficeSalesOpportunity {
  id                 String    @id @default(cuid())
  workspaceId        String
  workspace          Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  /// ALBOOM
  source             String
  externalId         String
  customerName       String
  phone              String?
  eventType          String?
  eventDate          DateTime?
  pipelineName       String
  stageName          String
  stageOrder         Int
  quoteSentAt        DateTime?
  externalCreatedAt  DateTime
  externalModifiedAt DateTime
  /// ABIERTA | CERRADA
  externalStatus     String
  /// La OportunidadVenta completa, serializada.
  snapshot           Json
  archivedAt         DateTime?
  syncedAt           DateTime
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  suggestions FotofficeSalesSuggestion[]
  followUps   FotofficeSalesFollowUp[]

  @@unique([workspaceId, source, externalId])
  @@index([workspaceId, externalStatus])
}

model FotofficeSalesSuggestion {
  id            String                    @id @default(cuid())
  workspaceId   String
  opportunityId String
  opportunity   FotofficeSalesOpportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  action        String
  priority      String
  reason        String
  message       String?
  editedMessage String?
  waitUntil     DateTime?
  /// `modificadaEn` de la oportunidad cuando se analizó: si Alboom la cambia después, se re-analiza.
  opportunityModifiedAt DateTime
  /// PENDIENTE | ENVIADA | POSPUESTA | DESCARTADA | REEMPLAZADA
  status        String                    @default("PENDIENTE")
  model         String?
  inputTokens   Int?
  outputTokens  Int?
  createdAt     DateTime                  @default(now())
  resolvedAt    DateTime?

  followUps FotofficeSalesFollowUp[]

  @@index([workspaceId, status])
  @@index([opportunityId, createdAt])
}

model FotofficeSalesFollowUp {
  id            String                    @id @default(cuid())
  workspaceId   String
  opportunityId String
  opportunity   FotofficeSalesOpportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  suggestionId  String?
  suggestion    FotofficeSalesSuggestion? @relation(fields: [suggestionId], references: [id], onDelete: SetNull)
  /// MENSAJE_ENVIADO | RESULTADO | NOTA
  kind          String
  /// NO_CONTESTO | INTERESADO | PIDIO_DESCUENTO | LO_PIENSA | NO_VA
  outcome       String?
  text          String?
  actorUserId   Int?
  actorLabel    String
  createdAt     DateTime                  @default(now())

  @@index([opportunityId, createdAt])
  @@index([workspaceId])
}
```

En `model Workspace` agregar, junto a `coverageSettings CoverageSettings?`:

```prisma
  salesSettings               FotofficeSalesSettings?
  salesOpportunities          FotofficeSalesOpportunity[]
```

- [ ] **Step 2: Validar y generar**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate`
Expected: "The schema ... is valid" y el cliente generado sin errores.

- [ ] **Step 3: Generar el SQL y guardarlo como migración**

Run: `pnpm --filter @repo/db exec prisma migrate diff --from-schema-datamodel <(git show origin/main:packages/db/prisma/schema.prisma) --to-schema-datamodel prisma/schema.prisma --script`

Si la sustitución de proceso no funciona con pnpm, guardar primero el schema viejo en el scratchpad y pasar esa ruta. Revisar que la salida tenga **sólo** `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` de las cuatro tablas nuevas; si aparece cualquier otra cosa, es deriva del schema y NO va en esta migración. Guardarlo en `packages/db/prisma/migrations/20260928120000_fotoffice_sales_assistant/migration.sql` con esta cabecera:

```sql
-- Asistente de ventas de FOTOFFICE (etapa 1). Aditiva: cuatro tablas nuevas, nada existente cambia.
-- Se aplica a mano en las cinco bases y se registra con `prisma migrate resolve --applied`.
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260928120000_fotoffice_sales_assistant/migration.sql
git commit -m "Tablas del Asistente de ventas"
```

---

### Task 3: Normalizar teléfonos argentinos

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/phone.ts`
- Test: `apps/fotoffice/lib/sales-assistant/phone.test.ts`

**Interfaces:**
- Consumes: `buildWhatsappUrl(raw: string, message?: string): string | null` de `@/lib/contact/whatsapp`.
- Produces: `normalizarTelefonoArgentino(raw: string | null | undefined): string | null` (sólo dígitos, con `549`) y `enlaceWhatsapp(raw: string | null | undefined, mensaje: string): string | null`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { enlaceWhatsapp, normalizarTelefonoArgentino } from "./phone";

describe("normalizarTelefonoArgentino", () => {
  it("completa un celular de 10 dígitos con 549", () => {
    expect(normalizarTelefonoArgentino("3412717813")).toBe("5493412717813");
  });
  it("respeta un número que ya trae +54 9, con espacios y guiones", () => {
    expect(normalizarTelefonoArgentino("+54 9 3416 91-0072")).toBe("5493416910072");
  });
  it("agrega el 9 a un 54 sin 9", () => {
    expect(normalizarTelefonoArgentino("543413748314")).toBe("5493413748314");
  });
  it("saca el 0 del área y el 15 del celular", () => {
    expect(normalizarTelefonoArgentino("0341 15 2717813")).toBe("5493412717813");
  });
  it("rechaza un número corto", () => {
    expect(normalizarTelefonoArgentino("341322858")).toBeNull();
  });
  it("rechaza vacío y null", () => {
    expect(normalizarTelefonoArgentino("")).toBeNull();
    expect(normalizarTelefonoArgentino(null)).toBeNull();
  });
});

describe("enlaceWhatsapp", () => {
  it("arma wa.me con el texto codificado", () => {
    expect(enlaceWhatsapp("3412717813", "Hola Sabri! ¿Cómo va?")).toBe(
      "https://wa.me/5493412717813?text=Hola%20Sabri!%20%C2%BFC%C3%B3mo%20va%3F",
    );
  });
  it("devuelve null si el número no sirve", () => {
    expect(enlaceWhatsapp("341322858", "Hola")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/phone.test.ts`
Expected: FAIL, "Cannot find module './phone'".

- [ ] **Step 3: Implementar**

```ts
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";

/**
 * Teléfonos de Alboom a formato WhatsApp.
 *
 * `lib/contact/whatsapp.ts` no adivina el país a propósito: un número suelto del padrón de una
 * institución puede ser de cualquier lado. Acá el caso es otro: el formulario de Alboom de un
 * fotógrafo argentino pide el celular sin código de país, y el 95 % llega como `341xxxxxxx`.
 * Por eso ESTE módulo sí completa con 54 9, y sólo cuando el resto tiene forma de celular
 * argentino (10 dígitos después de sacar el 0 y el 15).
 *
 * Módulo PURO.
 */
export function normalizarTelefonoArgentino(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("549") && d.length === 13) return d;
  if (d.startsWith("54") && !d.startsWith("549") && d.length === 12) return `549${d.slice(2)}`;

  // Local: sacar el 0 de larga distancia y el 15 de celular.
  if (d.startsWith("0")) d = d.slice(1);
  const con15 = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (con15 && con15[1].length + con15[2].length === 10) d = `${con15[1]}${con15[2]}`;

  if (d.length === 10) return `549${d}`;
  return null;
}

export function enlaceWhatsapp(raw: string | null | undefined, mensaje: string): string | null {
  const numero = normalizarTelefonoArgentino(raw);
  if (!numero) return null;
  return buildWhatsappUrl(`+${numero}`, mensaje);
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/phone.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/phone.ts apps/fotoffice/lib/sales-assistant/phone.test.ts
git commit -m "Teléfonos de Alboom a enlaces de WhatsApp"
```

---

### Task 4: Reglas puras — qué analizar, qué cerrar, en qué orden

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/needs-analysis.ts`, `cleanup.ts`, `priority.ts`
- Test: `needs-analysis.test.ts`, `cleanup.test.ts`, `priority.test.ts` (misma carpeta)

**Interfaces:**
- Consumes: `OportunidadVenta` (Task 1), constantes (Task 1).
- Produces:
  - `type UltimaSugerencia = { creadaEn: Date; accion: AccionVenta; estado: EstadoSugerencia; esperarHasta: Date | null; oportunidadModificadaEn: Date }`
  - `necesitaAnalisis(input: { oportunidad: OportunidadVenta; ultima: UltimaSugerencia | null; ultimoSeguimientoEn: Date | null; archivada: boolean; forzar: boolean; hoy: Date }): { analizar: boolean; motivo: string }`
  - `esCandidataACerrar(input: { oportunidad: OportunidadVenta; staleDays: number; hoy: Date }): { cerrar: boolean; motivo: string | null }`
  - `type TarjetaOrdenable = { accionHoy: boolean; prioridad: PrioridadVenta | null; fechaEvento: Date | null }` y `ordenarBandeja<T extends TarjetaOrdenable>(tarjetas: T[]): T[]`
  - `diasEntre(desde: Date, hasta: Date): number`, exportada desde `needs-analysis.ts` (días calendario enteros, redondeando hacia abajo)

- [ ] **Step 1: Escribir los tests que fallan**

`needs-analysis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { OportunidadVenta } from "./opportunity";
import { necesitaAnalisis, type UltimaSugerencia } from "./needs-analysis";

const HOY = new Date("2026-09-28T10:00:00Z");
function op(p: Partial<OportunidadVenta> = {}): OportunidadVenta {
  return {
    fuente: "ALBOOM", idExterno: "1", titulo: "XV", tipoEvento: "XV", nombreCliente: "Sabrina",
    apellidoCliente: "B", telefono: null, email: null,
    fechaEvento: new Date("2027-01-01T00:00:00Z"), lugar: null, ciudad: null, invitados: null,
    origen: null, descripcionCliente: null, embudo: "E", etapa: "Recepción", etapaOrden: 1,
    etapasTotal: 6, abierta: true, creadaEn: new Date("2026-09-20T00:00:00Z"),
    presupuestoEnviadoEn: null, modificadaEn: new Date("2026-09-20T00:00:00Z"), movimientos: [], ...p,
  };
}
function ultima(p: Partial<UltimaSugerencia> = {}): UltimaSugerencia {
  return {
    creadaEn: new Date("2026-09-27T10:00:00Z"), accion: "ESCRIBIR", estado: "PENDIENTE",
    esperarHasta: null, oportunidadModificadaEn: new Date("2026-09-20T00:00:00Z"), ...p,
  };
}
const base = { ultimoSeguimientoEn: null, archivada: false, forzar: false, hoy: HOY };

describe("necesitaAnalisis", () => {
  it("analiza una oportunidad nunca analizada", () => {
    expect(necesitaAnalisis({ ...base, oportunidad: op(), ultima: null }).analizar).toBe(true);
  });
  it("no analiza si nada cambió", () => {
    expect(necesitaAnalisis({ ...base, oportunidad: op(), ultima: ultima() }).analizar).toBe(false);
  });
  it("analiza si cambió en Alboom después del último análisis", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op({ modificadaEn: new Date("2026-09-28T08:00:00Z") }), ultima: ultima(),
    });
    expect(r).toEqual({ analizar: true, motivo: "Cambió en el CRM" });
  });
  it("analiza si hay un seguimiento posterior al último análisis", () => {
    const r = necesitaAnalisis({
      ...base, ultimoSeguimientoEn: new Date("2026-09-27T20:00:00Z"), oportunidad: op(), ultima: ultima(),
    });
    expect(r.analizar).toBe(true);
  });
  it("analiza cuando venció la espera", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op(),
      ultima: ultima({ accion: "ESPERAR", esperarHasta: new Date("2026-09-28T00:00:00Z") }),
    });
    expect(r).toEqual({ analizar: true, motivo: "Venció la espera" });
  });
  it("analiza cuando una sugerencia enviada lleva los días de espera sin novedad", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op(),
      ultima: ultima({ estado: "ENVIADA", creadaEn: new Date("2026-09-24T10:00:00Z") }),
    });
    expect(r.analizar).toBe(true);
  });
  it("analiza cuando el evento cruzó el umbral de 30 días", () => {
    const r = necesitaAnalisis({
      ...base, oportunidad: op({ fechaEvento: new Date("2026-10-27T00:00:00Z") }),
      ultima: ultima({ creadaEn: new Date("2026-09-26T10:00:00Z") }),
    });
    expect(r).toEqual({ analizar: true, motivo: "El evento está a menos de 30 días" });
  });
  it("nunca analiza una archivada ni una cerrada", () => {
    expect(necesitaAnalisis({ ...base, archivada: true, oportunidad: op(), ultima: null }).analizar).toBe(false);
    expect(necesitaAnalisis({ ...base, oportunidad: op({ abierta: false }), ultima: null }).analizar).toBe(false);
  });
  it("forzar gana a todo menos a cerrada", () => {
    expect(necesitaAnalisis({ ...base, forzar: true, oportunidad: op(), ultima: ultima() }).analizar).toBe(true);
  });
});
```

`cleanup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { esCandidataACerrar } from "./cleanup";
import type { OportunidadVenta } from "./opportunity";

const HOY = new Date("2026-09-28T10:00:00Z");
const op = (p: Partial<OportunidadVenta>): OportunidadVenta =>
  ({ fechaEvento: null, modificadaEn: HOY, movimientos: [], abierta: true, ...p }) as OportunidadVenta;

describe("esCandidataACerrar", () => {
  it("propone cerrar si el evento ya pasó", () => {
    const r = esCandidataACerrar({ oportunidad: op({ fechaEvento: new Date("2026-09-26T00:00:00Z") }), staleDays: 120, hoy: HOY });
    expect(r).toEqual({ cerrar: true, motivo: "La fecha del evento ya pasó" });
  });
  it("no la cierra si el evento es hoy", () => {
    expect(esCandidataACerrar({ oportunidad: op({ fechaEvento: new Date("2026-09-28T03:00:00Z") }), staleDays: 120, hoy: HOY }).cerrar).toBe(false);
  });
  it("propone cerrar si no se movió en staleDays días", () => {
    const r = esCandidataACerrar({ oportunidad: op({ modificadaEn: new Date("2026-05-31T00:00:00Z") }), staleDays: 120, hoy: HOY });
    expect(r).toEqual({ cerrar: true, motivo: "Sin movimiento hace 120 días" });
  });
  it("no la cierra a los 119 días", () => {
    expect(esCandidataACerrar({ oportunidad: op({ modificadaEn: new Date("2026-06-01T12:00:00Z") }), staleDays: 120, hoy: HOY }).cerrar).toBe(false);
  });
});
```

`priority.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ordenarBandeja } from "./priority";

describe("ordenarBandeja", () => {
  it("acción hoy primero, después prioridad, después evento más cercano, sin fecha al final", () => {
    const t = (id: string, accionHoy: boolean, prioridad: "ALTA" | "MEDIA" | "BAJA" | null, f: string | null) =>
      ({ id, accionHoy, prioridad, fechaEvento: f ? new Date(f) : null });
    const r = ordenarBandeja([
      t("espera", false, "ALTA", "2026-10-01"),
      t("baja", true, "BAJA", "2026-10-01"),
      t("alta-lejos", true, "ALTA", "2027-01-01"),
      t("alta-sin-fecha", true, "ALTA", null),
      t("alta-cerca", true, "ALTA", "2026-10-15"),
    ]);
    expect(r.map((x) => x.id)).toEqual(["alta-cerca", "alta-lejos", "alta-sin-fecha", "baja", "espera"]);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/`
Expected: FAIL (faltan los módulos).

- [ ] **Step 3: Implementar**

`needs-analysis.ts`:

```ts
import { DEFAULT_WAIT_DAYS, UMBRALES_EVENTO_DIAS, type AccionVenta, type EstadoSugerencia } from "./constants";
import type { OportunidadVenta } from "./opportunity";

/**
 * Decide si una oportunidad va a Claude hoy.
 *
 * Es la función que controla el costo: sin ella, las ~100 oportunidades abiertas irían todas,
 * todos los días, a pesar de que en la mayoría no pasó nada. Módulo PURO.
 */
export type UltimaSugerencia = {
  creadaEn: Date;
  accion: AccionVenta;
  estado: EstadoSugerencia;
  esperarHasta: Date | null;
  /** `modificadaEn` de la oportunidad al momento del análisis. */
  oportunidadModificadaEn: Date;
};

const DIA_MS = 24 * 60 * 60 * 1000;
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS);
}

export function necesitaAnalisis(input: {
  oportunidad: OportunidadVenta;
  ultima: UltimaSugerencia | null;
  ultimoSeguimientoEn: Date | null;
  archivada: boolean;
  forzar: boolean;
  hoy: Date;
  waitDays?: number;
}): { analizar: boolean; motivo: string } {
  const { oportunidad: op, ultima, hoy } = input;
  if (!op.abierta) return { analizar: false, motivo: "Cerrada en el CRM" };
  if (input.forzar) return { analizar: true, motivo: "Pedido a mano" };
  if (input.archivada) return { analizar: false, motivo: "Archivada" };
  if (!ultima) return { analizar: true, motivo: "Nueva" };

  if (op.modificadaEn.getTime() > ultima.oportunidadModificadaEn.getTime()) {
    return { analizar: true, motivo: "Cambió en el CRM" };
  }
  if (input.ultimoSeguimientoEn && input.ultimoSeguimientoEn.getTime() > ultima.creadaEn.getTime()) {
    return { analizar: true, motivo: "Hay un seguimiento nuevo" };
  }
  if (ultima.esperarHasta && ultima.esperarHasta.getTime() <= hoy.getTime()) {
    return { analizar: true, motivo: "Venció la espera" };
  }
  const espera = input.waitDays ?? DEFAULT_WAIT_DAYS;
  if (ultima.estado === "ENVIADA" && diasEntre(ultima.creadaEn, hoy) >= espera) {
    return { analizar: true, motivo: `Pasaron ${espera} días del último mensaje` };
  }
  if (op.fechaEvento) {
    const faltanHoy = diasEntre(hoy, op.fechaEvento);
    const faltabanAntes = diasEntre(ultima.creadaEn, op.fechaEvento);
    for (const umbral of UMBRALES_EVENTO_DIAS) {
      if (faltabanAntes >= umbral && faltanHoy < umbral) {
        return { analizar: true, motivo: `El evento está a menos de ${umbral} días` };
      }
    }
  }
  return { analizar: false, motivo: "Sin cambios" };
}
```

Nota para el implementador: el caso "cruzó 30 días" del test usa creadaEn 26/09 (faltaban 31) y hoy 28/09 (faltan 29). Recorrer los umbrales de menor a mayor daría "14" primero; como la lista es `[60, 30, 14]` y el primero que se cruza es 30, se devuelve 30. Si se cruzaran dos a la vez, el mensaje nombra el mayor; alcanza.

`cleanup.ts`:

```ts
import { diasEntre } from "./needs-analysis";
import type { OportunidadVenta } from "./opportunity";

/**
 * La limpieza inicial: oportunidades que casi seguro ya no se venden. Por regla, sin Claude:
 * decidir que un evento de marzo ya pasó no necesita un modelo. Módulo PURO.
 */
export function esCandidataACerrar(input: {
  oportunidad: OportunidadVenta;
  staleDays: number;
  hoy: Date;
}): { cerrar: boolean; motivo: string | null } {
  const { oportunidad: op, hoy } = input;
  if (op.fechaEvento && diasEntre(op.fechaEvento, hoy) >= 1) {
    return { cerrar: true, motivo: "La fecha del evento ya pasó" };
  }
  if (diasEntre(op.modificadaEn, hoy) >= input.staleDays) {
    return { cerrar: true, motivo: `Sin movimiento hace ${input.staleDays} días` };
  }
  return { cerrar: false, motivo: null };
}
```

`priority.ts`:

```ts
import type { PrioridadVenta } from "./constants";

export type TarjetaOrdenable = {
  accionHoy: boolean;
  prioridad: PrioridadVenta | null;
  fechaEvento: Date | null;
};

const PESO: Record<PrioridadVenta, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

/** Orden de la bandeja (spec §6.4). No muta el arreglo recibido. Módulo PURO. */
export function ordenarBandeja<T extends TarjetaOrdenable>(tarjetas: T[]): T[] {
  return [...tarjetas].sort((a, b) => {
    if (a.accionHoy !== b.accionHoy) return a.accionHoy ? -1 : 1;
    const pa = a.prioridad ? PESO[a.prioridad] : 3;
    const pb = b.prioridad ? PESO[b.prioridad] : 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fechaEvento?.getTime() ?? Number.POSITIVE_INFINITY;
    const fb = b.fechaEvento?.getTime() ?? Number.POSITIVE_INFINITY;
    return fa - fb;
  });
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/needs-analysis.ts apps/fotoffice/lib/sales-assistant/needs-analysis.test.ts apps/fotoffice/lib/sales-assistant/cleanup.ts apps/fotoffice/lib/sales-assistant/cleanup.test.ts apps/fotoffice/lib/sales-assistant/priority.ts apps/fotoffice/lib/sales-assistant/priority.test.ts
git commit -m "Reglas del asistente: qué analizar, qué cerrar y en qué orden"
```

---

### Task 5: De JSON de Alboom a OportunidadVenta

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/alboom/types.ts`
- Create: `apps/fotoffice/lib/sales-assistant/alboom/mapper.ts`
- Create: `apps/fotoffice/lib/sales-assistant/alboom/fixtures/lead-row.json`, `activities.json`, `mails.json`
- Test: `apps/fotoffice/lib/sales-assistant/alboom/mapper.test.ts`

**Interfaces:**
- Consumes: `OportunidadVenta`, `Movimiento` (Task 1).
- Produces:
  - Tipos `AlboomLeadRow`, `AlboomActivity`, `AlboomMail` y `AlboomStagesList`, con los campos que se usan.
  - `fechaAlboom(s: string | null | undefined): Date | null`: Alboom manda `"YYYY-MM-DD HH:mm:ss"` en hora de Argentina, sin zona. Hay que interpretarla como UTC-3.
  - `mapearOportunidad(row: AlboomLeadRow, movimientos: Movimiento[]): OportunidadVenta`
  - `movimientosDesde(input: { activities: AlboomActivity[]; mails: AlboomMail[] }): Movimiento[]`: orden cronológico. El texto de los correos queda sin HTML y recortado a 400 caracteres. Las actividades que empiezan con "Etapa cambiada" son `ETAPA`; las demás, `OTRO`. Los correos son `CORREO`.
  - `textoPlano(html: string): string`

- [ ] **Step 1: Crear los fixtures, con datos inventados pero con la forma real**

`fixtures/lead-row.json` (una fila de `leads/paginate`, anonimizada):

```json
{
  "id": "2025562", "name": "Fotografía o Video de  Cumpleaños de 15",
  "description": "al medio dia es un evento familiar de 70 personas (5 hs) y a la noche un evento con los amigos (5hs)",
  "tags": "Alboom Pro Site", "status_id": "421", "pipeline_id": "1611", "stage_id": "1",
  "created": "2026-09-14 21:37:24", "modified": "2026-09-14 21:37:24", "due_date": "2026-09-28",
  "event_date": "2026-11-28 00:00:00", "place_event": "el campito", "city_event": " ibarlucea",
  "state_event": "Santa Fe", "guests": "70 / 50", "quote_sent_date": "2026-09-14 21:37:24",
  "lead_origin": "Recomendado Por un Amigo/a", "customer_name": "Alejandro", "customer_lastname": "Prueba",
  "customer_email": "alejandro@example.com", "customer_phone": "", "customer_cellular": "3410000000",
  "pipeline_name": "Embudo de Ventas DNX 2022", "stage_name": "Recepción de la oportunidnad",
  "stages_count": "6", "stage_percent": "16", "activity_count": "0"
}
```

`fixtures/activities.json`:

```json
{ "rows": [
  { "text": "Etapa cambiada para \"Coordinar entrevista\"", "created": "2026-09-26 08:29:04" },
  { "text": "Email follow-up was sent", "created": "2026-09-17 11:28:50" },
  { "text": "Nueva Oportunidad añadida usando la Herramienta de Formulario", "created": "2026-09-14 21:37:24" }
], "count": "3" }
```

`fixtures/mails.json`:

```json
{ "rows": [
  { "subject": "", "message_type": "mail", "to_mail": "alejandro@example.com", "created": "2026-09-15 10:00:00",
    "body": "Hola alejandro como estas? recibimos tu consulta pero tu numero de telefono esta mal escrito.&nbsp;<br>podrias escribirme?<br><br><div><span>Saludos,</span></div><img src=\"data:image/png;base64,AAAA\">" }
] }
```

- [ ] **Step 2: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import lead from "./fixtures/lead-row.json";
import activities from "./fixtures/activities.json";
import mails from "./fixtures/mails.json";
import { fechaAlboom, mapearOportunidad, movimientosDesde, textoPlano } from "./mapper";
import type { AlboomLeadRow } from "./types";

describe("fechaAlboom", () => {
  it("interpreta la hora como Argentina (UTC-3)", () => {
    expect(fechaAlboom("2026-09-14 21:37:24")?.toISOString()).toBe("2026-09-15T00:37:24.000Z");
  });
  it("devuelve null para vacío o basura", () => {
    expect(fechaAlboom(null)).toBeNull();
    expect(fechaAlboom("")).toBeNull();
    expect(fechaAlboom("0000-00-00 00:00:00")).toBeNull();
  });
});

describe("textoPlano", () => {
  it("saca etiquetas, imágenes y entidades", () => {
    expect(textoPlano("Hola&nbsp;<br>che<img src=\"x\"><div>chau</div>")).toBe("Hola che chau");
  });
});

describe("movimientosDesde", () => {
  it("ordena cronológicamente y clasifica", () => {
    const m = movimientosDesde({ activities: activities.rows, mails: mails.rows });
    expect(m.map((x) => x.tipo)).toEqual(["OTRO", "CORREO", "OTRO", "ETAPA"]);
    expect(m[1].texto).toContain("recibimos tu consulta");
    expect(m[1].texto).not.toContain("<");
  });
});

describe("mapearOportunidad", () => {
  it("mapea una fila real", () => {
    const op = mapearOportunidad(lead as AlboomLeadRow, []);
    expect(op).toMatchObject({
      fuente: "ALBOOM", idExterno: "2025562", nombreCliente: "Alejandro", apellidoCliente: "Prueba",
      telefono: "3410000000", embudo: "Embudo de Ventas DNX 2022", etapa: "Recepción de la oportunidnad",
      etapaOrden: 1, etapasTotal: 6, abierta: true, invitados: "70 / 50", ciudad: "ibarlucea",
      tipoEvento: "Fotografía o Video de Cumpleaños de 15", origen: "Recomendado Por un Amigo/a",
    });
    expect(op.fechaEvento?.toISOString()).toBe("2026-11-28T03:00:00.000Z");
  });
  it("usa customer_phone si no hay celular, y null si no hay ninguno", () => {
    const row = { ...(lead as AlboomLeadRow), customer_cellular: "", customer_phone: "" };
    expect(mapearOportunidad(row, []).telefono).toBeNull();
  });
  it("marca cerrada lo que no tiene status 421", () => {
    expect(mapearOportunidad({ ...(lead as AlboomLeadRow), status_id: "422" }, []).abierta).toBe(false);
  });
});
```

Si el `tsconfig` no permite importar JSON (`resolveJsonModule`), leerlos con `readFileSync` + `JSON.parse`, como `aislamiento.test.ts` lee archivos.

- [ ] **Step 3: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/alboom/mapper.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar `types.ts` y `mapper.ts`**

`types.ts`:

```ts
/** Lo que se usa de la API interna de Alboom. Todo llega como texto, incluidos los números. */
export type AlboomLeadRow = {
  id: string;
  name: string;
  description: string | null;
  status_id: string;
  pipeline_id: string;
  stage_id: string;
  created: string;
  modified: string;
  event_date: string | null;
  place_event: string | null;
  city_event: string | null;
  guests: string | null;
  quote_sent_date: string | null;
  lead_origin: string | null;
  customer_name: string | null;
  customer_lastname: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cellular: string | null;
  pipeline_name: string | null;
  stage_name: string | null;
  stages_count: string | null;
  [otro: string]: unknown;
};
export type AlboomActivity = { text: string; created: string };
export type AlboomMail = { subject: string | null; body: string | null; created: string; message_type?: string };
export type AlboomStagesList = {
  stage_list: { id: string; name: string }[];
  stages: Record<string, { id: string; stage: string; name: string }[]>;
};
export const ALBOOM_STATUS_ABIERTO = "421";
```

`mapper.ts`:

```ts
import type { Movimiento, OportunidadVenta } from "../opportunity";
import { ALBOOM_STATUS_ABIERTO, type AlboomActivity, type AlboomLeadRow, type AlboomMail } from "./types";

/**
 * JSON de Alboom → OportunidadVenta. Módulo PURO: se prueba con respuestas reales anonimizadas.
 *
 * Alboom guarda las fechas como texto en la hora de la cuenta (Argentina), sin zona. Leerlas
 * como UTC correría todo tres horas; un evento de las 00:00 caería el día anterior.
 */
export function fechaAlboom(s: string | null | undefined): Date | null {
  const m = s?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m || m[1] === "0000") return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function textoPlano(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const limpio = (s: string | null | undefined) => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

export function movimientosDesde(input: { activities: AlboomActivity[]; mails: AlboomMail[] }): Movimiento[] {
  const salida: Movimiento[] = [];
  for (const a of input.activities) {
    const fecha = fechaAlboom(a.created);
    if (!fecha) continue;
    salida.push({ fecha, tipo: a.text.startsWith("Etapa cambiada") ? "ETAPA" : "OTRO", texto: a.text });
  }
  for (const m of input.mails) {
    const fecha = fechaAlboom(m.created);
    if (!fecha) continue;
    const cuerpo = textoPlano(m.body ?? "").slice(0, 400);
    const texto = [limpio(m.subject), cuerpo].filter(Boolean).join(" — ");
    salida.push({ fecha, tipo: "CORREO", texto });
  }
  return salida.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

export function mapearOportunidad(row: AlboomLeadRow, movimientos: Movimiento[]): OportunidadVenta {
  const creadaEn = fechaAlboom(row.created) ?? new Date(0);
  return {
    fuente: "ALBOOM",
    idExterno: String(row.id),
    titulo: limpio(row.name) ?? "Sin título",
    tipoEvento: limpio(row.name),
    nombreCliente: limpio(row.customer_name) ?? "Sin nombre",
    apellidoCliente: limpio(row.customer_lastname),
    telefono: limpio(row.customer_cellular) ?? limpio(row.customer_phone),
    email: limpio(row.customer_email),
    fechaEvento: fechaAlboom(row.event_date),
    lugar: limpio(row.place_event),
    ciudad: limpio(row.city_event),
    invitados: limpio(row.guests),
    origen: limpio(row.lead_origin),
    descripcionCliente: limpio(row.description),
    embudo: limpio(row.pipeline_name) ?? "Sin embudo",
    etapa: limpio(row.stage_name) ?? "Sin etapa",
    etapaOrden: Number.parseInt(row.stage_id, 10) || 0,
    etapasTotal: Number.parseInt(row.stages_count ?? "", 10) || 0,
    abierta: String(row.status_id) === ALBOOM_STATUS_ABIERTO,
    creadaEn,
    presupuestoEnviadoEn: fechaAlboom(row.quote_sent_date),
    modificadaEn: fechaAlboom(row.modified) ?? creadaEn,
    movimientos,
  };
}
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/alboom/mapper.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/alboom/
git commit -m "Mapeo de las oportunidades de Alboom"
```

---

### Task 6: Cliente HTTP de Alboom

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/alboom/client.ts`
- Test: `apps/fotoffice/lib/sales-assistant/alboom/client.test.ts`

**Interfaces:**
- Consumes: los tipos de Task 5.
- Produces:
  - `class AlboomLoginError extends Error` (credencial rechazada).
  - `class AlboomApiError extends Error` (red, 5xx o forma inesperada), con `status?: number`.
  - `type CredencialAlboom = { subdomain: string; username: string; password: string }`
  - `type ClienteAlboom = { listarAbiertas(): Promise<AlboomLeadRow[]>; detalle(id: string): Promise<{ activities: AlboomActivity[]; mails: AlboomMail[] }>; embudos(): Promise<string[]> }`
  - `crearClienteAlboom(cred: CredencialAlboom, fetchImpl?: typeof fetch): Promise<ClienteAlboom>`: inicia sesión al crearse. Ante un 401 en cualquier pedido, vuelve a iniciar sesión **una** vez.
  - `horaLocalAlboom(d: Date): string`: `YYYY-MM-DDTHH:mm:ss.sss` en hora de Argentina.

- [ ] **Step 1: Escribir el test que falla (con un `fetch` falso)**

```ts
import { describe, expect, it, vi } from "vitest";
import { AlboomLoginError, crearClienteAlboom, horaLocalAlboom } from "./client";

const cred = { subdomain: "dnxprueba", username: "a@b.com", password: "x" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("crearClienteAlboom", () => {
  it("inicia sesión y manda el token como Bearer", async () => {
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/users/login")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ email: "a@b.com", password: "x", type: "simple", keepme: true });
        return json({ status: "ok", token: "T1", data: {} });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer T1");
      return json({ rows: [{ id: "1", status_id: "421" }, { id: "2", status_id: "422" }], count: "2" });
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    const filas = await c.listarAbiertas();
    expect(filas.map((f) => f.id)).toEqual(["1"]);
    expect(fetchFalso.mock.calls[0][0]).toBe("https://dnxprueba.alboomcrm.com/api/users/login");
  });

  it("rechaza con AlboomLoginError si status no es ok", async () => {
    const fetchFalso = vi.fn(async () => json({ status: "error", message: "invalid" }));
    await expect(crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch)).rejects.toBeInstanceOf(AlboomLoginError);
  });

  it("pagina hasta traer count filas", async () => {
    let pagina = 0;
    const fetchFalso = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/login")) return json({ status: "ok", token: "T", data: {} });
      pagina = JSON.parse(String(init?.body)).pageNumber;
      const rows = pagina === 1
        ? Array.from({ length: 100 }, (_, i) => ({ id: String(i), status_id: "421" }))
        : [{ id: "100", status_id: "421" }];
      return json({ rows, count: "101" });
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    expect((await c.listarAbiertas()).length).toBe(101);
    expect(pagina).toBe(2);
  });

  it("reintenta el login una vez ante un 401", async () => {
    let logins = 0;
    let llamadas = 0;
    const fetchFalso = vi.fn(async (url: string) => {
      if (url.endsWith("/login")) { logins++; return json({ status: "ok", token: `T${logins}`, data: {} }); }
      llamadas++;
      return llamadas === 1 ? json({}, 401) : json({ rows: [], count: "0" });
    });
    const c = await crearClienteAlboom(cred, fetchFalso as unknown as typeof fetch);
    await c.listarAbiertas();
    expect(logins).toBe(2);
  });

  it("rechaza subdominios con caracteres raros", async () => {
    await expect(crearClienteAlboom({ ...cred, subdomain: "evil.com/x" }, vi.fn() as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("horaLocalAlboom", () => {
  it("es la hora de Argentina sin zona", () => {
    expect(horaLocalAlboom(new Date("2026-09-28T13:00:00.000Z"))).toBe("2026-09-28T10:00:00.000");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/alboom/client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
import { ALBOOM_STATUS_ABIERTO, type AlboomActivity, type AlboomLeadRow, type AlboomMail, type AlboomStagesList } from "./types";

/**
 * Cliente de la API INTERNA de Alboom: la misma que usa su panel. No es pública ni documentada;
 * si Alboom la cambia, esto falla con `AlboomApiError` y la bandeja lo avisa. Sólo lee.
 *
 * El login devuelve un token que viaja como `Authorization: Bearer`. Se inicia sesión una vez
 * por corrida; ante un 401 se reintenta una sola vez.
 */
export class AlboomLoginError extends Error {}
export class AlboomApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type CredencialAlboom = { subdomain: string; username: string; password: string };

export type ClienteAlboom = {
  listarAbiertas(): Promise<AlboomLeadRow[]>;
  detalle(id: string): Promise<{ activities: AlboomActivity[]; mails: AlboomMail[] }>;
  embudos(): Promise<string[]>;
};

const PAGE_SIZE = 100;
const MAX_PAGINAS = 20;
const TIMEOUT_MS = 20_000;

export function horaLocalAlboom(d: Date): string {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, -1);
}

export async function crearClienteAlboom(
  cred: CredencialAlboom,
  fetchImpl: typeof fetch = fetch,
): Promise<ClienteAlboom> {
  if (!/^[a-z0-9-]{1,63}$/i.test(cred.subdomain)) {
    throw new AlboomApiError("Subdominio de Alboom inválido");
  }
  const base = `https://${cred.subdomain}.alboomcrm.com/api`;
  let token = "";

  async function login(): Promise<void> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}/users/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: cred.username,
          password: cred.password,
          type: "simple",
          login_time: horaLocalAlboom(new Date()),
          keepme: true,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AlboomApiError("No se pudo conectar con Alboom");
    }
    const data = (await res.json().catch(() => null)) as { status?: string; token?: string } | null;
    if (!res.ok && res.status >= 500) throw new AlboomApiError("Alboom no responde", res.status);
    if (data?.status !== "ok" || !data.token) throw new AlboomLoginError("Alboom rechazó el usuario");
    token = data.token;
  }

  async function pedir<T>(ruta: string, init: { method: "GET" | "POST"; body?: unknown }, reintento = true): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${ruta}`, {
        method: init.method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AlboomApiError(`No se pudo leer ${ruta}`);
    }
    if (res.status === 401 && reintento) {
      await login();
      return pedir<T>(ruta, init, false);
    }
    if (res.status === 401) throw new AlboomLoginError("Alboom rechazó la sesión");
    if (!res.ok) throw new AlboomApiError(`Alboom respondió ${res.status} en ${ruta}`, res.status);
    const data = await res.json().catch(() => null);
    if (data === null) throw new AlboomApiError(`Respuesta no JSON en ${ruta}`);
    return data as T;
  }

  await login();

  return {
    async listarAbiertas() {
      const todas: AlboomLeadRow[] = [];
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const r = await pedir<{ rows?: AlboomLeadRow[]; count?: string | number }>("/leads/paginate", {
          method: "POST",
          body: { pageNumber: pagina, pageSize: PAGE_SIZE, sortBy: "id", sortDir: "DESC", pipeline: "all", stage: "all", searchTerm: "" },
        });
        if (!Array.isArray(r.rows)) throw new AlboomApiError("leads/paginate cambió de forma");
        todas.push(...r.rows);
        const total = Number(r.count ?? 0);
        if (r.rows.length < PAGE_SIZE || todas.length >= total) break;
      }
      return todas.filter((f) => String(f.status_id) === ALBOOM_STATUS_ABIERTO);
    },
    async detalle(id) {
      if (!/^\d+$/.test(id)) throw new AlboomApiError("id de oportunidad inválido");
      const [act, mails] = await Promise.all([
        pedir<{ rows?: AlboomActivity[] }>("/activities/paginate", {
          method: "POST",
          body: { type: "leads", id, offset: 0, count: 50, searchTerm: "" },
        }),
        pedir<{ rows?: AlboomMail[] }>(`/mails/leads/${id}/0/50`, { method: "GET" }),
      ]);
      return { activities: act.rows ?? [], mails: mails.rows ?? [] };
    },
    async embudos() {
      const r = await pedir<AlboomStagesList>("/stages/list?type=lead_stage", { method: "GET" });
      return (r.stage_list ?? []).map((s) => s.name);
    },
  };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/alboom/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/alboom/client.ts apps/fotoffice/lib/sales-assistant/alboom/client.test.ts
git commit -m "Cliente de lectura de Alboom"
```

---

### Task 7: Credencial de Alboom en el cofre

**Files:**
- Modify: `apps/fotoffice/lib/integrations/store.ts` (agregar dos funciones al final, sin tocar las existentes)
- Modify: `apps/fotoffice/lib/integrations/registry.ts` (sumar `"ALBOOM"` al tipo `IntegrationProvider` y la entrada `alboom-crm`)
- Create: `apps/fotoffice/lib/sales-assistant/alboom/credentials.ts`

**Interfaces:**
- Consumes: `encryptIntegrationSecret`, `decryptIntegrationSecret` y `requireIntegrationsMasterKey` (vault); `CredencialAlboom` (Task 6); `ALBOOM_INTEGRATION_KEY` y `ALBOOM_PROVIDER` (Task 1).
- Produces:
  - En store: `saveSecretIntegration(input: { workspaceId; integrationKey; provider; accountEmail; secret: string; connectedByUserId: number | null }): Promise<void>` y `readIntegrationSecret(workspaceId, integrationKey): Promise<string | null>`. Hay que decidir si `readRefreshToken` pasa a delegar en `readIntegrationSecret`: sí, para no duplicar el descifrado; su firma no cambia.
  - En credentials: `guardarCredencialAlboom(workspaceId: string, cred: CredencialAlboom, userId: number | null)`, `leerCredencialAlboom(workspaceId: string): Promise<CredencialAlboom | null>`, `borrarCredencialAlboom(workspaceId: string)`, `marcarCredencialRechazada(workspaceId: string)` y `resumenConexionAlboom(workspaceId: string): Promise<{ usuario: string; subdomain: string | null; estado: IntegrationStatusValue; conectadaEn: Date } | null>`. El subdominio no es secreto: se guarda en `accountExternalId`.

- [ ] **Step 1: Agregar al final de `store.ts`**

```ts
/**
 * Integraciones que no son OAuth: guardan un secreto arbitrario (p. ej. usuario y contraseña de
 * un CRM sin API pública). Mismo cofre, misma tabla, sin permisos otorgados.
 */
export async function saveSecretIntegration(input: {
  workspaceId: string;
  integrationKey: string;
  provider: string;
  accountEmail: string;
  accountExternalId?: string | null;
  secret: string;
  connectedByUserId: number | null;
}): Promise<void> {
  const blob = encryptIntegrationSecret(input.secret, requireIntegrationsMasterKey());
  const datos = {
    provider: input.provider,
    accountEmail: input.accountEmail,
    accountExternalId: input.accountExternalId ?? null,
    grantedScopes: [] as string[],
    ciphertext: blob.ciphertext,
    nonce: blob.nonce,
    authTag: blob.authTag,
    keyVersion: blob.keyVersion,
    status: "ACTIVE",
    connectedByUserId: input.connectedByUserId,
    revokedAt: null,
  };
  await prisma.workspaceIntegration.upsert({
    where: { workspaceId_integrationKey: { workspaceId: input.workspaceId, integrationKey: input.integrationKey } },
    create: { workspaceId: input.workspaceId, integrationKey: input.integrationKey, ...datos },
    update: { ...datos, connectedAt: new Date() },
  });
}

/** El secreto en claro. Las mismas reglas que `readRefreshToken`. */
export async function readIntegrationSecret(
  workspaceId: string,
  integrationKey: string,
): Promise<string | null> {
  return readRefreshToken(workspaceId, integrationKey);
}
```

(Se delega en `readRefreshToken` en lugar de reescribir el descifrado; el nombre viejo queda como está para no tocar Google.)

- [ ] **Step 2: Registrar la integración**

En `registry.ts`: `export type IntegrationProvider = "GOOGLE" | "ALBOOM";`, más una entrada `AVAILABLE` con `key: "alboom-crm"`, `provider: "ALBOOM"`, `label: "Alboom CRM"`, `description: "Lee tu embudo de ventas de Alboom para el Asistente de ventas."`, `scopes: []` y `requiredByModules: ["sales-assistant"]`. Buscar con `grep -rn "INTEGRATION_REGISTRY\|IntegrationProvider" apps/fotoffice` cualquier lugar que recorra el catálogo suponiendo Google (por ejemplo, una pantalla que ofrece "Conectar con Google" para todas las `AVAILABLE`). Si existe, filtrar ahí por `provider === "GOOGLE"`.

- [ ] **Step 3: Crear `credentials.ts`**

```ts
import "server-only";
import { prisma } from "@repo/db";
import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readIntegrationSecret,
  saveSecretIntegration,
  type IntegrationStatusValue,
} from "@/lib/integrations/store";
import { ALBOOM_INTEGRATION_KEY, ALBOOM_PROVIDER } from "../constants";
import type { CredencialAlboom } from "./client";

/** Única puerta a la credencial de Alboom. La contraseña sale en claro sólo por `leerCredencialAlboom`. */
export async function guardarCredencialAlboom(workspaceId: string, cred: CredencialAlboom, userId: number | null) {
  await saveSecretIntegration({
    workspaceId,
    integrationKey: ALBOOM_INTEGRATION_KEY,
    provider: ALBOOM_PROVIDER,
    accountEmail: cred.username,
    accountExternalId: cred.subdomain,
    secret: JSON.stringify(cred),
    connectedByUserId: userId,
  });
}

export async function leerCredencialAlboom(workspaceId: string): Promise<CredencialAlboom | null> {
  const crudo = await readIntegrationSecret(workspaceId, ALBOOM_INTEGRATION_KEY);
  if (!crudo) return null;
  const c = JSON.parse(crudo) as Partial<CredencialAlboom>;
  if (!c.subdomain || !c.username || !c.password) return null;
  return { subdomain: c.subdomain, username: c.username, password: c.password };
}

export async function borrarCredencialAlboom(workspaceId: string) {
  await deleteIntegration(workspaceId, ALBOOM_INTEGRATION_KEY);
}

export async function marcarCredencialRechazada(workspaceId: string) {
  await markIntegrationNeedsReconsent(workspaceId, ALBOOM_INTEGRATION_KEY);
}

export async function resumenConexionAlboom(workspaceId: string): Promise<{
  usuario: string;
  subdomain: string | null;
  estado: IntegrationStatusValue;
  conectadaEn: Date;
} | null> {
  const r = await getIntegrationSummary(workspaceId, ALBOOM_INTEGRATION_KEY);
  if (!r) return null;
  const fila = await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationKey: { workspaceId, integrationKey: ALBOOM_INTEGRATION_KEY } },
    select: { accountExternalId: true },
  });
  return { usuario: r.accountEmail, subdomain: fila?.accountExternalId ?? null, estado: r.status, conectadaEn: r.connectedAt };
}

/** Workspaces con la credencial activa. Para el cron. */
export async function workspacesConAlboomActivo(): Promise<string[]> {
  // aislamiento: recorre todos los workspaces a propósito; el cron trabaja uno por uno.
  const filas = await prisma.workspaceIntegration.findMany({
    where: { integrationKey: ALBOOM_INTEGRATION_KEY, status: "ACTIVE" },
    select: { workspaceId: true },
  });
  return filas.map((f) => f.workspaceId);
}
```

- [ ] **Step 4: Tipos y tests existentes**

Run: `pnpm --filter fotoffice exec tsc --noEmit -p . 2>&1 | grep -E "integrations|sales-assistant" | head` y `pnpm --filter fotoffice test 2>&1 | tail -5`
Expected: sin errores en esos archivos, y todos los tests en verde.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/integrations/store.ts apps/fotoffice/lib/integrations/registry.ts apps/fotoffice/lib/sales-assistant/alboom/credentials.ts
git commit -m "Credencial de Alboom guardada en el cofre de integraciones"
```

---

### Task 8: Contexto para Claude y esquema de la respuesta

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/prompt.ts`
- Test: `apps/fotoffice/lib/sales-assistant/prompt.test.ts`

**Interfaces:**
- Consumes: `OportunidadVenta` y los tipos de constantes.
- Produces:
  - `SugerenciaSchema` (zod) y `type SugerenciaIA = z.infer<typeof SugerenciaSchema>` = `{ accion: AccionVenta; prioridad: PrioridadVenta; motivo: string; mensaje: string | null; esperarDias: number | null }`
  - `SUGERENCIA_JSON_SCHEMA`: el objeto JSON Schema equivalente, para `output_config.format`.
  - `SYSTEM_PROMPT: string`
  - `type SeguimientoParaContexto = { fecha: Date; tipo: TipoSeguimiento; resultado: ResultadoSeguimiento | null; texto: string | null }`
  - `type SugerenciaPrevia = { fecha: Date; accion: AccionVenta; estado: EstadoSugerencia; mensaje: string | null }`
  - `armarContexto(input: { oportunidad: OportunidadVenta; seguimientos: SeguimientoParaContexto[]; sugerenciasPrevias: SugerenciaPrevia[]; voz: { firma: string | null; indicaciones: string | null }; hoy: Date }): string`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { armarContexto, SugerenciaSchema } from "./prompt";
import type { OportunidadVenta } from "./opportunity";

const op: OportunidadVenta = {
  fuente: "ALBOOM", idExterno: "9", titulo: "Cumple de XV", tipoEvento: "Cumple de XV",
  nombreCliente: "Sabrina", apellidoCliente: "Berdónez", telefono: "3412717813",
  email: "sabri@example.com", fechaEvento: new Date("2027-01-01T17:00:00Z"), lugar: "Salón X",
  ciudad: "Rosario", invitados: "120", origen: "Instagram", descripcionCliente: "Quiero foto y video",
  embudo: "Embudo DNX", etapa: "Cliente potencial", etapaOrden: 4, etapasTotal: 6, abierta: true,
  creadaEn: new Date("2026-09-20T15:00:00Z"), presupuestoEnviadoEn: new Date("2026-09-20T15:05:00Z"),
  modificadaEn: new Date("2026-09-24T15:00:00Z"),
  movimientos: [{ fecha: new Date("2026-09-22T12:00:00Z"), tipo: "CORREO", texto: "Te mando el presupuesto" }],
};

describe("armarContexto", () => {
  const ctx = armarContexto({
    oportunidad: op,
    seguimientos: [{ fecha: new Date("2026-09-25T12:00:00Z"), tipo: "RESULTADO", resultado: "PIDIO_DESCUENTO", texto: "dice que es caro" }],
    sugerenciasPrevias: [],
    voz: { firma: "Dani de DNX", indicaciones: "La seña es del 30 %" },
    hoy: new Date("2026-09-28T10:00:00Z"),
  });
  it("no incluye teléfono, email ni apellido", () => {
    expect(ctx).not.toContain("3412717813");
    expect(ctx).not.toContain("sabri@example.com");
    expect(ctx).not.toContain("Berdónez");
  });
  it("incluye lo necesario para decidir", () => {
    for (const s of ["Sabrina", "Cliente potencial", "Rosario", "Instagram", "Quiero foto y video", "Pidió descuento", "dice que es caro", "La seña es del 30 %", "Dani de DNX", "Te mando el presupuesto"]) {
      expect(ctx).toContain(s);
    }
  });
  it("dice cuántos días faltan y cuántos pasaron del presupuesto", () => {
    expect(ctx).toMatch(/faltan 95 días/);
    expect(ctx).toMatch(/hace 7 días/);
  });
});

describe("SugerenciaSchema", () => {
  it("acepta una respuesta válida y rechaza una acción inventada", () => {
    expect(SugerenciaSchema.safeParse({ accion: "ESCRIBIR", prioridad: "ALTA", motivo: "x", mensaje: "Hola", esperarDias: null }).success).toBe(true);
    expect(SugerenciaSchema.safeParse({ accion: "LLAMAR", prioridad: "ALTA", motivo: "x", mensaje: null, esperarDias: null }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
import { z } from "zod";
import {
  ACCIONES,
  ETIQUETA_RESULTADO,
  PRIORIDADES,
  SALES_TIME_ZONE,
  type AccionVenta,
  type EstadoSugerencia,
  type ResultadoSeguimiento,
  type TipoSeguimiento,
} from "./constants";
import { diasEntre } from "./needs-analysis";
import type { OportunidadVenta } from "./opportunity";

export const SugerenciaSchema = z.object({
  accion: z.enum(ACCIONES),
  prioridad: z.enum(PRIORIDADES),
  motivo: z.string().min(1).max(300),
  mensaje: z.string().max(1200).nullable(),
  esperarDias: z.number().int().min(1).max(60).nullable(),
});
export type SugerenciaIA = z.infer<typeof SugerenciaSchema>;

export const SUGERENCIA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["accion", "prioridad", "motivo", "mensaje", "esperarDias"],
  properties: {
    accion: { type: "string", enum: [...ACCIONES] },
    prioridad: { type: "string", enum: [...PRIORIDADES] },
    motivo: { type: "string", description: "Una sola línea, en castellano, que explica la decisión." },
    mensaje: { type: ["string", "null"], description: "El WhatsApp listo para mandar, o null si la acción no lleva mensaje." },
    esperarDias: { type: ["integer", "null"], description: "Si la acción es ESPERAR, en cuántos días volver a mirarla." },
  },
} as const;

export const SYSTEM_PROMPT = `Sos el asistente de ventas de un fotógrafo profesional argentino que vende coberturas de fiestas de XV, casamientos, eventos y sesiones. Cada día revisás una oportunidad de su embudo y decidís el próximo paso.

Acciones posibles:
- ESCRIBIR: mandar un mensaje de seguimiento o de respuesta.
- PEDIR_SENA: el cliente mostró interés claro; proponer reservar la fecha con la seña.
- COORDINAR_ENTREVISTA: proponer una llamada o reunión para cerrar detalles.
- ESPERAR: todavía no corresponde escribir (se escribió hace poco o el cliente pidió tiempo). Indicá esperarDias.
- CERRAR_PERDIDA: la oportunidad está perdida (el cliente dijo que no, el evento pasó o no hubo respuesta a 3 mensajes seguidos).
- REVISAR_A_MANO: falta información clave o el caso es delicado; el fotógrafo tiene que mirarlo.

Reglas de negocio:
- Nunca más de 3 mensajes seguidos sin respuesta del cliente. Contá los mensajes enviados en el historial.
- No escribas si el último mensaje fue hace menos de 3 días, salvo que el cliente haya respondido.
- Un evento a menos de 30 días pide prioridad ALTA y un mensaje que mencione que la fecha se puede ocupar.
- Si el cliente pidió descuento, no lo ofrezcas vos: proponé ajustar el paquete o coordinar una llamada.
- Nunca inventes precios, paquetes ni promociones que no estén en las indicaciones del fotógrafo.
- Si en el historial no consta ningún mensaje por WhatsApp, asumí que el primer contacto por WhatsApp todavía no se hizo.

Estilo del mensaje:
- Castellano rioplatense, con voseo, cálido y profesional. Corto: 2 a 4 oraciones.
- Saludá por el nombre de pila. Una sola pregunta por mensaje, al final. Como mucho un emoji.
- Firmá con la firma indicada, si hay.
- Nada de "estimado/a" ni fórmulas de correo.

El motivo es una línea para el fotógrafo, concreta y con datos ("Presupuesto enviado hace 6 días sin respuesta; el evento es en 61 días").`;

export type SeguimientoParaContexto = {
  fecha: Date;
  tipo: TipoSeguimiento;
  resultado: ResultadoSeguimiento | null;
  texto: string | null;
};
export type SugerenciaPrevia = {
  fecha: Date;
  accion: AccionVenta;
  estado: EstadoSugerencia;
  mensaje: string | null;
};

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: SALES_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

/**
 * El contexto de UNA oportunidad. Módulo PURO. Deja afuera, a propósito, el teléfono, el email
 * y el apellido: no hacen falta para decidir y no tienen por qué salir del sistema.
 */
export function armarContexto(input: {
  oportunidad: OportunidadVenta;
  seguimientos: SeguimientoParaContexto[];
  sugerenciasPrevias: SugerenciaPrevia[];
  voz: { firma: string | null; indicaciones: string | null };
  hoy: Date;
}): string {
  const { oportunidad: op, hoy } = input;
  const l: string[] = [];
  l.push(`Hoy es ${fmt(hoy)}.`);
  l.push("", "## Oportunidad");
  l.push(`Cliente (nombre de pila): ${op.nombreCliente}`);
  l.push(`Pedido: ${op.titulo}`);
  if (op.fechaEvento) l.push(`Fecha del evento: ${fmt(op.fechaEvento)} (faltan ${diasEntre(hoy, op.fechaEvento)} días)`);
  else l.push("Fecha del evento: no informada");
  if (op.lugar || op.ciudad) l.push(`Lugar: ${[op.lugar, op.ciudad].filter(Boolean).join(", ")}`);
  if (op.invitados) l.push(`Invitados: ${op.invitados}`);
  if (op.origen) l.push(`Cómo llegó: ${op.origen}`);
  l.push(`Embudo: ${op.embudo} — etapa ${op.etapaOrden} de ${op.etapasTotal}: ${op.etapa}`);
  l.push(`Consulta recibida: ${fmt(op.creadaEn)} (hace ${diasEntre(op.creadaEn, hoy)} días)`);
  if (op.presupuestoEnviadoEn) l.push(`Presupuesto enviado: ${fmt(op.presupuestoEnviadoEn)} (hace ${diasEntre(op.presupuestoEnviadoEn, hoy)} días)`);
  if (op.descripcionCliente) l.push(`Lo que escribió el cliente: "${op.descripcionCliente}"`);

  l.push("", "## Historial del CRM");
  if (op.movimientos.length === 0) l.push("(sin movimientos)");
  for (const m of op.movimientos) l.push(`- ${fmt(m.fecha)} [${m.tipo}] ${m.texto}`);

  l.push("", "## Lo que anotó el fotógrafo (WhatsApp)");
  if (input.seguimientos.length === 0) l.push("(nada anotado: no sabemos qué se habló por WhatsApp)");
  for (const s of input.seguimientos) {
    const que = s.tipo === "MENSAJE_ENVIADO" ? "Mensaje enviado" : s.resultado ? ETIQUETA_RESULTADO[s.resultado] : "Nota";
    l.push(`- ${fmt(s.fecha)} ${que}${s.texto ? `: "${s.texto}"` : ""}`);
  }

  if (input.sugerenciasPrevias.length > 0) {
    l.push("", "## Sugerencias anteriores");
    for (const s of input.sugerenciasPrevias) l.push(`- ${fmt(s.fecha)} ${s.accion} (${s.estado})${s.mensaje ? `: "${s.mensaje}"` : ""}`);
  }

  l.push("", "## Voz del fotógrafo");
  l.push(`Firma: ${input.voz.firma ?? "(sin firma)"}`);
  if (input.voz.indicaciones) l.push(`Indicaciones: ${input.voz.indicaciones}`);

  l.push("", "Decidí el próximo paso para esta oportunidad.");
  return l.join("\n");
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/prompt.test.ts`
Expected: PASS. Si "faltan 95 días" no da exacto, recalcular con `diasEntre(new Date("2026-09-28T10:00:00Z"), new Date("2027-01-01T17:00:00Z"))` y corregir el **test**: la función manda.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/prompt.ts apps/fotoffice/lib/sales-assistant/prompt.test.ts
git commit -m "Contexto y formato de respuesta para el análisis con Claude"
```

---

### Task 9: El analizador (llamada a Claude)

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/analyzer.ts`
- Test: `apps/fotoffice/lib/sales-assistant/analyzer.test.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT`, `SUGERENCIA_JSON_SCHEMA` y `SugerenciaSchema` (Task 8).
- Produces:
  - `type ResultadoAnalisis = { sugerencia: SugerenciaIA; modelo: string; inputTokens: number; outputTokens: number; fallo: boolean }`
  - `type LlamadaClaude = (req: { model: string; system: string; contexto: string }) => Promise<{ texto: string | null; stopReason: string | null; inputTokens: number; outputTokens: number; modelo: string }>`
  - `analizarOportunidad(contexto: string, llamar?: LlamadaClaude): Promise<ResultadoAnalisis>`: nunca lanza error. Si algo falla, devuelve `REVISAR_A_MANO` con `fallo: true`.
  - `iaDisponible(): boolean` (hay `ANTHROPIC_API_KEY`)
  - `modeloIA(): string`
  - `llamadaClaudeReal: LlamadaClaude`

Antes de escribir la llamada real, leer `node_modules/@anthropic-ai/sdk` (README o tipos) para confirmar cómo se pasan `output_config`, `fallbacks` y `betas` en la versión instalada. Si `client.beta.messages.create` no acepta `fallbacks` en los tipos, pasarlo igual con un cast documentado, o quitar fallbacks y dejar un comentario. **No inventar nombres de la API: verificar contra el SDK instalado.**

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { analizarOportunidad, type LlamadaClaude } from "./analyzer";

const ok: LlamadaClaude = async () => ({
  texto: JSON.stringify({ accion: "ESCRIBIR", prioridad: "ALTA", motivo: "Sin respuesta hace 6 días", mensaje: "Hola Sabri!", esperarDias: null }),
  stopReason: "end_turn", inputTokens: 1200, outputTokens: 90, modelo: "claude-opus-5",
});

describe("analizarOportunidad", () => {
  it("devuelve la sugerencia validada y los tokens", async () => {
    const r = await analizarOportunidad("ctx", ok);
    expect(r).toMatchObject({ fallo: false, inputTokens: 1200, outputTokens: 90, sugerencia: { accion: "ESCRIBIR", mensaje: "Hola Sabri!" } });
  });
  it("una respuesta inválida queda para revisar a mano", async () => {
    const r = await analizarOportunidad("ctx", async () => ({ texto: "{\"accion\":\"LLAMAR\"}", stopReason: "end_turn", inputTokens: 1, outputTokens: 1, modelo: "m" }));
    expect(r).toMatchObject({ fallo: true, sugerencia: { accion: "REVISAR_A_MANO", motivo: "No se pudo analizar", mensaje: null } });
  });
  it("un rechazo queda para revisar a mano", async () => {
    const r = await analizarOportunidad("ctx", async () => ({ texto: null, stopReason: "refusal", inputTokens: 1, outputTokens: 0, modelo: "m" }));
    expect(r.fallo).toBe(true);
  });
  it("un error de red no se propaga", async () => {
    const r = await analizarOportunidad("ctx", async () => { throw new Error("ECONNRESET"); });
    expect(r.fallo).toBe(true);
  });
  it("ESPERAR sin días usa 3", async () => {
    const r = await analizarOportunidad("ctx", async () => ({ texto: JSON.stringify({ accion: "ESPERAR", prioridad: "BAJA", motivo: "x", mensaje: null, esperarDias: null }), stopReason: "end_turn", inputTokens: 1, outputTokens: 1, modelo: "m" }));
    expect(r.sugerencia.esperarDias).toBe(3);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/analyzer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_WAIT_DAYS } from "./constants";
import { SUGERENCIA_JSON_SCHEMA, SYSTEM_PROMPT, SugerenciaSchema, type SugerenciaIA } from "./prompt";

/**
 * La única llamada a Claude del módulo. Nunca lanza: una oportunidad que no se pudo analizar
 * queda "para revisar a mano" y el lote sigue. Un fallo de IA no puede dejar la bandeja vacía.
 */
export type LlamadaClaude = (req: { model: string; system: string; contexto: string }) => Promise<{
  texto: string | null;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  modelo: string;
}>;

export type ResultadoAnalisis = {
  sugerencia: SugerenciaIA;
  modelo: string;
  inputTokens: number;
  outputTokens: number;
  fallo: boolean;
};

export function iaDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
export function modeloIA(): string {
  return process.env.FOTOFFICE_SALES_AI_MODEL?.trim() || "claude-opus-5";
}

const FALLIDA: SugerenciaIA = {
  accion: "REVISAR_A_MANO",
  prioridad: "MEDIA",
  motivo: "No se pudo analizar",
  mensaje: null,
  esperarDias: null,
};

let cliente: Anthropic | null = null;

export const llamadaClaudeReal: LlamadaClaude = async ({ model, system, contexto }) => {
  cliente ??= new Anthropic();
  // Verificar contra el SDK instalado: output_config.format, thinking adaptativo y effort.
  const r = await cliente.messages.create({
    model,
    max_tokens: 4000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SUGERENCIA_JSON_SCHEMA },
    },
    messages: [{ role: "user", content: contexto }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  const texto = r.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? null;
  return {
    texto,
    stopReason: r.stop_reason ?? null,
    inputTokens: (r.usage.input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0),
    outputTokens: r.usage.output_tokens ?? 0,
    modelo: r.model,
  };
};

export async function analizarOportunidad(
  contexto: string,
  llamar: LlamadaClaude = llamadaClaudeReal,
): Promise<ResultadoAnalisis> {
  const model = modeloIA();
  try {
    const r = await llamar({ model, system: SYSTEM_PROMPT, contexto });
    if (r.stopReason === "refusal" || !r.texto) {
      return { sugerencia: FALLIDA, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, fallo: true };
    }
    const parsed = SugerenciaSchema.safeParse(JSON.parse(r.texto));
    if (!parsed.success) {
      return { sugerencia: FALLIDA, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, fallo: true };
    }
    const s = parsed.data;
    const sugerencia: SugerenciaIA = {
      ...s,
      esperarDias: s.accion === "ESPERAR" ? s.esperarDias ?? DEFAULT_WAIT_DAYS : null,
      mensaje: s.accion === "ESPERAR" || s.accion === "CERRAR_PERDIDA" ? null : s.mensaje,
    };
    return { sugerencia, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, fallo: false };
  } catch {
    return { sugerencia: FALLIDA, modelo: model, inputTokens: 0, outputTokens: 0, fallo: true };
  }
}
```

(`JSON.parse` dentro del `try`: un texto no JSON también cae en `FALLIDA`.)

- [ ] **Step 4: Correr y ver que pasa, y compilar**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/analyzer.test.ts && pnpm --filter fotoffice exec tsc --noEmit -p . 2>&1 | grep analyzer`
Expected: PASS y ningún error de tipos en `analyzer.ts`. Si el SDK no tipa `output_config`, dejar el cast y un comentario que diga por qué.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/analyzer.ts apps/fotoffice/lib/sales-assistant/analyzer.test.ts
git commit -m "Analizador de oportunidades con Claude"
```

---

### Task 10: Repositorio y barrido de aislamiento

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/repository.ts`
- Create: `apps/fotoffice/lib/sales-assistant/aislamiento.test.ts` (copiar `lib/coverages/aislamiento.test.ts` y cambiar `ZONAS` por `lib/sales-assistant` y `app/(shell)/ventas`; el resto, igual)

**Interfaces:**
- Consumes: los modelos Prisma (Task 2), `OportunidadVenta`, constantes y los tipos de `prompt.ts`/`needs-analysis.ts`.
- Produces (todas reciben `workspaceId` primero):
  - `leerAjustes(workspaceId): Promise<AjustesVentas>`: crea la fila si no existe. `AjustesVentas = { pipelinesIncluded: string[]; signature: string | null; voiceNotes: string | null; waitDays: number; staleDays: number; lastSyncAt: Date | null; lastSyncStatus: EstadoSync | null; lastSyncMessage: string | null }`.
  - `guardarAjustes(workspaceId, datos: Partial<Pick<AjustesVentas, "pipelinesIncluded" | "signature" | "voiceNotes" | "waitDays" | "staleDays">>)`
  - `registrarSync(workspaceId, estado: EstadoSync, mensaje: string | null)`
  - `guardarOportunidad(workspaceId, op: OportunidadVenta, ahora: Date): Promise<{ id: string; archivada: boolean }>`: hace upsert por `(workspaceId, source, externalId)`. `snapshot` va serializado con las fechas como ISO.
  - `marcarNoVistasComoCerradas(workspaceId, idsExternosVistos: string[], ahora: Date)`: las ABIERTAS que no vinieron en esta lectura pasan a CERRADA.
  - `contextoDeAnalisis(workspaceId, opportunityId): Promise<{ ultima: UltimaSugerencia | null; ultimoSeguimientoEn: Date | null; seguimientos: SeguimientoParaContexto[]; sugerenciasPrevias: SugerenciaPrevia[] }>`: trae los últimos 20 seguimientos y las últimas 5 sugerencias.
  - `guardarSugerencia(workspaceId, opportunityId, r: ResultadoAnalisis, oportunidadModificadaEn: Date, ahora: Date)`: en una transacción pasa la PENDIENTE/POSPUESTA previa a REEMPLAZADA y crea la nueva, con `waitUntil = ahora + esperarDias` si corresponde y `opportunityModifiedAt = oportunidadModificadaEn`.
  - `oportunidadGuardada(workspaceId, source: "ALBOOM", externalId): Promise<{ id: string; modificadaEn: Date; snapshot: OportunidadVenta; archivada: boolean } | null>` — el snapshot re-hidratado con `Date`.
  - `bandeja(workspaceId, filtro: "HOY" | "ESPERANDO" | "PARA_CERRAR" | "ARCHIVADAS", staleDays: number, hoy: Date): Promise<TarjetaBandeja[]>`. Devuelve oportunidades ABIERTAS (o archivadas, si el filtro es ARCHIVADAS) con su sugerencia vigente. Clasificación:
    - PARA_CERRAR: `esCandidataACerrar` da cerrar, o la sugerencia vigente es CERRAR_PERDIDA.
    - HOY: sugerencia vigente PENDIENTE con acción de `ACCIONES_CON_MENSAJE` o REVISAR_A_MANO.
    - ESPERANDO: el resto de las no archivadas.
    - El resultado sale ordenado con `ordenarBandeja`.
  - `type TarjetaBandeja = { oportunidadId: string; nombre: string; tipoEvento: string | null; fechaEvento: Date | null; etapa: string; telefono: string | null; externalId: string; sugerencia: { id: string; accion: AccionVenta; prioridad: PrioridadVenta; motivo: string; mensaje: string | null; estado: EstadoSugerencia; creadaEn: Date } | null; ultimoResultado: ResultadoSeguimiento | null; motivoCierre: string | null; accionHoy: boolean; prioridad: PrioridadVenta | null }`
  - `detalleOportunidad(workspaceId, id): Promise<{ oportunidad: OportunidadVenta; archivada: boolean; externalStatus: string; sugerencias: ...[]; seguimientos: ...[] } | null>`: el snapshot se re-hidrata con fechas `Date`.
  - `resolverSugerencia(workspaceId, suggestionId, estado: "ENVIADA" | "DESCARTADA" | "POSPUESTA", extra: { editedMessage?: string | null; posponerDias?: number }, ahora: Date)`
  - `registrarSeguimiento(workspaceId, opportunityId, s: { kind: TipoSeguimiento; outcome?: ResultadoSeguimiento | null; text?: string | null; suggestionId?: string | null; actorUserId: number | null; actorLabel: string })`
  - `archivar(workspaceId, opportunityId, archivar: boolean)`

- [ ] **Step 1: Escribir `aislamiento.test.ts`** copiando el de coverages, con:

```ts
const ZONAS: readonly { carpeta: string; filtro?: (archivo: string) => boolean }[] = [
  { carpeta: "lib/sales-assistant" },
  { carpeta: "app/(shell)/ventas" },
];
```

Si la carpeta `app/(shell)/ventas` todavía no existe, el recorrido tiene que tolerarlo: usar `existsSync` antes de `readdirSync`.

- [ ] **Step 2: Implementar `repository.ts`** con las funciones de arriba. Todas las consultas llevan `workspaceId` en el `where` de primer nivel o en `data`. Las escrituras por `id` usan `updateMany({ where: { id, workspaceId } })`, no `update({ where: { id } })`. Así el barrido pasa sin excepciones, salvo `workspacesConAlboomActivo` (que ya está declarada en Task 7).

- [ ] **Step 3: Correr el barrido y los tipos**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/ && pnpm --filter fotoffice exec tsc --noEmit -p . 2>&1 | grep sales-assistant`
Expected: PASS y sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/repository.ts apps/fotoffice/lib/sales-assistant/aislamiento.test.ts
git commit -m "Repositorio del asistente de ventas, aislado por workspace"
```

---

### Task 11: La sincronización

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/sync.ts`
- Test: `apps/fotoffice/lib/sales-assistant/sync.test.ts`

**Interfaces:**
- Consumes: `crearClienteAlboom`, `AlboomLoginError` y `AlboomApiError` (T6); `mapearOportunidad` y `movimientosDesde` (T5); `necesitaAnalisis` (T4); `armarContexto` (T8); `analizarOportunidad` e `iaDisponible` (T9); el repositorio (T10); las credenciales (T7).
- Produces:
  - `type DependenciasSync = { leerCredencial; crearCliente; repo; analizar; iaDisponible; ahora: () => Date; marcarCredencialRechazada }`, inyectables para el test.
  - `sincronizarWorkspace(workspaceId: string, opciones?: { forzarIds?: string[]; deps?: Partial<DependenciasSync>; deadlineMs?: number }): Promise<ResumenSync>`
  - `type ResumenSync = { estado: EstadoSync; leidas: number; analizadas: number; fallidas: number; pendientes: number; mensaje: string | null }`

Algoritmo:
1. Leer la credencial. Si no hay, devolver `{ estado: "ERROR_LOGIN", mensaje: "Falta conectar Alboom" }`.
2. `leerAjustes`. `crearCliente(cred)`.
   - Si lanza `AlboomLoginError`: `marcarCredencialRechazada`, `registrarSync(ERROR_LOGIN)` y devolver.
   - Si lanza `AlboomApiError`: `registrarSync(ERROR_ALBOOM, "No se pudo leer Alboom")` y devolver.
3. `listarAbiertas()`. Quedarse sólo con las de embudos en `pipelinesIncluded`. Si la lista está vacía no se incluye ninguna: se guarda estado OK con el mensaje "Elegí qué embudos incluir en Configuración" y se devuelve.
4. Para cada fila: si la oportunidad no existe en base, o su `modified` es posterior a la guardada, pedir `detalle(id)` y armar los movimientos; si no, reusar los movimientos del snapshot guardado. `mapearOportunidad` → `guardarOportunidad`.
5. `marcarNoVistasComoCerradas` con los ids leídos (solo si la lectura terminó entera).
6. Si `iaDisponible()`: para cada oportunidad guardada, `contextoDeAnalisis` → `necesitaAnalisis` (con `forzar` si su id está en `forzarIds` y `waitDays` de ajustes). Las que dan `analizar: true` van a una cola. Se procesan de a `ANALISIS_EN_PARALELO`, como mucho `MAX_ANALISIS_POR_CORRIDA`, cortando si `ahora() - inicio > deadlineMs` (por defecto 240 000). Por cada una: `armarContexto` → `analizar` → `guardarSugerencia`.
7. El estado final es `PARCIAL` si quedaron pendientes o hubo fallos; si no, `OK`. `registrarSync(estado, mensaje)`. El mensaje resume, por ejemplo: "Leí 42 oportunidades y analicé 12".

- [ ] **Step 1: Escribir el test que falla** con dependencias falsas: un repo en memoria (un `Map`), un cliente falso y un `analizar` falso. Casos:
  - sin credencial → ERROR_LOGIN;
  - login rechazado → marca la credencial y da ERROR_LOGIN;
  - Alboom caído → ERROR_ALBOOM, sin tocar oportunidades;
  - con `pipelinesIncluded` vacío no analiza nada y el mensaje pide elegir embudos;
  - una corrida normal lee 3 y analiza las 3 nuevas;
  - una segunda corrida sin cambios no llama a `analizar` (criterio de aceptación 6);
  - `forzarIds` fuerza sólo esa;
  - sin IA, sincroniza y no analiza;
  - el deadline corta y deja `pendientes > 0` con estado PARCIAL.

Para que el repo en memoria sea fácil de escribir, `DependenciasSync.repo` es una interfaz con **sólo** las funciones que usa `sync`: `leerAjustes`, `registrarSync`, `oportunidadGuardada` (de T10), `guardarOportunidad`, `marcarNoVistasComoCerradas`, `contextoDeAnalisis` y `guardarSugerencia`.

- [ ] **Step 2: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/sync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `sync.ts`** siguiendo el algoritmo. Las dependencias por defecto son las reales, importadas de sus módulos; el archivo empieza con `import "server-only";`. Para que el test las pueda reemplazar, `sincronizarWorkspace` arma `const d = { ...depsReales(), ...opciones?.deps }`, donde `depsReales()` es una función (no una constante de módulo), así importar el archivo en el test no toca Prisma.

- [ ] **Step 4: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/sales-assistant/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/sync.ts apps/fotoffice/lib/sales-assistant/sync.test.ts apps/fotoffice/lib/sales-assistant/repository.ts
git commit -m "Sincronización diaria: leer Alboom, decidir y analizar"
```

---

### Task 12: Acceso, acciones y pantallas

**Files:**
- Create: `apps/fotoffice/lib/sales-assistant/access.ts`
- Create: `apps/fotoffice/app/(shell)/ventas/actions.ts`
- Create: `apps/fotoffice/app/(shell)/ventas/page.tsx`
- Create: `apps/fotoffice/app/(shell)/ventas/suggestion-card.tsx`
- Create: `apps/fotoffice/app/(shell)/ventas/[id]/page.tsx`
- Create: `apps/fotoffice/app/(shell)/ventas/configuracion/page.tsx`
- Modify: `apps/fotoffice/lib/modules/submodules.ts`, `components/shell/shell-nav.tsx`, `components/shell/shell-sidebar.tsx`, `app/(shell)/layout.tsx`

**Antes de empezar:** leer `node_modules/next/dist/docs/` sobre Server Actions, `params` async y `searchParams` en Next 16. Leer `app/(shell)/coberturas/page.tsx`, `app/(shell)/coberturas/actions.ts` y un componente cliente de coberturas para copiar el estilo visual (clases Tailwind, encabezados, tarjetas) y la forma de devolver `PanelState`.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `requireSalesAssistantManager(): Promise<{ user; workspace; role }>`: módulo encendido; si no, `redirect("/dashboard?ventas=off")`. Rol con `canManageWorkspaceSettings`; si no, `redirect("/dashboard")`.
  - Acciones (`"use server"`, todas llaman primero a `requireSalesAssistantManager` y validan la entrada con zod):
    - `guardarConexionAction(prev, formData)`: campos `subdomain`, `username` y `password`. Prueba el login con `crearClienteAlboom` **antes** de guardar. Si la contraseña viene vacía y ya hay credencial, conserva la guardada. Devuelve `PanelState` con los embudos encontrados.
    - `desconectarAlboomAction()`
    - `guardarAjustesAction(prev, formData)`: `pipelinesIncluded[]`, `signature`, `voiceNotes`, `waitDays` (1–30) y `staleDays` (30–365).
    - `actualizarAhoraAction()`: respeta `MIN_MINUTOS_ENTRE_CORRIDAS` mirando `lastSyncAt`. Llama a `sincronizarWorkspace` y hace `revalidatePath("/ventas")`.
    - `marcarEnviadaAction(suggestionId, mensajeFinal)`: resuelve como ENVIADA con `editedMessage` si cambió, y registra un `MENSAJE_ENVIADO` con el texto.
    - `registrarResultadoAction(opportunityId, suggestionId | null, outcome, texto)`
    - `posponerAction(suggestionId, dias)` (1, 3 o 7) y `descartarAction(suggestionId)`
    - `archivarAction(opportunityId, archivar)` y `reanalizarAction(opportunityId)`: `sincronizarWorkspace(ws, { forzarIds: [externalId] })`.
  - `actorLabel`: el nombre visible del usuario, como lo arma coverages (buscar cómo se obtiene en `lib/coverages/events.ts`).

- [ ] **Step 1: `access.ts`**, con la forma de `lib/coverages/access.ts`, usando `SALES_ASSISTANT_MODULE_KEY` y `canManageWorkspaceSettings` de `@/lib/workspace-settings-access`.

- [ ] **Step 2: Menú.** En `submodules.ts` agregar:

```ts
const VENTAS: SubmoduleItem[] = [
  { href: "/ventas", label: "Bandeja", icon: "Inbox", description: "Qué hacer hoy con cada oportunidad.", requiresManage: true, activeMatch: "rest" },
  { href: "/ventas/configuracion", label: "Configuración", icon: "Settings", description: "Conexión con el CRM, embudos y tu forma de escribir.", requiresManage: true, activeMatch: "under" },
];
```

Registrarlo en el mapa junto a `[COVERAGES_MODULE_KEY]: COBERTURAS`. Replicar en `layout.tsx`, `shell-sidebar.tsx` y `shell-nav.tsx` exactamente lo que se hace con `coveragesEnabled` (un flag `salesAssistantEnabled`, la sección `<Section title="Ventas" …/>`) y confirmar que los íconos `Inbox` y `Settings` estén en `ICONOS`.

- [ ] **Step 3: `configuracion/page.tsx`.** Es un Server Component. Muestra:
  - la conexión: `resumenConexionAlboom`, con usuario, subdominio y estado. Si el estado es `NEEDS_RECONSENT`, un cartel rojo "Alboom rechazó el usuario". El formulario tiene los campos subdominio, usuario y contraseña; la contraseña nunca se precarga y lleva el placeholder "(guardada)" si ya existe;
  - los embudos, como casillas. La lista sale de `embudos()` sólo si hay conexión; si falla, se muestran los guardados;
  - "Tu voz": firma, indicaciones, `waitDays` y `staleDays`.
  Los formularios que devuelven estado usan `useActionState` en un componente cliente chico, siguiendo el patrón de coberturas.

- [ ] **Step 4: `page.tsx` (bandeja).** Server Component con `searchParams.filtro` (HOY por defecto). Tiene:
  - un encabezado con los contadores de los cuatro filtros, `lastSyncAt` formateado en `SALES_TIME_ZONE` y el botón "Actualizar ahora";
  - un cartel según `lastSyncStatus`: ERROR_LOGIN en rojo con enlace a configuración, ERROR_ALBOOM en amarillo con la fecha de la última sincronización buena, y otro cartel si `!iaDisponible()` ("Sin sugerencias: falta configurar la IA");
  - si no hay conexión, un estado vacío con enlace a Configuración;
  - una lista de `<SuggestionCard>`.

- [ ] **Step 5: `suggestion-card.tsx`** (`"use client"`). Recibe una `TarjetaBandeja` más `whatsappDisponible: boolean` y `alboomUrl: string` (`https://{subdomain}.alboomcrm.com/#/leads/view/{externalId}`). Muestra:
  - nombre, tipo de evento, fecha y "en N días", etapa, la acción (`ETIQUETA_ACCION`) con color por prioridad, y el motivo;
  - el mensaje en un `<textarea>` editable (sólo si la acción lleva mensaje);
  - **Abrir WhatsApp**: arma el enlace del lado del cliente con `enlaceWhatsapp(telefono, textoActual)` (`phone.ts` es puro, así que se puede importar). Lo abre con `window.open(url, "_blank", "noopener")` y después llama a `marcarEnviadaAction`. Si el número no sirve, en lugar del botón muestra "Número inválido en Alboom";
  - después de enviar, cinco botones de resultado (`ETIQUETA_RESULTADO`) y un campo "¿Qué respondió?" opcional que llaman a `registrarResultadoAction`;
  - Posponer (1/3/7), Descartar, "Ver en Alboom" y un enlace al detalle `/ventas/{oportunidadId}`;
  - en PARA_CERRAR: el `motivoCierre` y los botones "Archivar en el asistente" y "Abrir en Alboom".

- [ ] **Step 6: `[id]/page.tsx`.** Usa `detalleOportunidad`. Muestra los datos, una línea de tiempo que mezcla movimientos y seguimientos ordenados por fecha, las sugerencias anteriores con su estado y los botones "Volver a analizar" y "Archivar/Desarchivar". Si no existe o es de otro workspace: `notFound()`.

- [ ] **Step 7: Tipos, lint y tests**

Run: `pnpm --filter fotoffice exec tsc --noEmit -p . 2>&1 | grep -E "ventas|sales-assistant|shell" ; pnpm --filter fotoffice lint 2>&1 | grep -E "ventas|sales-assistant" ; pnpm --filter fotoffice test 2>&1 | tail -5`
Expected: sin errores nuevos. El barrido de aislamiento ahora incluye `app/(shell)/ventas` y tiene que seguir en verde.

- [ ] **Step 8: Commit**

```bash
git add apps/fotoffice/lib/sales-assistant/access.ts "apps/fotoffice/app/(shell)/ventas" apps/fotoffice/lib/modules/submodules.ts apps/fotoffice/components/shell/shell-nav.tsx apps/fotoffice/components/shell/shell-sidebar.tsx "apps/fotoffice/app/(shell)/layout.tsx"
git commit -m "Pantallas del asistente de ventas: bandeja, detalle y configuración"
```

---

### Task 13: Tarea programada

**Files:**
- Create: `apps/fotoffice/app/api/cron/ventas/route.ts`
- Modify: `apps/fotoffice/vercel.json`

**Interfaces:**
- Consumes: `sincronizarWorkspace` (T11), `workspacesConAlboomActivo` (T7), `isModuleEnabledForWorkspace`, `isAuthorizedCronRequest` y `sanitizeError`.

- [ ] **Step 1: Crear la ruta** copiando la estructura de `app/api/cron/sorteos/route.ts`. Recorre `workspacesConAlboomActivo()`, se salta los que no tienen el módulo encendido y llama a `sincronizarWorkspace(id, { deadlineMs })`. `deadlineMs` es lo que queda de 270 s repartido entre los workspaces pendientes. Responde `{ ok: true, resultados: [{ workspaceId, estado, leidas, analizadas }] }`. Un workspace que falla no corta a los demás: `try/catch` por workspace y log con `sanitizeError`.

- [ ] **Step 2: Agregar el cron a `vercel.json`**

```json
    {
      "path": "/api/cron/ventas",
      "schedule": "0 10 * * *"
    }
```

- [ ] **Step 3: Tipos**

Run: `pnpm --filter fotoffice exec tsc --noEmit -p . 2>&1 | grep cron/ventas`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add apps/fotoffice/app/api/cron/ventas/route.ts apps/fotoffice/vercel.json
git commit -m "Tarea diaria del asistente de ventas"
```

---

### Task 14: Verificación completa

- [ ] **Step 1: Tests de FOTOFFICE**: `pnpm --filter fotoffice test`. Todo en verde.
- [ ] **Step 2: Build de FOTOFFICE**: `pnpm --filter fotoffice build`. El build chequea tipos e incluye los tests; tiene que terminar sin errores.
- [ ] **Step 3: El lockfile no rompió otras apps**: correr `pnpm --filter compramelafoto build`, `pnpm --filter clickaton build` y `pnpm --filter fotorank build`, o como mínimo `pnpm install --frozen-lockfile` más el typecheck de cada una, si el build completo tarda demasiado. Comparar contra `origin/main`: un error que ya estaba allá no cuenta.
- [ ] **Step 4: Prueba manual en local** (`next dev` en el puerto 3010, contra una rama Neon de prueba, nunca contra `development`):
  1. encender el módulo en un workspace de prueba;
  2. cargar la credencial real de Alboom en Configuración (la ingresa Daniel);
  3. elegir el embudo;
  4. Actualizar ahora;
  5. revisar la bandeja, abrir WhatsApp de una tarjeta, registrar un resultado y volver a analizar.
- [ ] **Step 5: Push de la rama y PR** con un resumen en español, lo que queda pendiente de configurar (la SQL en las cinco bases, `ANTHROPIC_API_KEY` y encender el módulo en el workspace de DNX), y el pie `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
