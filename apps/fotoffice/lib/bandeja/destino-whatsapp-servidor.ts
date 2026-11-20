import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import type { resolverAcceso } from "@/lib/access/acceso";
import { BANDEJA_MODULE_KEY } from "./constantes";
import { leerConexion } from "./conexion";
import { plantillasAprobadas } from "./plantillas";
import { waIdDe } from "./telefono";
import { elegirDestinoWhatsapp, necesitaPlantillas, type DestinoWhatsapp } from "./destino-whatsapp";

/**
 * El destino del botón «Enviar WhatsApp» de la ficha de un cliente (ver `elegirDestinoWhatsapp`).
 * `null` cuando el teléfono no sirve para WhatsApp. Nunca lanza: ante un error, WhatsApp Web.
 */
export async function destinoWhatsappDeCliente(entrada: {
  workspaceId: string;
  acceso: Awaited<ReturnType<typeof resolverAcceso>>;
  clientId: string;
  telefono: string | null | undefined;
}): Promise<DestinoWhatsapp | null> {
  const waId = waIdDe(entrada.telefono);
  if (!waId) return null;
  const ahora = new Date();
  try {
    const puedeUsarBandeja =
      puede(entrada.acceso, "operar", BANDEJA_MODULE_KEY) && (await isModuleEnabledForWorkspace(entrada.workspaceId, BANDEJA_MODULE_KEY));
    const chat = puedeUsarBandeja
      ? await prisma.fotofficeWaChat.findFirst({
          where: { workspaceId: entrada.workspaceId, canal: "WHATSAPP", OR: [{ waId }, { clientId: entrada.clientId }] },
          orderBy: { ultimoMensajeEn: "desc" },
          select: { id: true, ultimoEntranteEn: true },
        })
      : null;
    const hayPlantillas = necesitaPlantillas(chat, puedeUsarBandeja, ahora)
      ? (await plantillasAprobadas(await leerConexion(entrada.workspaceId))).length > 0
      : false;
    return elegirDestinoWhatsapp({ waId, chat, puedeUsarBandeja, hayPlantillas, ahora });
  } catch (error) {
    console.error("[fotoffice][ficha] no se pudo elegir el destino de WhatsApp", error);
    return { tipo: "web", href: `https://wa.me/${waId}` };
  }
}
