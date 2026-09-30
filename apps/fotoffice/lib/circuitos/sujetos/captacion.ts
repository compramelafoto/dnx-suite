import "server-only";
import { prisma } from "@repo/db";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { SERVICE_LEAD_EVENT_TYPE_LABELS } from "@/lib/service-leads/form-definitions";
import { fechaBA } from "@/lib/ficha/formato";
import { ESTADOS_CAPTACION } from "../constantes";
import type { Adaptador, NombreDeSujeto } from "./tipos";

/** Los valores del enum `ServiceLeadStatus` (no se reexporta desde `@repo/db`). */
type ServiceLeadStatus = (typeof ESTADOS_CAPTACION)[number] | "WON" | "LOST";

/** Estado compatible (`ServiceSalesLead.status`) que corresponde a cada salida de venta. */
const ESTADO_POR_SALIDA: Record<string, ServiceLeadStatus> = { GANADA: "WON", PERDIDA: "LOST" };

function esEstadoDeEtapa(v: string): v is (typeof ESTADOS_CAPTACION)[number] {
  return (ESTADOS_CAPTACION as readonly string[]).includes(v);
}

export function hrefDeConsulta(id: string): string {
  return `/captacion/${encodeURIComponent(id)}`;
}

/** Captación: el sujeto es una `ServiceSalesLead` (consulta de presupuesto). */
export const adaptadorCaptacion: Adaptador = {
  moduleKey: SERVICE_LEADS_MODULE_KEY,
  rutaTablero: "/captacion",
  rutaFicha: hrefDeConsulta,

  async existe(tx, workspaceId, id) {
    return (await tx.serviceSalesLead.count({ where: { id, workspaceId } })) > 0;
  },

  async nombre(workspaceId, ids) {
    const mapa = new Map<string, NombreDeSujeto>();
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return mapa;
    const filas = await prisma.serviceSalesLead.findMany({
      where: { workspaceId, id: { in: unicos } },
      select: { id: true, name: true, eventType: true, eventDate: true },
    });
    for (const f of filas) {
      const tipo = (SERVICE_LEAD_EVENT_TYPE_LABELS as Record<string, string>)[f.eventType] ?? f.eventType;
      const partes = [tipo, f.eventDate ? fechaBA(f.eventDate) : ""].filter((p) => p.length > 0);
      mapa.set(f.id, {
        titulo: f.name,
        ...(partes.length > 0 ? { subtitulo: partes.join(" · ") } : {}),
        href: hrefDeConsulta(f.id),
      });
    }
    return mapa;
  },

  async alCambiarEtapa(tx, workspaceId, id, etapa, salida) {
    let status: ServiceLeadStatus | null = null;
    if (salida !== null) status = Object.hasOwn(ESTADO_POR_SALIDA, salida) ? ESTADO_POR_SALIDA[salida] : null;
    else if (etapa?.leadStatus && esEstadoDeEtapa(etapa.leadStatus)) status = etapa.leadStatus;
    // Etapa sin estado compatible: la consulta conserva el que tenía.
    if (status === null) return;
    await tx.serviceSalesLead.updateMany({ where: { id, workspaceId }, data: { status } });
  },
};
