import "server-only";
import { resolverBot, type Capacidades } from "./acceso";
import { prefijosPermitidos } from "./rutas";

/**
 * ¿Se pinta la burbuja en el panel? Lo decide el servidor al armar `AdminShell`, con las mismas
 * puertas que las rutas del bot: si alguna está cerrada no se manda nada al navegador. Con el
 * interruptor apagado (por omisión) no toca ni la sesión ni la base. Si algo falla, el panel sigue
 * sin la burbuja.
 */
export async function botEnPanel(): Promise<{ rutas: string[]; capacidades: Capacidades } | null> {
  try {
    const r = await resolverBot();
    return r.ok ? { rutas: prefijosPermitidos(r.ctx.capacidades), capacidades: r.ctx.capacidades } : null;
  } catch (e) {
    console.error("[dnx-bot] panel", e);
    return null;
  }
}
