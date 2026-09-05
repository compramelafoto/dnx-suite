"use server";

import { revalidatePath } from "next/cache";
import {
  createMemberInvitation,
  getMember,
  linkMemberToUser,
  MemberConcurrencyError,
  MemberLinkError,
  markMemberInvitationDelivery,
  revokeMemberInvitation,
  unlinkMemberFromUser,
} from "@repo/db/fotoffice-members";
import { findLinkableUserByEmail } from "@repo/db/fotoffice-user-lookup";
import { requireMembersManageContext } from "@/lib/members/access";
import { auditActorFrom, normalizeReason } from "@/lib/members/audit";
import { generateInvitationToken, hashInvitationToken } from "@/lib/members/invitation-tokens";
import {
  buildInvitationUrl,
  canMemberUseInvitations,
  emailsMatch,
  invitationExpiryFrom,
  INVITE_BATCH_MAX,
} from "@/lib/members/invitations";
import { buildInvitationEmailBody } from "@/lib/members/invitation-email";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadDuesCallout } from "@/lib/membership/dues-callout";

export type MemberAccessState = {
  error: string | null;
  /** Datos del usuario encontrado, para que el administrador confirme antes de vincular. */
  candidate?: { userId: number; email: string; name: string | null; emailMatchesMember: boolean };
  /** Dirección a la que salió la invitación, para confirmarlo en pantalla. Nunca el enlace. */
  sentTo?: string;
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
      case "MEMBER_NOT_ACTIVE":
        return "Solo se puede invitar a un socio activo.";
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
 * Emite la invitación de UN socio y la manda por email.
 *
 * Es el núcleo compartido entre invitar de a uno desde la ficha e invitar una tanda desde el
 * padrón: las dos pantallas tienen que producir exactamente la misma invitación, la misma
 * auditoría y el mismo email. Duplicar esta lógica para el envío masivo sería la forma
 * segura de que una de las dos se quede atrás.
 *
 * Sirve también para reenviar: crear una invitación nueva revoca la anterior, así que nunca
 * quedan dos enlaces válidos dando vueltas.
 *
 * El token en claro no sale de esta función: viaja dentro del email y en la base solo queda
 * su hash. Quien llama se entera de a qué dirección salió, nunca del enlace.
 *
 * El contexto (workspace y actor) llega ya resuelto y autorizado: una tanda de 25 socios no
 * puede revalidar permisos 25 veces.
 */
async function inviteOneMember(
  workspace: { id: string },
  actorUser: Parameters<typeof auditActorFrom>[0],
  memberId: string,
): Promise<MemberAccessState> {
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

  if (!canMemberUseInvitations(member.status)) {
    return { error: "Solo se puede invitar a un socio activo." };
  }

  // El enlace se resuelve ANTES de crear nada: si falta `APP_URL`, la invitación no llegaría
  // a ninguna parte y no tiene sentido dejarla creada.
  const rawToken = generateInvitationToken();
  const link = buildInvitationUrl(rawToken);
  if (!link.ok) {
    return {
      error:
        "Falta configuración del sistema para enviar invitaciones. Avisale al equipo técnico.",
    };
  }

  const actor = auditActorFrom(actorUser);
  let created: Awaited<ReturnType<typeof createMemberInvitation>>;
  try {
    created = await createMemberInvitation(workspace.id, memberId, {
      email,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: invitationExpiryFrom(),
      invitedByUserId: actorUser.id,
      actor,
    });
  } catch (e) {
    return { error: friendlyLinkError(e) };
  }

  // El envío ocurre DESPUÉS del commit. Si falla, la invitación queda creada pero marcada
  // como no enviada: nunca se la presenta como enviada, y "Reenviar" la reintenta.
  const { organizationName, signature } = await loadWorkspaceEmailContext(workspace.id);
  const body = buildInvitationEmailBody({
    memberFirstName: member.firstName,
    institution: organizationName,
    invitationUrl: link.url,
    signature,
    dues: await loadDuesCallout(memberId),
  });
  const outcome = await sendTransactionalEmail({ to: email, ...body });

  await markMemberInvitationDelivery(
    workspace.id,
    memberId,
    created.invitation.id,
    {
      sent: outcome.status === "SENT",
      resend: created.resend,
      detail: outcome.status === "SENT" ? null : outcome.detail,
    },
    actor,
  );

  if (outcome.status !== "SENT") {
    return {
      error:
        "La invitación quedó creada pero el email no salió. Probá con «Reenviar»; quedó registrado para revisarlo.",
    };
  }
  return { error: null, ok: true, sentTo: email };
}

/** Invitación de a uno, desde la ficha del socio. */
export async function inviteMemberAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace, user: actorUser } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  if (!memberId) return { error: "Socio inválido." };

  const result = await inviteOneMember(workspace, actorUser, memberId);
  revalidatePath(`/members/${memberId}`);
  return result;
}

export type InviteBatchState = {
  error: string | null;
  /** Cuántos salieron. */
  sent?: number;
  /** Socios cuyo email no salió, con el motivo, para poder reintentar. */
  failed?: { memberId: string; error: string }[];
};

/**
 * Invita a varios socios de una vez.
 *
 * Secuencial, no en paralelo: el proveedor de email limita los envíos por segundo, y una
 * ráfaga de 25 simultáneos hace rechazar la mitad. Lento y completo es mejor que rápido y a
 * medias, sobre todo cuando lo que se pierde es el aviso de cobranza de un socio.
 *
 * Cada socio se resuelve por separado y un fallo NO corta la tanda: se sigue con el resto y
 * se informa quién quedó afuera. La alternativa —abortar en el primero que falla— dejaría a
 * la Secretaría sin saber a quién ya se le mandó.
 */
export async function inviteMembersBatchAction(
  _prev: InviteBatchState | undefined,
  formData: FormData,
): Promise<InviteBatchState> {
  const { workspace, user: actorUser } = await requireMembersManageContext();

  // `getAll` y no `get`: el formulario manda una casilla por socio seleccionado.
  const ids = Array.from(
    new Set(
      formData
        .getAll("memberIds")
        .map((v) => v.toString().trim())
        .filter(Boolean),
    ),
  );

  if (ids.length === 0) return { error: "No seleccionaste ningún socio." };
  if (ids.length > INVITE_BATCH_MAX) {
    return {
      error: `Se pueden invitar hasta ${INVITE_BATCH_MAX} socios por vez. Seleccionaste ${ids.length}.`,
    };
  }

  let sent = 0;
  const failed: { memberId: string; error: string }[] = [];

  for (const memberId of ids) {
    const result = await inviteOneMember(workspace, actorUser, memberId);
    if (result.ok) sent += 1;
    else failed.push({ memberId, error: result.error ?? "No se pudo invitar." });
  }

  revalidatePath("/members");
  return { error: null, sent, failed };
}

export async function revokeMemberInvitationAction(
  _prev: MemberAccessState | undefined,
  formData: FormData,
): Promise<MemberAccessState> {
  const { workspace, user: actorUser } = await requireMembersManageContext();
  const memberId = formData.get("memberId")?.toString()?.trim();
  const invitationId = formData.get("invitationId")?.toString()?.trim();
  if (!memberId || !invitationId) return { error: "Datos inválidos." };

  const result = await revokeMemberInvitation(workspace.id, memberId, invitationId, auditActorFrom(actorUser));
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
