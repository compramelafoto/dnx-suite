"use server";

import { headers } from "next/headers";
import { anotarNumeroDelLaboratorio, type ResultadoNumeroLaboratorio } from "@/lib/carpetas/carpeta";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE = 20;

/**
 * «Guardar» del número de pedido del laboratorio, sin sesión: el token del enlace del laboratorio
 * es la llave y el workspace sale del slug. `anotarNumeroDelLaboratorio` vuelve a validar todo.
 */
export async function anotarNumeroDelLaboratorioAction(slug: string, token: string, numero: string): Promise<ResultadoNumeroLaboratorio> {
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `carpeta-numero-lab:${ip}`, limit: TOPE, windowMs: DIEZ_MINUTOS }).allowed) {
    return { ok: false, error: "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo." };
  }
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: "Este enlace ya no es válido." };
  return anotarNumeroDelLaboratorio(workspaceId, token, numero);
}
