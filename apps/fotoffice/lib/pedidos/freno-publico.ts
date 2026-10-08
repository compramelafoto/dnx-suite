import "server-only";
import { headers } from "next/headers";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

/** Ventana y tope del freno por IP para abrir los enlaces del pedido y del recibo (los mismos del presupuesto). */
const DIEZ_MINUTOS = 10 * 60 * 1000;
const TOPE_VISTAS = 60;

/**
 * ¿Esta conexión puede abrir otro enlace de pedido o de recibo? Un solo cupo para las dos páginas.
 * Freno en memoria, por instancia, igual que el del presupuesto: frena bucles y raspadores que
 * prueban tokens. No guarda la IP.
 */
export async function pasaElFrenoDeEnlaces(): Promise<boolean> {
  const ip = clientIp(await headers());
  return checkRateLimit({ key: `pedido-ver:${ip}`, limit: TOPE_VISTAS, windowMs: DIEZ_MINUTOS }).allowed;
}

/** Pagar una cuota (abre una preferencia en Mercado Pago) y verificar la vuelta (le pregunta a Mercado Pago): cupos aparte, más cortos. */
const TOPE_PAGOS = 15;

export async function pasaElFrenoDePagos(): Promise<boolean> {
  const ip = clientIp(await headers());
  return checkRateLimit({ key: `pedido-pagar:${ip}`, limit: TOPE_PAGOS, windowMs: DIEZ_MINUTOS }).allowed;
}
