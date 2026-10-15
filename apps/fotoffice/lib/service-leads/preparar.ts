import "server-only";
import { prisma } from "@repo/db";
import { asegurarCircuitos } from "@/lib/circuitos/semillas/asegurar";
import { engancharConsultas } from "@/lib/circuitos/eventos";
import { contarSinFicha, engancharConsultasExistentes } from "@/lib/consultas/enganche";
import { asegurarCatalogosIniciales } from "@/lib/consultas/semillas";

/** Sólo el tipo y el código del error: nunca su mensaje (puede traer datos de una consulta). */
function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[captacion] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/**
 * Lo que la pantalla de Consultas hace al abrirse: carga los circuitos iniciales y los catálogos
 * de Consultas (etapa 1) si faltan, engancha las consultas que todavía no tienen recorrido o
 * número (hasta `TOPE_ENGANCHE` / `TOPE_NUMERACION` por vez) y las que todavía no tienen contacto
 * ni categoría (hasta `LOTE_ENGANCHE` por vez). Devuelve cuántas quedan para la próxima apertura.
 * Cada parte va aislada: una falla nunca rompe la pantalla ni frena a las otras.
 */
export async function prepararCaptacion(workspaceId: string): Promise<{ quedan: number }> {
  let slug = "";
  try {
    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
    slug = branding?.publicSlug ?? "";
    await asegurarCircuitos(workspaceId, slug);
  } catch (error) {
    registrarFalla("asegurarCircuitos", error);
  }
  try {
    await asegurarCatalogosIniciales(workspaceId, slug);
  } catch (error) {
    registrarFalla("asegurarCatalogosIniciales", error);
  }
  let quedan = 0;
  try {
    quedan = (await engancharConsultas(workspaceId)).quedan;
  } catch (error) {
    registrarFalla("engancharConsultas", error);
  }
  try {
    // Con su propio tope (LOTE_ENGANCHE): cada una busca o crea su contacto.
    if (!(await engancharConsultasExistentes(workspaceId)).completo) quedan = Math.max(quedan, await contarSinFicha(workspaceId));
  } catch (error) {
    registrarFalla("engancharConsultasExistentes", error);
  }
  return { quedan };
}
