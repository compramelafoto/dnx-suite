# UX de jurados y usuarios en FotoRank — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ninguna pantalla de jurados o usuarios muestre palabras de la base de datos, y que cada una se entienda de un vistazo.

**Architecture:** Un solo módulo traduce cada estado a castellano y a un tono visual, con pruebas propias. Ninguna pantalla imprime un enum. Es el mismo patrón que Clickatón ya usa en `lib/admin-registration/ui/admin-status-presentation.ts`. Después se recorren las once pantallas del alcance aplicándolo, junto con las reglas de fechas, identificadores y estados vacíos.

**Tech Stack:** Next.js 16.2 (App Router), TypeScript, `node:test` con `tsx --test`, `@repo/design-system`.

**Spec:** `docs/superpowers/specs/2026-09-20-fotorank-altas-de-jurados-y-ux-design.md`, sección 8.

**Worktree:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-jurado-unico`.

**Depende de:** el plan `2026-09-20-fotorank-altas-de-jurados.md`, sólo para la Task 6 (la cola de revisión tiene que existir antes de vestirla). Las tareas 1 a 5 se pueden hacer en paralelo.

## Global Constraints

- **Ninguna pantalla muestra palabras de la base de datos.** Ni enums, ni nombres de columna, ni identificadores.
- **No cambian rutas, permisos ni comportamiento.** Es presentación: si una pantalla hoy hace algo, después lo sigue haciendo igual.
- **Ninguna pantalla de concurso se toca**, ni pública ni administrativa. En `/super-admin`, sólo la sección `#usuarios`.
- **Un valor de enum desconocido no rompe la pantalla:** se muestra tal cual, en tono neutro.
- Valores reales de los enums, tomados de `packages/db/prisma/schema.prisma`:
  - `FotorankJudgeAccountStatus`: `INVITED`, `PENDING_REGISTRATION`, `ACTIVE`, `SUSPENDED`, `DISABLED`
  - `FotorankJudgeInvitationStatus`: `DRAFT`, `SENT`, `OPENED`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `REVOKED`
  - `FotorankJudgeAssignmentStatus`: `ASSIGNED`, `INVITATION_SENT`, `ACCEPTED`, `REJECTED`, `IN_PROGRESS`, `COMPLETED`, `EXTENDED`, `REPLACED_BY_BACKUP`
  - `FotorankJudgeDirectoryInviteStatus`: `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `ARCHIVED`
  - `FotorankJudgeMembershipStatus`: `ACTIVE`, `INVITED`, `DISABLED`
  - `FotorankJudgeAssignmentType`: `PRIMARY`, `BACKUP`

---

### Task 1: El módulo de presentación

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/judgePresentation.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/judgePresentation.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export type Tono = "neutral" | "exito" | "atencion" | "peligro" | "progreso";
  export type Presentacion = { texto: string; tono: Tono; ayuda?: string };
  export function presentarEstadoDeCuenta(v: string): Presentacion;
  export function presentarEstadoDeInvitacion(v: string): Presentacion;
  export function presentarEstadoDeAsignacion(v: string): Presentacion;
  export function presentarEstadoDePropuesta(v: string): Presentacion;
  export function presentarEstadoDeMembresia(v: string): Presentacion;
  export function presentarTipoDeAsignacion(v: string): Presentacion;
  export function presentarEstadoDeRevision(v: string): Presentacion;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/ui/judgePresentation.test.ts`:

```ts
/**
 * La lista de jurados mostraba ACTIVE y SUSPENDED, y las invitaciones el
 * estado crudo. Son palabras de la base filtrándose a la pantalla.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  presentarEstadoDeCuenta,
  presentarEstadoDeInvitacion,
  presentarEstadoDeAsignacion,
  presentarEstadoDePropuesta,
  presentarEstadoDeMembresia,
  presentarTipoDeAsignacion,
  presentarEstadoDeRevision,
} from "./judgePresentation";

const TODOS = {
  presentarEstadoDeCuenta: ["INVITED", "PENDING_REGISTRATION", "ACTIVE", "SUSPENDED", "DISABLED"],
  presentarEstadoDeInvitacion: ["DRAFT", "SENT", "OPENED", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED"],
  presentarEstadoDeAsignacion: [
    "ASSIGNED", "INVITATION_SENT", "ACCEPTED", "REJECTED",
    "IN_PROGRESS", "COMPLETED", "EXTENDED", "REPLACED_BY_BACKUP",
  ],
  presentarEstadoDePropuesta: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED", "ARCHIVED"],
  presentarEstadoDeMembresia: ["ACTIVE", "INVITED", "DISABLED"],
  presentarTipoDeAsignacion: ["PRIMARY", "BACKUP"],
  presentarEstadoDeRevision: ["PENDING", "APPROVED", "REJECTED"],
} as const;

const FUNCIONES = {
  presentarEstadoDeCuenta,
  presentarEstadoDeInvitacion,
  presentarEstadoDeAsignacion,
  presentarEstadoDePropuesta,
  presentarEstadoDeMembresia,
  presentarTipoDeAsignacion,
  presentarEstadoDeRevision,
};

test("cada valor de cada enum tiene un texto en castellano", () => {
  for (const [nombre, valores] of Object.entries(TODOS)) {
    const fn = FUNCIONES[nombre as keyof typeof FUNCIONES];
    for (const v of valores) {
      const p = fn(v);
      assert.ok(p.texto.length > 0, `${nombre}(${v}) sin texto`);
      assert.notEqual(p.texto, v, `${nombre}(${v}) devuelve el enum crudo`);
      assert.ok(
        !/^[A-Z_]+$/.test(p.texto),
        `${nombre}(${v}) devuelve algo que parece un enum: ${p.texto}`,
      );
    }
  }
});

test("ningún texto tiene guión bajo ni mayúsculas de enum", () => {
  for (const [nombre, valores] of Object.entries(TODOS)) {
    const fn = FUNCIONES[nombre as keyof typeof FUNCIONES];
    for (const v of valores) {
      assert.ok(!fn(v).texto.includes("_"), `${nombre}(${v}) tiene guión bajo`);
    }
  }
});

test("los estados que exigen atención no se pintan como si todo estuviera bien", () => {
  assert.equal(presentarEstadoDeCuenta("SUSPENDED").tono, "peligro");
  assert.equal(presentarEstadoDeCuenta("ACTIVE").tono, "exito");
  assert.equal(presentarEstadoDeInvitacion("EXPIRED").tono, "atencion");
  assert.equal(presentarEstadoDeAsignacion("IN_PROGRESS").tono, "progreso");
  assert.equal(presentarEstadoDeAsignacion("COMPLETED").tono, "exito");
  assert.equal(presentarEstadoDeRevision("REJECTED").tono, "peligro");
  assert.equal(presentarEstadoDeRevision("APPROVED").tono, "exito");
});

test("un valor desconocido no rompe la pantalla", () => {
  const p = presentarEstadoDeCuenta("LO_QUE_SEA");
  assert.equal(p.tono, "neutral");
  assert.ok(p.texto.length > 0);
});

test("los textos concretos que se acordaron", () => {
  assert.equal(presentarEstadoDeCuenta("ACTIVE").texto, "Activo");
  assert.equal(presentarEstadoDeCuenta("SUSPENDED").texto, "Suspendido");
  assert.equal(presentarEstadoDeCuenta("INVITED").texto, "Invitado");
  assert.equal(presentarEstadoDeCuenta("PENDING_REGISTRATION").texto, "Falta que se registre");
  assert.equal(presentarEstadoDeAsignacion("INVITATION_SENT").texto, "Invitación enviada");
  assert.equal(presentarEstadoDeAsignacion("IN_PROGRESS").texto, "Evaluando");
  assert.equal(presentarEstadoDeAsignacion("REPLACED_BY_BACKUP").texto, "Reemplazado por el suplente");
  assert.equal(presentarTipoDeAsignacion("PRIMARY").texto, "Titular");
  assert.equal(presentarTipoDeAsignacion("BACKUP").texto, "Suplente");
  assert.equal(presentarEstadoDeRevision("PENDING").texto, "En revisión");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/ui/judgePresentation.test.ts
```
Esperado: FAIL con "Cannot find module './judgePresentation'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/ui/judgePresentation.ts`:

```ts
/**
 * Traduce los estados de jurado a palabras que una persona entiende.
 *
 * Única fuente: ninguna pantalla imprime un enum. Si una pantalla necesita un
 * texto que no está acá, se agrega acá, no en la pantalla.
 */
export type Tono = "neutral" | "exito" | "atencion" | "peligro" | "progreso";

export type Presentacion = { texto: string; tono: Tono; ayuda?: string };

function buscar(tabla: Record<string, Presentacion>, valor: string): Presentacion {
  return tabla[valor] ?? { texto: "Sin definir", tono: "neutral" };
}

const CUENTA: Record<string, Presentacion> = {
  INVITED: { texto: "Invitado", tono: "atencion", ayuda: "Recibió la invitación y todavía no entró." },
  PENDING_REGISTRATION: {
    texto: "Falta que se registre",
    tono: "atencion",
    ayuda: "Tiene la invitación abierta pero no completó su cuenta.",
  },
  ACTIVE: { texto: "Activo", tono: "exito" },
  SUSPENDED: { texto: "Suspendido", tono: "peligro", ayuda: "No puede entrar hasta que se lo reactive." },
  DISABLED: { texto: "Dado de baja", tono: "neutral" },
};

const INVITACION: Record<string, Presentacion> = {
  DRAFT: { texto: "Sin enviar", tono: "neutral" },
  SENT: { texto: "Enviada", tono: "progreso" },
  OPENED: { texto: "Abierta", tono: "progreso" },
  ACCEPTED: { texto: "Aceptada", tono: "exito" },
  REJECTED: { texto: "Rechazada", tono: "peligro" },
  EXPIRED: { texto: "Vencida", tono: "atencion", ayuda: "Hay que generar un enlace nuevo." },
  REVOKED: { texto: "Anulada", tono: "neutral" },
};

const ASIGNACION: Record<string, Presentacion> = {
  ASSIGNED: { texto: "Asignado", tono: "neutral" },
  INVITATION_SENT: { texto: "Invitación enviada", tono: "progreso" },
  ACCEPTED: { texto: "Confirmado", tono: "exito" },
  REJECTED: { texto: "No aceptó", tono: "peligro" },
  IN_PROGRESS: { texto: "Evaluando", tono: "progreso" },
  COMPLETED: { texto: "Terminó de evaluar", tono: "exito" },
  EXTENDED: { texto: "Con prórroga", tono: "atencion" },
  REPLACED_BY_BACKUP: { texto: "Reemplazado por el suplente", tono: "neutral" },
};

const PROPUESTA: Record<string, Presentacion> = {
  PENDING: { texto: "Esperando respuesta", tono: "progreso" },
  ACCEPTED: { texto: "Aceptada", tono: "exito" },
  REJECTED: { texto: "Rechazada", tono: "peligro" },
  CANCELLED: { texto: "Cancelada", tono: "neutral" },
  EXPIRED: { texto: "Vencida", tono: "atencion" },
  ARCHIVED: { texto: "Archivada", tono: "neutral" },
};

const MEMBRESIA: Record<string, Presentacion> = {
  ACTIVE: { texto: "En la organización", tono: "exito" },
  INVITED: { texto: "Invitado", tono: "atencion" },
  DISABLED: { texto: "Fuera de la organización", tono: "neutral" },
};

const TIPO: Record<string, Presentacion> = {
  PRIMARY: { texto: "Titular", tono: "neutral" },
  BACKUP: { texto: "Suplente", tono: "neutral", ayuda: "Evalúa sólo si el titular no puede." },
};

const REVISION: Record<string, Presentacion> = {
  PENDING: { texto: "En revisión", tono: "progreso" },
  APPROVED: { texto: "Aprobado", tono: "exito" },
  REJECTED: { texto: "Rechazado", tono: "peligro" },
};

export function presentarEstadoDeCuenta(v: string): Presentacion { return buscar(CUENTA, v); }
export function presentarEstadoDeInvitacion(v: string): Presentacion { return buscar(INVITACION, v); }
export function presentarEstadoDeAsignacion(v: string): Presentacion { return buscar(ASIGNACION, v); }
export function presentarEstadoDePropuesta(v: string): Presentacion { return buscar(PROPUESTA, v); }
export function presentarEstadoDeMembresia(v: string): Presentacion { return buscar(MEMBRESIA, v); }
export function presentarTipoDeAsignacion(v: string): Presentacion { return buscar(TIPO, v); }
export function presentarEstadoDeRevision(v: string): Presentacion { return buscar(REVISION, v); }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/ui/judgePresentation.test.ts
```
Esperado: PASS, 5 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-presentation": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/ui/judgePresentation.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-presentation
git add apps/fotorank/app/lib/fotorank/judges/ui apps/fotorank/package.json
git commit -m "Traducir los estados de jurado a palabras que se entienden

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Las fechas en lenguaje humano

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/tiempoRelativo.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/tiempoRelativo.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export function tiempoRelativo(fecha: Date | null, ahora: Date): string;
  export function fechaExacta(fecha: Date | null): string;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/ui/tiempoRelativo.test.ts`:

```ts
/**
 * "Último acceso: 19/9/2026, 14:32:07" obliga a hacer la cuenta mentalmente.
 * La fecha exacta queda en el title, para cuando de verdad hace falta.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { tiempoRelativo, fechaExacta } from "./tiempoRelativo";

const AHORA = new Date("2026-09-20T12:00:00.000Z");

function haceMinutos(n: number) { return new Date(AHORA.getTime() - n * 60_000); }
function haceHoras(n: number) { return new Date(AHORA.getTime() - n * 3_600_000); }
function haceDias(n: number) { return new Date(AHORA.getTime() - n * 86_400_000); }

test("sin fecha, lo dice sin asustar", () => {
  assert.equal(tiempoRelativo(null, AHORA), "sin actividad");
});

test("hace instantes", () => {
  assert.equal(tiempoRelativo(haceMinutos(0), AHORA), "recién");
  assert.equal(tiempoRelativo(haceMinutos(1), AHORA), "hace 1 minuto");
  assert.equal(tiempoRelativo(haceMinutos(5), AHORA), "hace 5 minutos");
});

test("horas y días en singular y plural", () => {
  assert.equal(tiempoRelativo(haceHoras(1), AHORA), "hace 1 hora");
  assert.equal(tiempoRelativo(haceHoras(3), AHORA), "hace 3 horas");
  assert.equal(tiempoRelativo(haceDias(1), AHORA), "ayer");
  assert.equal(tiempoRelativo(haceDias(2), AHORA), "hace 2 días");
});

test("pasado el mes, meses; pasado el año, años", () => {
  assert.equal(tiempoRelativo(haceDias(45), AHORA), "hace 1 mes");
  assert.equal(tiempoRelativo(haceDias(200), AHORA), "hace 6 meses");
  assert.equal(tiempoRelativo(haceDias(400), AHORA), "hace 1 año");
});

test("una fecha futura no dice 'hace'", () => {
  const manana = new Date(AHORA.getTime() + 86_400_000);
  assert.equal(tiempoRelativo(manana, AHORA), "en 1 día");
});

test("la fecha exacta va en formato local argentino", () => {
  assert.ok(fechaExacta(new Date("2026-09-19T17:32:07.000Z")).includes("2026"));
  assert.equal(fechaExacta(null), "");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/ui/tiempoRelativo.test.ts
```
Esperado: FAIL con "Cannot find module './tiempoRelativo'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/ui/tiempoRelativo.ts` usando
`Intl.RelativeTimeFormat("es-AR", { numeric: "auto" })` —que da "ayer" en lugar de "hace 1
día"— con estos cortes: menos de 1 minuto → `"recién"`; menos de 1 hora → minutos; menos
de 1 día → horas; menos de 30 días → días; menos de 365 → meses; el resto → años. Sin
fecha, devuelve `"sin actividad"`.

`fechaExacta` usa `toLocaleString("es-AR")`, y con `null` devuelve `""`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/ui/tiempoRelativo.test.ts
```
Esperado: PASS, 6 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-tiempo-relativo": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/ui/tiempoRelativo.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-tiempo-relativo
git add apps/fotorank/app/lib/fotorank/judges/ui apps/fotorank/package.json
git commit -m "Decir hace cuánto en lugar de una fecha con segundos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La tarjeta de jurado, una sola vez

**Files:**
- Create: `apps/fotorank/app/components/jurados/JudgeCard.tsx`
- Create: `apps/fotorank/app/components/jurados/EstadoBadge.tsx`
- Create: `apps/fotorank/app/components/jurados/PantallaVacia.tsx`
- Create: `apps/fotorank/app/components/jurados/CopiarIdentificador.tsx`

**Interfaces:**
- Consumes: `Presentacion` y `Tono` (Task 1), `tiempoRelativo`/`fechaExacta` (Task 2), `judgeAvatarSrc` del plan de altas.
- Produces:
  ```tsx
  export function EstadoBadge({ presentacion }: { presentacion: Presentacion }): JSX.Element;
  export function JudgeCard(props: {
    nombre: string;
    titular?: string | null;
    email?: string | null;
    avatarSrc: string | null;
    estado?: Presentacion;
    ultimaActividad?: Date | null;
    acciones?: React.ReactNode;
    href?: string;
  }): JSX.Element;
  export function PantallaVacia({ titulo, queHacer, accion }: { titulo: string; queHacer: string; accion?: React.ReactNode }): JSX.Element;
  export function CopiarIdentificador({ id, etiqueta }: { id: string; etiqueta?: string }): JSX.Element;
  ```

- [ ] **Step 1: Write EstadoBadge**

Mapea cada `Tono` a las clases del design system que ya usa la app. Si `presentacion.ayuda`
existe, va en el `title` del elemento. Nunca recibe un enum: recibe una `Presentacion`.

- [ ] **Step 2: Write JudgeCard**

Una tarjeta, siempre la misma: retrato redondo de 48 px (o las iniciales sobre un círculo
si no hay foto), nombre como título, titular profesional debajo, email en gris y más chico
en tercera línea, `EstadoBadge` a la derecha, y la última actividad en
`tiempoRelativo(...)` con `title={fechaExacta(...)}`.

- [ ] **Step 3: Write PantallaVacia**

Título, una frase que dice **qué hacer** —no sólo que está vacío— y un botón opcional.

- [ ] **Step 4: Write CopiarIdentificador**

Un botón chico que copia el identificador al portapapeles y muestra "Copiado" por dos
segundos. El identificador **no se muestra**: sólo se copia.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint
git add apps/fotorank/app/components/jurados
git commit -m "Una sola tarjeta de jurado para todas las pantallas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Las pantallas del organizador

**Files:**
- Modify: `apps/fotorank/app/(dashboard)/jurados/page.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/nuevo/page.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/[judgeId]/editar/page.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/invitaciones/page.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/asignaciones/page.tsx`

**Interfaces:**
- Consumes: todo lo de las tareas 1, 2 y 3.

- [ ] **Step 1: Rewrite the judges list**

`app/(dashboard)/jurados/page.tsx` pasa a usar `JudgeCard`. En concreto:

- `<Badge variant="neutral">{String(j.accountStatus)}</Badge>` → `<EstadoBadge presentacion={presentarEstadoDeCuenta(j.accountStatus)} />`
- `Último acceso: {new Date(...).toLocaleString("es-AR")}` → `tiempoRelativo(j.lastLoginAt, new Date())` con `title={fechaExacta(j.lastLoginAt)}`
- `Todavía no hay jurados.` → `<PantallaVacia titulo="Todavía no hay jurados" queHacer="Podés cargar uno a mano, o compartir el enlace de postulación para que se presenten solos." accion={…} />`
- Se eliminan los `String(...)` y los `as any`: se tipa el retorno de `listJudgesForOrg`.

- [ ] **Step 2: Type the action's return**

`listJudgesForOrg` hoy devuelve `Array<Record<string, unknown>>` y la pantalla lo castea
con `as any`. Declarar el tipo concreto:

```ts
export type JudgeListRow = {
  judgeId: string;
  email: string;
  accountStatus: string;
  lastLoginAt: Date | null;
  profile: { id: string; firstName: string; lastName: string; professionalHeadline: string | null; avatarUrl: string | null } | null;
};
```

y devolver `JudgeActionResult<JudgeListRow[]>`.

- [ ] **Step 3: Apply to the other four screens**

Mismo criterio en cada una: `EstadoBadge` en lugar del estado crudo, `tiempoRelativo` en
lugar de la fecha completa, `PantallaVacia` en lugar del texto suelto, `CopiarIdentificador`
donde hoy se ve un identificador. En `/jurados/invitaciones`,
`presentarEstadoDeInvitacion`; en `/jurados/asignaciones`, `presentarEstadoDeAsignacion` y
`presentarTipoDeAsignacion`.

- [ ] **Step 4: Verify nothing prints an enum**

```bash
cd apps/fotorank && grep -rnE "\{String\(.*[Ss]tatus\)\}|\{[a-z]+\.(accountStatus|invitationStatus|assignmentStatus|membershipStatus)\}" "app/(dashboard)/jurados" | grep -v node_modules
```
Esperado: sin resultados.

```bash
npx tsc --noEmit && pnpm lint
```
Esperado: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add "apps/fotorank/app/(dashboard)/jurados" apps/fotorank/app/actions/judges.ts
git commit -m "Limpiar las pantallas de jurados del organizador

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: El directorio, la auditoría y el portal del jurado

**Files:**
- Modify: `apps/fotorank/app/(dashboard)/jurados/directorio/page.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/directorio/[judgeId]/page.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/directorio/invitaciones/SentDirectoryInvitationsClient.tsx:50`
- Modify: `apps/fotorank/app/(dashboard)/jurados/auditoria/page.tsx`
- Modify: `apps/fotorank/app/jurado/invitaciones/JudgeDirectoryInvitationsClient.tsx:56`

- [ ] **Step 1: Group the directory filters**

Los filtros del directorio pasan a una barra única, con el conteo al lado: *"12 jurados"*.
Cada filtro activo se puede sacar con una cruz.

- [ ] **Step 2: Remove the four dead statistics**

En `app/(dashboard)/jurados/directorio/[judgeId]/page.tsx` (alrededor de la línea 114), se
quitan de la pantalla `completedJuryAssignmentsCount`, `responseRate`,
`avgResponseTimeHours` y `completionScore`. **Las columnas no se borran**: eso va con las
estadísticas calculadas, que están fuera de esta entrega.

En su lugar: *"Todavía no hay participaciones registradas."*

- [ ] **Step 3: Translate the two raw statuses**

- `SentDirectoryInvitationsClient.tsx:50`: `{r.status}` → `<EstadoBadge presentacion={presentarEstadoDePropuesta(r.status)} />`
- `JudgeDirectoryInvitationsClient.tsx:56`: `{r.status}` → lo mismo.

- [ ] **Step 4: Make the audit log readable**

Cada hecho se lee como una oración: *"Aprobó la ficha de Ana Pérez — hace 2 días"*, no como
una fila de columnas con el nombre del evento en mayúsculas.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint && pnpm test:judge-presentation
grep -rnE "\{r\.status\}|\{[a-z]+\.status\}" "app/(dashboard)/jurados" app/jurado | grep -v node_modules
```
Esperado: 0 errores y sin resultados en el grep.

```bash
git add "apps/fotorank/app/(dashboard)/jurados" apps/fotorank/app/jurado
git commit -m "Limpiar el directorio, la auditoría y el portal del jurado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Super Admin — la cola y la sección de usuarios

**Depende de:** Task 12 del plan de altas (la cola tiene que existir).

**Files:**
- Modify: `apps/fotorank/app/(home)/super-admin/jurados/page.tsx`
- Modify: `apps/fotorank/app/(home)/super-admin/page.tsx` (**sólo** la sección `#usuarios`, línea 166)

- [ ] **Step 1: Dress the review queue**

La cola usa `JudgeCard`, `EstadoBadge` con `presentarEstadoDeRevision`, y `PantallaVacia`
cuando no hay nada. El cuadro de rechazo no deja confirmar con el motivo vacío y explica
que el jurado va a leer ese texto.

- [ ] **Step 2: Clean the users section**

En la sección `#usuarios`, la misma tarjeta, el rol traducido al castellano, y la última
actividad en tiempo relativo. **Las secciones de Organizaciones, Concursos, Configuración
global y Logs no se tocan.**

- [ ] **Step 3: Verify the untouched sections**

```bash
cd apps/fotorank && git diff --stat "app/(home)/super-admin/page.tsx"
git diff "app/(home)/super-admin/page.tsx" | grep -E "^[+-]" | grep -iE "organizacion|concurso|configuracion|log"
```
Esperado: el segundo comando sin resultados — ninguna línea de esas secciones cambió.

- [ ] **Step 4: Commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint
git add "apps/fotorank/app/(home)/super-admin"
git commit -m "Limpiar la cola de revisión y la lista de usuarios

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: La prueba que impide la recaída

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/sinEnumsEnPantalla.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: nada. Lee los archivos de las pantallas del alcance y falla si encuentra un
  enum impreso.

- [ ] **Step 1: Write the test**

```ts
/**
 * El día que alguien agregue una pantalla nueva y escriba {x.status}, esta
 * prueba se lo dice antes de que llegue a producción.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const RAICES = ["app/(dashboard)/jurados", "app/jurado", "app/(home)/super-admin/jurados"];

// {algo.status}, {algo.accountStatus}, {String(algo.status)} y parientes.
const SOSPECHOSO =
  /\{\s*(?:String\()?[A-Za-z_$][\w$]*\.(?:status|accountStatus|invitationStatus|assignmentStatus|membershipStatus|directoryReviewStatus|assignmentType)\)?\s*\}/;

function archivos(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(archivos(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("ninguna pantalla de jurados imprime un estado de la base", () => {
  const culpables: string[] = [];
  for (const raiz of RAICES) {
    let lista: string[];
    try {
      lista = archivos(raiz);
    } catch {
      continue; // la carpeta puede no existir todavía
    }
    for (const f of lista) {
      const contenido = readFileSync(f, "utf8");
      contenido.split("\n").forEach((linea, i) => {
        if (SOSPECHOSO.test(linea)) culpables.push(`${f}:${i + 1}  ${linea.trim()}`);
      });
    }
  }
  assert.deepEqual(
    culpables,
    [],
    `Estas líneas imprimen un estado crudo. Usá judgePresentation:\n${culpables.join("\n")}`,
  );
});
```

- [ ] **Step 2: Run it**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/ui/sinEnumsEnPantalla.test.ts
```
Esperado: PASS. Si falla, nombra el archivo y la línea: arreglarlos antes de seguir.

- [ ] **Step 3: Register and commit**

```json
"test:judge-sin-enums": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/ui/sinEnumsEnPantalla.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-sin-enums
git add apps/fotorank/app/lib/fotorank/judges/ui apps/fotorank/package.json
git commit -m "Impedir que vuelva a colarse un estado de la base en pantalla

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Cobertura de la sección 8 del spec:**

| Requisito | Tarea |
|---|---|
| Módulo de presentación con pruebas | 1 |
| Tabla de traducciones (estados, fechas, mensajes) | 1, 2 |
| Una tarjeta por persona | 3, 4 |
| Los identificadores desaparecen de la vista | 3 (`CopiarIdentificador`), 4, 5 |
| Fechas en lenguaje humano con la exacta en el `title` | 2, 3 |
| Cada pantalla vacía dice qué hacer | 3 (`PantallaVacia`), 4, 5, 6 |
| Los filtros se agrupan con el conteo | 5 |
| Se quitan las cuatro estadísticas que nadie escribe | 5 |
| Las once pantallas del alcance | 4 (1-3, 7-8), 5 (4-6, 9), 6 (10-11) |
| No cambian rutas, permisos ni comportamiento | verificación en cada tarea |
| `/super-admin` sólo en `#usuarios` | 6, con verificación explícita en el paso 3 |
| El mensaje técnico del registro | plan de altas, Task 5 |

La regla "ninguna pantalla muestra palabras de la base de datos" queda además defendida
por la prueba de la Task 7, que falla si alguien reincide.
