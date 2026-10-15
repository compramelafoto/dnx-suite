# Etapa 0.2 · Listado estándar — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sola pieza de listado (motor + componentes) que Clientes, Socios y Caja/movimientos usan para buscar, filtrar, ordenar, paginar, recordar filtros, guardar vistas, actuar en lote, exportar a Excel y abrir un panel al costado.

**Architecture:** El servidor arma la lista y la dirección de la página guarda el estado. Cada lista se declara en un archivo de definición (columnas, filtros, órdenes, `where` de Prisma, acciones en lote, panel). Un motor puro en `lib/listado/` valida la dirección contra la definición, resuelve períodos en hora de Buenos Aires, pagina, recuerda y ejecuta lotes; `components/listado/` lo dibuja con las clases `fo-*` existentes. Dos tablas nuevas propias de FOTOFFICE guardan vistas y actividad.

**Tech Stack:** Next.js 16 App Router (server components, server actions, route handlers), Prisma sobre `packages/db/prisma/schema.prisma`, Vitest 3 (entorno `node`, sólo `lib/**/*.test.ts` y `app/**/*.test.ts`), Tailwind v4 con tokens `--fo-*`, lucide-react, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-29-etapa-0-2-listado-estandar-design.md`

## Global Constraints

- Rama `feat/fotoffice-listado-estandar` creada **desde `feat/fotoffice-quien-ve-que`** (PR 277): usa `puede(rol, capacidad)` de `apps/fotoffice/lib/access/policy.ts`. Worktree propio: `~/Desktop/PROGRAMACIONES/dnx-fotoffice-listado` (otras sesiones comparten el índice de git del checkout principal).
- pnpm, nunca npm. **Ninguna dependencia nueva** (el lockfile es de todas las apps).
- No agregar columnas a `Workspace`, `WorkspaceMembership`, `WorkspaceFeatureModule` ni a ninguna tabla que lean otras apps. Sólo tablas nuevas `FotofficeListView` y `FotofficeListActivity` (los campos de relación inversa en `Workspace` son virtuales y están permitidos).
- La migración se escribe en `packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql` y **no se aplica a ninguna base**: la aplica Daniel (staging primero). Nada de `prisma migrate` contra bases remotas.
- Toda consulta lleva `workspaceId` de la sesión (nunca de la dirección ni del formulario).
- Filtros, valores y órdenes no declarados en la definición se descartan antes de llegar a Prisma.
- Filas por página: sólo `10 | 25 | 50 | 100`.
- Hora: siempre `America/Argentina/Buenos_Aires` (offset fijo `-03:00`; Argentina no usa horario de verano desde 2009).
- Tope de lote: 5.000 filas por defecto; "Invitar al portal" conserva su tope `INVITE_BATCH_MAX` (25) porque manda correos. Tope de exportación: 20.000 filas.
- Permisos: acciones en lote `operar`; exportar `verDinero`; vistas del equipo `configurar`; ver la lista = guarda de cada página, sin cambios.
- Caja: el cambio de rubro sólo toca `categoryId` de movimientos con `sourceModule = "manual"`, `transferId = null`, sin anular (`reversedBy` nulo), que no sean contramovimientos (`reversesMovementId = null`), y cuyo `kind` coincide con el `kind` del rubro. Nunca importe, cuenta ni fecha.
- Sin borrado en lote. Sin cambio de estado de socios en lote.
- Textos de interfaz en español rioplatense; en Socios, respetar el vocabulario del workspace (`loadPersonVocabulary`, `aplicarVocabulario`).
- Pruebas: `pnpm --filter fotoffice exec vitest run <ruta>`. Tipos: `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit`. Build: `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice build`.
- Commits en español, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sin push hasta el final; sin merge nunca.

## Decisiones tomadas al planificar (rulings)

1. **Lote de socios fila por fila.** `updateMember` ya abre su propia transacción con control de concurrencia y `MemberAudit`; se reutiliza por socio en vez de una transacción gigante (5.000 socios en una transacción bloquearía la tabla). El resultado informa aplicados y fallidos, y todo queda en `FotofficeListActivity`. Caja sí usa una sola transacción (`updateMany`). El spec §6 se ajusta en la Tarea 13.
2. **"Limpiar todo"** lleva a `?limpio=1`: guarda una consulta vacía como la última y muestra la lista sin filtros.
3. **Formato de la dirección:** `q`, `orden` (`campo` ascendente, `-campo` descendente), `pagina`, `filas`, `ver`, `limpio`, `vista` son reservados; cada filtro usa su propia clave. Período: `este-mes` o `2026-01-01..2026-03-31`.
4. **El filtro "cliente" de Caja** es un filtro de relación con buscador (server action), no un desplegable.
5. **Exportar socios:** los botones viejos se reemplazan por el botón común; la ruta `app/api/members/export` y sus pruebas se mantienen intactas.

## Mapa de archivos

**Motor (`apps/fotoffice/lib/listado/`)**
- `tipos.ts` — tipos de definición, consulta, contexto, acciones.
- `consulta.ts` + `consulta.test.ts` — leer/escribir la dirección.
- `periodos.ts` + `periodos.test.ts` — atajos y rangos en hora de Buenos Aires.
- `ejecutar.ts` + `ejecutar.test.ts` — validar relaciones, contar, paginar, traer.
- `csv.ts` + `csv.test.ts` — archivo para Excel.
- `vistas.ts` + `vistas.test.ts` — última consulta y vistas guardadas.
- `lote.ts` + `lote.test.ts` — resolver objetivo, recontar, tope, registrar.
- `actividad.ts` — escribir `FotofficeListActivity`.
- `acceso.ts` + `acceso.test.ts` — contexto para descargas (sin redirect) y chequeo de capacidades.
- `registro.ts` + `registro.test.ts` — clave → definición y guarda.
- `etiquetas.ts` + `etiquetas.test.ts` — chips de filtros activos.

**Acciones y rutas**
- `apps/fotoffice/app/actions/listado.ts` — vistas, lote (preparar/aplicar), buscar opciones de relación.
- `apps/fotoffice/app/api/listados/[clave]/exportar/route.ts` + `apps/fotoffice/lib/listado/exportar-aislamiento.test.ts`.

**Componentes (`apps/fotoffice/components/listado/`)**
- `listado.tsx` (server), `caja-de-busqueda.tsx`, `barra-de-filtros.tsx`, `filtro-relacion.tsx`, `etiquetas-de-filtro.tsx`, `menu-de-vistas.tsx`, `tabla.tsx`, `paginador.tsx`, `seleccion.tsx` (proveedor + casillas + barra), `panel-lateral.tsx`, `fila.tsx`.

**Listas**
- `apps/fotoffice/lib/clients/listado.ts` + `listado.test.ts`; `app/(shell)/clientes/page.tsx`.
- `apps/fotoffice/lib/members/listado.ts` + `listado.test.ts`; `app/(shell)/members/page.tsx`.
- `apps/fotoffice/lib/cash/listado-movimientos.ts` + `listado-movimientos.test.ts`; `app/(shell)/caja/movimientos/page.tsx`.

**Base**
- `packages/db/prisma/schema.prisma` (dos modelos + relaciones inversas en `Workspace` y `User`).
- `packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql`.
- `packages/db/docs/MIGRACION-LISTADO-ESTANDAR.md`.

---

### Task 1: Tipos y lectura de la dirección

**Files:**
- Create: `apps/fotoffice/lib/listado/tipos.ts`
- Create: `apps/fotoffice/lib/listado/consulta.ts`
- Test: `apps/fotoffice/lib/listado/consulta.test.ts`

**Interfaces:**
- Produces: tipos `DefinicionListado<F>`, `FiltroDef`, `ColumnaDef<F>`, `AccionLote`, `ContextoListado`, `ConsultaListado`, `FILAS_PERMITIDAS`, `PARAMETROS_RESERVADOS`; funciones `leerConsulta(def, params) → { consulta, descartados }`, `escribirConsulta(def, consulta, cambios?) → string` (query string sin `?`), `consultaVacia(def) → ConsultaListado`, `hayConsultaEnDireccion(params) → boolean`.

- [ ] **Step 1: Crear el worktree y la rama**

```bash
cd ~/Desktop/PROGRAMACIONES/dnx-suite
git fetch origin
git worktree add -b feat/fotoffice-listado-estandar ../dnx-fotoffice-listado origin/feat/fotoffice-quien-ve-que
cd ../dnx-fotoffice-listado && pnpm install --frozen-lockfile
```

- [ ] **Step 2: Escribir `tipos.ts`**

```ts
import type { ReactNode } from "react";
import type { Capacidad } from "@/lib/access/policy";

export const FILAS_PERMITIDAS = [10, 25, 50, 100] as const;
export type FilasPorPagina = (typeof FILAS_PERMITIDAS)[number];

/** Parámetros de la dirección que ninguna definición puede usar como clave de filtro. */
export const PARAMETROS_RESERVADOS = ["q", "orden", "pagina", "filas", "ver", "limpio", "vista"] as const;

export type Opcion = { valor: string; etiqueta: string };

export type FiltroDef =
  | { tipo: "opcion"; clave: string; etiqueta: string; opciones: readonly Opcion[] }
  /** Id de otra tabla (categoría, cuenta, cliente). Se valida contra el workspace en `ejecutar`. */
  | { tipo: "relacion"; clave: string; etiqueta: string; conBuscador?: boolean }
  | { tipo: "periodo"; clave: string; etiqueta: string }
  | { tipo: "siNo"; clave: string; etiqueta: string; si: string; no: string };

export type ConsultaListado = {
  q: string;
  /** clave de filtro → valor crudo ya validado en forma (no en existencia). */
  filtros: Record<string, string>;
  orden: { campo: string; desc: boolean };
  pagina: number;
  filas: FilasPorPagina;
  ver: string | null;
};

export type RangoFechas = { desde: Date; hasta: Date };

/** La consulta después de validar relaciones y resolver períodos. Es lo que reciben `contar`/`traer`. */
export type ConsultaResuelta = ConsultaListado & {
  periodos: Record<string, RangoFechas>;
  /** clave de filtro de relación → etiqueta legible (para los chips). */
  etiquetasRelacion: Record<string, string>;
};

export type ContextoListado = {
  workspaceId: string;
  workspaceName: string;
  userId: number;
  userLabel: string;
  role: string | null;
};

export type ColumnaDef<F> = {
  clave: string;
  titulo: string;
  celda: (fila: F) => ReactNode;
  /** Si está, la columna se ordena por este campo (debe figurar en `ordenes`). */
  orden?: string;
  /** Se esconde cuando el panel lateral está abierto y en pantallas chicas. */
  secundaria?: boolean;
  alinear?: "izquierda" | "derecha";
};

export type ColumnaExport<F> = {
  titulo: string;
  tipo: "texto" | "importe" | "fecha" | "fechaHora" | "numero";
  valor: (fila: F) => string | number | Date | null;
};

export type ResultadoLote = {
  aplicados: number;
  fallidos: { id: string; error: string }[];
  /** Antes/después por fila, para `FotofficeListActivity.detail`. */
  detalle: unknown[];
};

export type AccionLote = {
  clave: string;
  etiqueta: string;
  capacidad: Capacidad;
  maximo: number;
  /** Texto de confirmación. `{n}` = cantidad, `{parametro}` = etiqueta del parámetro elegido. */
  confirmacion: string;
  parametro?: { etiqueta: string; opciones: (ctx: ContextoListado) => Promise<Opcion[]> };
  /** Separa las filas que la acción no puede tocar, con el motivo. */
  elegibles?: (
    ctx: ContextoListado,
    ids: string[],
    parametro: string | null,
  ) => Promise<{ elegibles: string[]; excluidos: { id: string; motivo: string }[] }>;
  aplicar: (ctx: ContextoListado, ids: string[], parametro: string | null) => Promise<ResultadoLote>;
};

export type DefinicionListado<F> = {
  clave: string;
  titulo: string;
  /** Singular y plural para "Mostrando 1 a 25 de 40 {plural}". */
  sustantivo: { singular: string; plural: string };
  placeholderBusqueda: string;
  columnas: ColumnaDef<F>[];
  filtros: FiltroDef[];
  ordenes: readonly string[];
  ordenPorDefecto: { campo: string; desc: boolean };
  idDe: (fila: F) => string;
  hrefFicha: (id: string) => string;
  contar: (ctx: ContextoListado, c: ConsultaResuelta) => Promise<number>;
  traer: (ctx: ContextoListado, c: ConsultaResuelta, p: { skip: number; take: number }) => Promise<F[]>;
  /** Ids del resultado completo, en orden, hasta `tope`. Para "todos los resultados" y exportar. */
  traerIds: (ctx: ContextoListado, c: ConsultaResuelta, tope: number) => Promise<string[]>;
  /** Filas completas por id (exportar selección). Debe filtrar por workspaceId. */
  traerPorIds: (ctx: ContextoListado, ids: string[]) => Promise<F[]>;
  /** Devuelve la etiqueta si el id existe en el workspace, o null. */
  validarRelacion?: (ctx: ContextoListado, clave: string, id: string) => Promise<string | null>;
  opcionesRelacion?: (ctx: ContextoListado, clave: string) => Promise<Opcion[]>;
  buscarRelacion?: (ctx: ContextoListado, clave: string, texto: string) => Promise<Opcion[]>;
  acciones: AccionLote[];
  exportar: { columnas: ColumnaExport<F>[] };
  panel?: (ctx: ContextoListado, id: string) => Promise<ReactNode | null>;
};
```

- [ ] **Step 3: Escribir la prueba que falla (`consulta.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { escribirConsulta, hayConsultaEnDireccion, leerConsulta } from "./consulta";
import type { DefinicionListado } from "./tipos";

const def = {
  clave: "prueba",
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "ACTIVO", etiqueta: "Activo" }] },
    { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
    { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    { tipo: "siNo", clave: "deuda", etiqueta: "Deuda", si: "Con deuda", no: "Al día" },
  ],
  ordenes: ["nombre", "alta"],
  ordenPorDefecto: { campo: "nombre", desc: false },
} as unknown as DefinicionListado<unknown>;

const p = (s: string) => new URLSearchParams(s);

describe("leerConsulta", () => {
  it("sin parámetros devuelve los valores por defecto", () => {
    const { consulta, descartados } = leerConsulta(def, p(""));
    expect(consulta).toEqual({
      q: "", filtros: {}, orden: { campo: "nombre", desc: false }, pagina: 1, filas: 25, ver: null,
    });
    expect(descartados).toEqual([]);
  });

  it("lee búsqueda, filtros válidos, orden descendente, página, filas y ver", () => {
    const { consulta } = leerConsulta(
      def,
      p("q=%20perez%20&estado=ACTIVO&categoria=cat_1&alta=este-mes&deuda=si&orden=-alta&pagina=3&filas=50&ver=abc"),
    );
    expect(consulta).toEqual({
      q: "perez",
      filtros: { estado: "ACTIVO", categoria: "cat_1", alta: "este-mes", deuda: "si" },
      orden: { campo: "alta", desc: true },
      pagina: 3,
      filas: 50,
      ver: "abc",
    });
  });

  it("descarta filtros no declarados, valores fuera de lista y órdenes inventados", () => {
    const { consulta, descartados } = leerConsulta(
      def,
      p("workspaceId=otro&estado=BORRADO&orden=-password&filas=1000&pagina=-2&deuda=quizas&alta=ayer"),
    );
    expect(consulta.filtros).toEqual({});
    expect(consulta.orden).toEqual({ campo: "nombre", desc: false });
    expect(consulta.filas).toBe(25);
    expect(consulta.pagina).toBe(1);
    expect(descartados.sort()).toEqual(["alta", "deuda", "estado", "filas", "orden", "pagina", "workspaceId"]);
  });

  it("acepta un rango de período y rechaza rangos invertidos o mal formados", () => {
    expect(leerConsulta(def, p("alta=2026-01-01..2026-03-31")).consulta.filtros.alta).toBe("2026-01-01..2026-03-31");
    expect(leerConsulta(def, p("alta=2026-03-31..2026-01-01")).consulta.filtros.alta).toBeUndefined();
    expect(leerConsulta(def, p("alta=2026-13-01..2026-14-01")).consulta.filtros.alta).toBeUndefined();
  });

  it("un id de relación con caracteres raros se descarta", () => {
    expect(leerConsulta(def, p("categoria=a'%20OR%201=1")).consulta.filtros.categoria).toBeUndefined();
  });

  it("recorta la búsqueda a 100 caracteres", () => {
    expect(leerConsulta(def, p(`q=${"x".repeat(300)}`)).consulta.q).toHaveLength(100);
  });
});

describe("escribirConsulta", () => {
  it("omite lo que está en su valor por defecto", () => {
    const { consulta } = leerConsulta(def, p(""));
    expect(escribirConsulta(def, consulta)).toBe("");
  });

  it("aplica cambios y vuelve a la página 1 si cambia un filtro o la búsqueda", () => {
    const { consulta } = leerConsulta(def, p("estado=ACTIVO&pagina=4"));
    expect(escribirConsulta(def, consulta, { q: "ana" })).toBe("q=ana&estado=ACTIVO");
    expect(escribirConsulta(def, consulta, { pagina: 5 })).toBe("estado=ACTIVO&pagina=5");
    expect(escribirConsulta(def, consulta, { filtros: { estado: null } })).toBe("");
  });

  it("escribe el orden descendente con guion", () => {
    const { consulta } = leerConsulta(def, p(""));
    expect(escribirConsulta(def, consulta, { orden: { campo: "alta", desc: true } })).toBe("orden=-alta");
  });
});

describe("hayConsultaEnDireccion", () => {
  it("sólo cuenta parámetros de lista, no mensajes como ok o error", () => {
    expect(hayConsultaEnDireccion(p("ok=1&error=x"))).toBe(false);
    expect(hayConsultaEnDireccion(p("estado=ACTIVO"))).toBe(true);
    expect(hayConsultaEnDireccion(p("limpio=1"))).toBe(true);
  });
});
```

- [ ] **Step 4: Correr y ver que falla**

Run: `pnpm --filter fotoffice exec vitest run lib/listado/consulta.test.ts`
Expected: FAIL (no existe `./consulta`).

- [ ] **Step 5: Implementar `consulta.ts`**

```ts
import {
  FILAS_PERMITIDAS,
  PARAMETROS_RESERVADOS,
  type ConsultaListado,
  type DefinicionListado,
  type FilasPorPagina,
} from "./tipos";
import { esAtajoPeriodo } from "./periodos";

const ID_RELACION = /^[A-Za-z0-9_-]{1,64}$/;
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_BUSQUEDA = 100;
/** Parámetros que la pantalla usa para mensajes y no forman parte de la consulta. */
const IGNORADOS = new Set(["ok", "error", "forbidden", "module"]);

export function esRangoValido(valor: string): boolean {
  const [desde, hasta, ...resto] = valor.split("..");
  if (resto.length || !desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta)) return false;
  return desde <= hasta;
}

export function consultaVacia(def: DefinicionListado<unknown>): ConsultaListado {
  return { q: "", filtros: {}, orden: { ...def.ordenPorDefecto }, pagina: 1, filas: 25, ver: null };
}

export function leerConsulta(
  def: DefinicionListado<unknown>,
  params: URLSearchParams,
): { consulta: ConsultaListado; descartados: string[] } {
  const consulta = consultaVacia(def);
  const descartados: string[] = [];
  const filtrosPorClave = new Map(def.filtros.map((f) => [f.clave, f]));

  for (const [clave, crudo] of params.entries()) {
    const valor = crudo.trim();
    if (IGNORADOS.has(clave) || clave === "limpio" || clave === "vista") continue;
    if (clave === "q") {
      consulta.q = valor.slice(0, MAX_BUSQUEDA);
      continue;
    }
    if (clave === "orden") {
      const desc = valor.startsWith("-");
      const campo = desc ? valor.slice(1) : valor;
      if (def.ordenes.includes(campo)) consulta.orden = { campo, desc };
      else descartados.push(clave);
      continue;
    }
    if (clave === "pagina") {
      const n = Number(valor);
      if (Number.isInteger(n) && n >= 1) consulta.pagina = n;
      else descartados.push(clave);
      continue;
    }
    if (clave === "filas") {
      const n = Number(valor) as FilasPorPagina;
      if ((FILAS_PERMITIDAS as readonly number[]).includes(n)) consulta.filas = n;
      else descartados.push(clave);
      continue;
    }
    if (clave === "ver") {
      if (ID_RELACION.test(valor)) consulta.ver = valor;
      continue;
    }
    const filtro = filtrosPorClave.get(clave);
    if (!filtro || valor === "") {
      if (valor !== "") descartados.push(clave);
      continue;
    }
    const ok =
      (filtro.tipo === "opcion" && filtro.opciones.some((o) => o.valor === valor)) ||
      (filtro.tipo === "relacion" && ID_RELACION.test(valor)) ||
      (filtro.tipo === "periodo" && (esAtajoPeriodo(valor) || esRangoValido(valor))) ||
      (filtro.tipo === "siNo" && (valor === "si" || valor === "no"));
    if (ok) consulta.filtros[clave] = valor;
    else descartados.push(clave);
  }
  return { consulta, descartados };
}

export type CambiosConsulta = {
  q?: string;
  filtros?: Record<string, string | null>;
  orden?: { campo: string; desc: boolean };
  pagina?: number;
  filas?: FilasPorPagina;
  ver?: string | null;
};

/** Devuelve la query string (sin "?"). Cambiar búsqueda, filtros, orden o filas vuelve a la página 1. */
export function escribirConsulta(
  def: DefinicionListado<unknown>,
  consulta: ConsultaListado,
  cambios: CambiosConsulta = {},
): string {
  const reinicia = cambios.q !== undefined || cambios.filtros || cambios.orden || cambios.filas;
  const filtros = { ...consulta.filtros };
  for (const [k, v] of Object.entries(cambios.filtros ?? {})) {
    if (v === null || v === "") delete filtros[k];
    else filtros[k] = v;
  }
  const q = cambios.q ?? consulta.q;
  const orden = cambios.orden ?? consulta.orden;
  const filas = cambios.filas ?? consulta.filas;
  const pagina = reinicia ? 1 : (cambios.pagina ?? consulta.pagina);
  const ver = cambios.ver === undefined ? consulta.ver : cambios.ver;

  const out = new URLSearchParams();
  if (q) out.set("q", q);
  for (const f of def.filtros) if (filtros[f.clave]) out.set(f.clave, filtros[f.clave]);
  const esDefecto = orden.campo === def.ordenPorDefecto.campo && orden.desc === def.ordenPorDefecto.desc;
  if (!esDefecto) out.set("orden", `${orden.desc ? "-" : ""}${orden.campo}`);
  if (pagina > 1) out.set("pagina", String(pagina));
  if (filas !== 25) out.set("filas", String(filas));
  if (ver) out.set("ver", ver);
  return out.toString();
}

export function hayConsultaEnDireccion(params: URLSearchParams): boolean {
  for (const clave of params.keys()) if (!IGNORADOS.has(clave)) return true;
  return false;
}

export { PARAMETROS_RESERVADOS };
```

Nota: `esAtajoPeriodo` viene de la Tarea 2. Para que esta tarea compile sola, crear ya `periodos.ts` con sólo esto (la Tarea 2 lo completa):

```ts
export const ATAJOS_PERIODO = [
  "hoy", "esta-semana", "semana-pasada", "este-mes", "mes-pasado", "ultimos-3-meses", "este-anio", "anio-pasado",
] as const;
export type AtajoPeriodo = (typeof ATAJOS_PERIODO)[number];
export function esAtajoPeriodo(v: string): v is AtajoPeriodo {
  return (ATAJOS_PERIODO as readonly string[]).includes(v);
}
```

- [ ] **Step 6: Correr y ver que pasa**

Run: `pnpm --filter fotoffice exec vitest run lib/listado/consulta.test.ts`
Expected: PASS (todas).

- [ ] **Step 7: Commit**

```bash
git add apps/fotoffice/lib/listado
git commit -m "Listado estándar: tipos y lectura de la dirección

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Períodos en hora de Buenos Aires

**Files:**
- Modify: `apps/fotoffice/lib/listado/periodos.ts`
- Test: `apps/fotoffice/lib/listado/periodos.test.ts`

**Interfaces:**
- Consumes: `ATAJOS_PERIODO`, `esAtajoPeriodo` (Tarea 1).
- Produces: `ETIQUETAS_PERIODO: Record<AtajoPeriodo, string>`, `hoyEnBuenosAires(ahora?: Date): string` ("YYYY-MM-DD"), `resolverPeriodo(valor: string, hoyYmd: string): RangoFechas | null` (desde = 00:00:00.000 -03:00 del primer día, hasta = 23:59:59.999 -03:00 del último), `etiquetaPeriodo(valor: string): string`.

- [ ] **Step 1: Prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { etiquetaPeriodo, hoyEnBuenosAires, resolverPeriodo } from "./periodos";

const iso = (r: { desde: Date; hasta: Date } | null) => r && [r.desde.toISOString(), r.hasta.toISOString()];

describe("hoyEnBuenosAires", () => {
  it("a las 01:00 UTC todavía es el día anterior en Argentina", () => {
    expect(hoyEnBuenosAires(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-30");
  });
});

describe("resolverPeriodo (hoy = miércoles 2026-09-30)", () => {
  const hoy = "2026-09-30";
  it("hoy", () => expect(iso(resolverPeriodo("hoy", hoy))).toEqual(["2026-09-30T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]));
  it("esta semana arranca el lunes", () =>
    expect(iso(resolverPeriodo("esta-semana", hoy))).toEqual(["2026-09-28T03:00:00.000Z", "2026-10-05T02:59:59.999Z"]));
  it("semana pasada", () =>
    expect(iso(resolverPeriodo("semana-pasada", hoy))).toEqual(["2026-09-21T03:00:00.000Z", "2026-09-28T02:59:59.999Z"]));
  it("este mes", () =>
    expect(iso(resolverPeriodo("este-mes", hoy))).toEqual(["2026-09-01T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]));
  it("mes pasado", () =>
    expect(iso(resolverPeriodo("mes-pasado", hoy))).toEqual(["2026-08-01T03:00:00.000Z", "2026-09-01T02:59:59.999Z"]));
  it("últimos 3 meses incluye el actual", () =>
    expect(iso(resolverPeriodo("ultimos-3-meses", hoy))).toEqual(["2026-07-01T03:00:00.000Z", "2026-10-01T02:59:59.999Z"]));
  it("este año", () =>
    expect(iso(resolverPeriodo("este-anio", hoy))).toEqual(["2026-01-01T03:00:00.000Z", "2027-01-01T02:59:59.999Z"]));
  it("año pasado", () =>
    expect(iso(resolverPeriodo("anio-pasado", hoy))).toEqual(["2025-01-01T03:00:00.000Z", "2026-01-01T02:59:59.999Z"]));
  it("mes pasado en enero cae en diciembre del año anterior", () =>
    expect(iso(resolverPeriodo("mes-pasado", "2026-01-15"))).toEqual(["2025-12-01T03:00:00.000Z", "2026-01-01T02:59:59.999Z"]));
  it("un domingo pertenece a la semana que empezó el lunes anterior", () =>
    expect(iso(resolverPeriodo("esta-semana", "2026-10-04"))).toEqual(["2026-09-28T03:00:00.000Z", "2026-10-05T02:59:59.999Z"]));
  it("rango explícito, las dos puntas incluidas", () =>
    expect(iso(resolverPeriodo("2026-02-01..2026-02-28", hoy))).toEqual(["2026-02-01T03:00:00.000Z", "2026-03-01T02:59:59.999Z"]));
  it("valor inválido", () => expect(resolverPeriodo("ayer", hoy)).toBeNull());
});

describe("etiquetaPeriodo", () => {
  it("atajo y rango", () => {
    expect(etiquetaPeriodo("mes-pasado")).toBe("Mes pasado");
    expect(etiquetaPeriodo("2026-02-01..2026-02-28")).toBe("01/02/2026 al 28/02/2026");
  });
});
```

- [ ] **Step 2: Correr y ver que falla** — Run: `pnpm --filter fotoffice exec vitest run lib/listado/periodos.test.ts` — Expected: FAIL (funciones inexistentes).

- [ ] **Step 3: Implementar**

```ts
import type { RangoFechas } from "./tipos";
import { esRangoValido } from "./consulta";

export const ATAJOS_PERIODO = [
  "hoy", "esta-semana", "semana-pasada", "este-mes", "mes-pasado", "ultimos-3-meses", "este-anio", "anio-pasado",
] as const;
export type AtajoPeriodo = (typeof ATAJOS_PERIODO)[number];

export const ETIQUETAS_PERIODO: Record<AtajoPeriodo, string> = {
  hoy: "Hoy",
  "esta-semana": "Esta semana",
  "semana-pasada": "Semana pasada",
  "este-mes": "Este mes",
  "mes-pasado": "Mes pasado",
  "ultimos-3-meses": "Últimos 3 meses",
  "este-anio": "Este año",
  "anio-pasado": "Año pasado",
};

export function esAtajoPeriodo(v: string): v is AtajoPeriodo {
  return (ATAJOS_PERIODO as readonly string[]).includes(v);
}

/** Argentina no usa horario de verano desde 2009: el offset es fijo. */
const OFFSET = "-03:00";
const ZONA = "America/Argentina/Buenos_Aires";

export function hoyEnBuenosAires(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
/** Día calendario en UTC puro (sin hora) para hacer cuentas de fechas sin husos. */
function ymd(y: number, m0: number, d: number): string {
  const t = new Date(Date.UTC(y, m0, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function inicio(dia: string): Date {
  return new Date(`${dia}T00:00:00.000${OFFSET}`);
}
function fin(dia: string): Date {
  return new Date(`${dia}T23:59:59.999${OFFSET}`);
}

export function resolverPeriodo(valor: string, hoyYmd: string): RangoFechas | null {
  if (esRangoValido(valor)) {
    const [d, h] = valor.split("..");
    return { desde: inicio(d), hasta: fin(h) };
  }
  if (!esAtajoPeriodo(valor)) return null;
  const [y, m, d] = hoyYmd.split("-").map(Number);
  const m0 = m - 1;
  // Lunes = 0 … domingo = 6.
  const diaSemana = (new Date(Date.UTC(y, m0, d)).getUTCDay() + 6) % 7;
  switch (valor) {
    case "hoy":
      return { desde: inicio(hoyYmd), hasta: fin(hoyYmd) };
    case "esta-semana":
      return { desde: inicio(ymd(y, m0, d - diaSemana)), hasta: fin(ymd(y, m0, d - diaSemana + 6)) };
    case "semana-pasada":
      return { desde: inicio(ymd(y, m0, d - diaSemana - 7)), hasta: fin(ymd(y, m0, d - diaSemana - 1)) };
    case "este-mes":
      return { desde: inicio(ymd(y, m0, 1)), hasta: fin(ymd(y, m0 + 1, 0)) };
    case "mes-pasado":
      return { desde: inicio(ymd(y, m0 - 1, 1)), hasta: fin(ymd(y, m0, 0)) };
    case "ultimos-3-meses":
      return { desde: inicio(ymd(y, m0 - 2, 1)), hasta: fin(ymd(y, m0 + 1, 0)) };
    case "este-anio":
      return { desde: inicio(ymd(y, 0, 1)), hasta: fin(ymd(y, 11, 31)) };
    case "anio-pasado":
      return { desde: inicio(ymd(y - 1, 0, 1)), hasta: fin(ymd(y - 1, 11, 31)) };
  }
}

function dma(dia: string) {
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}

export function etiquetaPeriodo(valor: string): string {
  if (esAtajoPeriodo(valor)) return ETIQUETAS_PERIODO[valor];
  const [d, h] = valor.split("..");
  return `${dma(d)} al ${dma(h)}`;
}
```

(`consulta.ts` importa `esAtajoPeriodo` de acá y `periodos.ts` importa `esRangoValido` de `consulta.ts`: la dependencia circular es sólo de funciones usadas en tiempo de ejecución, no al cargar; si el empaquetador protesta, mover `esRangoValido` a `periodos.ts` y re-exportarlo desde `consulta.ts`.)

- [ ] **Step 4: Correr las dos pruebas** — Run: `pnpm --filter fotoffice exec vitest run lib/listado` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add apps/fotoffice/lib/listado && git commit -m "Listado estándar: períodos en hora de Buenos Aires" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`

---

### Task 3: Ejecutar la lista (validar, contar, paginar) y etiquetas de filtros

**Files:**
- Create: `apps/fotoffice/lib/listado/ejecutar.ts`, `apps/fotoffice/lib/listado/etiquetas.ts`
- Test: `apps/fotoffice/lib/listado/ejecutar.test.ts`, `apps/fotoffice/lib/listado/etiquetas.test.ts`

**Interfaces:**
- Consumes: Tareas 1–2.
- Produces:
  - `resolverConsulta(def, ctx, consulta, hoyYmd) → Promise<{ resuelta: ConsultaResuelta; descartados: string[] }>` (relaciones inexistentes se sacan y se agregan a `descartados`).
  - `ejecutarListado(def, ctx, resuelta) → Promise<PaginaListado<F>>` con `PaginaListado<F> = { filas: F[]; total: number; pagina: number; paginas: number; desde: number; hasta: number }` (página fuera de rango → última; `desde`/`hasta` 1-based, 0/0 si no hay filas).
  - `etiquetasDeFiltro(def, resuelta) → { clave: string; texto: string }[]` (p. ej. `"Estado: Activo"`, `"Alta: Mes pasado"`, `"Deuda: Con deuda"`, `"Categoría: Vitalicio"`).

- [ ] **Step 1: Pruebas que fallan** (`ejecutar.test.ts`)

```ts
import { describe, expect, it, vi } from "vitest";
import { ejecutarListado, resolverConsulta } from "./ejecutar";
import { leerConsulta } from "./consulta";
import type { ContextoListado, DefinicionListado } from "./tipos";

const ctx: ContextoListado = { workspaceId: "ws1", workspaceName: "WS", userId: 1, userLabel: "Dani", role: "WORKSPACE_OWNER" };

function defCon(total: number) {
  const traer = vi.fn(async (_c, _r, p: { skip: number; take: number }) =>
    Array.from({ length: Math.max(0, Math.min(p.take, total - p.skip)) }, (_, i) => ({ id: String(p.skip + i + 1) })),
  );
  const def = {
    clave: "prueba",
    filtros: [
      { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
      { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    ],
    ordenes: ["nombre"],
    ordenPorDefecto: { campo: "nombre", desc: false },
    contar: vi.fn(async () => total),
    traer,
    validarRelacion: vi.fn(async (_c, _k, id: string) => (id === "cat_ok" ? "Vitalicio" : null)),
  } as unknown as DefinicionListado<{ id: string }>;
  return { def, traer };
}

describe("resolverConsulta", () => {
  it("una relación de otro workspace se descarta y se avisa", async () => {
    const { def } = defCon(0);
    const { consulta } = leerConsulta(def, new URLSearchParams("categoria=cat_ajena"));
    const r = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    expect(r.resuelta.filtros).toEqual({});
    expect(r.descartados).toEqual(["categoria"]);
  });
  it("una relación válida trae su etiqueta y el período su rango", async () => {
    const { def } = defCon(0);
    const { consulta } = leerConsulta(def, new URLSearchParams("categoria=cat_ok&alta=este-mes"));
    const r = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    expect(r.resuelta.etiquetasRelacion).toEqual({ categoria: "Vitalicio" });
    expect(r.resuelta.periodos.alta.desde.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });
});

describe("ejecutarListado", () => {
  it("pagina con skip/take y calcula desde/hasta", async () => {
    const { def, traer } = defCon(120);
    const { consulta } = leerConsulta(def, new URLSearchParams("pagina=2&filas=50"));
    const { resuelta } = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    const p = await ejecutarListado(def, ctx, resuelta);
    expect(traer).toHaveBeenCalledWith(ctx, expect.anything(), { skip: 50, take: 50 });
    expect(p).toMatchObject({ total: 120, pagina: 2, paginas: 3, desde: 51, hasta: 100 });
  });
  it("una página fuera de rango muestra la última", async () => {
    const { def } = defCon(30);
    const { consulta } = leerConsulta(def, new URLSearchParams("pagina=9"));
    const { resuelta } = await resolverConsulta(def, ctx, consulta, "2026-09-30");
    const p = await ejecutarListado(def, ctx, resuelta);
    expect(p).toMatchObject({ pagina: 2, paginas: 2, desde: 26, hasta: 30 });
  });
  it("sin resultados: página 1 de 1, 0 a 0", async () => {
    const { def } = defCon(0);
    const { resuelta } = await resolverConsulta(def, ctx, leerConsulta(def, new URLSearchParams("")).consulta, "2026-09-30");
    expect(await ejecutarListado(def, ctx, resuelta)).toMatchObject({ total: 0, pagina: 1, paginas: 1, desde: 0, hasta: 0 });
  });
});
```

`etiquetas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { etiquetasDeFiltro } from "./etiquetas";
import type { ConsultaResuelta, DefinicionListado } from "./tipos";

const def = {
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "ACTIVO", etiqueta: "Activo" }] },
    { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
    { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    { tipo: "siNo", clave: "deuda", etiqueta: "Deuda", si: "Con deuda", no: "Al día" },
  ],
} as unknown as DefinicionListado<unknown>;

it("arma un chip legible por filtro activo, en el orden de la definición", () => {
  const r = {
    filtros: { deuda: "no", estado: "ACTIVO", categoria: "c1", alta: "mes-pasado" },
    etiquetasRelacion: { categoria: "Vitalicio" },
  } as unknown as ConsultaResuelta;
  expect(etiquetasDeFiltro(def, r)).toEqual([
    { clave: "estado", texto: "Estado: Activo" },
    { clave: "categoria", texto: "Categoría: Vitalicio" },
    { clave: "alta", texto: "Alta: Mes pasado" },
    { clave: "deuda", texto: "Deuda: Al día" },
  ]);
});
```

- [ ] **Step 2: Correr y ver que fallan** — Run: `pnpm --filter fotoffice exec vitest run lib/listado/ejecutar.test.ts lib/listado/etiquetas.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar `ejecutar.ts`**

```ts
import { resolverPeriodo } from "./periodos";
import type { ConsultaListado, ConsultaResuelta, ContextoListado, DefinicionListado } from "./tipos";

export type PaginaListado<F> = { filas: F[]; total: number; pagina: number; paginas: number; desde: number; hasta: number };

export async function resolverConsulta<F>(
  def: DefinicionListado<F>,
  ctx: ContextoListado,
  consulta: ConsultaListado,
  hoyYmd: string,
): Promise<{ resuelta: ConsultaResuelta; descartados: string[] }> {
  const filtros = { ...consulta.filtros };
  const periodos: ConsultaResuelta["periodos"] = {};
  const etiquetasRelacion: Record<string, string> = {};
  const descartados: string[] = [];
  for (const f of def.filtros) {
    const valor = filtros[f.clave];
    if (!valor) continue;
    if (f.tipo === "periodo") {
      const rango = resolverPeriodo(valor, hoyYmd);
      if (rango) periodos[f.clave] = rango;
      else {
        delete filtros[f.clave];
        descartados.push(f.clave);
      }
    }
    if (f.tipo === "relacion") {
      const etiqueta = def.validarRelacion ? await def.validarRelacion(ctx, f.clave, valor) : null;
      if (etiqueta) etiquetasRelacion[f.clave] = etiqueta;
      else {
        delete filtros[f.clave];
        descartados.push(f.clave);
      }
    }
  }
  return { resuelta: { ...consulta, filtros, periodos, etiquetasRelacion }, descartados };
}

export async function ejecutarListado<F>(
  def: DefinicionListado<F>,
  ctx: ContextoListado,
  resuelta: ConsultaResuelta,
): Promise<PaginaListado<F>> {
  const total = await def.contar(ctx, resuelta);
  const paginas = Math.max(1, Math.ceil(total / resuelta.filas));
  const pagina = Math.min(resuelta.pagina, paginas);
  const skip = (pagina - 1) * resuelta.filas;
  const filas = total === 0 ? [] : await def.traer(ctx, { ...resuelta, pagina }, { skip, take: resuelta.filas });
  return {
    filas,
    total,
    pagina,
    paginas,
    desde: total === 0 ? 0 : skip + 1,
    hasta: total === 0 ? 0 : skip + filas.length,
  };
}
```

`etiquetas.ts`:

```ts
import { etiquetaPeriodo } from "./periodos";
import type { ConsultaResuelta, DefinicionListado } from "./tipos";

export function etiquetasDeFiltro<F>(def: DefinicionListado<F>, r: ConsultaResuelta): { clave: string; texto: string }[] {
  const out: { clave: string; texto: string }[] = [];
  for (const f of def.filtros) {
    const v = r.filtros[f.clave];
    if (!v) continue;
    let texto: string | undefined;
    if (f.tipo === "opcion") texto = f.opciones.find((o) => o.valor === v)?.etiqueta;
    if (f.tipo === "relacion") texto = r.etiquetasRelacion[f.clave];
    if (f.tipo === "periodo") texto = etiquetaPeriodo(v);
    if (f.tipo === "siNo") texto = v === "si" ? f.si : f.no;
    if (texto) out.push({ clave: f.clave, texto: `${f.etiqueta}: ${texto}` });
  }
  return out;
}
```

- [ ] **Step 4: Correr** — Run: `pnpm --filter fotoffice exec vitest run lib/listado` — Expected: PASS.

- [ ] **Step 5: Commit** — mensaje: `Listado estándar: validar relaciones, paginar y etiquetas de filtros`.

---

### Task 4: Archivo para Excel

**Files:**
- Create: `apps/fotoffice/lib/listado/csv.ts`
- Test: `apps/fotoffice/lib/listado/csv.test.ts`

**Interfaces:**
- Consumes: `ColumnaExport<F>` (Tarea 1); `escapeFormulaInjection` de `apps/fotoffice/lib/members/export.ts`.
- Produces: `armarCsvExcel<F>(columnas, filas) → string` (empieza con `﻿`, separador `;`, fin de línea `\r\n`), `nombreArchivoExport(workspaceName, clave, ahora?) → string` (`<workspace-slug>-<clave>-AAAA-MM-DD.csv`, fecha en Buenos Aires), constante `TOPE_EXPORTACION = 20000`.

- [ ] **Step 1: Prueba que falla**

```ts
import { describe, expect, it } from "vitest";
import { armarCsvExcel, nombreArchivoExport } from "./csv";
import type { ColumnaExport } from "./tipos";

type F = { n: string; m: number; f: Date | null };
const cols: ColumnaExport<F>[] = [
  { titulo: "Nombre", tipo: "texto", valor: (x) => x.n },
  { titulo: "Importe", tipo: "importe", valor: (x) => x.m },
  { titulo: "Fecha", tipo: "fechaHora", valor: (x) => x.f },
];

describe("armarCsvExcel", () => {
  it("BOM, punto y coma, coma decimal y fecha argentina", () => {
    const csv = armarCsvExcel(cols, [{ n: "Pérez; Ana", m: 123456, f: new Date("2026-09-30T02:30:00Z") }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Nombre;Importe;Fecha\r\n"Pérez; Ana";1234,56;29/09/2026 23:30\r\n');
  });
  it("neutraliza fórmulas y deja vacío lo nulo", () => {
    const csv = armarCsvExcel(cols, [{ n: "=HYPERLINK(1)", m: -500, f: null }]);
    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1);-5,00;");
  });
});

it("nombreArchivoExport usa la fecha de Buenos Aires", () => {
  expect(nombreArchivoExport("DNX Estudio", "clientes", new Date("2026-10-01T01:00:00Z"))).toBe("dnx-estudio-clientes-2026-09-30.csv");
});
```

(El importe se expresa en **centavos** — `amountMinor` — como en el resto de Caja: `123456` → `1234,56`.)

- [ ] **Step 2: Correr y ver que falla** — `pnpm --filter fotoffice exec vitest run lib/listado/csv.test.ts`.

- [ ] **Step 3: Implementar**

```ts
import { escapeFormulaInjection } from "@/lib/members/export";
import { hoyEnBuenosAires } from "./periodos";
import type { ColumnaExport } from "./tipos";

export const TOPE_EXPORTACION = 20000;
const ZONA = "America/Argentina/Buenos_Aires";

function celda(raw: string): string {
  const t = escapeFormulaInjection(raw);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function formatear<F>(col: ColumnaExport<F>, v: string | number | Date | null): string {
  if (v === null || v === undefined || v === "") return "";
  if (col.tipo === "importe" && typeof v === "number") {
    const signo = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    return `${signo}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  }
  if ((col.tipo === "fecha" || col.tipo === "fechaHora") && v instanceof Date) {
    const opts: Intl.DateTimeFormatOptions = { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" };
    if (col.tipo === "fechaHora") Object.assign(opts, { hour: "2-digit", minute: "2-digit", hour12: false });
    return new Intl.DateTimeFormat("es-AR", opts).format(v).replace(",", "");
  }
  return String(v);
}

export function armarCsvExcel<F>(columnas: ColumnaExport<F>[], filas: F[]): string {
  const lineas = [columnas.map((c) => celda(c.titulo)).join(";")];
  for (const f of filas) lineas.push(columnas.map((c) => celda(formatear(c, c.valor(f)))).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}

export function nombreArchivoExport(workspaceName: string, clave: string, ahora: Date = new Date()): string {
  const slug = workspaceName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "fotoffice"}-${clave}-${hoyEnBuenosAires(ahora)}.csv`;
}
```

- [ ] **Step 4: Correr** — Expected: PASS. Si el formato de `Intl` de Node difiere (p. ej. `29/09/2026, 23:30`), ajustar el `replace` hasta que la prueba pase; la prueba manda.

- [ ] **Step 5: Commit** — mensaje: `Listado estándar: exportación que Excel abre directo`.

---

### Task 5: Tablas nuevas y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql`
- Create: `packages/db/docs/MIGRACION-LISTADO-ESTANDAR.md`
- Test: `apps/fotoffice/lib/listado/migracion.test.ts`

**Interfaces:**
- Produces: modelos Prisma `FotofficeListView` y `FotofficeListActivity` (accesibles como `prisma.fotofficeListView` y `prisma.fotofficeListActivity`).

- [ ] **Step 1: Agregar los modelos al final de la sección FOTOFFICE del schema** (cerca de `FotofficeWorkspaceBranding`)

```prisma
/// Filtros recordados (ULTIMA) y vistas guardadas (GUARDADA) de los listados de FOTOFFICE.
model FotofficeListView {
  id          String   @id @default(cuid())
  workspaceId String
  listKey     String
  /// ULTIMA | GUARDADA
  kind        String
  /// Sólo en GUARDADA.
  name        String?
  /// Query string de la dirección, sin "?".
  query       String   @default("")
  ownerUserId Int
  /// GUARDADA visible para todo el equipo del workspace.
  shared      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  owner     User      @relation("FotofficeListViewOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)

  @@index([workspaceId, listKey, kind])
  @@index([ownerUserId])
}

/// Registro de exportaciones y acciones en lote hechas desde un listado.
model FotofficeListActivity {
  id          String   @id @default(cuid())
  workspaceId String
  listKey     String
  /// EXPORT | BULK_ACTION
  kind        String
  action      String?
  actorUserId Int?
  actorLabel  String
  rowCount    Int
  query       String   @default("")
  detail      Json?
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  actor     User?     @relation("FotofficeListActivityActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([workspaceId, listKey, createdAt])
}
```

Y en `model Workspace` agregar `fotofficeListViews FotofficeListView[]` y `fotofficeListActivity FotofficeListActivity[]`; en `model User` agregar `fotofficeListViews FotofficeListView[] @relation("FotofficeListViewOwner")` y `fotofficeListActivity FotofficeListActivity[] @relation("FotofficeListActivityActor")`. Son campos virtuales: no crean columnas.

La unicidad de la ULTIMA por persona+workspace+lista se garantiza con un índice parcial en el SQL (Prisma no los modela) y el código usa `findFirst` + `update`/`create`.

- [ ] **Step 2: Escribir `migration.sql`**

```sql
-- Etapa 0.2 FOTOFFICE: listado estándar. Puramente ADITIVO: dos tablas propias de FOTOFFICE.
-- No toca Workspace, WorkspaceMembership ni WorkspaceFeatureModule.

CREATE TABLE "FotofficeListView" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "query" TEXT NOT NULL DEFAULT '',
    "ownerUserId" INTEGER NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FotofficeListView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FotofficeListView_workspaceId_listKey_kind_idx" ON "FotofficeListView"("workspaceId", "listKey", "kind");
CREATE INDEX "FotofficeListView_ownerUserId_idx" ON "FotofficeListView"("ownerUserId");
-- Una sola ULTIMA por persona, workspace y lista.
CREATE UNIQUE INDEX "FotofficeListView_ultima_unica" ON "FotofficeListView"("workspaceId", "listKey", "ownerUserId") WHERE "kind" = 'ULTIMA';
ALTER TABLE "FotofficeListView" ADD CONSTRAINT "FotofficeListView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeListView" ADD CONSTRAINT "FotofficeListView_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FotofficeListActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "action" TEXT,
    "actorUserId" INTEGER,
    "actorLabel" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotofficeListActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FotofficeListActivity_workspaceId_listKey_createdAt_idx" ON "FotofficeListActivity"("workspaceId", "listKey", "createdAt");
ALTER TABLE "FotofficeListActivity" ADD CONSTRAINT "FotofficeListActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotofficeListActivity" ADD CONSTRAINT "FotofficeListActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Validar y generar** — Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db exec prisma generate` — Expected: sin errores. Comparar con `prisma migrate diff --from-migrations packages/db/prisma/migrations --to-schema-datamodel packages/db/prisma/schema.prisma --script --shadow-database-url <no usar remota>`: **si no hay base local, saltear el diff** y revisar a ojo que los nombres de índices y FKs coincidan con la convención de Prisma de la migración 0.1.

- [ ] **Step 4: Prueba de fuente (`migracion.test.ts`)**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(raiz, "packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql"), "utf8");

describe("migración del listado estándar", () => {
  it("sólo crea tablas nuevas: no altera tablas compartidas", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(Workspace|WorkspaceMembership|WorkspaceFeatureModule|User|Member|Client|CashMovement)"/);
    expect(sql).not.toMatch(/DROP /);
  });
  it("crea las dos tablas y la ULTIMA única", () => {
    expect(sql).toMatch(/CREATE TABLE "FotofficeListView"/);
    expect(sql).toMatch(/CREATE TABLE "FotofficeListActivity"/);
    expect(sql).toMatch(/WHERE "kind" = 'ULTIMA'/);
  });
});
```

- [ ] **Step 5: Documento `MIGRACION-LISTADO-ESTANDAR.md`** con: qué hace (dos tablas nuevas, nada más); que depende de que la 0.1 esté aplicada sólo por orden de publicación, no por SQL; orden de aplicación (staging → FOTOFFICE `divine-hall-10689679`/`br-old-rain-adwthzng` → las demás bases que comparten el schema, como en `MIGRACION-EQUIPO-Y-MODULOS.md`); cómo registrar en `_prisma_migrations` (INSERT con `id` uuid, `checksum` = `sha256sum migration.sql`, `migration_name` = `20261001120000_fotoffice_listado_estandar`, `finished_at`/`started_at` = now(), `applied_steps_count` = 1); verificación (`SELECT count(*) FROM "FotofficeListView"` → 0 sin error); vuelta atrás (`DROP TABLE "FotofficeListActivity"; DROP TABLE "FotofficeListView";` + borrar la fila de `_prisma_migrations`). Anotar el checksum calculado.

- [ ] **Step 6: Correr** — `pnpm --filter fotoffice exec vitest run lib/listado/migracion.test.ts` — PASS.

- [ ] **Step 7: Commit** — mensaje: `Listado estándar: tablas de vistas y actividad (SQL sin aplicar)`.

---

### Task 6: Acceso, actividad y registro de listas

**Files:**
- Create: `apps/fotoffice/lib/listado/acceso.ts`, `apps/fotoffice/lib/listado/actividad.ts`, `apps/fotoffice/lib/listado/registro.ts`
- Test: `apps/fotoffice/lib/listado/acceso.test.ts`, `apps/fotoffice/lib/listado/registro.test.ts`

**Interfaces:**
- Consumes: `puede`, `Capacidad` (0.1); `getAuthUser`, `requireAuth` (`@/lib/auth`); `resolveActiveWorkspace` (`@/lib/workspace`); `resolveWorkspaceRole` (`@/lib/workspace-role`); `isModuleEnabledForWorkspace` (`@/lib/modules/gating`).
- Produces:
  - `contextoDeListado(clave: string): Promise<ContextoListado | null>` — **sin redirect**: sesión → workspace activo → módulo encendido → rol con `operar`; si algo falta, `null`.
  - `exigirCapacidad(ctx, capacidad): boolean` (= `puede(ctx.role, capacidad)`).
  - `registrarActividad(tx | prisma, { ctx, listKey, kind: "EXPORT" | "BULK_ACTION", action?, rowCount, query, detail? }) → Promise<void>`.
  - `LISTAS: Record<string, { moduleKey: string; cargar: () => Promise<DefinicionListado<any>> }>` y `definicionDe(clave) → Promise<DefinicionListado<any> | null>`. Las definiciones se cargan con `import()` dinámico para no arrastrar todo a cada ruta. Claves: `clientes` (módulo `clients`), `socios` (`members`), `caja-movimientos` (`cash`).

- [ ] **Step 1: Pruebas que fallan**

`registro.test.ts` — verifica por fuente que cada clave apunta a un módulo real y que ninguna definición usa una clave reservada:

```ts
import { describe, expect, it } from "vitest";
import { LISTAS } from "./registro";

describe("registro de listas", () => {
  it("tiene las tres listas de la etapa con su módulo", () => {
    expect(Object.fromEntries(Object.entries(LISTAS).map(([k, v]) => [k, v.moduleKey]))).toEqual({
      clientes: "clients",
      socios: "members",
      "caja-movimientos": "cash",
    });
  });
});
```

(La prueba "ninguna clave de filtro es reservada" se agrega en cada tarea de lista, cuando la definición existe.)

`acceso.test.ts` — por fuente, igual que `lib/members/export-isolation.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "acceso.ts"), "utf8");
const fn = src.slice(src.indexOf("export async function contextoDeListado"));

describe("contextoDeListado", () => {
  it("nunca redirige (se usa en descargas y acciones)", () => expect(fn).not.toMatch(/redirect\(/));
  it("exige el módulo encendido y la capacidad operar", () => {
    expect(fn).toMatch(/isModuleEnabledForWorkspace/);
    expect(fn).toMatch(/puede\([^)]*"operar"\)/);
  });
  it("el workspace sale de la sesión", () => expect(fn).toMatch(/resolveActiveWorkspace\(/));
});
```

- [ ] **Step 2: Correr y ver que fallan.**

- [ ] **Step 3: Implementar**

`acceso.ts`:

```ts
import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede, type Capacidad } from "@/lib/access/policy";
import { LISTAS } from "./registro";
import type { ContextoListado } from "./tipos";

/**
 * Contexto para acciones y descargas de un listado. Devuelve null ante cualquier falta —sin
 * sesión, sin workspace, módulo apagado, rol sin `operar`— sin distinguir el motivo, y nunca
 * redirige: un redirect en una descarga produce un archivo con HTML adentro.
 */
export async function contextoDeListado(clave: string): Promise<ContextoListado | null> {
  const lista = LISTAS[clave];
  if (!lista) return null;
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, lista.moduleKey))) return null;
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "operar")) return null;
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: user.name ?? user.email ?? `Usuario ${user.id}`,
    role,
  };
}

export function exigirCapacidad(ctx: ContextoListado, capacidad: Capacidad): boolean {
  return puede(ctx.role, capacidad);
}
```

(Verificar en `@/lib/auth` los nombres reales de los campos de `AuthUser` — `name`, `email` — y en `ActiveWorkspace` el campo `name`; ajustar si difieren.)

`actividad.ts`:

```ts
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { ContextoListado } from "./tipos";

type Cliente = Pick<typeof prisma, "fotofficeListActivity"> | Prisma.TransactionClient;

export async function registrarActividad(
  db: Cliente,
  a: {
    ctx: ContextoListado;
    listKey: string;
    kind: "EXPORT" | "BULK_ACTION";
    action?: string;
    rowCount: number;
    query: string;
    detail?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.fotofficeListActivity.create({
    data: {
      workspaceId: a.ctx.workspaceId,
      listKey: a.listKey,
      kind: a.kind,
      action: a.action ?? null,
      actorUserId: a.ctx.userId,
      actorLabel: a.ctx.userLabel,
      rowCount: a.rowCount,
      query: a.query,
      detail: a.detail,
    },
  });
}
```

`registro.ts`:

```ts
import type { DefinicionListado } from "./tipos";

export const LISTAS: Record<string, { moduleKey: string; cargar: () => Promise<DefinicionListado<any>> }> = {
  clientes: { moduleKey: "clients", cargar: async () => (await import("@/lib/clients/listado")).listadoClientes },
  socios: { moduleKey: "members", cargar: async () => (await import("@/lib/members/listado")).listadoSocios },
  "caja-movimientos": {
    moduleKey: "cash",
    cargar: async () => (await import("@/lib/cash/listado-movimientos")).listadoMovimientos,
  },
};

export async function definicionDe(clave: string): Promise<DefinicionListado<any> | null> {
  const l = LISTAS[clave];
  return l ? l.cargar() : null;
}
```

Hasta que existan las tres definiciones (Tareas 10–12), crear archivos mínimos para que compile: `lib/clients/listado.ts`, `lib/members/listado.ts`, `lib/cash/listado-movimientos.ts`, cada uno con `export const listadoX = null as unknown as DefinicionListado<unknown>;` y un comentario `// Se completa en la Tarea N`. Cada tarea de lista lo reemplaza entero.

- [ ] **Step 4: Correr** — `pnpm --filter fotoffice exec vitest run lib/listado` — PASS.

- [ ] **Step 5: Commit** — mensaje: `Listado estándar: acceso sin redirect, registro de listas y actividad`.

---

### Task 7: Filtros recordados y vistas guardadas

**Files:**
- Create: `apps/fotoffice/lib/listado/vistas.ts`
- Test: `apps/fotoffice/lib/listado/vistas.test.ts`
- Create: `apps/fotoffice/app/actions/listado.ts` (sólo las acciones de vistas en esta tarea)

**Interfaces:**
- Consumes: `leerConsulta`, `escribirConsulta`, `consultaVacia` (Tarea 1); `contextoDeListado`, `exigirCapacidad`, `definicionDe` (Tarea 6).
- Produces:
  - Puras: `puedeEditarVista(ctx, vista: { ownerUserId: number; shared: boolean }) → boolean` (personal: sólo su dueño; del equipo: `configurar`); `normalizarNombreVista(raw) → string | null` (recorta, 1–60 caracteres); `sanearQuery(def, raw) → string` (pasa por `leerConsulta` y `escribirConsulta` con `pagina: 1`, `ver: null`).
  - Servidor: `leerUltima(ctx, clave) → Promise<string | null>`, `guardarUltima(ctx, clave, query) → Promise<void>` (upsert manual: `findFirst` ULTIMA y `update`, si no `create`; captura el error de unicidad y reintenta con `update`), `listarVistas(ctx, clave) → Promise<{ id; name; query; shared; editable }[]>` (propias + compartidas del workspace, por nombre), `crearVista`, `renombrarVista`, `borrarVista`.
  - Acciones (`app/actions/listado.ts`): `guardarVistaAction(prev, formData)` (campos `clave`, `nombre`, `query`, `compartida`), `renombrarVistaAction`, `borrarVistaAction`. Estado `{ error: string | null; ok?: boolean }`. `compartida=on` sin `configurar` → error "Sólo el dueño o un administrador pueden compartir vistas con el equipo."

- [ ] **Step 1: Prueba de las funciones puras**

```ts
import { describe, expect, it } from "vitest";
import { normalizarNombreVista, puedeEditarVista, sanearQuery } from "./vistas";
import type { ContextoListado, DefinicionListado } from "./tipos";

const ctx = (role: string, userId = 1): ContextoListado => ({ workspaceId: "w", workspaceName: "W", userId, userLabel: "x", role });
const def = {
  filtros: [{ tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "A", etiqueta: "A" }] }],
  ordenes: ["n"],
  ordenPorDefecto: { campo: "n", desc: false },
} as unknown as DefinicionListado<unknown>;

describe("puedeEditarVista", () => {
  it("una vista personal sólo la edita su dueño, aunque sea Equipo", () => {
    expect(puedeEditarVista(ctx("STAFF", 1), { ownerUserId: 1, shared: false })).toBe(true);
    expect(puedeEditarVista(ctx("WORKSPACE_OWNER", 2), { ownerUserId: 1, shared: false })).toBe(false);
  });
  it("una vista del equipo sólo la editan Dueño y Administrador", () => {
    expect(puedeEditarVista(ctx("STAFF", 1), { ownerUserId: 1, shared: true })).toBe(false);
    expect(puedeEditarVista(ctx("WORKSPACE_ADMIN", 2), { ownerUserId: 1, shared: true })).toBe(true);
  });
});

it("normalizarNombreVista", () => {
  expect(normalizarNombreVista("  Deudores  ")).toBe("Deudores");
  expect(normalizarNombreVista("   ")).toBeNull();
  expect(normalizarNombreVista("x".repeat(61))).toBeNull();
});

it("sanearQuery descarta lo inválido, la página y el panel abierto", () => {
  expect(sanearQuery(def, "estado=A&pagina=3&ver=abc&hack=1")).toBe("estado=A");
});
```

- [ ] **Step 2: Correr y ver que falla.**

- [ ] **Step 3: Implementar `vistas.ts`** (puras arriba; las de servidor usan `prisma.fotofficeListView` siempre con `workspaceId: ctx.workspaceId`, y `listKey`; `renombrar`/`borrar` leen la vista con `findFirst({ where: { id, workspaceId } })`, comprueban `puedeEditarVista` y recién ahí escriben; una vista de otro workspace se trata como inexistente).

```ts
import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { escribirConsulta, leerConsulta } from "./consulta";
import type { ContextoListado, DefinicionListado } from "./tipos";

export function puedeEditarVista(ctx: ContextoListado, v: { ownerUserId: number; shared: boolean }): boolean {
  return v.shared ? puede(ctx.role, "configurar") : v.ownerUserId === ctx.userId;
}

export function normalizarNombreVista(raw: string | null | undefined): string | null {
  const n = (raw ?? "").trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 60 ? n : null;
}

export function sanearQuery(def: DefinicionListado<unknown>, raw: string): string {
  const { consulta } = leerConsulta(def, new URLSearchParams(raw));
  return escribirConsulta(def, { ...consulta, pagina: 1, ver: null });
}

export async function leerUltima(ctx: ContextoListado, clave: string): Promise<string | null> {
  const v = await prisma.fotofficeListView.findFirst({
    where: { workspaceId: ctx.workspaceId, listKey: clave, kind: "ULTIMA", ownerUserId: ctx.userId },
    select: { query: true },
  });
  return v?.query ?? null;
}

export async function guardarUltima(ctx: ContextoListado, clave: string, query: string): Promise<void> {
  const where = { workspaceId: ctx.workspaceId, listKey: clave, kind: "ULTIMA", ownerUserId: ctx.userId };
  const actual = await prisma.fotofficeListView.findFirst({ where, select: { id: true, query: true } });
  if (actual) {
    if (actual.query !== query) await prisma.fotofficeListView.update({ where: { id: actual.id }, data: { query } });
    return;
  }
  try {
    await prisma.fotofficeListView.create({ data: { ...where, query } });
  } catch {
    // Otra pestaña la creó en el medio (índice único parcial): se actualiza la que ganó.
    await prisma.fotofficeListView.updateMany({ where, data: { query } });
  }
}

export async function listarVistas(ctx: ContextoListado, clave: string) {
  const filas = await prisma.fotofficeListView.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      listKey: clave,
      kind: "GUARDADA",
      OR: [{ ownerUserId: ctx.userId }, { shared: true }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, query: true, shared: true, ownerUserId: true },
  });
  return filas.map((v) => ({ id: v.id, name: v.name ?? "", query: v.query, shared: v.shared, editable: puedeEditarVista(ctx, v) }));
}

export async function crearVista(ctx: ContextoListado, clave: string, nombre: string, query: string, compartida: boolean) {
  return prisma.fotofficeListView.create({
    data: { workspaceId: ctx.workspaceId, listKey: clave, kind: "GUARDADA", name: nombre, query, ownerUserId: ctx.userId, shared: compartida },
  });
}

async function vistaEditable(ctx: ContextoListado, id: string) {
  const v = await prisma.fotofficeListView.findFirst({
    where: { id, workspaceId: ctx.workspaceId, kind: "GUARDADA" },
    select: { id: true, ownerUserId: true, shared: true },
  });
  return v && puedeEditarVista(ctx, v) ? v : null;
}

export async function renombrarVista(ctx: ContextoListado, id: string, nombre: string): Promise<boolean> {
  if (!(await vistaEditable(ctx, id))) return false;
  await prisma.fotofficeListView.update({ where: { id }, data: { name: nombre } });
  return true;
}

export async function borrarVista(ctx: ContextoListado, id: string): Promise<boolean> {
  if (!(await vistaEditable(ctx, id))) return false;
  await prisma.fotofficeListView.delete({ where: { id } });
  return true;
}
```

- [ ] **Step 4: Acciones en `app/actions/listado.ts`** (`"use server"`): cada una hace `const ctx = await contextoDeListado(clave); if (!ctx) return { error: "No tenés acceso a esta lista." };`, `definicionDe(clave)`, valida con `normalizarNombreVista` / `sanearQuery`, exige `configurar` si `compartida`, llama a la función de servidor y `revalidatePath` de la ruta de la lista (`/clientes`, `/members`, `/caja/movimientos` — agregar `ruta` a cada entrada de `LISTAS` en `registro.ts` y a su prueba). Mensajes: vista inexistente o ajena → "No encontramos esa vista o no podés modificarla."

- [ ] **Step 5: Prueba de fuente de las acciones** (agregar a `vistas.test.ts`): el archivo `app/actions/listado.ts` empieza con `"use server"`, cada acción exportada llama a `contextoDeListado` antes de tocar `prisma` o las funciones de vistas, y ninguna lee `workspaceId` del `formData`.

- [ ] **Step 6: Correr, tsc del paquete** — `pnpm --filter fotoffice exec vitest run lib/listado` y `NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit` — PASS / sin errores.

- [ ] **Step 7: Commit** — mensaje: `Listado estándar: filtros recordados y vistas guardadas`.

---

### Task 8: Acciones en lote

**Files:**
- Create: `apps/fotoffice/lib/listado/lote.ts`
- Test: `apps/fotoffice/lib/listado/lote.test.ts`
- Modify: `apps/fotoffice/app/actions/listado.ts` (agregar `prepararLoteAction`, `aplicarLoteAction`)

**Interfaces:**
- Consumes: Tareas 1, 3, 6.
- Produces:
  - `type Seleccion = { tipo: "ids"; ids: string[] } | { tipo: "todos"; query: string }`.
  - `resolverObjetivo(def, ctx, seleccion, maximo, hoyYmd) → Promise<{ ok: true; ids: string[] } | { ok: false; error: string }>` — con `ids`: saca duplicados, **filtra por workspace** pidiendo `def.traerPorIds` y quedándose con los que vuelven; con `todos`: `leerConsulta(query)` → `resolverConsulta` → `def.traerIds(ctx, resuelta, maximo + 1)`; si vienen más de `maximo` → error `Son más de {maximo}. Filtrá un poco más.`
  - `prepararLote(...) → { cantidad: number; excluidos: { id; motivo }[]; mensaje: string }` (usa `accion.elegibles` si existe; `mensaje` = `confirmacion` con `{n}` y `{parametro}` reemplazados).
  - `aplicarLote(..., cantidadConfirmada) → { estado: "reconfirmar"; cantidad; excluidos; mensaje } | { estado: "hecho"; resultado: ResultadoLote } | { estado: "error"; error }` — recalcula; si la cantidad de elegibles ≠ `cantidadConfirmada` devuelve `reconfirmar`; si no, `accion.aplicar` y `registrarActividad(prisma, { kind: "BULK_ACTION", action: accion.clave, rowCount: resultado.aplicados, query, detail: { parametro, excluidos, fallidos, detalle } })`.
  - Acciones: `prepararLoteAction({ clave, accion, seleccion, parametro })` y `aplicarLoteAction({ ..., cantidadConfirmada })` — reciben objetos serializables (no FormData), exigen `contextoDeListado` y `exigirCapacidad(ctx, accion.capacidad)`, y validan `parametro` contra `accion.parametro.opciones(ctx)`.

- [ ] **Step 1: Pruebas que fallan** (con una definición falsa, sin base)

```ts
import { describe, expect, it, vi } from "vitest";
import { aplicarLote, prepararLote, resolverObjetivo } from "./lote";
import type { AccionLote, ContextoListado, DefinicionListado } from "./tipos";

const ctx: ContextoListado = { workspaceId: "w", workspaceName: "W", userId: 1, userLabel: "Dani", role: "WORKSPACE_OWNER" };
vi.mock("./actividad", () => ({ registrarActividad: vi.fn(async () => {}) }));
vi.mock("@repo/db", () => ({ prisma: {} }));

function armar(universo: string[]) {
  const aplicar = vi.fn(async (_c, ids: string[]) => ({ aplicados: ids.length, fallidos: [], detalle: [] }));
  const accion: AccionLote = {
    clave: "categoria", etiqueta: "Cambiar categoría", capacidad: "operar", maximo: 3,
    confirmacion: "Vas a cambiar la categoría de {n} socios a {parametro}.",
    parametro: { etiqueta: "Categoría", opciones: async () => [{ valor: "c1", etiqueta: "Vitalicio" }] },
    elegibles: async (_c, ids) => ({ elegibles: ids.filter((i) => i !== "x"), excluidos: ids.includes("x") ? [{ id: "x", motivo: "no" }] : [] }),
    aplicar,
  };
  const def = {
    clave: "socios", filtros: [], ordenes: ["n"], ordenPorDefecto: { campo: "n", desc: false },
    traerIds: vi.fn(async (_c, _r, tope: number) => universo.slice(0, tope)),
    traerPorIds: vi.fn(async (_c, ids: string[]) => ids.filter((i) => universo.includes(i)).map((id) => ({ id }))),
    idDe: (f: { id: string }) => f.id,
    acciones: [accion],
  } as unknown as DefinicionListado<{ id: string }>;
  return { def, accion, aplicar };
}

describe("resolverObjetivo", () => {
  it("con ids descarta los de otro workspace y los repetidos", async () => {
    const { def } = armar(["a", "b"]);
    expect(await resolverObjetivo(def, ctx, { tipo: "ids", ids: ["a", "a", "ajeno"] }, 3, "2026-09-30")).toEqual({ ok: true, ids: ["a"] });
  });
  it("con todos, más que el tope es error", async () => {
    const { def } = armar(["a", "b", "c", "d"]);
    const r = await resolverObjetivo(def, ctx, { tipo: "todos", query: "" }, 3, "2026-09-30");
    expect(r).toEqual({ ok: false, error: "Son más de 3. Filtrá un poco más." });
  });
});

describe("prepararLote y aplicarLote", () => {
  it("prepara con cantidad, excluidos y mensaje", async () => {
    const { def, accion } = armar(["a", "b", "x"]);
    const p = await prepararLote(def, accion, ctx, { tipo: "todos", query: "" }, "c1", "2026-09-30");
    expect(p).toEqual({ ok: true, cantidad: 2, excluidos: [{ id: "x", motivo: "no" }], mensaje: "Vas a cambiar la categoría de 2 socios a Vitalicio." });
  });
  it("si la cantidad cambió, no aplica y pide reconfirmar", async () => {
    const { def, accion, aplicar } = armar(["a", "b", "c"]);
    const r = await aplicarLote(def, accion, ctx, { tipo: "todos", query: "" }, "c1", 2, "2026-09-30");
    expect(r.estado).toBe("reconfirmar");
    expect(aplicar).not.toHaveBeenCalled();
  });
  it("si coincide, aplica sólo a los elegibles", async () => {
    const { def, accion, aplicar } = armar(["a", "b", "x"]);
    const r = await aplicarLote(def, accion, ctx, { tipo: "todos", query: "" }, "c1", 2, "2026-09-30");
    expect(r).toEqual({ estado: "hecho", resultado: { aplicados: 2, fallidos: [], detalle: [] } });
    expect(aplicar).toHaveBeenCalledWith(ctx, ["a", "b"], "c1");
  });
  it("un parámetro que no está entre las opciones es error", async () => {
    const { def, accion } = armar(["a"]);
    const p = await prepararLote(def, accion, ctx, { tipo: "ids", ids: ["a"] }, "c_trucho", "2026-09-30");
    expect(p).toEqual({ ok: false, error: "Elegí una opción válida." });
  });
});
```

- [ ] **Step 2: Correr y ver que fallan.**

- [ ] **Step 3: Implementar `lote.ts`** según las firmas de arriba (`prepararLote` devuelve `{ ok: true, cantidad, excluidos, mensaje } | { ok: false, error }`; valida el parámetro contra `accion.parametro.opciones(ctx)` y usa su etiqueta en `{parametro}`; si la acción no tiene parámetro, `parametro` debe ser `null`). `aplicarLote` reutiliza `prepararLote` para recalcular. La query guardada en la actividad es la de `todos` o `""` para ids.

- [ ] **Step 4: Acciones en `app/actions/listado.ts`**: buscar la acción con `def.acciones.find((a) => a.clave === accion)`; si no existe → `{ error: "Acción desconocida." }`; si `!exigirCapacidad(ctx, a.capacidad)` → `{ error: "No tenés permiso para esta acción." }`; `hoyEnBuenosAires()` como hoy; después de aplicar, `revalidatePath(LISTAS[clave].ruta)`.

- [ ] **Step 5: Correr y tsc** — PASS / sin errores.

- [ ] **Step 6: Commit** — mensaje: `Listado estándar: acciones en lote con reconfirmación y registro`.

---

### Task 9: Exportar

**Files:**
- Create: `apps/fotoffice/app/api/listados/[clave]/exportar/route.ts`
- Test: `apps/fotoffice/lib/listado/exportar-aislamiento.test.ts`

**Interfaces:**
- Consumes: `contextoDeListado`, `exigirCapacidad`, `definicionDe`, `leerConsulta`, `resolverConsulta`, `armarCsvExcel`, `nombreArchivoExport`, `TOPE_EXPORTACION`, `registrarActividad`, `hoyEnBuenosAires`.
- Produces: `GET /api/listados/<clave>/exportar?<query>[&ids=a,b,c]` → CSV. Botón en la UI apunta a esta ruta.

- [ ] **Step 1: Prueba por fuente que falla**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "..", "..", "app/api/listados/[clave]/exportar/route.ts"), "utf8");
const body = src.slice(src.indexOf("export async function GET"));

describe("exportar un listado", () => {
  it("el guarda corre antes de leer datos", () => {
    expect(body.indexOf("contextoDeListado")).toBeGreaterThan(-1);
    expect(body.indexOf("contextoDeListado")).toBeLessThan(body.indexOf("traerIds"));
  });
  it("exige verDinero", () => expect(body).toMatch(/exigirCapacidad\(ctx, "verDinero"\)/));
  it("toda denegación es 404 y no redirige", () => {
    expect(body).toMatch(/status: 404/);
    expect(body).not.toMatch(/status: 40[13]|redirect\(/);
  });
  it("no lee el workspace de la dirección", () => expect(src).not.toMatch(/get\(["']workspaceId["']\)/));
  it("registra la exportación y respeta el tope", () => {
    expect(body).toMatch(/registrarActividad/);
    expect(body).toMatch(/TOPE_EXPORTACION/);
  });
  it("no se cachea ni se indexa", () => expect(body).toMatch(/no-store/));
});
```

- [ ] **Step 2: Correr y ver que falla.**

- [ ] **Step 3: Implementar la ruta**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { contextoDeListado, exigirCapacidad } from "@/lib/listado/acceso";
import { definicionDe } from "@/lib/listado/registro";
import { leerConsulta } from "@/lib/listado/consulta";
import { resolverConsulta } from "@/lib/listado/ejecutar";
import { armarCsvExcel, nombreArchivoExport, TOPE_EXPORTACION } from "@/lib/listado/csv";
import { registrarActividad } from "@/lib/listado/actividad";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  const ctx = await contextoDeListado(clave);
  if (!ctx || !exigirCapacidad(ctx, "verDinero")) return new NextResponse(null, { status: 404 });
  const def = await definicionDe(clave);
  if (!def) return new NextResponse(null, { status: 404 });

  const sp = new URLSearchParams(req.nextUrl.searchParams);
  const idsCrudos = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  sp.delete("ids");

  let filas: unknown[];
  if (idsCrudos.length) {
    if (idsCrudos.length > TOPE_EXPORTACION) return tope();
    filas = await def.traerPorIds(ctx, Array.from(new Set(idsCrudos)));
  } else {
    const { consulta } = leerConsulta(def, sp);
    const { resuelta } = await resolverConsulta(def, ctx, consulta, hoyEnBuenosAires());
    const ids = await def.traerIds(ctx, resuelta, TOPE_EXPORTACION + 1);
    if (ids.length > TOPE_EXPORTACION) return tope();
    filas = await def.traerPorIds(ctx, ids);
  }

  const csv = armarCsvExcel(def.exportar.columnas, filas);
  await registrarActividad(prisma, { ctx, listKey: clave, kind: "EXPORT", rowCount: filas.length, query: sp.toString() });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivoExport(ctx.workspaceName, clave)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function tope() {
  return new NextResponse(`Son más de ${TOPE_EXPORTACION} filas. Filtrá un poco más para exportar.`, {
    status: 422,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
```

`traerPorIds` debe devolver las filas **en el orden de los ids** (cada definición ordena en memoria con un `Map`): lo exige la prueba de cada lista.

- [ ] **Step 4: Correr** — PASS.

- [ ] **Step 5: Commit** — mensaje: `Listado estándar: exportar a Excel con permiso y registro`.

---

### Task 10: Componentes del listado

**Files:**
- Create: `apps/fotoffice/components/listado/listado.tsx`, `caja-de-busqueda.tsx`, `barra-de-filtros.tsx`, `filtro-relacion.tsx`, `etiquetas-de-filtro.tsx`, `menu-de-vistas.tsx`, `tabla.tsx`, `paginador.tsx`, `seleccion.tsx`, `panel-lateral.tsx`, `fila.tsx`
- Modify: `apps/fotoffice/app/actions/listado.ts` (agregar `buscarOpcionesRelacionAction(clave, filtro, texto)` → `Opcion[]`, máximo 20, texto ≥ 2 caracteres)
- Test: `apps/fotoffice/lib/listado/componentes.test.ts` (pruebas de fuente)

**Interfaces:**
- Consumes: todo el motor.
- Produces: `<Listado def={...} ctx={...} ruta="/clientes" searchParams={...} encabezadoExtra={ReactNode} />` — server component async que:
  1. Convierte `searchParams` en `URLSearchParams`.
  2. Si `!hayConsultaEnDireccion(sp)` y `leerUltima` devuelve una query no vacía → `redirect(`${ruta}?${ultima}`)`. Si `sp.get("limpio") === "1"` → `guardarUltima(ctx, clave, "")` y sigue sin filtros. Si `sp.get("vista")` → carga la vista (propia o compartida del workspace), `redirect` a `ruta?query`.
  3. `leerConsulta` → `resolverConsulta(hoyEnBuenosAires())` → `ejecutarListado` → `guardarUltima(ctx, clave, escribirConsulta(def, consulta, { ver: null, pagina: 1 }))`.
  4. Dibuja: barra (búsqueda, filtros, vistas, exportar si `verDinero`), aviso de descartados ("Se ignoraron filtros que ya no existen: …"), etiquetas, tabla dentro de `ProveedorSeleccion`, paginador, barra de selección, y el panel si `consulta.ver` y `def.panel`.

  Componentes client (`"use client"`):
  - `CajaDeBusqueda({ valorInicial, placeholder })`: `useRouter` + `useSearchParams`; espera 500 ms; aplica si hay ≥ 2 caracteres o el campo quedó vacío; escribe `q`, borra `pagina` y `ver`; `router.replace` sin scroll.
  - `BarraDeFiltros`: un `<form method="GET">` con `<select className="fo-input">` por filtro `opcion`/`siNo`/`relacion` con opciones; `periodo` = `<select>` con atajos + "Otro período…" que muestra dos `<input type="date">` y compone `desde..hasta` en un campo oculto; `relacion` con `conBuscador` usa `FiltroRelacion` (input + lista de sugerencias con `buscarOpcionesRelacionAction`). En pantallas chicas los filtros van dentro de un `<details>` con resumen "Filtros (N)".
  - `EtiquetasDeFiltro`: server; cada chip es un `<Link>` a `escribirConsulta(def, consulta, { filtros: { [clave]: null } })` con "✕" y `aria-label="Quitar filtro Estado: Activo"`; "Limpiar todo" → `?limpio=1`.
  - `Tabla`: server; encabezado con casilla "toda la página" (`CasillaPagina`), títulos; los ordenables son `<Link>` que alternan asc/desc y muestran `ArrowUp`/`ArrowDown` de lucide; con panel abierto oculta `secundaria`. Estilos: los del relevamiento (`overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]`, `thead bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]`, `tbody divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]`, celdas `px-4 py-3`). Cada fila es `<Fila>` (client) con `CasillaFila`.
  - `Fila({ id, hrefPanel, hrefFicha, activa, children })`: clic (fuera de casillas, links y botones) → si `window.matchMedia("(min-width: 1024px)").matches` navega a `hrefPanel` (o a la ficha si ya está activa), si no a `hrefFicha`. Fila activa con `bg-[var(--fo-accent-soft)]`.
  - `seleccion.tsx`: `ProveedorSeleccion({ idsDePagina, total, clave, query, acciones, puedeExportar, rutaExportar, children })` guarda `Set<string>` y `todos: boolean`; `CasillaFila`, `CasillaPagina`; aviso "Seleccionaste 25 · Seleccionar los 1.240 resultados" / "Están seleccionados los 1.240 resultados · Quitar selección"; `BarraDeSeleccion` fija abajo (`fixed bottom-0 inset-x-0 fo-card`) con un botón por acción; al elegir una con parámetro muestra un `<select>`; "Continuar" llama `prepararLoteAction`, muestra el `mensaje` y los excluidos ("12 quedan afuera: vienen de Cuotas"), y "Confirmar" llama `aplicarLoteAction` con la cantidad; si vuelve `reconfirmar`, reemplaza el mensaje con la cantidad nueva y pide confirmar otra vez; al terminar, `router.refresh()` y muestra "Listo: 1.238 actualizados, 2 no se pudieron (ver detalle)". Exportar selección → abre `rutaExportar?ids=...` (o con la query si `todos`).
  - `PanelLateral({ hrefCerrar, hrefAnterior, hrefSiguiente, hrefFicha, children })`: `aside` a la derecha (`lg:w-[420px]`, `sticky top-4`), Esc → `hrefCerrar`, ↑/↓ → anterior/siguiente (calculados en el server con los ids de la página), botón "Abrir ficha". Con el panel abierto la página arma un grid `lg:grid-cols-[1fr_420px]`.
  - `MenuDeVistas({ clave, ruta, vistas, queryActual, puedeCompartir })`: `<details>` con la lista (link a `ruta?vista=<id>`), "Guardar vista actual" (form con nombre y, si `puedeCompartir`, casilla "Compartir con el equipo") usando `guardarVistaAction` con `useActionState`; renombrar/borrar sólo en las `editable`.
  - `Paginador({ pagina, paginas, desde, hasta, total, sustantivo, filas, hrefPagina, hrefFilas })`: server; "Mostrando 51 a 100 de 1.240 socios", anterior/siguiente, página actual de total, selector 10/25/50/100 (links). Números con `toLocaleString("es-AR")`.
  - Vacío: "No hay resultados con estos filtros." + link "Limpiar filtros" (`?limpio=1`); si no hay filtros ni búsqueda: "Todavía no hay {plural}."

- [ ] **Step 1: Prueba de fuente que falla (`componentes.test.ts`)**: `listado.tsx` no tiene `"use client"`; `caja-de-busqueda.tsx`, `seleccion.tsx`, `panel-lateral.tsx`, `fila.tsx`, `menu-de-vistas.tsx`, `filtro-relacion.tsx` sí; `caja-de-busqueda.tsx` contiene `500` y `length >= 2`; `listado.tsx` llama `guardarUltima` y `leerUltima` y usa `exigirCapacidad(ctx, "verDinero")` antes de mostrar Exportar; ningún componente importa `@repo/db`.

- [ ] **Step 2: Correr y ver que falla.**

- [ ] **Step 3: Implementar los componentes** con las firmas de arriba. Reglas: nada de librerías nuevas; íconos de `lucide-react`; clases `fo-*`; todos los textos en español; accesibilidad: `aria-sort` en encabezados ordenados, `aria-label` en casillas ("Seleccionar fila", "Seleccionar toda la página"), el panel con `role="complementary"` y foco al abrir.

- [ ] **Step 4: Correr pruebas y tsc** — PASS / sin errores.

- [ ] **Step 5: Commit** — mensaje: `Listado estándar: componentes de búsqueda, filtros, tabla, selección, vistas y panel`.

---

### Task 11: Clientes con el listado estándar

**Files:**
- Modify (reemplazar el stub): `apps/fotoffice/lib/clients/listado.ts`
- Test: `apps/fotoffice/lib/clients/listado.test.ts`
- Modify: `apps/fotoffice/app/(shell)/clientes/page.tsx`

**Interfaces:**
- Consumes: `DefinicionListado`, `ContextoListado` y `<Listado>`; `clientDisplayName` de `lib/clients/display.ts`; `CLIENT_KINDS`, `CLIENT_STATUSES`, `IVA_CONDITION_LABELS` de `lib/clients/constants.ts`; `requireClientsStaff`.
- Produces: `listadoClientes: DefinicionListado<FilaCliente>` y la función pura exportada `whereClientes(workspaceId: string, c: ConsultaResuelta): Prisma.ClientWhereInput`.

Definición:
- `clave: "clientes"`, sustantivo `cliente/clientes`, placeholder "Buscar por nombre, documento, correo o teléfono".
- Búsqueda (igual que `listClients` hoy): `firstName`, `lastName`, `businessName`, `email` (insensitive), `docNumber` (sin puntos, guiones ni espacios), `phone`, y `clientNumber` si la búsqueda es un entero.
- Filtros: `tipo` (opcion `PERSONA` "Persona" / `EMPRESA` "Empresa" → `kind`), `estado` (opcion `ACTIVO`/`INACTIVO` → `status`), `alta` (periodo → `createdAt`), `movimientos` (siNo "Con movimientos"/"Sin movimientos" → `movements: { some: {} }` / `{ none: {} }`).
- Órdenes: `numero` (`clientNumber`), `nombre` (`[{ lastName }, { firstName }, { businessName }]`), `alta` (`createdAt`); por defecto `{ campo: "numero", desc: true }`.
- Columnas: N° (orden numero), Nombre (link a la ficha; orden nombre), Documento, Correo (secundaria), Teléfono (secundaria), Socio (número si `member`), Estado (chip), Alta (fecha AR, orden alta, secundaria).
- Acciones: ninguna en lote (la exportación de la selección la da la barra).
- Exportar: N°, Tipo, Nombre, Razón social, Tipo de documento, Documento, Condición IVA, Correo, Teléfono, Domicilio, Ciudad, Estado, Socio N°, Alta (fechaHora).
- Panel: nombre, tipo, documento, condición IVA, correo, teléfono, domicilio, socio vinculado (link), y los últimos 5 movimientos de Caja del cliente (fecha, descripción, importe con signo) — sólo si el módulo `cash` está encendido para el workspace (`isModuleEnabledForWorkspace`).
- `hrefFicha: (id) => `/clientes/${id}``.

- [ ] **Step 1: Pruebas que fallan** — `whereClientes` pone siempre `workspaceId`; cada filtro se traduce; la búsqueda por número agrega `clientNumber`; el documento se busca sin puntos; `listadoClientes.filtros` no usa claves de `PARAMETROS_RESERVADOS`; `listadoClientes.ordenes` incluye `ordenPorDefecto.campo`; `traerPorIds` preserva el orden de los ids (con `prisma` simulado vía `vi.mock("@repo/db")`).

```ts
import { describe, expect, it } from "vitest";
import { whereClientes } from "./listado";
import type { ConsultaResuelta } from "@/lib/listado/tipos";

const base = { q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "numero", desc: true }, pagina: 1, filas: 25, ver: null } as ConsultaResuelta;

describe("whereClientes", () => {
  it("siempre filtra por workspace", () => expect(whereClientes("w1", base)).toEqual({ workspaceId: "w1" }));
  it("traduce tipo, estado y movimientos", () =>
    expect(whereClientes("w1", { ...base, filtros: { tipo: "EMPRESA", estado: "ACTIVO", movimientos: "no" } })).toEqual({
      workspaceId: "w1", kind: "EMPRESA", status: "ACTIVO", movements: { none: {} },
    }));
  it("busca por número y documento sin puntos", () => {
    const w = whereClientes("w1", { ...base, q: "20.123" });
    expect(w.OR).toContainEqual({ docNumber: { contains: "20123" } });
    const n = whereClientes("w1", { ...base, q: "42" });
    expect(n.OR).toContainEqual({ clientNumber: 42 });
  });
  it("período de alta", () => {
    const desde = new Date("2026-09-01T03:00:00Z"), hasta = new Date("2026-10-01T02:59:59.999Z");
    expect(whereClientes("w1", { ...base, filtros: { alta: "este-mes" }, periodos: { alta: { desde, hasta } } }).createdAt).toEqual({ gte: desde, lte: hasta });
  });
});
```

- [ ] **Step 2: Correr y ver que falla.**

- [ ] **Step 3: Implementar `lib/clients/listado.ts`** (`import "server-only"`; `whereClientes` pura; `contar` = `prisma.client.count({ where })`; `traer` = `findMany` con `select` de lo que usan columnas y `skip/take`; `traerIds` = `findMany({ select: { id: true }, take: tope })` con el mismo orden; `traerPorIds` = `findMany({ where: { workspaceId, id: { in: ids } } })` reordenado).

- [ ] **Step 4: Reemplazar la página** `app/(shell)/clientes/page.tsx`: conserva `requireClientsStaff()`, el `PageHeader` con el botón "Nuevo cliente" y los mensajes `ok`/`error` que tenga hoy; arma `ctx: ContextoListado` desde el resultado del guarda (`userLabel` como en `contextoDeListado`) y dibuja `<Listado def={listadoClientes} ctx={ctx} ruta="/clientes" searchParams={sp} />`. El formulario GET, la tabla a mano y el `take: 200` desaparecen; `listClients` queda para otros usos (buscar su uso con `grep -rn "listClients" apps/fotoffice`; si sólo lo usaba esta página y el filtro de Caja, dejarlo hasta la Tarea 13).

- [ ] **Step 5: Correr pruebas, tsc y build** — PASS / sin errores / build OK.

- [ ] **Step 6: Commit** — mensaje: `Clientes usa el listado estándar: sin corte de 200 filas`.

---

### Task 12: Socios con el listado estándar

**Files:**
- Modify (reemplazar el stub): `apps/fotoffice/lib/members/listado.ts`
- Test: `apps/fotoffice/lib/members/listado.test.ts`
- Modify: `apps/fotoffice/app/(shell)/members/page.tsx`

**Interfaces:**
- Consumes: `<Listado>`, motor; `updateMember`, `MemberConcurrencyError` y `memberAccessWhere` de `@repo/db/fotoffice-members` y `packages/db/src/fotoffice-member-access-filter.ts`; `auditActorFrom` (`lib/members/audit.ts`); `inviteOneMember` e `INVITE_BATCH_MAX` (hoy usados por `inviteMembersBatchAction` en `app/actions/member-access.ts` — si `inviteOneMember` es local a ese archivo, moverlo a `lib/members/invite-member.ts` exportado, sin cambiar su comportamiento, y que la acción vieja lo importe); `loadPersonVocabulary`, `aplicarVocabulario`; `requireMembersContext`.
- Produces: `listadoSocios(vocabulario): DefinicionListado<FilaSocio>` (**función**, porque los textos dependen del vocabulario; `registro.ts` la llama con el vocabulario del workspace: cambiar `cargar` a `cargar: async (ctx) => …` si hace falta y ajustar `definicionDe(clave, ctx)` y sus usos) y la pura `whereSocios(workspaceId, c)`.

Definición:
- `clave: "socios"`, sustantivo `{persona}/{personas}` del vocabulario.
- Búsqueda: `firstName`, `lastName`, `memberNumber`, `email`, `documentNumber` (insensitive), como `searchMembers`.
- Filtros: `estado` (opcion `ACTIVE` "Activo" / `SUSPENDED` "Suspendido" / `INACTIVE` "Baja" → `status`), `categoria` (relacion → `categoryId`; `opcionesRelacion` = categorías del workspace; `validarRelacion` = categoría del workspace), `acceso` (opcion con los mismos valores que acepta hoy `memberAccessWhere` → `...memberAccessWhere(valor)`), `deuda` (siNo "Con deuda"/"Al día" → `charges: { some: <condición de cuota impaga> }` / `{ none: … }`; tomar la condición de impaga de la que usa hoy la pantalla de Cuotas en `lib/membership/dues-overview.ts`, sin inventar una nueva).
- Órdenes: `apellido` (`[{ lastName }, { firstName }]`), `numero` (`memberNumber`), `categoria` (`category: { name }`), `alta` (`joinedAt`); defecto `{ campo: "apellido", desc: false }`.
- Columnas: N°, Apellido y nombre (link), Categoría, Estado (chip), Correo (secundaria), Acceso al portal (secundaria), Alta (secundaria).
- Acciones:
  - `categoria` — "Cambiar categoría", `operar`, máximo 5.000, parámetro = categorías activas del workspace, confirmación `Vas a cambiar la categoría de {n} {personas} a {parametro}.` (con vocabulario); `elegibles` excluye los que ya tienen esa categoría ("ya tiene esa categoría"); `aplicar` recorre los ids y llama `updateMember(ctx.workspaceId, id, { categoryId }, { actor: { userId: ctx.userId, label: ctx.userLabel }, action: "UPDATED", source: "MANUAL" })` (verificar la forma exacta de `actor` en `auditActorFrom`); `null` → fallido "no encontrado"; `MemberConcurrencyError` → fallido "se modificó mientras tanto"; `detalle` = `{ id, antes: categoryIdAnterior, despues: categoryId }` (leer las categorías anteriores con un `findMany` previo).
  - `invitar` — "Invitar al portal", `operar`, **máximo `INVITE_BATCH_MAX`**, sin parámetro, confirmación `Vas a invitar al portal a {n} {personas}.`; `elegibles` excluye los sin correo ("no tiene correo") y los que ya tienen usuario vinculado ("ya tiene acceso"); `aplicar` llama `inviteOneMember` por id.
- Exportar: las mismas columnas que `buildMembersCsv` hoy (leer `lib/members/export.ts` y replicar títulos y orden), con fechas `fecha`.
- Panel: N°, estado, categoría, deuda total y cantidad de cuotas impagas, último carnet (estado), últimos 3 pagos (fecha, importe), acceso al portal; botón "Abrir ficha".
- La página conserva: `requireMembersContext`, el `PageHeader` con sus botones (nuevo socio, importar, etc.), las tarjetas de conteo por estado (`countMembersByStatus`) y los mensajes `forbidden`. Desaparecen: el form GET, `buildQuery`, la paginación a mano, los dos botones de exportar (reemplazados por el común) y `InviteBatchForm` (reemplazado por la acción en lote). `inviteMembersBatchAction` y `app/api/members/export` quedan sin tocar.

- [ ] **Step 1: Pruebas que fallan**: `whereSocios` (workspace siempre, estado, categoría, acceso delega en `memberAccessWhere`, deuda); `elegibles` de invitar excluye sin correo y ya vinculados; `aplicar` de categoría cuenta fallidos por concurrencia (con `updateMember` simulado vía `vi.mock("@repo/db/fotoffice-members")`); el máximo de invitar es `INVITE_BATCH_MAX`; claves de filtro no reservadas.

- [ ] **Step 2: Correr y ver que fallan.**

- [ ] **Step 3: Implementar definición y página** según lo de arriba.

- [ ] **Step 4: Correr todas las pruebas de socios** — `pnpm --filter fotoffice exec vitest run lib/members lib/listado app/actions` — PASS, incluidas las existentes (`export.test.ts`, `export-isolation.test.ts`, `invite-member-action.test.ts`). tsc y build OK.

- [ ] **Step 5: Commit** — mensaje: `Socios usa el listado estándar: cambiar categoría e invitar en lote`.

---

### Task 13: Caja / movimientos con el listado estándar, documentación y cierre

**Files:**
- Modify (reemplazar el stub): `apps/fotoffice/lib/cash/listado-movimientos.ts`
- Test: `apps/fotoffice/lib/cash/listado-movimientos.test.ts`
- Modify: `apps/fotoffice/app/(shell)/caja/movimientos/page.tsx`
- Modify: `apps/fotoffice/docs/superpowers/specs/2026-09-29-etapa-0-2-listado-estandar-design.md` (§3.4 y §6: el lote de socios es fila por fila — ruling 1)

**Interfaces:**
- Consumes: `<Listado>`, motor; `movementSelect`/`toMovementRow` y `MovementRow` de `lib/cash/repository.ts` (exportar `movementSelect` y `toMovementRow` si hoy son locales, sin cambiarlos); `MOVEMENT_KINDS`, `PAYMENT_METHODS`, `MOVEMENT_SOURCES` de `lib/cash/constants.ts`; `clientDisplayName`; `requireCashStaff`; los componentes de fila de `app/(shell)/caja/movements-table.tsx` (celdas y botón de anular) para no perder acciones por fila.
- Produces: `listadoMovimientos: DefinicionListado<MovementRow>`, pura `whereMovimientos(workspaceId, c)`, pura `separarElegiblesRubro(movs, categoria) → { elegibles; excluidos }`.

Definición:
- `clave: "caja-movimientos"`, sustantivo `movimiento/movimientos`, placeholder "Buscar por descripción, comprobante o cliente".
- Búsqueda: `description`, `receiptRef` (insensitive) y `client` por nombre (`client: { OR: [firstName, lastName, businessName contains] }`).
- Filtros: `cuenta` (relacion → `accountId`, opciones = cuentas del workspace), `rubro` (relacion → `categoryId`, opciones = rubros), `tipo` (opcion INGRESO "Ingreso"/EGRESO "Egreso" → `kind`), `medio` (opcion `PAYMENT_METHODS` → `paymentMethod`), `origen` (opcion `MOVEMENT_SOURCES` con etiquetas "Carga manual", "Cuotas", "Reservas", "Ventas", "Pedidos" → `sourceModule`), `cliente` (relacion **con buscador** → `clientId`; `buscarRelacion` busca clientes del workspace por nombre/documento, 20 resultados; `validarRelacion` devuelve `clientDisplayName`), `periodo` (periodo → `occurredAt`).
- Órdenes: `fecha` (`occurredAt`), `importe` (`amountArs`); defecto `{ campo: "fecha", desc: true }`.
- Columnas: Fecha y hora (AR), Descripción (+ comprobante debajo), Cliente (secundaria), Cuenta, Rubro, Medio (secundaria), Importe (derecha, verde ingreso / rojo egreso, anulado tachado), y la columna de acciones por fila que hoy tiene `movements-table.tsx`.
- Acción `rubro` — "Cambiar rubro", `operar`, máximo 5.000, parámetro = rubros **activos** del workspace con etiqueta `"<nombre> (ingreso|egreso)"`, confirmación `Vas a cambiar el rubro de {n} movimientos a {parametro}.`
  - `elegibles` usa `separarElegiblesRubro` con motivos exactos: `sourceModule !== "manual"` → "viene de <origen>: se corrige en su módulo"; `transferId` → "es un pase entre cuentas"; `isReversed` → "está anulado"; `reversesMovementId` → "es una anulación"; `kind !== categoria.kind` → "es un ingreso y el rubro es de egresos" (o al revés); `categoryId === categoria.id` → "ya tiene ese rubro".
  - `aplicar`: en `prisma.$transaction`: lee los movimientos (`id`, `categoryId`) para el detalle, y `cashMovement.updateMany({ where: { id: { in: ids }, workspaceId, sourceModule: "manual", transferId: null, reversesMovementId: null, reversedBy: { is: null }, kind: categoria.kind }, data: { categoryId } })`. `aplicados` = `count`; si `count` < `ids.length`, los que faltan son fallidos "cambió mientras tanto". `detalle` = `{ id, antes, despues }`.
- Exportar: Fecha y hora, Tipo, Importe (importe, con signo negativo para egresos), Cuenta, Rubro, Medio, Descripción, Comprobante, Cliente, Origen, Anulado (Sí/No).
- Panel: todo `MovementRow`, más el contramovimiento si está anulado (link a `?ver=<id del contramovimiento>`), y quién lo cargó (`userDisplayNames`).
- La página conserva `requireCashStaff`, el `PageHeader`, el formulario de alta de movimiento (`MovementForm`) con sus `ok`/`error`, y deja de traer **todos los clientes** para un desplegable.

- [ ] **Step 1: Pruebas que fallan**

```ts
import { describe, expect, it } from "vitest";
import { separarElegiblesRubro, whereMovimientos } from "./listado-movimientos";

const mov = (o: Partial<{ id: string; kind: string; sourceModule: string; transferId: string | null; isReversed: boolean; reversesMovementId: string | null; categoryId: string | null }>) => ({
  id: "m", kind: "INGRESO", sourceModule: "manual", transferId: null, isReversed: false, reversesMovementId: null, categoryId: null, ...o,
});

describe("separarElegiblesRubro", () => {
  const rubro = { id: "r1", kind: "INGRESO" };
  it("sólo manuales, sin pase, sin anular, del mismo tipo y con otro rubro", () => {
    const r = separarElegiblesRubro(
      [
        mov({ id: "ok" }),
        mov({ id: "cuota", sourceModule: "membership" }),
        mov({ id: "pase", transferId: "t" }),
        mov({ id: "anulado", isReversed: true }),
        mov({ id: "anulacion", reversesMovementId: "x" }),
        mov({ id: "egreso", kind: "EGRESO" }),
        mov({ id: "igual", categoryId: "r1" }),
      ],
      rubro,
    );
    expect(r.elegibles).toEqual(["ok"]);
    expect(r.excluidos.map((e) => e.id)).toEqual(["cuota", "pase", "anulado", "anulacion", "egreso", "igual"]);
    expect(r.excluidos[0].motivo).toBe("viene de Cuotas: se corrige en su módulo");
  });
});

describe("whereMovimientos", () => {
  it("siempre workspace; período sobre occurredAt; cliente por id", () => {
    const desde = new Date("2026-09-01T03:00:00Z"), hasta = new Date("2026-10-01T02:59:59.999Z");
    const w = whereMovimientos("w1", {
      q: "", filtros: { periodo: "este-mes", cliente: "c1", tipo: "EGRESO" }, periodos: { periodo: { desde, hasta } },
      etiquetasRelacion: {}, orden: { campo: "fecha", desc: true }, pagina: 1, filas: 25, ver: null,
    });
    expect(w).toEqual({ workspaceId: "w1", clientId: "c1", kind: "EGRESO", occurredAt: { gte: desde, lte: hasta } });
  });
});
```

- [ ] **Step 2: Correr y ver que falla.**

- [ ] **Step 3: Implementar definición y página.**

- [ ] **Step 4: Ajustar el spec** (§3.4 fila de Socios/cambiar categoría: "fila por fila con `updateMember`; el resultado informa aplicados y no aplicados"; §6: "Una acción de Socios falla en una fila: esa fila queda sin cambiar, las demás se aplican y el resultado lo detalla. En Caja, la transacción no deja nada a medias").

- [ ] **Step 5: Verificación completa**

```bash
pnpm --filter fotoffice exec vitest run
NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice exec tsc --noEmit
NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter fotoffice build
for app in compramelafoto clickaton fotorank; do NODE_OPTIONS=--max-old-space-size=12288 pnpm --filter $app exec tsc --noEmit; done
```

Expected: todo verde (el cambio de schema toca el cliente Prisma que usan todas las apps; si alguna app falla por tipos preexistentes, comparar con la rama base antes de atribuirlo a esta etapa). `lib/carnet/template.test.ts` puede agotar el tiempo bajo carga: reintentar sola esa prueba.

- [ ] **Step 6: Prueba manual con `next dev`** (base local o staging con el SQL aplicado; si no hay ninguna con las tablas, dejarlo anotado para Daniel en el PR): en `/clientes`, `/members`, `/caja/movimientos` — buscar, filtrar, ordenar, cambiar de página y de filas; salir y volver (recuerda); guardar una vista; seleccionar todo y cambiar categoría/rubro; exportar y abrir el archivo; abrir el panel y moverse con ↑/↓.

- [ ] **Step 7: Commit** — mensaje: `Caja usa el listado estándar: cambiar rubro en lote sólo en cargas manuales`.

---

## Autorrevisión del plan

- **Cobertura del spec:** §3.1 → Tareas 1–3, 10; §3.2 → 7, 10; §3.3 → 7, 10; §3.4 → 8, 10, 12, 13; §3.5 → 4, 9; §3.6 → 10–13; §4 → 11–13; §5.1–5.3 → 1–10; §5.4 → 5; §5.5 → 6–9; §6 → 3, 7, 8, 13; §7 → pruebas de cada tarea; §8 → criterios que se cargan al tablero después del merge; §9 → documento de migración (Tarea 5) y PR.
- **Nombres consistentes:** `DefinicionListado`, `ConsultaListado`, `ConsultaResuelta`, `ContextoListado`, `leerConsulta`, `escribirConsulta`, `resolverConsulta`, `ejecutarListado`, `contextoDeListado`, `exigirCapacidad`, `definicionDe`, `LISTAS`, `registrarActividad`, `prepararLote`, `aplicarLote`, `resolverObjetivo`, `armarCsvExcel`, `TOPE_EXPORTACION`, `hoyEnBuenosAires`, `resolverPeriodo`.
- **Riesgo conocido:** la Tarea 12 puede requerir que `definicionDe` reciba el contexto (vocabulario). Si pasa, se cambia en la Tarea 12 junto con sus dos usos (acciones de `app/actions/listado.ts` y la ruta de exportar) y la prueba de `registro.test.ts`.
