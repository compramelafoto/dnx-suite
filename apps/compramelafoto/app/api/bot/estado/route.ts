import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser, readBotConfig } from "@/lib/bot/config";
import { buildPhotographerSituation } from "@/lib/bot/contexto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
const SALUDO = "Hola, soy DNX Bot. ¿En qué te ayudo?";
const SUGERENCIAS_FOTOGRAFO = ["¿Por qué mi álbum no vende?", "Cambiar el precio de un álbum", "Reenviar un link de descarga"];

export async function GET() {
  // Con el bot apagado no se toca la sesión ni la base: cada panel llama a esta ruta al cargar.
  if (!readBotConfig().enabled) return Response.json({ enabled: false });
  const user = await getAuthUser();
  if (!user || !(await isBotEnabledForUser(user.id))) return Response.json({ enabled: false });
  if (!PHOTOGRAPHER_ROLES.has(String(user.role))) {
    return Response.json({
      enabled: true,
      alerta: false,
      saludo: SALUDO,
      sugerencias: ["¿Cómo funciona CLF?", "Quiero hablar con una persona"],
    });
  }
  let bloqueo: { text: string } | undefined;
  try {
    const s = await buildPhotographerSituation(user.id);
    bloqueo = s.alerts.find((a) => a.level === "bloquea_ventas");
  } catch (e) {
    // Si falla armar la situación, la burbuja igual aparece con el saludo de siempre.
    console.error("[dnx-bot] estado", e);
  }
  return Response.json({
    enabled: true,
    alerta: !!bloqueo,
    saludo: bloqueo ? `${bloqueo.text} ¿Te ayudo a resolverlo?` : SALUDO,
    sugerencias: SUGERENCIAS_FOTOGRAFO,
  });
}
