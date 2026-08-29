/**
 * Protecciones de las rutas públicas del generador de propuestas.
 *
 * `/propuesta` es una pantalla abierta: cualquiera con el enlace arma una
 * propuesta sin cuenta. Eso es a propósito —el vendedor la usa en la reunión—
 * pero implica exponer a internet dos endpoints que suben un archivo y gastan
 * CPU real componiendo imágenes y armando PDFs.
 *
 * Acá viven las tres defensas: identificar al cliente sin guardar datos
 * personales, limitar cuántos pedidos hace, y aceptar el archivo por lo que
 * **es** y no por lo que dice ser.
 */
import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { PartnersDomainError, assertPartnerUploadAllowed, consumeRateLimit } from "@repo/partners";

/** Tope de subida: un logo razonable no pasa de esto. */
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * Identificador efímero del cliente.
 *
 * Se hashea la IP con la clave del despliegue: alcanza para contar pedidos y no
 * guarda un dato personal en ningún lado. Si no hay IP —o el proxy no la
 * manda— cae en una cubeta común, que es el comportamiento seguro: se limita de
 * más, nunca de menos.
 */
export function clientKeyFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  if (!ip) return "sin-ip";
  const salt = process.env.PROPOSAL_RATE_LIMIT_SALT ?? "dnx-propuesta";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export type PublicLimit = { limit: number; windowMs: number };

/**
 * Componer una pieza es barato y el vendedor recorre nueve mientras mira.
 * Armar el PDF compone dieciocho imágenes de una: es el pedido caro.
 */
export const PIECE_LIMIT: PublicLimit = { limit: 90, windowMs: 5 * 60_000 };
export const PDF_LIMIT: PublicLimit = { limit: 6, windowMs: 10 * 60_000 };

/** Devuelve la respuesta de rechazo, o null si el pedido puede seguir. */
export function rejectIfRateLimited(
  request: Request,
  limit: PublicLimit,
): NextResponse | null {
  const resultado = consumeRateLimit(clientKeyFrom(request), limit);
  if (resultado.allowed) return null;
  return NextResponse.json(
    {
      error: `Probaste muchas veces seguidas. Esperá ${resultado.retryAfterSeconds} segundos y volvé a intentar.`,
    },
    { status: 429, headers: { "retry-after": String(resultado.retryAfterSeconds) } },
  );
}

export type LogoLectura =
  | { ok: true; buffer: Buffer }
  | { ok: false; response: NextResponse };

/**
 * Lee el logo del formulario y lo valida por su contenido.
 *
 * El `type` que manda el navegador lo elige el cliente y se puede falsear, así
 * que la validación mira los bytes. `assertPartnerUploadAllowed` es la misma
 * que usa la carga de materiales de partners, y rechaza SVG salvo que el
 * despliegue lo habilite expresamente.
 */
export async function leerLogoDelFormulario(archivo: unknown): Promise<LogoLectura> {
  if (!(archivo instanceof File)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Falta el logo." }, { status: 400 }),
    };
  }
  if (archivo.size > MAX_LOGO_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "El logo pesa más de 5 MB. Probá con uno más liviano." },
        { status: 413 },
      ),
    };
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  try {
    assertPartnerUploadAllowed({
      buffer,
      declaredMime: archivo.type || undefined,
    });
  } catch (err) {
    const mensaje =
      err instanceof PartnersDomainError
        ? err.message
        : "Formato no admitido. Usá PNG, JPG o WEBP.";
    return {
      ok: false,
      response: NextResponse.json({ error: mensaje }, { status: 415 }),
    };
  }

  return { ok: true, buffer };
}
