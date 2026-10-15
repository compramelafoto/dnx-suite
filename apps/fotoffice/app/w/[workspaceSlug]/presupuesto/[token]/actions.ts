"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { aceptarPresupuesto, MENSAJES_ACEPTACION, pedirPresupuestoNuevo } from "@/lib/presupuestos/aceptacion";
import { hashDeIp, navegadorCorto, salDeIp } from "@/lib/presupuestos/enlace";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

/**
 * Acciones del enlace público de un presupuesto, sin sesión: el token es la llave y el workspace
 * sale del slug de la dirección. Con freno por IP (en memoria, por instancia: frena bucles y
 * raspadores, no es un control de seguridad; la aceptación única la garantiza la base).
 */

export type ResultadoPublico = { ok: true } | { ok: false; error: string };

const DIEZ_MINUTOS = 10 * 60 * 1000;
const DEMASIADOS = "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.";

async function visitante() {
  const h = await headers();
  const ip = clientIp(h);
  return { ip, ipHash: hashDeIp(ip === "desconocido" ? null : ip, salDeIp()), userAgent: navegadorCorto(h.get("user-agent")) };
}

/** "Acepto": nombre, tilde de las condiciones y la forma de pago elegida (sin elegir, la primera). */
export async function aceptarPresupuestoAction(
  slug: unknown,
  token: unknown,
  nombre: unknown,
  acepta: unknown,
  opcion?: unknown,
): Promise<ResultadoPublico> {
  const v = await visitante();
  if (!checkRateLimit({ key: `presupuesto-aceptar:${v.ip}`, limit: 10, windowMs: DIEZ_MINUTOS }).allowed) return { ok: false, error: DEMASIADOS };
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: MENSAJES_ACEPTACION.enlaceInvalido };
  const r = await aceptarPresupuesto(workspaceId, token, { nombre, acepta, opcion }, { ipHash: v.ipHash, userAgent: v.userAgent });
  return r.ok ? { ok: true } : r;
}

/** "Pedir uno nuevo" desde un presupuesto vencido. */
export async function pedirPresupuestoNuevoAction(slug: unknown, token: unknown): Promise<ResultadoPublico> {
  const v = await visitante();
  if (!checkRateLimit({ key: `presupuesto-pedir:${v.ip}`, limit: 5, windowMs: DIEZ_MINUTOS }).allowed) return { ok: false, error: DEMASIADOS };
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: MENSAJES_ACEPTACION.enlaceInvalido };
  return pedirPresupuestoNuevo(workspaceId, token);
}
