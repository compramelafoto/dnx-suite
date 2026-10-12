import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser } from "@/lib/bot/config";
import { buildPhotographerSituation } from "@/lib/bot/contexto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
const SALUDO = "Hola, soy DNX Bot. ¿En qué te ayudo?";

export async function GET() {
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
  const s = await buildPhotographerSituation(user.id);
  const bloqueo = s.alerts.find((a) => a.level === "bloquea_ventas");
  return Response.json({
    enabled: true,
    alerta: !!bloqueo,
    saludo: bloqueo ? `${bloqueo.text} ¿Te ayudo a resolverlo?` : SALUDO,
    sugerencias: ["¿Por qué mi álbum no vende?", "Cambiar el precio de un álbum", "Reenviar un link de descarga"],
  });
}
