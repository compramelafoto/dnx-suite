"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { iniciarPagoImpresion, type ResultadoIniciarPagoImpresion } from "@/lib/impresiones/pago-servidor";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE_PAGOS = 15;

/**
 * «Pagar» de la pantalla de copias impresas desde la GALERÍA del cliente, sin sesión: el token de la galería es
 * la llave y el workspace sale del slug. `iniciarPagoImpresion` vuelve a resolver la galería y las fotos
 * imprimibles (sólo las que el cliente puede bajar en original): el navegador no se cree.
 */
export async function iniciarPagoImpresionGaleriaAction(slug: string, token: string, datos: unknown): Promise<ResultadoIniciarPagoImpresion> {
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `impresion-pagar:${ip}`, limit: TOPE_PAGOS, windowMs: DIEZ_MINUTOS }).allowed) {
    return { ok: false, error: "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo." };
  }
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: "Este enlace ya no permite pedir copias." };
  return iniciarPagoImpresion(workspaceId, slug, "GALERIA", token, datos);
}
