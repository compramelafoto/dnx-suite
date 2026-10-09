import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@repo/db";
import { analizar, tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
import { correoValido } from "@/lib/plantillas/contexto";
import { DIAS_VALIDEZ_ENLACE, MAX_CUERPO_CONTRATO } from "./constantes";
import { tokenDeFirmante, hashDeToken } from "./enlace";
import { huellaTexto } from "./huella";
import type { Contratante } from "./contratantes";

/** Una condición que corta la operación y deshace la transacción (con el mensaje para la persona). */
export class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Vencimiento del enlace de un firmante enviado en `ahora`. */
export function vencimientoDeEnlace(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_VALIDEZ_ENLACE * DIA_MS);
}

/** Candado por contrato (dentro de una transacción): serializa enviar, corregir, anular y firmar. */
export function bloquearContrato(tx: Pick<Prisma.TransactionClient, "$executeRaw">, contratoId: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-contrato:${contratoId}`}))`;
}

export type RevisionTexto = { ok: true; texto: string } | { ok: false; error: string };

/**
 * El texto que se va a congelar en una versión: ya viene completado, así que no puede quedar ninguna
 * variable `[algo]` ni bloque `[si:…]…[/si]` sin resolver, ni un `[TEXTO EN MAYÚSCULAS]` por completar.
 * Normaliza saltos de línea y exige un largo razonable.
 */
export function revisarTextoFinal(raw: string): RevisionTexto {
  const texto = raw.replace(/\r\n?/g, "\n").trim();
  if (!texto) return { ok: false, error: "El texto del contrato está vacío." };
  if (texto.length > MAX_CUERPO_CONTRATO) return { ok: false, error: "El texto del contrato supera los 100.000 caracteres." };
  const r = analizar(texto, new Set());
  if (!r.ok) {
    const v = r.errores.find((e) => e.variable)?.variable;
    return { ok: false, error: v ? `Quedó una variable sin completar en el texto: [${v}]. Reemplazala por el dato.` : `El texto tiene un bloque mal cerrado (carácter ${r.errores[0]!.posicion + 1}).` };
  }
  if (tieneMarcadorSinCompletar(texto)) return { ok: false, error: "Quedó un texto entre corchetes y en mayúsculas por completar. Reemplazalo por el dato." };
  return { ok: true, texto };
}

/** Contratantes sin correo válido (para frenar el envío). */
export function contratantesSinCorreo(contratantes: readonly Contratante[]): Contratante[] {
  return contratantes.filter((c) => !correoValido(c.email));
}

export type FirmanteNuevo = { id: string; orden: number; clientId: string; name: string; docNumber: string | null; email: string; tokenHash: string; tokenExpiresAt: Date };

/** Los firmantes de una versión nueva: uno por contratante, con sus datos congelados y su token. */
export function armarFirmantes(contratantes: readonly Contratante[], clave: string, ahora: Date): FirmanteNuevo[] {
  const vence = vencimientoDeEnlace(ahora);
  return contratantes.map((c) => {
    const id = randomUUID();
    const doc = [c.datos.docType, c.datos.docNumber].map((x) => x?.trim()).filter(Boolean).join(" ");
    return {
      id,
      orden: c.orden,
      clientId: c.clientId,
      name: c.nombre,
      docNumber: doc || null,
      email: c.email!.trim(),
      tokenHash: hashDeToken(tokenDeFirmante(id, vence, clave)),
      tokenExpiresAt: vence,
    };
  });
}

export { huellaTexto };
