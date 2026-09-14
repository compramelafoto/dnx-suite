import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

/**
 * La "sesión" del invitado: una cookie firmada, no un usuario.
 *
 * El capítulo 9 es claro: el invitado no se registra. Esto sólo sirve para contarle sus
 * propias fotos y dejarle borrar las suyas, no para identificarlo.
 */

export const COOKIE_INVITADO = "slf_invitado";

export async function obtenerOCrearSesion(params: {
  eventoId: string;
  token: string | null;
}): Promise<{ id: string; token: string; subidas: number; esNueva: boolean }> {
  if (params.token) {
    const existente = await prisma.subilafotoGuestSession.findUnique({
      where: { token: params.token },
      select: { id: true, token: true, uploadCount: true, eventId: true },
    });
    // El token tiene que ser de ESTE evento: uno de otro no sirve acá.
    if (existente && existente.eventId === params.eventoId) {
      return {
        id: existente.id,
        token: existente.token,
        subidas: existente.uploadCount,
        esNueva: false,
      };
    }
  }

  const creada = await prisma.subilafotoGuestSession.create({
    data: { eventId: params.eventoId, token: randomBytes(32).toString("hex") },
    select: { id: true, token: true, uploadCount: true },
  });

  return { id: creada.id, token: creada.token, subidas: creada.uploadCount, esNueva: true };
}
