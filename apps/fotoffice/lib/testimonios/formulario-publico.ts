import "server-only";
import { prisma } from "@repo/db";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Lo que comparten la acción del formulario de testimonio y la ruta que firma la subida de la foto.
 * Vive fuera del archivo `"use server"` a propósito: todo lo que ese archivo exporta se vuelve una
 * acción que el navegador puede llamar.
 */

/** Envíos del formulario: 5 por IP cada 10 minutos (abierto o con invitación). */
export const FRENO_TESTIMONIOS = { limit: 5, windowMs: 10 * 60 * 1000 };
/** Fotos firmadas: un poco más, porque la persona puede cambiar de foto antes de enviar. */
export const FRENO_FOTOS_TESTIMONIO = { limit: 10, windowMs: 10 * 60 * 1000 };
export const MENSAJE_FRENO_TESTIMONIO = "Recibimos muchos envíos seguidos desde tu conexión. Probá de nuevo en unos minutos.";

/**
 * Freno de memoria por IP (el mismo de las consultas: "N por instancia" en Vercel; no es un control
 * de seguridad, evita un bucle o un robot). Sin IP conocida no se frena: agruparía a todos juntos.
 */
export async function frenadoPorIp(prefijo: string, freno: { limit: number; windowMs: number }): Promise<boolean> {
  let ip: string;
  try {
    ip = clientIp(await headers());
  } catch {
    return false; // Fuera de un pedido (pruebas, scripts): no hay IP que contar.
  }
  if (ip === "desconocido") return false;
  return !checkRateLimit({ key: `${prefijo}:${ip}`, ...freno }).allowed;
}

export type SitioDelFormulario = { workspaceId: string; estudio: string };

/**
 * El estudio dueño del slug, sólo si su Sitio web está encendido (si no, el formulario no existe).
 * `estudio` es el nombre que va en el texto del permiso.
 */
export async function sitioDelFormulario(workspaceSlug: unknown): Promise<SitioDelFormulario | null> {
  if (typeof workspaceSlug !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(workspaceSlug)) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) return null;
  if (!(await getEnabledModuleKeysForWorkspace(branding.workspaceId)).has(WEBSITE_MODULE_KEY)) return null;
  return { workspaceId: branding.workspaceId, estudio: branding.commercialName?.trim() || workspaceSlug };
}
