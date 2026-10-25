import "server-only";
import { prisma } from "@repo/db";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { AVISO_DEMASIADOS_DATOS, MAX_FILAS_CUOTAS_Y_CUENTAS } from "./constantes";
import { agrupamientoEmbudoElegido, armarEmbudo, type AgrupamientoEmbudo, type ConsultaEmbudo, type ResultadoConsulta, type TablaEmbudo } from "./embudo";
import { inicioDeMes, inicioDelMesSiguiente, periodoInforme, type PeriodoInforme } from "./periodos";

/**
 * Lectura del Embudo de consultas (etapa 6, Entrega B). Cada consulta a la base filtra por
 * `workspaceId`. El tope (20 000 consultas) se mide leyendo una más: si se pasa, no se devuelven
 * datos parciales sino el aviso. Ganada / perdida / cierre salen del recorrido de venta, igual que
 * en la lista de Consultas (ver `embudo.ts`); si una consulta tiene varios recorridos, vale el más
 * reciente (como hace la lista).
 */

const LOTE = 5_000;

function lotes<T>(xs: readonly T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += LOTE) r.push(xs.slice(i, i + LOTE));
  return r;
}

/** Consultas creadas entre los meses `desde` y `hasta`. `null` si se pasa el tope. */
export async function leerConsultasEmbudo(workspaceId: string, desde: string, hasta: string): Promise<ConsultaEmbudo[] | null> {
  const leads = await prisma.serviceSalesLead.findMany({
    where: { workspaceId, createdAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) } },
    select: { id: true, createdAt: true, fotofficeConsulta: { select: { categoryId: true, originId: true, estimatedValue: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (leads.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;
  if (leads.length === 0) return [];

  const ids = leads.map((l) => l.id);
  const idsCategoria = [...new Set(leads.flatMap((l) => l.fotofficeConsulta?.categoryId ?? []))];
  const idsOrigen = [...new Set(leads.flatMap((l) => l.fotofficeConsulta?.originId ?? []))];

  const resultados = new Map<string, { resultado: ResultadoConsulta; cerradaEn: Date | null }>();
  const vendido = new Map<string, number>();
  const [categorias, origenes] = await Promise.all([
    idsCategoria.length > 0 ? prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId, id: { in: idsCategoria } }, select: { id: true, name: true } }) : [],
    idsOrigen.length > 0 ? prisma.fotofficeOrigen.findMany({ where: { workspaceId, id: { in: idsOrigen } }, select: { id: true, name: true } }) : [],
    ...lotes(ids).map(async (lote) => {
      const [journeys, pedidos] = await Promise.all([
        prisma.fotofficeJourney.findMany({
          where: { workspaceId, subjectType: "CAPTACION", kind: "VENTA", subjectId: { in: lote } },
          select: { subjectId: true, outcome: true, closedAt: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        prisma.fotofficePedido.findMany({
          where: { workspaceId, status: { not: "CANCELADO" }, consultaLeadId: { in: lote } },
          select: { consultaLeadId: true, totalArs: true },
        }),
      ]);
      for (const j of journeys) {
        if (resultados.has(j.subjectId)) continue; // el más reciente
        const resultado: ResultadoConsulta = j.outcome === "GANADA" ? "GANADA" : j.outcome === "PERDIDA" ? "PERDIDA" : null;
        resultados.set(j.subjectId, { resultado, cerradaEn: resultado ? j.closedAt : null });
      }
      for (const p of pedidos) {
        if (p.consultaLeadId === null) continue;
        vendido.set(p.consultaLeadId, (vendido.get(p.consultaLeadId) ?? 0) + decimalArsToMinor(p.totalArs));
      }
    }),
  ]);
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.name]));
  const nombreOrigen = new Map(origenes.map((o) => [o.id, o.name]));

  return leads.map((l) => {
    const c = l.fotofficeConsulta;
    const r = resultados.get(l.id);
    return {
      id: l.id,
      creadaEn: l.createdAt,
      categoriaId: c?.categoryId ?? null,
      categoria: c ? (nombreCategoria.get(c.categoryId) ?? null) : null,
      origenId: c?.originId ?? null,
      origen: c?.originId ? (nombreOrigen.get(c.originId) ?? null) : null,
      valorEstimadoCentavos: c?.estimatedValue ? decimalArsToMinor(c.estimatedValue) : 0,
      resultado: r?.resultado ?? null,
      cerradaEn: r?.cerradaEn ?? null,
      vendidoCentavos: vendido.get(l.id) ?? 0,
    };
  });
}

export type EmbudoCargado = {
  periodo: PeriodoInforme;
  agrupar: AgrupamientoEmbudo;
  /** `null` si se pasó el tope de datos (no se muestran datos parciales). */
  tabla: TablaEmbudo | null;
  avisos: string[];
};

/** Embudo por grupo. `null` si la persona no tiene permiso (no se lee nada). */
export async function cargarEmbudo(
  ctx: CtxInformes,
  params: { periodo?: string | null; agrupar?: string | null } = {},
  ahora: Date = new Date(),
): Promise<EmbudoCargado | null> {
  if (!puedeVerInformes(ctx)) return null;
  const periodo = periodoInforme({ periodo: params.periodo, hoy: hoyEnBuenosAires(ahora) });
  const agrupar = agrupamientoEmbudoElegido(params.agrupar);
  const avisos = periodo.aviso ? [periodo.aviso] : [];
  const consultas = await leerConsultasEmbudo(ctx.workspaceId, periodo.desde, periodo.hasta);
  if (!consultas) return { periodo, agrupar, tabla: null, avisos: [...avisos, AVISO_DEMASIADOS_DATOS] };
  return { periodo, agrupar, tabla: armarEmbudo({ consultas, agrupar }), avisos };
}
