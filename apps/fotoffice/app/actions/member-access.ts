"use server";

import { revalidatePath } from "next/cache";
import {
  createMemberInvitation,
  getMember,
  linkMemberToUser,
  MemberConcurrencyError,
  MemberLinkError,
  revokeMemberInvitation,
  unlinkMemberFromUser,
} from "@repo/db/fotoffice-members";
import { findLinkableUserByEmail } from "@repo/db/fotoffice-user-lookup";
import { requireMembersManageContext } from "@/lib/members/access";
import { auditActorFrom, normalizeReason } from "@/lib/members/audit";
import {
  buildInvitationUrl,
  emailsMatch,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiryFrom,
} from "@/lib/members/invitations";

export type MemberAccessState = {
  error: string | null;
  /** Datos del usuario encontrado, para que el administrador confirme antes de vincular. */
  candidate?: { userId: number; email: string; name: string | null; emailMatchesMember: boolean };
  /** Enlace de invitación recién generado. Se muestra UNA sola vez: después solo queda el hash. */
  invitationUrl?: string;
  ok?: boolean;
};

function friendlyLinkError(e: unknown): string {
  if (e instanceof MemberConcurrencyError) {
    return "Otra persona modificó este socio mientras tanto. Recargá la ficha e intentá de nuevo.";
  }
  if (e instanceof MemberLinkError) {
    switch (e.reason) {
      case "ALREADY_LINKED":
        return "Este socio ya tiene una cuenta vinculada.";
      case "USER_TAKEN":
        return "Esa cuenta ya está vinculada a otro socio de este workspace.";
      case "INVITATION_INVALID":
        return "La invitación ya no es válida.";
      default:
        return "Socio no encontrado.";
    }
  }
  return "No se pudo completar la operación.";
}

/**
 * PASO 1: buscar por email EXACTO. No vincula nada — solo devuelve el candidato para que el
 * administrador confirme. FotoOffice nunca vincula automáticamente por coincidencia de email:
 * dos personas pueden compartir casilla (un matrimonio), y adivinar sería regalar el acceso
 * a la cuenta equivocada.
 */
export async function findUserToLinkAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim();
  if (!memberId) return { error: "Socio inválido." };
  if (!email) return { error: "Escribí el email exacto de la cuenta a vincular." };

  const member = await getMember(workspace.id, memberId);
  if (!member) return { error: "Socio no encontrado." };
  if (member.userId !== null) return { error: "Este socio ya tiene una cuenta vinculada." };

  const user = await findLinkableUserByEmail(email);
  if (!user) {
    // Mensaje deliberadamente igual para "no existe" que para cualquier otro caso: desde acá
    // no se puede sondear qué emails están registrados en la plataforma.
    return { error: "No encontramos una cuenta con ese email exacto. Revisá el email o invitá al socio." };
  }

  return {
    error: null,
    candidate: {
      userId: user.id,
      email: user.email,
      name: user.name,
      emailMatchesMember: emailsMatch(member.email, user.email),
    },
  };
}

/**
 * PASO 2: vincular, ya con confirmación explícita del administrador.
 *
 * Si los emails no coinciden se exige una SEGUNDA confirmación (`confirmMismatch`): no se
 * bloquea —hay casos legítimos, como un socio que usa la casilla del estudio— pero no puede
 * pasar por descuido.
 */
export async function linkMemberUserAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace, user: actorUser } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  const userId = Number(formData.get("userId")?.toString() ?? "");
  if (!memberId || !Number.isInteger(userId)) return { error: "Datos inválidos." };

  const member = await getMember(workspace.id, memberId);
  if (!member) return { error: "Socio no encontrado." };

  const target = await findLinkableUserByEmail(formData.get("email")?.toString() ?? "");
  if (!target || target.id !== userId) {
    return { error: "La cuenta cambió desde que la buscaste. Volvé a buscarla." };
  }

  const mismatch = !emailsMatch(member.email, target.email);
  if (mismatch && formData.get("confirmMismatch") !== "on") {
    return {
      error:
        "Los emails no coinciden: confirmá que esta es realmente la cuenta del socio antes de continuar.",
      candidate: { userId: target.id, email: target.email, name: target.name, emailMatchesMember: false },
    };
  }

  try {
    await linkMemberToUser(workspace.id, memberId, userId, {
      actor: auditActorFrom(actorUser),
      // Queda asentado en el historial que fue una decisión manual, no una coincidencia.
      reason: mismatch
        ? "Vinculación manual confirmada por el administrador (los emails no coinciden)"
        : "Vinculación manual confirmada por el administrador",
      expectedUpdatedAt: member.updatedAt,
    });
  } catch (e) {
    return { error: friendlyLinkError(e) };
  }

  revalidatePath(`/members/${memberId}`);
  return { error: null, ok: true };
}

/**
 * Genera una invitación y devuelve el enlace para copiar. No se envía por email: hoy no hay
 * proveedor configurado en producción, y mostrar "invitación enviada" cuando nada salió sería
 * peor que no ofrecerlo. El administrador lo comparte por el medio que quiera.
 */
export async function inviteMemberAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace, user: actorUser } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  if (!memberId) return { error: "Socio inválido." };

  const member = await getMember(workspace.id, memberId);
  if (!member) return { error: "Socio no encontrado." };
  if (member.userId !== null) return { error: "Este socio ya tiene una cuenta vinculada." };

  // El email del socio manda. Si no tiene, el administrador debe cargarle uno propio primero:
  // FotoOffice nunca inventa una dirección ni le agrega sufijos.
  const email = member.email?.trim().toLowerCase();
  if (!email) {
    return {
      error:
        "Este socio no tiene email. Cargale un email propio en su ficha, o vinculá una cuenta existente.",
    };
  }

  const rawToken = generateInvitationToken();
  try {
    await createMemberInvitation(workspace.id, memberId, {
      email,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: invitationExpiryFrom(),
      invitedByUserId: actorUser.id,
    });
  } catch (e) {
    return { error: friendlyLinkError(e) };
  }

  const baseUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  revalidatePath(`/members/${memberId}`);
  // Única vez que el token viaja en claro: de acá en más solo existe su hash.
  return { error: null, ok: true, invitationUrl: buildInvitationUrl(baseUrl, rawToken) };
}

export async function revokeMemberInvitationAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  const invitationId = formData.get("invitationId")?.toString()?.trim();
  if (!memberId || !invitationId) return { error: "Datos inválidos." };

  const result = await revokeMemberInvitation(workspace.id, memberId, invitationId);
  if (result.count === 0) return { error: "Esa invitación ya no estaba pendiente." };

  revalidatePath(`/members/${memberId}`);
  return { error: null, ok: true };
}

/** Desvincular exige motivo, igual que suspender o dar de baja: es quitarle el acceso a alguien. */
export async function unlinkMemberUserAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace, user: actorUser } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  if (!memberId) return { error: "Socio inválido." };

  const reason = normalizeReason(formData.get("reason")?.toString());
  if (!reason) {
    return { error: "Escribí el motivo de la desvinculación: queda registrado en el historial del socio." };
  }

  const member = await getMember(workspace.id, memberId);
  if (!member) return { error: "Socio no encontrado." };
  if (member.userId === null) return { error: "Este socio no tiene ninguna cuenta vinculada." };

  try {
    await unlinkMemberFromUser(workspace.id, memberId, {
      actor: auditActorFrom(actorUser),
      reason,
      expectedUpdatedAt: member.updatedAt,
    });
  } catch (e) {
    return { error: friendlyLinkError(e) };
  }

  revalidatePath(`/members/${memberId}`);
  return { error: null, ok: true };
}
