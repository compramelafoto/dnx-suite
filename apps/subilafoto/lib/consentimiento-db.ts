import "server-only";

import { prisma } from "@repo/db";
import { hashDeIp, tieneConsentimientoVigente } from "./consentimiento";
import { VERSION_DE_TERMINOS } from "./legal/contenido";

/**
 * Lectura y escritura del consentimiento del invitado.
 *
 * La decisión de si hace falta aceptar vive en `consentimiento.ts`, que es puro
 * y está probado. Acá sólo se va a buscar y a guardar.
 */

/** ¿El invitado de esta cookie ya aceptó el texto vigente para este evento? */
export async function yaAcepto(params: {
  eventoId: string;
  token: string | null;
}): Promise<boolean> {
  if (!params.token) return false;

  const sesion = await prisma.subilafotoGuestSession.findUnique({
    where: { token: params.token },
    select: { id: true, eventId: true },
  });
  // Una cookie de otro evento no vale acá: cada evento tiene su propio texto y
  // su propio organizador.
  if (!sesion || sesion.eventId !== params.eventoId) return false;

  const guardados = await prisma.subilafotoConsent.findMany({
    where: { eventId: params.eventoId, guestSessionId: sesion.id, kind: "TERMS" },
    select: { documentVersion: true, accepted: true },
  });

  return tieneConsentimientoVigente(guardados, VERSION_DE_TERMINOS);
}

/**
 * Deja registrado que este invitado aceptó, y con qué versión del texto.
 *
 * No usa `upsert` ni pisa lo anterior: cada aceptación es un hecho con su fecha
 * y se guarda entera. Si alguien acepta la versión de octubre y en marzo acepta
 * otra, quedan las dos — que es justamente lo que hay que poder mostrar.
 */
export async function registrarAceptacion(params: {
  eventoId: string;
  guestSessionId: string;
  ip: string | null;
}): Promise<void> {
  await prisma.subilafotoConsent.create({
    data: {
      eventId: params.eventoId,
      guestSessionId: params.guestSessionId,
      kind: "TERMS",
      documentVersion: VERSION_DE_TERMINOS,
      accepted: true,
      ipHash: hashDeIp(params.ip),
    },
  });
}

/** La IP del visitante detrás del proxy de Vercel. */
export function ipDelPedido(headers: Headers): string | null {
  const reenviada = headers.get("x-forwarded-for");
  // Puede venir una cadena: el primero es el cliente, el resto son los saltos.
  if (reenviada) return reenviada.split(",")[0]!.trim() || null;
  return headers.get("x-real-ip");
}
