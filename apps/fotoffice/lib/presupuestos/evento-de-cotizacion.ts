import "server-only";
import { prisma } from "@repo/db";
import { SERVICE_LEAD_EVENT_TYPE_LABELS } from "@/lib/service-leads/form-definitions";
import { respuestasDelFormulario, resumirVistas, type EventoDeCotizacion, type ResumenDeVistas } from "./evento-vista";

/**
 * Lecturas para mostrar el evento y las aperturas del cliente en Cotizaciones. Todo acotado al
 * workspace: una consulta o cotización de otro negocio no aporta nada aunque se pase su id.
 */

const TIPOS_VIEJOS = SERVICE_LEAD_EVENT_TYPE_LABELS as Record<string, string>;
/** Tope de aperturas que se leen por tanda (una página del listado son pocas cotizaciones). */
const TOPE_APERTURAS = 5000;

/** Los datos del evento de una consulta, tal como están hoy en ella; null si no existe en el workspace. */
export async function eventoDeLaConsulta(workspaceId: string, leadId: string): Promise<EventoDeCotizacion | null> {
  const lead = await prisma.serviceSalesLead.findFirst({
    where: { id: leadId, workspaceId },
    select: {
      eventType: true,
      eventDate: true,
      eventLocation: true,
      message: true,
      metaJson: true,
      fotofficeConsulta: {
        select: {
          eventStartsAt: true,
          eventTimeKnown: true,
          venue: true,
          ceremonyVenue: true,
          receptionVenue: true,
          city: true,
          guests: true,
          partnerOneName: true,
          partnerTwoName: true,
          category: { select: { name: true } },
          origin: { select: { name: true } },
        },
      },
    },
  });
  if (!lead) return null;
  const c = lead.fotofficeConsulta;
  const protagonistas = [c?.partnerOneName?.trim(), c?.partnerTwoName?.trim()].filter(Boolean).join(" y ") || null;
  return {
    tipo: c?.category.name ?? (lead.eventType ? (TIPOS_VIEJOS[lead.eventType] ?? lead.eventType) : null),
    fecha: c ? c.eventStartsAt : lead.eventDate,
    horaConocida: c?.eventTimeKnown === true,
    lugar: c ? c.venue : lead.eventLocation,
    ceremonia: c?.ceremonyVenue ?? null,
    recepcion: c?.receptionVenue ?? null,
    ciudad: c?.city ?? null,
    invitados: c?.guests ?? null,
    protagonistas,
    origen: c?.origin?.name ?? null,
    mensaje: lead.message,
    ...respuestasDelFormulario(lead.metaJson),
  };
}

/**
 * Las aperturas del cliente por cotización (todas sus versiones). Las del equipo nunca se
 * registran (`vistas.ts`), así que todo lo que cuenta acá es del cliente.
 */
export async function vistasDeCotizaciones(workspaceId: string, presupuestoIds: readonly string[]): Promise<Map<string, ResumenDeVistas>> {
  const ids = [...new Set(presupuestoIds)];
  const out = new Map<string, ResumenDeVistas>();
  if (ids.length === 0) return out;
  const filas = await prisma.fotofficePresupuestoVista.findMany({
    where: { workspaceId, version: { presupuestoId: { in: ids } } },
    select: { viewedAt: true, version: { select: { presupuestoId: true } } },
    orderBy: { viewedAt: "desc" },
    take: TOPE_APERTURAS,
  });
  const porCotizacion = new Map<string, Date[]>();
  for (const f of filas) {
    const lista = porCotizacion.get(f.version.presupuestoId) ?? [];
    lista.push(f.viewedAt);
    porCotizacion.set(f.version.presupuestoId, lista);
  }
  for (const [id, aperturas] of porCotizacion) {
    const r = resumirVistas(aperturas);
    if (r) out.set(id, r);
  }
  return out;
}
