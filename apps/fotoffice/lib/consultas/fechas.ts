import "server-only";
import { prisma } from "@repo/db";
import { ESTADOS_CAPTACION } from "@/lib/circuitos/constantes";
import { esFechaSinHora } from "@/lib/plantillas/variables";
import { tituloDeConsulta } from "@/lib/service-leads/numero";
import { esGrupoConsulta, grupoPide } from "./constantes";

/**
 * Aviso de fecha superpuesta (spec §3.1): otra consulta ABIERTA del workspace con el evento el
 * mismo día de calendario. Sólo avisa, nunca bloquea.
 */

const ZONA = "America/Argentina/Buenos_Aires";
const DIA_MS = 24 * 60 * 60 * 1000;
/** Superpuestas que se muestran como mucho (es un cartel, no un listado). */
const MAX_SUPERPUESTAS = 20;

const diaAR = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * "aaaa-mm-dd" del evento con la regla de toda la app (PR 402, `fechaDeEvento`): medianoche UTC
 * exacta es una fecha de calendario guardada sin hora (se lee en UTC); cualquier otro instante,
 * en hora de Buenos Aires.
 */
export function diaDeCalendario(d: Date): string {
  return esFechaSinHora(d) ? d.toISOString().slice(0, 10) : diaAR.format(d);
}

export type ConsultaSuperpuesta = { leadId: string; display: string };

/**
 * De estas consultas, las que NO cuentan para la superposición (regla R11): su categoría es de un
 * grupo que no pide "Fecha y hora" (p. ej. Trabajo sin fecha). Al cambiar de categoría, el día que
 * quedó guardado no se borra, pero deja de tener significado. Las consultas sin ficha de la etapa
 * 1 (todavía no enganchadas) cuentan como siempre.
 */
export async function sinFechaQueCuente(workspaceId: string, leadIds: readonly string[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const fichas = await prisma.fotofficeConsulta.findMany({
    where: { workspaceId, leadId: { in: [...leadIds] } },
    select: { leadId: true, categoryId: true },
  });
  if (fichas.length === 0) return new Set();
  const categorias = await prisma.fotofficeConsultaCategoria.findMany({
    where: { workspaceId, id: { in: [...new Set(fichas.map((f) => f.categoryId))] } },
    select: { id: true, group: true },
  });
  const grupoDe = new Map(categorias.map((c) => [c.id, c.group]));
  const fuera = new Set<string>();
  for (const f of fichas) {
    const g = grupoDe.get(f.categoryId);
    if (esGrupoConsulta(g) && !grupoPide(g, "fechaHora")) fuera.add(f.leadId);
  }
  return fuera;
}

/**
 * Consultas abiertas (Nueva, Contactada, Presupuestada, Interesada) del workspace con el evento el
 * mismo día que `fecha`, sin contar `excluirId`. Lee `ServiceSalesLead.eventDate`, donde toda
 * consulta refleja su día (también las de la etapa 1). `display`: "Consulta N° … · Nombre".
 */
export async function fechasSuperpuestas(
  workspaceId: string,
  fecha: Date | null | undefined,
  excluirId?: string | null,
): Promise<ConsultaSuperpuesta[]> {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return [];
  const dia = diaDeCalendario(fecha);
  const inicio = new Date(`${dia}T00:00:00.000Z`);
  // El mismo día puede estar guardado como medianoche UTC o como un instante en hora de Buenos
  // Aires (hasta las 02:59 UTC del día siguiente): se trae un margen y se filtra por día.
  const candidatas = await prisma.serviceSalesLead.findMany({
    where: {
      workspaceId,
      status: { in: [...ESTADOS_CAPTACION] },
      eventDate: { gte: new Date(inicio.getTime() - DIA_MS), lt: new Date(inicio.getTime() + 2 * DIA_MS) },
    },
    select: { id: true, name: true, eventDate: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  const delDia = candidatas.filter((c) => c.id !== excluirId && c.eventDate !== null && diaDeCalendario(new Date(c.eventDate)) === dia);
  if (delDia.length === 0) return [];
  // La propia consulta, si su grupo no pide fecha, no se superpone con nadie (R11).
  const ids = excluirId ? [...delDia.map((c) => c.id), excluirId] : delDia.map((c) => c.id);
  const fuera = await sinFechaQueCuente(workspaceId, ids);
  if (excluirId && fuera.has(excluirId)) return [];
  const mismas = delDia.filter((c) => !fuera.has(c.id)).slice(0, MAX_SUPERPUESTAS);
  if (mismas.length === 0) return [];
  const numeros = await prisma.fotofficeRecordNumber.findMany({
    where: { workspaceId, entityType: "CONSULTA", entityId: { in: mismas.map((m) => m.id) } },
    select: { entityId: true, display: true },
  });
  const numeroDe = new Map(numeros.map((n) => [n.entityId, n.display]));
  return mismas.map((m) => ({ leadId: m.id, display: tituloDeConsulta(m.name, numeroDe.get(m.id)) }));
}
