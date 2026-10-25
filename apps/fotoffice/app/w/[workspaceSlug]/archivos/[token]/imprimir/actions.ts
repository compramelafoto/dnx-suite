"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { iniciarPagoImpresion, type ResultadoIniciarPagoImpresion } from "@/lib/impresiones/pago-servidor";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE_PAGOS = 15;

/**
 * «Pagar» de la pantalla de copias impresas, sin sesión: el token de la carpeta del cliente es la llave
 * y el workspace sale del slug. Todo se vuelve a validar en `iniciarPagoImpresion` (el navegador no se cree).
 */
export async function iniciarPagoImpresionAction(slug: string, token: string, datos: unknown): Promise<ResultadoIniciarPagoImpresion> {
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `impresion-pagar:${ip}`, limit: TOPE_PAGOS, windowMs: DIEZ_MINUTOS }).allowed) {
    return { ok: false, error: "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo." };
  }
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: "Este enlace ya no permite pedir copias." };
  return iniciarPagoImpresion(workspaceId, slug, "CARPETA", token, datos);
}
