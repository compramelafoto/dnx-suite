"use server";

import { redirect } from "next/navigation";
import { MemberLinkError } from "@repo/db/fotoffice-members";
import { acceptMemberInvitation } from "@repo/db/fotoffice-member-invitations";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { auditActorFrom } from "@/lib/members/audit";
import { canMemberUseInvitations, emailsMatch, invitationState } from "@/lib/members/invitations";
import { clearInvitationContinuity } from "@/lib/members/invitation-continuity";
import { resolvePortalDestination } from "@/lib/portal/destination";

export type AcceptInvitationState = { error: string | null };

/**
 * Acepta la invitación y vincula. Revalida TODO del lado del servidor —vigencia, estado y
 * coincidencia de email— sin confiar en nada de lo que muestre la pantalla: entre que se
 * renderizó y se confirmó, la invitación pudo revocarse o el socio pudo vincularse por otra vía.
 */
export async function acceptInvitationAction(
  _prev: AcceptInvitationState | undefined,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const invitationId = formData.get("invitationId")?.toString()?.trim();
  if (!invitationId) return { error: "Invitación inválida." };

  const user = await getAuthUser();
  if (!user) return { error: "Iniciá sesión para aceptar la invitación." };

  const invitation = await prisma.memberInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      member: { select: { status: true } },
    },
  });
  if (!invitation) return { error: "La invitación ya no es válida." };
  if (invitationState(invitation) !== "PENDING") return { error: "La invitación ya no es válida." };
  // El estado del socio se revalida acá: pudo darse de baja después de emitida la invitación.
  if (!canMemberUseInvitations(invitation.member.status)) {
    return { error: "La invitación ya no es válida." };
  }
  // El email de la sesión debe ser el invitado, aunque la pantalla ya lo hubiera chequeado.
  if (!emailsMatch(user.email, invitation.email)) {
    return { error: "Esta invitación fue emitida para otra dirección de email." };
  }

  try {
    await acceptMemberInvitation(invitationId, user.id, auditActorFrom(user));
  } catch (e) {
    if (e instanceof MemberLinkError) {
      switch (e.reason) {
        case "ALREADY_LINKED":
          return { error: "Este socio ya tiene una cuenta vinculada." };
        case "USER_TAKEN":
          return { error: "Tu cuenta ya está vinculada a otro socio de esta institución." };
        default:
          return { error: "La invitación ya no es válida." };
      }
    }
    return { error: "No pudimos completar la vinculación. Intentá de nuevo." };
  }

  // La continuidad ya cumplió su función: se borra apenas la vinculación quedó firme.
  await clearInvitationContinuity();

  // Al portal del socio, NUNCA a `/workspace`: esa ruta le crearía una institución propia con
  // rol de dueño. El destino está centralizado para poder cambiarlo a `/portal/pagos`.
  redirect(resolvePortalDestination(formData.get("next")?.toString()));
}
