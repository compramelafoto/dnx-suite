import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { nombresDePlantillas, SELECT_MENSAJE } from "@/lib/plantillas/registro";
import { tituloDeMensaje, vistaDeMensaje } from "@/lib/plantillas/vista-mensaje";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { filas } from "./comun";

const PREFIJO = "mensajes:";

/**
 * Mensajes (`FotofficeMessage`) enviados a la persona: los de su ficha de cliente y los de su
 * ficha de socio, siempre acotados al workspace. Cada lado sólo con su módulo encendido
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
    const OR: { entityType: string; entityId: string }[] = [];
    if (persona.clientId && conClientes) OR.push({ entityType: "CLIENTE", entityId: persona.clientId });
    if (persona.memberId && conSocios) OR.push({ entityType: "SOCIO", entityId: persona.memberId });
    if (OR.length === 0) return [];
    const leidas = await prisma.fotofficeMessage.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR,
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.FotofficeMessageWhereInput],
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
