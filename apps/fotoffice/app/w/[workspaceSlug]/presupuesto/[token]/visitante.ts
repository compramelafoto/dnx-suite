import "server-only";
import { headers } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { esDelEquipo } from "@/lib/presupuestos/vistas";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { hashDeIp, navegadorCorto, salDeIp } from "@/lib/presupuestos/enlace";

/** Ventana y tope del freno por IP para abrir el enlace (página y vista para imprimir). */
const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE_VISTAS = 60;

/**
 * Quién abre el enlace (IP con hash y navegador recortado, nunca la IP) y si pasa el freno por
 * IP. El freno es en memoria, por instancia: frena bucles y raspadores que prueban tokens.
 */
export async function visitanteDelEnlace(): Promise<{ permitido: boolean; ipHash: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = clientIp(h);
  const permitido = checkRateLimit({ key: `presupuesto-ver:${ip}`, limit: TOPE_VISTAS, windowMs: DIEZ_MINUTOS }).allowed;
  return { permitido, ipHash: hashDeIp(ip === "desconocido" ? null : ip, salDeIp()), userAgent: navegadorCorto(h.get("user-agent")) };
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
