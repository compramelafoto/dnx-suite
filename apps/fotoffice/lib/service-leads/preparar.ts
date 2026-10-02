import "server-only";
import { prisma } from "@repo/db";
import { asegurarCircuitos } from "@/lib/circuitos/semillas/asegurar";
import { engancharConsultas } from "@/lib/circuitos/eventos";

/** Sólo el tipo y el código del error: nunca su mensaje (puede traer datos de una consulta). */
function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[captacion] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/**
 * Lo que la pantalla de Captación hace al abrirse: carga los circuitos iniciales si faltan y
 * engancha las consultas que todavía no tienen recorrido (hasta `TOPE_ENGANCHE` por vez).
 * Devuelve cuántas quedan para la próxima apertura. Una falla nunca rompe la pantalla.
 */
export async function prepararCaptacion(workspaceId: string): Promise<{ quedan: number }> {
  try {
    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
    await asegurarCircuitos(workspaceId, branding?.publicSlug ?? "");
  } catch (error) {
    registrarFalla("asegurarCircuitos", error);
  }
  try {
    return { quedan: (await engancharConsultas(workspaceId)).quedan };
  } catch (error) {
    registrarFalla("engancharConsultas", error);
    return { quedan: 0 };
  }
}
