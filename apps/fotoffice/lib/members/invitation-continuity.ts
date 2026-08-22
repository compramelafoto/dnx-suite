import { cookies } from "next/headers";

/**
 * Continuidad de una invitación mientras el socio crea su contraseña.
 *
 * El problema concreto: `requestPasswordReset` arma el enlace de "crear contraseña" por su
 * cuenta y no admite llevar un destino. Como ese paquete lo comparten las otras aplicaciones
 * del monorepo, no se toca. La continuidad se guarda entonces del lado de FotoOffice, en una
 * cookie propia.
 *
 * MODELO DE AMENAZA (se guarda el token de invitación en claro dentro de la cookie):
 *
 * - `HttpOnly`: ningún script de la página puede leerla, así que un XSS no se la lleva.
 * - `Secure` en producción: no viaja por HTTP en claro.
 * - `SameSite=Lax`: no se manda en pedidos de terceros; un sitio hostil no puede provocarla.
 * - Vive como mucho lo que le queda a la invitación, nunca más.
 *
 * Qué NO cambia el riesgo: el mismo token ya viaja en el enlace del email de invitación, que
 * es el canal más expuesto de los dos. La cookie no agrega una vía de robo nueva.
 *
 * Qué NO alcanza la cookie por sí sola: aceptar. Poseerla solo devuelve a la pantalla de la
 * invitación; la vinculación exige sesión autenticada con el email invitado. Alguien que se
 * quede con la cookie en una computadora compartida ve la pantalla, no obtiene el acceso.
 *
 * El valor nunca se escribe en logs, ni se copia a una URL, ni se renderiza en el HTML.
 */

export const INVITATION_CONTINUITY_COOKIE = "fotoffice_member_invitation";

/**
 * Vida de la cookie: lo que le quede a la invitación, acotado. Nunca sobrevive al enlace que
 * representa — una cookie más longeva que su invitación solo genera vueltas a una pantalla
 * que ya no sirve.
 */
export function continuityMaxAgeSeconds(expiresAt: Date, now: Date = new Date()): number {
  const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export async function setInvitationContinuity(rawToken: string, expiresAt: Date): Promise<void> {
  const maxAge = continuityMaxAgeSeconds(expiresAt);
  if (maxAge <= 0) return;

  const store = await cookies();
  store.set(INVITATION_CONTINUITY_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function readInvitationContinuity(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(INVITATION_CONTINUITY_COOKIE)?.value?.trim();
  return value ? value : null;
}

export async function clearInvitationContinuity(): Promise<void> {
  const store = await cookies();
  store.delete(INVITATION_CONTINUITY_COOKIE);
}
