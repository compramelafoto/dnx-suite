import "server-only";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { estaVencida } from "@/lib/circuitos/calculos";
import type { ConsultaResuelta, ContextoListado, DefinicionListado, Opcion } from "@/lib/listado/tipos";
import { camposParaListado, conCampos, restriccionDeCampos } from "@/lib/campos/listado";
import { SERVICE_LEAD_EVENT_TYPE_LABELS } from "./form-definitions";

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

export type FilaCaptacion = Prisma.ServiceSalesLeadGetPayload<{ select: typeof SELECT_FILA }> & { recorrido: RecorridoDeFila | null };

/** Los ids que llegan de una dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Tope de ids que devuelve la subconsulta de recorridos. Cada id viaja como parámetro del
 * `IN (...)` de la consulta principal (Postgres admite hasta 32.767): pasado el tope la lista
 * sale vacía con un aviso (nunca parcial), algo que a la escala de un estudio no debería pasar.
 */
export const TOPE_SUBCONSULTA = 20_000;

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

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre, primero. `idsRecorrido` viene de la subconsulta. */
export function whereCaptacion(workspaceId: string, c: ConsultaResuelta, idsRecorrido: string[] | null): Prisma.ServiceSalesLeadWhereInput {
  const where: Prisma.ServiceSalesLeadWhereInput = { workspaceId };
  const campos = restriccionDeCampos(c);
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
    if (campos.buscar) or.push(campos.buscar);
    where.OR = or;
  }
  const evento = c.periodos.evento;
  if (evento) where.eventDate = { gte: evento.desde, lte: evento.hasta };
  const alta = c.periodos.alta;
  if (alta) where.createdAt = { gte: alta.desde, lte: alta.hasta };
  if (idsRecorrido) where.id = { in: idsRecorrido };
  // Va en un AND: `id` ya puede estar acotado por los recorridos.
  if (campos.acotar) where.AND = [campos.acotar];
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
  if (!filtraPorRecorrido(c)) return whereCaptacion(ctx.workspaceId, c, null);
  // Pasado el tope no se devuelven resultados parciales: la lista queda vacía y `avisoCaptacion` explica por qué.
  return whereCaptacion(ctx.workspaceId, c, (await idsDeRecorridos(ctx, c, ahora)) ?? []);
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

/** Aviso del listado: los filtros de recorrido superaron el tope y la lista se muestra vacía. */
export async function avisoCaptacion(ctx: ContextoListado, c: ConsultaResuelta, ahora: Date = new Date()): Promise<string | null> {
  if (!filtraPorRecorrido(c)) return null;
  return (await idsDeRecorridos(ctx, c, ahora)) === null ? AVISO_DEMASIADAS : null;
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

async function conRecorrido(workspaceId: string, filas: Prisma.ServiceSalesLeadGetPayload<{ select: typeof SELECT_FILA }>[]): Promise<FilaCaptacion[]> {
  const mapa = await recorridosDe(workspaceId, filas.map((f) => f.id));
  return filas.map((f) => ({ ...f, recorrido: mapa.get(f.id) ?? null }));
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
  placeholderBusqueda: "Buscar por nombre, correo, teléfono o tipo de evento",
  columnas: [
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
  ordenes: ["alta", "evento", "nombre"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f) => f.id,
  hrefFicha: (id) => `/captacion/${encodeURIComponent(id)}`,
  contar: async (ctx, c) => prisma.serviceSalesLead.count({ where: await resolverWhere(ctx, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.serviceSalesLead.findMany({ where: await resolverWhere(ctx, c), select: SELECT_FILA, orderBy: ordenarPor(c), skip, take });
    return conRecorrido(ctx.workspaceId, filas);
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.serviceSalesLead.findMany({ where: await resolverWhere(ctx, c), select: { id: true }, orderBy: ordenarPor(c), take: tope });
    return filas.map((f) => f.id);
  },
  traerPorIds: async (ctx, ids) => {
    const validos = ids.filter((id) => ID_VALIDO.test(id));
    if (validos.length === 0) return [];
    const filas = await prisma.serviceSalesLead.findMany({
      where: { workspaceId: ctx.workspaceId, id: { in: validos } },
      select: SELECT_FILA,
    });
    const porId = new Map((await conRecorrido(ctx.workspaceId, filas)).map((f) => [f.id, f]));
    return validos.flatMap((id) => porId.get(id) ?? []);
  },
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
