import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { estaVencida } from "@/lib/circuitos/calculos";
import type { ConsultaResuelta, ContextoListado, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { avisoDeCampos, camposParaListado, conCampos, listasDeCampos } from "@/lib/campos/listado";
import { presupuestoDeIds, TOPE_IDS_POR_CONSULTA, type PresupuestoDeIds } from "@/lib/listado/presupuesto";
import { numeroDe } from "@/lib/numeracion/asignar";
import { SERVICE_LEAD_EVENT_TYPE_LABELS } from "./form-definitions";
import { TIPO_CONSULTA } from "./numero";

const SELECT_FILA = {
  id: true,
  name: true,
  email: true,
  phone: true,
  eventType: true,
  eventDate: true,
  createdAt: true,
} satisfies Prisma.ServiceSalesLeadSelect;

/** Recorrido de venta de la consulta: no hay FK entre las dos tablas, se une por `subjectId`. */
export type RecorridoDeFila = {
  circuito: string;
  etapa: { nombre: string; color: string } | null;
  outcome: string | null;
  enteredStageAt: Date;
  stageDueAt: Date | null;
};

type FilaBase = Prisma.ServiceSalesLeadGetPayload<{ select: typeof SELECT_FILA }>;
/** `numero`: el número de la consulta ("2026-0042"), null si todavía no tiene. */
export type FilaCaptacion = FilaBase & { recorrido: RecorridoDeFila | null; numero: string | null };

/** Los ids que llegan de una dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Tope de ids que devuelve cada subconsulta (recorridos, números). Cada id viaja como parámetro
 * del `IN (...)` de la consulta principal (Postgres admite hasta 32.767), y todas las listas de
 * una consulta comparten ese presupuesto (`presupuestoDeIds`): pasado el tope la lista sale vacía
 * con un aviso (nunca parcial), algo que a la escala de un estudio no debería pasar.
 */
export const TOPE_SUBCONSULTA = TOPE_IDS_POR_CONSULTA;

const fechaAR = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
const DIA_MS = 24 * 60 * 60 * 1000;
const RESULTADOS: readonly Opcion[] = [
  { valor: "abierta", etiqueta: "Abierta" },
  { valor: "GANADA", etiqueta: ETIQUETA_SALIDA.GANADA! },
  { valor: "PERDIDA", etiqueta: ETIQUETA_SALIDA.PERDIDA! },
];
const TIPOS_EVENTO = SERVICE_LEAD_EVENT_TYPE_LABELS as Record<string, string>;
const etiquetaTipo = (v: string) => TIPOS_EVENTO[v] ?? v;

export function diasEnEtapa(entrada: Date, ahora: Date): number {
  return Math.max(0, Math.floor((ahora.getTime() - entrada.getTime()) / DIA_MS));
}

/** ¿La consulta pide algo que sólo se sabe mirando el recorrido? */
export function filtraPorRecorrido(c: ConsultaResuelta): boolean {
  const f = c.filtros;
  return Boolean(f.circuito || f.etapa || f.resultado || f.vencidas);
}

/**
 * Puro: el `where` sobre `FotofficeJourney` que expresan los filtros de circuito, etapa,
 * resultado y vencidas. Va siempre acotado al workspace y a los recorridos de venta de Captación.
 */
export function whereRecorridos(workspaceId: string, c: ConsultaResuelta, ahora: Date): Prisma.FotofficeJourneyWhereInput {
  const where: Prisma.FotofficeJourneyWhereInput = { workspaceId, subjectType: "CAPTACION", kind: "VENTA" };
  const f = c.filtros;
  if (f.circuito) where.circuitId = f.circuito;
  if (f.etapa) where.stageId = f.etapa;
  if (f.resultado === "abierta") where.outcome = null;
  else if (f.resultado) where.outcome = f.resultado;
  // `vencidas` sólo aplica a recorridos abiertos y se combina con `resultado`: una salida
  // (GANADA / PERDIDA) junto con `vencidas` no puede coincidir con nada.
  if (f.vencidas) {
    const and: Prisma.FotofficeJourneyWhereInput[] = [{ outcome: null }];
    if (f.vencidas === "si") and.push({ stageDueAt: { lt: ahora } });
    else and.push({ OR: [{ stageDueAt: null }, { stageDueAt: { gte: ahora } }] });
    where.AND = and;
  }
  return where;
}

/**
 * Puro: todas las listas de ids de la consulta, en un solo presupuesto. AND: los recorridos y los
 * filtros de campos (se intersecan); OR: la búsqueda por número y la de campos (se unen y, con
 * AND, sólo quedan las que están en ella). Si juntas pasan el tope, `excedido`: la lista sale
 * vacía y `avisoCaptacion` explica por qué, nunca parcial.
 */
export function idsDeCaptacion(c: ConsultaResuelta, idsRecorrido: string[] | null, idsNumero: string[] = []): PresupuestoDeIds {
  const campos = listasDeCampos(c);
  return presupuestoDeIds({ y: [idsRecorrido, campos.y], o: [c.q.trim() ? idsNumero : [], campos.o] });
}

/**
 * Puro: lo que se le pide a Prisma. `workspaceId` va siempre, primero. `idsRecorrido` viene de la
 * subconsulta de recorridos; `idsNumero`, de la búsqueda por número (se suma al OR de la búsqueda).
 */
export function whereCaptacion(
  workspaceId: string,
  c: ConsultaResuelta,
  idsRecorrido: string[] | null,
  idsNumero: string[] = [],
): Prisma.ServiceSalesLeadWhereInput {
  const ids = idsDeCaptacion(c, idsRecorrido, idsNumero);
  if (ids.excedido) return { workspaceId, id: { in: [] } };
  const where: Prisma.ServiceSalesLeadWhereInput = { workspaceId };
  const q = c.q.trim();
  if (q) {
    const minuscula = q.toLowerCase();
    const codigos = Object.entries(TIPOS_EVENTO)
      .filter(([, etiqueta]) => etiqueta.toLowerCase().includes(minuscula))
      .map(([codigo]) => codigo);
    const or: Prisma.ServiceSalesLeadWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { eventType: { contains: q, mode: "insensitive" } },
    ];
    if (codigos.length > 0) or.push({ eventType: { in: codigos } });
    // Número y campos personalizados, en una sola lista.
    if (ids.o.length > 0) or.push({ id: { in: ids.o } });
    where.OR = or;
  }
  const evento = c.periodos.evento;
  if (evento) where.eventDate = { gte: evento.desde, lte: evento.hasta };
  const alta = c.periodos.alta;
  if (alta) where.createdAt = { gte: alta.desde, lte: alta.hasta };
  // Recorridos y filtros de campos, ya intersecados.
  if (ids.y !== null) where.id = { in: ids.y };
  return where;
}

/**
 * Resuelve el `where` completo. Como `ServiceSalesLead` no tiene relación con `FotofficeJourney`
 * (no se agregan columnas a la tabla), los filtros de circuito, etapa, resultado y vencidas se
 * resuelven con una subconsulta previa de `subjectId` acotada al workspace (y al tipo CAPTACION).
 *
 * Costo: una consulta extra por listado, que lee como mucho `TOPE_SUBCONSULTA` + 1 ids usando el
 * índice `(workspaceId, subjectType, subjectId)`, y un `IN` con esos ids en la consulta principal.
 * Sin esos filtros no hay subconsulta.
 */
export async function resolverWhere(ctx: ContextoListado, c: ConsultaResuelta, ahora: Date = new Date()): Promise<Prisma.ServiceSalesLeadWhereInput> {
  const porNumero = await idsPorTextoDeNumero(ctx.workspaceId, c.q);
  if (!filtraPorRecorrido(c)) return whereCaptacion(ctx.workspaceId, c, null, porNumero);
  // Pasado el tope no se devuelven resultados parciales: la lista queda vacía y `avisoCaptacion` explica por qué.
  return whereCaptacion(ctx.workspaceId, c, (await idsDeRecorridos(ctx, c, ahora)) ?? [], porNumero);
}

/** Puro: lo que se busca en el número mostrado. Sin dígitos no hay búsqueda por número; "N° 42" o "Nro. 42" buscan "42". */
export function textoDeNumeroBuscado(q: string): string | null {
  const t = q.trim().replace(/^(n\s*[°º]|nro\.?)\s*/i, "").trim();
  return /\d/.test(t) ? t : null;
}

/**
 * Consultas cuyo número mostrado contiene lo buscado ("2026-0042", "0042" o "42"). Una lectura
 * acotada al workspace y a los números de consulta. Si coinciden más que `TOPE_SUBCONSULTA`
 * (p. ej. buscar "2"), la búsqueda por número no suma nada: el resto de la búsqueda sigue igual.
 */
async function idsPorTextoDeNumero(workspaceId: string, q: string): Promise<string[]> {
  const texto = textoDeNumeroBuscado(q);
  if (!texto) return [];
  const filas = await prisma.fotofficeRecordNumber.findMany({
    where: { workspaceId, entityType: TIPO_CONSULTA, display: { contains: texto, mode: "insensitive" } },
    select: { entityId: true },
    take: TOPE_SUBCONSULTA + 1,
  });
  return filas.length > TOPE_SUBCONSULTA ? [] : filas.map((f) => f.entityId);
}

/** Ids de consultas con recorrido que cumple los filtros; null si son más que `TOPE_SUBCONSULTA`. */
async function idsDeRecorridos(ctx: ContextoListado, c: ConsultaResuelta, ahora: Date): Promise<string[] | null> {
  const filas = await prisma.fotofficeJourney.findMany({
    where: whereRecorridos(ctx.workspaceId, c, ahora),
    select: { subjectId: true },
    orderBy: [{ subjectId: "asc" }, { id: "asc" }],
    take: TOPE_SUBCONSULTA + 1,
  });
  if (filas.length > TOPE_SUBCONSULTA) return null;
  return Array.from(new Set(filas.map((f) => f.subjectId)));
}

export const AVISO_DEMASIADAS = "Hay demasiadas consultas para filtrar por etapa o resultado. Acotá con período o búsqueda.";

/**
 * Aviso del listado: la lista se muestra vacía porque los filtros de recorrido superaron el tope o
 * porque las listas de ids juntas (recorridos, número y campos) pasan el presupuesto. `c` llega
 * con la restricción de los campos (`conCampos`); si los campos solos se pasaron, avisan ellos.
 */
export async function avisoCaptacion(ctx: ContextoListado, c: ConsultaResuelta, ahora: Date = new Date()): Promise<string | null> {
  const conRecorridos = filtraPorRecorrido(c);
  const idsRecorrido = conRecorridos ? await idsDeRecorridos(ctx, c, ahora) : null;
  if (conRecorridos && idsRecorrido === null) return AVISO_DEMASIADAS;
  if (!idsDeCaptacion(c, idsRecorrido, await idsPorTextoDeNumero(ctx.workspaceId, c.q)).excedido) return null;
  // Sin recorridos sólo se pasa con los campos personalizados de por medio.
  return conRecorridos ? AVISO_DEMASIADAS : avisoDeCampos("consultas");
}

function ordenarPor(c: ConsultaResuelta): Prisma.ServiceSalesLeadOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  // `id` desempata para que la paginación no repita ni saltee filas.
  switch (c.orden.campo) {
    case "evento":
      return [{ eventDate: { sort: dir, nulls: "last" } }, { id: dir }];
    case "nombre":
      return [{ name: dir }, { id: dir }];
    default:
      // "alta" y, si el resultado pasó el tope, "numero" (se numera en orden de alta).
      return [{ createdAt: dir }, { id: dir }];
  }
}

/** El recorrido de venta más reciente de cada consulta (acotado al workspace). */
async function recorridosDe(workspaceId: string, ids: string[]): Promise<Map<string, RecorridoDeFila>> {
  const mapa = new Map<string, RecorridoDeFila>();
  if (ids.length === 0) return mapa;
  const filas = await prisma.fotofficeJourney.findMany({
    where: { workspaceId, subjectType: "CAPTACION", kind: "VENTA", subjectId: { in: ids } },
    select: {
      subjectId: true,
      outcome: true,
      enteredStageAt: true,
      stageDueAt: true,
      circuit: { select: { name: true } },
      stage: { select: { name: true, color: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  for (const j of filas) {
    if (mapa.has(j.subjectId)) continue;
    mapa.set(j.subjectId, {
      circuito: j.circuit.name,
      etapa: j.stage ? { nombre: j.stage.name, color: j.stage.color } : null,
      outcome: j.outcome,
      enteredStageAt: j.enteredStageAt,
      stageDueAt: j.stageDueAt,
    });
  }
  return mapa;
}

/** Recorrido y número de cada fila de la página: una lectura de cada uno para toda la página. */
async function conRecorrido(workspaceId: string, filas: FilaBase[]): Promise<FilaCaptacion[]> {
  const ids = filas.map((f) => f.id);
  const [mapa, numeros] = await Promise.all([recorridosDe(workspaceId, ids), numeroDe(workspaceId, TIPO_CONSULTA, ids)]);
  return filas.map((f) => ({ ...f, recorrido: mapa.get(f.id) ?? null, numero: numeros.get(f.id) ?? null }));
}

/**
 * Orden por número. La consulta no tiene relación con su número (no se agregan columnas), así
 * que se ordena en dos lecturas: los ids del resultado (hasta `TOPE_SUBCONSULTA`) y sus números;
 * después, por año y valor (no por el texto: "2026-0100" va después de "2026-0099" aunque cambie
 * el prefijo). Las que todavía no tienen número van al final, por alta. Si el resultado pasa el
 * tope devuelve null y se ordena por alta, que es el orden en que se numeran.
 */
async function idsOrdenadosPorNumero(workspaceId: string, where: Prisma.ServiceSalesLeadWhereInput, desc: boolean): Promise<string[] | null> {
  // Presupuesto de parámetros: `where` viene de `whereCaptacion` (ya pasó por `presupuestoDeIds`)
  // y la segunda lectura lleva sólo los ids de la primera, como mucho `TOPE_SUBCONSULTA`.
  const dir = desc ? "desc" : "asc";
  const filas = await prisma.serviceSalesLead.findMany({ where, select: { id: true }, orderBy: [{ createdAt: dir }, { id: dir }], take: TOPE_SUBCONSULTA + 1 });
  if (filas.length > TOPE_SUBCONSULTA) return null;
  const ids = filas.map((f) => f.id);
  if (ids.length === 0) return [];
  const numeros = await prisma.fotofficeRecordNumber.findMany({
    where: { workspaceId, entityType: TIPO_CONSULTA, entityId: { in: ids } },
    select: { entityId: true, year: true, value: true },
  });
  return ordenarPorNumero(ids, new Map(numeros.map((n) => [n.entityId, n])), desc);
}

/** Puro: `ids` (ya en orden de alta) ordenados por año y valor; las sin número al final, en su orden. */
export function ordenarPorNumero(ids: string[], numeros: Map<string, { year: number | null; value: number }>, desc: boolean): string[] {
  const posicion = new Map(ids.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => {
    const na = numeros.get(a);
    const nb = numeros.get(b);
    if (!na || !nb) return na ? -1 : nb ? 1 : posicion.get(a)! - posicion.get(b)!;
    const d = (na.year ?? 0) - (nb.year ?? 0) || na.value - nb.value;
    return (desc ? -d : d) || posicion.get(a)! - posicion.get(b)!;
  });
}

/** Las filas de `ids`, en ese orden y acotadas al workspace. */
async function filasPorIds(workspaceId: string, ids: string[]): Promise<FilaCaptacion[]> {
  if (ids.length === 0) return [];
  const filas = await prisma.serviceSalesLead.findMany({ where: { workspaceId, id: { in: ids } }, select: SELECT_FILA });
  const porId = new Map((await conRecorrido(workspaceId, filas)).map((f) => [f.id, f]));
  return ids.flatMap((id) => porId.get(id) ?? []);
}

function Chip({ texto, clase }: { texto: string; clase: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${clase}`}>{texto}</span>;
}

function celdaEtapa(f: FilaCaptacion) {
  const r = f.recorrido;
  if (!r) return <span className="text-[var(--fo-muted)]">Sin ordenar</span>;
  if (r.outcome) return <Chip texto={ETIQUETA_SALIDA[r.outcome] ?? r.outcome} clase={r.outcome === "GANADA" ? claseDeColorEtiqueta("verde") : claseDeColorEtiqueta("rojo")} />;
  return <Chip texto={r.etapa?.nombre ?? "—"} clase={claseDeColorEtiqueta(r.etapa?.color ?? "gris")} />;
}

function textoResultado(r: RecorridoDeFila | null): string | null {
  if (!r) return null;
  return r.outcome ? (ETIQUETA_SALIDA[r.outcome] ?? r.outcome) : "Abierta";
}

export const listadoCaptacion: DefinicionListado<FilaCaptacion> = {
  clave: "captacion",
  titulo: "Captación",
  sustantivo: { singular: "consulta", plural: "consultas" },
  placeholderBusqueda: "Buscar por número, nombre, correo, teléfono o tipo de evento",
  columnas: [
    {
      clave: "numero",
      titulo: "N°",
      orden: "numero",
      celda: (f) => (f.numero ? <span className="whitespace-nowrap tabular-nums">{f.numero}</span> : "—"),
    },
    {
      clave: "nombre",
      titulo: "Nombre",
      orden: "nombre",
      celda: (f) => (
        <Link href={`/captacion/${encodeURIComponent(f.id)}`} className="font-medium text-[var(--fo-text)] hover:underline">
          {f.name}
        </Link>
      ),
    },
    { clave: "tipo", titulo: "Tipo de evento", celda: (f) => etiquetaTipo(f.eventType) },
    { clave: "evento", titulo: "Fecha del evento", orden: "evento", celda: (f) => (f.eventDate ? fechaAR.format(f.eventDate) : "—") },
    { clave: "etapa", titulo: "Etapa", celda: celdaEtapa },
    {
      clave: "dias",
      titulo: "Días en la etapa",
      secundaria: true,
      alinear: "derecha",
      celda: (f) => (f.recorrido && !f.recorrido.outcome ? diasEnEtapa(f.recorrido.enteredStageAt, new Date()) : "—"),
    },
    {
      clave: "vence",
      titulo: "Vence",
      secundaria: true,
      celda: (f) => {
        const r = f.recorrido;
        if (!r || r.outcome || !r.stageDueAt) return "—";
        const vencida = estaVencida(r.stageDueAt, new Date());
        return <span className={vencida ? "font-medium text-red-700" : undefined}>{fechaAR.format(r.stageDueAt)}</span>;
      },
    },
    { clave: "alta", titulo: "Alta", orden: "alta", secundaria: true, celda: (f) => fechaAR.format(f.createdAt) },
  ],
  filtros: [
    { tipo: "relacion", clave: "circuito", etiqueta: "Circuito" },
    { tipo: "relacion", clave: "etapa", etiqueta: "Etapa" },
    { tipo: "opcion", clave: "resultado", etiqueta: "Resultado", opciones: RESULTADOS },
    { tipo: "siNo", clave: "vencidas", etiqueta: "Vencidas", si: "Vencidas", no: "En plazo" },
    { tipo: "periodo", clave: "evento", etiqueta: "Fecha del evento" },
    { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
  ],
  ordenes: ["alta", "evento", "nombre", "numero"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/captacion/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.serviceSalesLead.count({ where: await resolverWhere(ctx, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const where = await resolverWhere(ctx, c);
    if (c.orden.campo === "numero") {
      const ids = await idsOrdenadosPorNumero(ctx.workspaceId, where, c.orden.desc);
      if (ids) return filasPorIds(ctx.workspaceId, ids.slice(skip, skip + take));
    }
    const filas = await prisma.serviceSalesLead.findMany({ where, select: SELECT_FILA, orderBy: ordenarPor(c), skip, take });
    return conRecorrido(ctx.workspaceId, filas);
  },
  traerIds: async (ctx, c, tope) => {
    const where = await resolverWhere(ctx, c);
    if (c.orden.campo === "numero") {
      const ids = await idsOrdenadosPorNumero(ctx.workspaceId, where, c.orden.desc);
      if (ids) return ids.slice(0, tope);
    }
    const filas = await prisma.serviceSalesLead.findMany({ where, select: { id: true }, orderBy: ordenarPor(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => filasPorIds(ctx.workspaceId, ids.filter((id) => ID_VALIDO.test(id))),
  opcionesRelacion: async (ctx, clave) => {
    if (clave === "circuito") {
      const circuitos = await prisma.fotofficeCircuit.findMany({
        where: { workspaceId: ctx.workspaceId, kind: "VENTA" },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return circuitos.map((c) => ({ valor: c.id, etiqueta: c.name }));
    }
    if (clave === "etapa") {
      const etapas = await prisma.fotofficeStage.findMany({
        where: { circuit: { workspaceId: ctx.workspaceId, kind: "VENTA" } },
        select: { id: true, name: true, circuit: { select: { name: true } } },
        orderBy: [{ circuit: { name: "asc" } }, { order: "asc" }, { id: "asc" }],
      });
      const variosCircuitos = new Set(etapas.map((e) => e.circuit.name)).size > 1;
      return etapas.map((e) => ({ valor: e.id, etiqueta: variosCircuitos ? `${e.circuit.name} · ${e.name}` : e.name }));
    }
    return [];
  },
  validarRelacion: async (ctx, clave, id) => {
    if (!ID_VALIDO.test(id)) return null;
    if (clave === "circuito") {
      const c = await prisma.fotofficeCircuit.findFirst({ where: { id, workspaceId: ctx.workspaceId, kind: "VENTA" }, select: { name: true } });
      return c?.name ?? null;
    }
    if (clave === "etapa") {
      const e = await prisma.fotofficeStage.findFirst({ where: { id, circuit: { workspaceId: ctx.workspaceId, kind: "VENTA" } }, select: { name: true } });
      return e?.name ?? null;
    }
    return null;
  },
  // Sin acciones en lote en esta etapa: mover, ganar o perder se hace desde el tablero y la ficha.
  aviso: avisoCaptacion,
  acciones: [],
  exportar: {
    columnas: [
      { titulo: "N°", tipo: "texto", valor: (f) => f.numero },
      { titulo: "Nombre", tipo: "texto", valor: (f) => f.name },
      { titulo: "Correo", tipo: "texto", valor: (f) => f.email },
      { titulo: "Teléfono", tipo: "texto", valor: (f) => f.phone },
      { titulo: "Tipo de evento", tipo: "texto", valor: (f) => etiquetaTipo(f.eventType) },
      { titulo: "Fecha del evento", tipo: "fecha", valor: (f) => f.eventDate },
      { titulo: "Circuito", tipo: "texto", valor: (f) => f.recorrido?.circuito ?? null },
      { titulo: "Etapa", tipo: "texto", valor: (f) => f.recorrido?.etapa?.nombre ?? null },
      { titulo: "Resultado", tipo: "texto", valor: (f) => textoResultado(f.recorrido) },
      { titulo: "Días en la etapa", tipo: "numero", valor: (f) => (f.recorrido && !f.recorrido.outcome ? diasEnEtapa(f.recorrido.enteredStageAt, new Date()) : null) },
      { titulo: "Vence", tipo: "fecha", valor: (f) => (f.recorrido && !f.recorrido.outcome ? f.recorrido.stageDueAt : null) },
      { titulo: "Alta", tipo: "fechaHora", valor: (f) => f.createdAt },
    ],
  },
};

/** La lista con los campos personalizados del workspace (columnas, filtros, búsqueda y exportación). */
export async function cargarListadoCaptacion(ctx: ContextoListado) {
  return conCampos(listadoCaptacion, await camposParaListado(ctx, "CONSULTA"));
}
