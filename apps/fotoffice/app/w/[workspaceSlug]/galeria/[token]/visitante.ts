import "server-only";
import { headers } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { esDelEquipo } from "@/lib/presupuestos/vistas";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

/** Ventana del freno por IP en el enlace de la galería (como el del contrato y el presupuesto). */
const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE_VISTAS = 60;

/**
 * Si quien abre la página pasa el freno por IP. El freno es en memoria, por instancia: frena bucles y
 * raspadores que prueban tokens. La IP no se guarda en ningún lado.
 */
export async function visitanteDelEnlace(): Promise<{ permitido: boolean }> {
  const ip = clientIp(await headers());
  return { permitido: checkRateLimit({ key: `galeria-ver:${ip}`, limit: TOPE_VISTAS, windowMs: DIEZ_MINUTOS }).allowed };
}

/** Lo mismo para una acción: freno propio por tipo (elegir tiene más margen porque se toca mucho). */
export async function visitanteDeAccion(accion: string, tope: number): Promise<{ permitido: boolean }> {
  const ip = clientIp(await headers());
  return { permitido: checkRateLimit({ key: `galeria-${accion}:${ip}`, limit: tope, windowMs: DIEZ_MINUTOS }).allowed };
}

/** ¿Quien abre tiene sesión y es del equipo de esta organización? Su apertura no cuenta como "entró". */
export async function abreAlguienDelEquipo(workspaceId: string): Promise<boolean> {
  try {
    const user = await getAuthUser();
    return await esDelEquipo(workspaceId, user?.id ?? null);
  } catch {
    return false;
  }
}
