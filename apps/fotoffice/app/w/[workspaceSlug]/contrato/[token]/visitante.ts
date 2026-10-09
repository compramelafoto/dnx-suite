import "server-only";
import { headers } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { esDelEquipo } from "@/lib/presupuestos/vistas";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { hashDeIp, navegadorCorto, salDeIp } from "@/lib/presupuestos/enlace";

/** Ventana y tope del freno por IP para abrir el enlace del contrato (como el del presupuesto). */
const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE_VISTAS = 60;

async function origen() {
  const h = await headers();
  const ip = clientIp(h);
  return { ip, ipHash: hashDeIp(ip === "desconocido" ? null : ip, salDeIp()), userAgent: navegadorCorto(h.get("user-agent")) };
}

/**
 * Quién abre el enlace (IP con hash y navegador recortado, nunca la IP) y si pasa el freno por IP.
 * El freno es en memoria, por instancia: frena bucles y raspadores que prueban tokens. Los límites que
 * importan (códigos, intentos, una sola firma) los garantiza la base.
 */
export async function visitanteDelEnlace(): Promise<{ permitido: boolean; ipHash: string | null; userAgent: string | null }> {
  const v = await origen();
  const permitido = checkRateLimit({ key: `contrato-ver:${v.ip}`, limit: TOPE_VISTAS, windowMs: DIEZ_MINUTOS }).allowed;
  return { permitido, ipHash: v.ipHash, userAgent: v.userAgent };
}

/** Lo mismo para una acción: freno propio por tipo de acción. */
export async function visitanteDeAccion(accion: string, tope: number): Promise<{ permitido: boolean; ipHash: string | null; userAgent: string | null }> {
  const v = await origen();
  const permitido = checkRateLimit({ key: `contrato-${accion}:${v.ip}`, limit: tope, windowMs: DIEZ_MINUTOS }).allowed;
  return { permitido, ipHash: v.ipHash, userAgent: v.userAgent };
}

/** ¿Quien abre tiene sesión y es del equipo de esta organización? Su apertura no cuenta como vista. */
export async function abreAlguienDelEquipo(workspaceId: string): Promise<boolean> {
  try {
    const user = await getAuthUser();
    return await esDelEquipo(workspaceId, user?.id ?? null);
  } catch {
    return false;
  }
}
