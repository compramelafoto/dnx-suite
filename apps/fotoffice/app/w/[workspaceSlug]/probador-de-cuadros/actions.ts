"use server";

import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import type { ResultadoIniciarPagoImpresion } from "@/lib/impresiones/pago-servidor";
import { crearPedidoProbador, pedirSubidas, type ResultadoSubidas } from "@/lib/probador/pedido.server";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

const DIEZ_MINUTOS = 10 * 60 * 1000;
const MUCHOS = "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.";

/**
 * Las dos acciones del paso a paso del probador, sin sesión: el estudio sale del slug y todo se
 * vuelve a validar en el servidor (`lib/probador/pedido.server.ts`).
 */
export async function pedirSubidasAction(slug: string, archivos: unknown): Promise<ResultadoSubidas> {
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `probador-subir:${ip}`, limit: 20, windowMs: DIEZ_MINUTOS }).allowed) return { ok: false, error: MUCHOS };
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: "Este estudio no existe." };
  return pedirSubidas(workspaceId, archivos);
}

export async function pedirCuadrosAction(slug: string, datos: unknown): Promise<ResultadoIniciarPagoImpresion> {
  const ip = clientIp(await headers());
  if (!checkRateLimit({ key: `probador-pagar:${ip}`, limit: 10, windowMs: DIEZ_MINUTOS }).allowed) return { ok: false, error: MUCHOS };
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: "Este estudio no existe." };
  return crearPedidoProbador(workspaceId, datos);
}
