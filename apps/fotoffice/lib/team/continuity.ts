import "server-only";
import { cookies } from "next/headers";
import { findTeamInvitationByTokenHash } from "@repo/db/fotoffice-team";
import { continuityMaxAgeSeconds } from "@/lib/members/invitation-continuity";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";
import { emailsMatch, invitationState } from "@/lib/members/invitations";

/**
 * Continuidad de una invitación AL EQUIPO mientras la persona crea su contraseña.
 *
 * Mismo modelo de amenaza que la de socios (`lib/members/invitation-continuity.ts`), pero en
 * una cookie propia: las dos invitaciones pueden convivir en la misma computadora y ninguna
 * debe pisar a la otra.
 *
 * Poseer la cookie sólo devuelve a la pantalla de la invitación. Aceptar exige además sesión,
 * email de sesión igual al invitado, invitación vigente y confirmación explícita.
 *
 * El valor nunca se escribe en logs ni se renderiza en el HTML.
 */
export const TEAM_INVITATION_CONTINUITY_COOKIE = "fotoffice_team_invitation";

export async function setTeamInvitationContinuity(rawToken: string, expiresAt: Date): Promise<void> {
  const maxAge = continuityMaxAgeSeconds(expiresAt);
  if (maxAge <= 0) return;
  const store = await cookies();
  store.set(TEAM_INVITATION_CONTINUITY_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function readTeamInvitationContinuity(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(TEAM_INVITATION_CONTINUITY_COOKIE)?.value?.trim();
  return value ? value : null;
}

export async function clearTeamInvitationContinuity(): Promise<void> {
  const store = await cookies();
  store.delete(TEAM_INVITATION_CONTINUITY_COOKIE);
}

/**
 * A dónde seguir después de autenticarse si había una invitación al equipo a medio completar.
 * Revalida todo contra la base; no consume la invitación.
 */
export async function resolveTeamInvitationContinuityPath(userEmail: string): Promise<string | null> {
  const rawToken = await readTeamInvitationContinuity();
  if (!rawToken) return null;

  const invitation = await findTeamInvitationByTokenHash(hashInvitationToken(rawToken));
  const usable =
    invitation && invitationState(invitation) === "PENDING" && emailsMatch(userEmail, invitation.email);

  if (!usable) {
    // Manipulada, vencida o para otra persona: se descarta sin decir por qué.
    await clearTeamInvitationContinuity();
    return null;
  }

  return `/invitacion/equipo/${encodeURIComponent(rawToken)}`;
}
