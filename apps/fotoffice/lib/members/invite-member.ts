import "server-only";
import {
  createMemberInvitation,
  getMember,
  markMemberInvitationDelivery,
  MemberConcurrencyError,
  MemberLinkError,
} from "@repo/db/fotoffice-members";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { auditActorFrom } from "./audit";
import { generateInvitationToken, hashInvitationToken } from "./invitation-tokens";
import { buildInvitationUrl, canMemberUseInvitations, invitationExpiryFrom } from "./invitations";
import { buildInvitationEmailBody } from "./invitation-email";
import { invitationExtrasFor } from "./invitation-extras";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { loadDuesCallout } from "@/lib/membership/dues-callout";
import type { AuthUser } from "@/lib/auth";

/**
 * Emite la invitación de UN socio y la manda por email.
 *
 * Es el núcleo compartido entre invitar de a uno desde la ficha, invitar una tanda desde el
 * padrón y **dar el acceso al aprobar una solicitud**: las tres tienen que producir
 * exactamente la misma invitación y la misma auditoría. Duplicar esta lógica para cualquiera
 * de ellas sería la forma segura de que una se quede atrás.
 *
 * Vive fuera de `app/actions` justamente por el tercer caso: un archivo `"use server"` expone
 * como endpoint todo lo que exporta, y la aprobación necesita llamar a esto sin que se
 * convierta en una acción invocable desde el navegador.
 *
 * Sirve también para reenviar: crear una invitación nueva revoca la anterior, así que nunca
 * quedan dos enlaces válidos dando vueltas.
 *
 * El token en claro no sale de esta función: viaja dentro del email y en la base solo queda su
 * hash. Quien llama se entera de a qué dirección salió, nunca del enlace.
 *
 * El contexto (workspace y actor) llega ya resuelto y autorizado: una tanda de 25 socios no
 * puede revalidar permisos 25 veces.
 */
export type InviteOutcome =
  | { error: string; ok?: false }
  | { error: null; ok: true; sentTo: string };

/**
 * Quién emite la invitación.
 *
 * Casi siempre una persona. `SYSTEM` es para el recordatorio de una solicitud por vencer: el
 * enlace de la aprobación dura 14 días y el plazo para pagar 30, así que cuando llega la hora
 * de recordar **el enlace original ya venció siempre**. Mandar un recordatorio que apunta a un
 * enlace muerto sería peor que no mandarlo, y no hay ningún administrador apretando un botón a
 * las seis de la mañana. Queda asentado como `SYSTEM` en el historial del socio, que es
 * exactamente la distinción que el registro necesita.
 */
export type InviteActor = AuthUser | { kind: "SYSTEM"; label: string };

function esSistema(actor: InviteActor): actor is { kind: "SYSTEM"; label: string } {
  return "kind" in actor && actor.kind === "SYSTEM";
}

/**
 * Cuerpo alternativo del email.
 *
 * La invitación suelta dice "la institución te invita a acceder". La de una aprobación tiene
 * que decir además que fue aceptada, cuánto debe y hasta cuándo: son el mismo enlace y el
 * mismo circuito, pero dos mensajes distintos, y mandar los dos sería mandar dos emails para
 * un solo hecho.
 */
export type InvitationBodyBuilder = (context: {
  memberFirstName: string;
  institution: string;
  invitationUrl: string;
  signature: RenderedEmailSignature | null;
}) => { subject: string; html: string; text: string };

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

export async function inviteOneMember(
  workspace: { id: string },
  actorUser: InviteActor,
  memberId: string,
  options: { buildBody?: InvitationBodyBuilder } = {},
): Promise<InviteOutcome> {
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

  const sistema = esSistema(actorUser);
  const actor = sistema ? { userId: null, label: actorUser.label } : auditActorFrom(actorUser);
  let created: Awaited<ReturnType<typeof createMemberInvitation>>;
  try {
    created = await createMemberInvitation(workspace.id, memberId, {
      email,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: invitationExpiryFrom(),
      // Sin persona detrás no hay a quién atribuirle la invitación: la columna queda nula y el
      // historial lo cuenta con la fuente, que es donde corresponde.
      invitedByUserId: sistema ? null : actorUser.id,
      actor,
      source: sistema ? "SYSTEM" : "MANUAL",
    });
  } catch (e) {
    return { error: friendlyLinkError(e) };
  }

  // El envío ocurre DESPUÉS del commit. Si falla, la invitación queda creada pero marcada
  // como no enviada: nunca se la presenta como enviada, y "Reenviar" la reintenta.
  const { organizationName, signature } = await loadWorkspaceEmailContext(workspace.id);
  const contexto = {
    memberFirstName: member.firstName,
    institution: organizationName,
    invitationUrl: link.url,
    signature,
  };
  /*
    Los extras —la nota de migración, el video de presentación y el número de socio— sólo van
    en la invitación genérica. Quien pasa su propio `buildBody` (la aprobación de un alta)
    arma otro mensaje, con otro propósito, y meterle el video de bienvenida ahí sería mezclar
    dos comunicaciones distintas.
  */
  const extras = invitationExtrasFor(workspace.id);
  const body = options.buildBody
    ? options.buildBody(contexto)
    : buildInvitationEmailBody({
        ...contexto,
        dues: await loadDuesCallout(memberId),
        migrationNote: extras.migrationNote,
        video: extras.video,
        memberNumber: member.memberNumber,
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
