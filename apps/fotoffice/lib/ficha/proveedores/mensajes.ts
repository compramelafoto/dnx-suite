import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CODIGO_ENVIO_EN_CURSO } from "@/lib/plantillas/constantes";
import { nombresDePlantillas, SELECT_MENSAJE } from "@/lib/plantillas/registro";
import { tituloDeMensaje, vistaDeMensaje } from "@/lib/plantillas/vista-mensaje";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { filas } from "./comun";

const PREFIJO = "mensajes:";

/**
 * Mensajes (`FotofficeMessage`) enviados a la persona: los de su ficha de cliente y los de su
 * ficha de socio, y los de sus consultas y cotizaciones (respuestas automáticas, seguimientos de
 * cotización), siempre acotados al workspace. Cada lado sólo con su módulo encendido
 * (Clientes, Socios), como "Más datos". Un evento por mensaje, con canal, estado, asunto y cuerpo.
 */
export const proveedorMensajes: Proveedor = {
  clave: "mensajes",
  tipo: "mensajes",
  async traer(ctx, persona, antesDe, take, opciones) {
    const [conClientes, conSocios] = await Promise.all([
      persona.clientId ? isModuleEnabledForWorkspace(ctx.workspaceId, CLIENTS_MODULE_KEY) : false,
      persona.memberId ? isModuleEnabledForWorkspace(ctx.workspaceId, MEMBERS_MODULE_KEY) : false,
    ]);
    const OR: Prisma.FotofficeMessageWhereInput[] = [];
    if (persona.clientId && conClientes) {
      OR.push({ entityType: "CLIENTE", entityId: persona.clientId });
      const consultas = await prisma.fotofficeConsulta.findMany({ where: { workspaceId: ctx.workspaceId, clientId: persona.clientId }, select: { leadId: true }, take: 200 });
      const leads = consultas.map((c) => c.leadId);
      if (leads.length) {
        const presupuestos = await prisma.fotofficePresupuesto.findMany({ where: { workspaceId: ctx.workspaceId, consultaLeadId: { in: leads } }, select: { id: true }, take: 500 });
        OR.push({ entityType: "CONSULTA", entityId: { in: leads } });
        if (presupuestos.length) OR.push({ entityType: "PRESUPUESTO", entityId: { in: presupuestos.map((p) => p.id) } });
      }
    }
    if (persona.memberId && conSocios) OR.push({ entityType: "SOCIO", entityId: persona.memberId });
    if (OR.length === 0) return [];
    const leidas = await prisma.fotofficeMessage.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR,
        AND: [
          whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.FotofficeMessageWhereInput,
          // Las reservas de un envío automático en curso (o abandonado) no son mensajes.
          { OR: [{ errorCode: null }, { errorCode: { not: CODIGO_ENVIO_EN_CURSO } }] },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: SELECT_MENSAJE,
    });
    if (leidas.length === 0) return [];
    const nombres = await nombresDePlantillas(ctx.workspaceId, leidas.map((f) => f.templateId));
    return leidas.map((f) => {
      const mensaje = vistaDeMensaje(f, f.templateId ? (nombres.get(f.templateId) ?? null) : null);
      return {
        id: `${PREFIJO}${f.id}`,
        tipo: "mensajes" as const,
        fecha: f.createdAt,
        actor: mensaje.quien,
        titulo: tituloDeMensaje(mensaje),
        mensaje,
      };
    });
  },
};
