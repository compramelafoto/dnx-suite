import "server-only";
import { prisma } from "@repo/db";
import { MENSAJES_GALERIA as M, puedeConfigurarGalerias, type CtxGalerias } from "./acceso";
import { MAX_MENSAJE_GALERIA, MODOS_DESCARGA, type ModoDescarga, type ModoSeleccion } from "./constantes";

/**
 * Ajustes de Galería (Configuración → Galería, `FotofficeGaleriaAjustes`): los valores con los que
 * nace cada galería nueva. Una fila por organización. Sin fila valen los de fábrica (los de DNX en
 * Proof): selección libre, comentarios sí, descarga de la vista y el mensaje de bienvenida de abajo.
 * Escribir exige `configurar` (dueño o administrador). El modo "por cantidad" se define en cada
 * galería (necesita mínimo o máximo): como valor por omisión sólo existe la selección libre.
 */
export const MENSAJE_DE_BIENVENIDA_DE_FABRICA =
  "Seleccioná las fotos para tu fotolibro. Marcá las que más te gusten, dejá un comentario si querés aclarar algo y, cuando termines, enviá tu selección.";

export type AjustesGaleria = {
  defaultMessage: string | null;
  defaultSelectionMode: ModoSeleccion;
  defaultAllowComments: boolean;
  defaultDownloadMode: ModoDescarga;
};

export const AJUSTES_GALERIA_DE_FABRICA: AjustesGaleria = {
  defaultMessage: MENSAJE_DE_BIENVENIDA_DE_FABRICA,
  defaultSelectionMode: "LIBRE",
  defaultAllowComments: true,
  defaultDownloadMode: "VISTA",
};

export async function leerAjustesGaleria(workspaceId: string): Promise<AjustesGaleria> {
  const f = await prisma.fotofficeGaleriaAjustes.findUnique({
    where: { workspaceId },
    select: { defaultMessage: true, defaultSelectionMode: true, defaultAllowComments: true, defaultDownloadMode: true },
  });
  if (!f) return { ...AJUSTES_GALERIA_DE_FABRICA };
  return {
    defaultMessage: f.defaultMessage,
    defaultSelectionMode: f.defaultSelectionMode === "CANTIDAD" ? "CANTIDAD" : "LIBRE",
    defaultAllowComments: f.defaultAllowComments,
    defaultDownloadMode: (MODOS_DESCARGA as readonly string[]).includes(f.defaultDownloadMode) ? (f.defaultDownloadMode as ModoDescarga) : "VISTA",
  };
}

export type ResultadoAjustesGaleria = { ok: true } | { ok: false; error: string };

/** Guarda los valores por omisión. Exige `configurar`. Un mensaje vacío significa "sin mensaje". */
export async function guardarAjustesGaleria(ctx: CtxGalerias, datos: unknown): Promise<ResultadoAjustesGaleria> {
  if (!puedeConfigurarGalerias(ctx)) return { ok: false, error: M.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: M.datosInvalidos };
  const d = datos as Record<string, unknown>;
  if (typeof d.defaultAllowComments !== "boolean") return { ok: false, error: M.comentarios };
  if (typeof d.defaultDownloadMode !== "string" || !(MODOS_DESCARGA as readonly string[]).includes(d.defaultDownloadMode)) return { ok: false, error: M.modoDescarga };
  let mensaje: string | null = null;
  if (d.defaultMessage !== null && d.defaultMessage !== undefined) {
    if (typeof d.defaultMessage !== "string") return { ok: false, error: M.mensajeGaleria };
    const t = d.defaultMessage.replace(/\r\n?/g, "\n").trim();
    if (t.length > MAX_MENSAJE_GALERIA) return { ok: false, error: M.mensajeGaleria };
    mensaje = t === "" ? null : t;
  }
  const valores = {
    defaultMessage: mensaje,
    defaultSelectionMode: "LIBRE",
    defaultAllowComments: d.defaultAllowComments,
    defaultDownloadMode: d.defaultDownloadMode,
  };
  try {
    await prisma.fotofficeGaleriaAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...valores },
      update: valores,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
    if ((e as { code?: unknown } | null)?.code !== "P2002") return { ok: false, error: M.guardar };
    await prisma.fotofficeGaleriaAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: valores });
  }
  return { ok: true };
}
