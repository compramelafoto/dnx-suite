import "server-only";
import { leerTokenTelegram } from "@/lib/integrations/telegram/credentials";
import { mandarMensaje } from "@/lib/telegram/api";
import { leerConexionTelegram } from "@/lib/telegram/conexion";
import { textoAvisoNoCliente, type NoCliente } from "./aviso-no-cliente";

/** Le avisa al dueño por el Telegram del estudio. Sin Telegram conectado no hace nada. Nunca lanza. */
export async function avisarNoClienteAlDueno(workspaceId: string, p: NoCliente): Promise<void> {
  try {
    const conexion = await leerConexionTelegram(workspaceId);
    if (!conexion?.chatId) return;
    const token = await leerTokenTelegram(workspaceId);
    if (!token) return;
    const r = await mandarMensaje(token, conexion.chatId, textoAvisoNoCliente(p), null);
    if (!r.ok) console.warn("[fotoffice][whatsapp] no se pudo avisar por Telegram", { codigo: r.codigo });
  } catch (e) {
    console.warn("[fotoffice][whatsapp] falló el aviso por Telegram", { codigo: e instanceof Error ? e.name : "desconocido" });
  }
}
