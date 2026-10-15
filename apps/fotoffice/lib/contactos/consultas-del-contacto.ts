import "server-only";
import { prisma } from "@repo/db";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { fechaDeEvento } from "@/lib/ficha/formato";
import { numeroDe } from "@/lib/numeracion/asignar";
import { TIPO_CONSULTA } from "@/lib/service-leads/numero";
import { formatoPesos, valorComoNumero } from "@/lib/consultas/valor";
import { hrefDeConsulta } from "@/lib/circuitos/sujetos/captacion";

/** Tope de consultas en la tarjeta: un contacto real no llega; si pasa, se avisa. */
export const MAX_CONSULTAS_EN_FICHA = 50;

export type ConsultaDelContacto = {
  id: string;
  /** "2026-0042"; null si todavía no tiene número. */
  numero: string | null;
  categoria: string | null;
  /** "20/12/2026" (fecha de calendario, sin correrla un día); null sin fecha. */
  fechaEvento: string | null;
  /** Etapa actual, o el resultado si está cerrada ("Ganada", "Perdida"). */
  estado: { texto: string; color: string | null; cerrada: boolean; ganada: boolean } | null;
  /** "$ 1.250.000"; null sin valor. */
  valor: string | null;
  href: string;
};

/**
 * Las consultas de un contacto para la tarjeta "Consultas" de su ficha (spec §3.3), de la más
 * nueva a la más vieja. Quien llama ya verificó "Ver" en Consultas. Todo se filtra por el
 * workspace de la sesión: un `clientId` ajeno devuelve una lista vacía.
 */
export async function consultasDelContacto(
  workspaceId: string,
  clientId: string,
): Promise<{ consultas: ConsultaDelContacto[]; hayMas: boolean }> {
  const filas = await prisma.fotofficeConsulta.findMany({
    where: { workspaceId, clientId },
    select: { leadId: true, categoryId: true, estimatedValue: true, eventStartsAt: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_CONSULTAS_EN_FICHA + 1,
  });
  const hayMas = filas.length > MAX_CONSULTAS_EN_FICHA;
  const visibles = filas.slice(0, MAX_CONSULTAS_EN_FICHA);
  if (visibles.length === 0) return { consultas: [], hayMas: false };

  const leadIds = visibles.map((f) => f.leadId);
  const categoriaIds = [...new Set(visibles.map((f) => f.categoryId).filter((x): x is string => !!x))];
  const [leads, categorias, recorridos, numeros] = await Promise.all([
    prisma.serviceSalesLead.findMany({ where: { workspaceId, id: { in: leadIds } }, select: { id: true, eventDate: true } }),
    categoriaIds.length > 0
      ? prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId, id: { in: categoriaIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    prisma.fotofficeJourney.findMany({
      where: { workspaceId, subjectType: "CAPTACION", kind: "VENTA", subjectId: { in: leadIds } },
      select: { subjectId: true, stageId: true, outcome: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    numeroDe(workspaceId, TIPO_CONSULTA, leadIds),
  ]);
  const etapaIds = [...new Set(recorridos.map((r) => r.stageId).filter((x): x is string => !!x))];
  const etapas = etapaIds.length > 0
    ? await prisma.fotofficeStage.findMany({ where: { id: { in: etapaIds }, circuit: { workspaceId } }, select: { id: true, name: true, color: true } })
    : [];

  const leadDe = new Map(leads.map((l) => [l.id, l]));
  const categoriaDe = new Map(categorias.map((c) => [c.id, c.name]));
  const etapaDe = new Map(etapas.map((e) => [e.id, e]));
  // El recorrido más reciente de cada consulta (como la lista de Consultas).
  const recorridoDe = new Map<string, (typeof recorridos)[number]>();
  for (const r of recorridos) if (!recorridoDe.has(r.subjectId)) recorridoDe.set(r.subjectId, r);

  const consultas: ConsultaDelContacto[] = [];
  for (const f of visibles) {
    const lead = leadDe.get(f.leadId);
    if (!lead) continue; // la consulta tiene que ser del mismo workspace
    const fecha = f.eventStartsAt ?? lead.eventDate;
    const r = recorridoDe.get(f.leadId);
    let estado: ConsultaDelContacto["estado"] = null;
    if (r?.outcome) {
      estado = { texto: ETIQUETA_SALIDA[r.outcome] ?? r.outcome, color: null, cerrada: true, ganada: r.outcome === "GANADA" };
    } else if (r?.stageId && etapaDe.has(r.stageId)) {
      const e = etapaDe.get(r.stageId)!;
      estado = { texto: e.name, color: e.color, cerrada: false, ganada: false };
    }
    const valor = valorComoNumero(f.estimatedValue);
    consultas.push({
      id: f.leadId,
      numero: numeros.get(f.leadId) ?? null,
      categoria: f.categoryId ? (categoriaDe.get(f.categoryId) ?? null) : null,
      fechaEvento: fecha ? fechaDeEvento(fecha) || null : null,
      estado,
      valor: valor === null ? null : formatoPesos(valor),
      href: hrefDeConsulta(f.leadId),
    });
  }
  return { consultas, hayMas };
}
