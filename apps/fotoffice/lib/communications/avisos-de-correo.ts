import "server-only";
import { prisma } from "@repo/db";
import type { ParsedWebhookEvent } from "@/lib/mailing/webhook-events";
import { crearTareaDeConsulta, destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";

/**
 * Avisos de Resend sobre los correos que FOTOFFICE registra en `FotofficeMessage` (consultas,
 * cotizaciones, contratos, pedidos, clientes). Igual que las campañas: el primer aviso de cada tipo
 * gana (si el cliente abre el correo diez veces, la fecha de la primera apertura no se mueve).
 *
 * Si rebota o lo marcan como spam un correo de una consulta o de su cotización, el responsable de
 * la consulta recibe la tarea «Correo rebotado» (una sola abierta por consulta) para conseguir otra
 * dirección. Nunca loguea direcciones.
 */

export const TITULO_TAREA_REBOTE = "Correo rebotado: conseguí otra dirección";

type Resultado = "APLICADO" | "REPETIDO" | "DESCONOCIDO";

/** El leadId de la consulta de un mensaje (consulta directa o su cotización), o null. */
async function consultaDelMensaje(m: { workspaceId: string; entityType: string; entityId: string }): Promise<string | null> {
  if (m.entityType === "CONSULTA") return m.entityId;
  if (m.entityType === "PRESUPUESTO") {
    const p = await prisma.fotofficePresupuesto.findFirst({ where: { id: m.entityId, workspaceId: m.workspaceId }, select: { consultaLeadId: true } });
    return p?.consultaLeadId ?? null;
  }
  return null;
}

export async function aplicarAvisoDeCorreo(e: ParsedWebhookEvent, ahora: Date = new Date()): Promise<Resultado> {
  const m = await prisma.fotofficeMessage.findFirst({
    where: { providerId: e.emailId, channel: "EMAIL" },
    select: { id: true, workspaceId: true, entityType: true, entityId: true },
  });
  if (!m) return "DESCONOCIDO";
  const r = await prisma.fotofficeMessage.updateMany({ where: { id: m.id, [e.field]: null }, data: { [e.field]: e.at } });
  if (r.count !== 1) return "REPETIDO";

  if (e.optOut) {
    try {
      const leadId = await consultaDelMensaje(m);
      if (leadId) {
        const recorrido = await prisma.fotofficeJourney.findFirst({
          where: { workspaceId: m.workspaceId, subjectId: leadId, outcome: null },
          select: { ownerUserId: true },
        });
        const para = await destinatarioDelPresupuesto(m.workspaceId, recorrido?.ownerUserId ?? null);
        await crearTareaDeConsulta(m.workspaceId, leadId, TITULO_TAREA_REBOTE, para, ahora, { unaSolaAbierta: true });
      }
    } catch (error) {
      // La fecha ya quedó anotada: una falla al crear la tarea no hace que Resend reintente.
      console.error("[fotoffice][correo] no se pudo crear la tarea del rebote", { codigo: (error as { code?: unknown })?.code ?? "desconocido" });
    }
  }
  return "APLICADO";
}
