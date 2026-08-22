import { findInvitationByTokenHash } from "@repo/db/fotoffice-member-invitations";
import {
  canMemberUseInvitations,
  emailsMatch,
  hashInvitationToken,
  invitationState,
} from "./invitations";
import { clearInvitationContinuity, readInvitationContinuity } from "./invitation-continuity";

/**
 * Devuelve a dónde seguir cuando alguien acaba de autenticarse y tenía una invitación a medio
 * completar.
 *
 * Se ejecuta SOLO después de autenticar, y revalida todo de nuevo: la invitación pudo
 * revocarse, vencer o aceptarse mientras la persona creaba su contraseña.
 *
 * No consume la invitación: solo devuelve a la pantalla donde se acepta explícitamente.
 *
 * Poseer la cookie no alcanza para nada por sí solo — se exige además que el email de la
 * sesión sea el invitado. Quien inicie sesión con otra cuenta en la misma computadora no va
 * a parar a la invitación ajena.
 */
export async function resolveInvitationContinuityPath(userEmail: string): Promise<string | null> {
  const rawToken = await readInvitationContinuity();
  if (!rawToken) return null;

  const invitation = await findInvitationByTokenHash(hashInvitationToken(rawToken));
  const usable =
    invitation &&
    invitationState(invitation) === "PENDING" &&
    invitation.member.userId === null &&
    canMemberUseInvitations(invitation.member.status) &&
    emailsMatch(userEmail, invitation.email);

  if (!usable) {
    // Cookie manipulada, vencida o para otra persona: se descarta y no se dice por qué.
    await clearInvitationContinuity();
    return null;
  }

  return `/invitacion/${encodeURIComponent(rawToken)}`;
}
