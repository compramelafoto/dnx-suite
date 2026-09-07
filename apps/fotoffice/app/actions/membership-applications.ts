"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import type { AuthUser } from "@/lib/auth";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { parseApplication } from "@/lib/membership/application";
import { approveApplication, rejectApplication } from "@/lib/membership/repository";
import { ApprovalError } from "@/lib/membership/approve";
import {
  buildApplicationAlertEmail,
  buildApplicationApprovedEmail,
  buildApplicationReceivedEmail,
  buildApplicationRejectedEmail,
} from "@/lib/membership/application-emails";
import { fechaLegible } from "@/lib/membership/charge-labels";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { MEMBERSHIP_EMAIL_KEYS } from "@/lib/communications/constants";
import { inviteOneMember } from "@/lib/members/invite-member";
import { INVITATION_TTL_LABEL } from "@/lib/members/invitations";
import { appUrl } from "@/lib/app-url";

/**
 * `warn` es para lo que salió a medias: la resolución ocurrió pero el aviso a la persona no
 * salió. Sin ese tercer canal habría que elegir entre pintar de verde un fallo o de rojo una
 * aprobación que sí se hizo, y las dos cosas hacen que la Secretaría actúe mal.
 */
export type ApplicationFormState = {
  error: string | null;
  ok: string | null;
  warn?: string | null;
};

const fail = (error: string): ApplicationFormState => ({ error, ok: null });
const done = (ok: string): ApplicationFormState => ({ error: null, ok });

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Envío del formulario público de asociación.
 *
 * Público a propósito: quien se asocia todavía no tiene cuenta. Lo que protege este
 * endpoint no es una sesión sino que **nada ocurre hasta que una persona apruebe**: una
 * solicitud es un pedido, no un alta.
 */
export async function submitApplicationAction(
  workspaceSlug: string,
  _prev: ApplicationFormState | undefined,
  formData: FormData,
): Promise<ApplicationFormState> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, contactEmail: true },
  });
  if (!branding) return fail("No encontramos la institución.");

  // Si la institución no puede cobrar, el formulario no debería estar publicado. Se
  // verifica igual acá: esconder un formulario no es un control.
  const cobros = await getWorkspaceCollectionStatus(branding.workspaceId);
  if (!cobros.canCharge) {
    return fail("Las inscripciones no están abiertas en este momento.");
  }

  const parsed = parseApplication(readForm(formData));
  if (!parsed.ok) return fail(parsed.error);

  // Una solicitud pendiente del mismo email no se duplica: se le dice que ya está en curso.
  const yaExiste = await prisma.membershipApplication.findFirst({
    where: { workspaceId: branding.workspaceId, email: parsed.data.email, status: "PENDIENTE" },
    select: { id: true },
  });
  if (yaExiste) {
    return done("Ya tenemos tu solicitud y está en revisión. Te avisamos por email.");
  }

  await prisma.membershipApplication.create({
    data: { workspaceId: branding.workspaceId, ...parsed.data },
    select: { id: true },
  });

  // Los avisos salen DESPUÉS de que la solicitud está guardada, y su fracaso no la deshace:
  // el pedido ya entró y la Secretaría lo va a ver igual en la bandeja.
  await notifyApplicationReceived({
    workspaceId: branding.workspaceId,
    contactEmail: branding.contactEmail,
    applicant: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
    },
  });

  return done("Recibimos tu solicitud. La Secretaría la va a revisar y te avisamos por email.");
}

/**
 * Acuse a quien se asocia y aviso a la Secretaría.
 *
 * Los dos avisos van juntos porque responden al mismo hecho y ninguno de los dos puede
 * frenar el envío del formulario. El de la Secretaría es el que evita el peor caso: alguien
 * se asocia un lunes y espera tres semanas porque nadie abrió la bandeja.
 */
async function notifyApplicationReceived(input: {
  workspaceId: string;
  contactEmail: string | null;
  applicant: { firstName: string; lastName: string; email: string };
}): Promise<void> {
  try {
    const { organizationName, signature } = await loadWorkspaceEmailContext(input.workspaceId);

    await sendAndLogEmail({
      to: input.applicant.email,
      templateKey: MEMBERSHIP_EMAIL_KEYS.RECEIVED,
      body: buildApplicationReceivedEmail({
        firstName: input.applicant.firstName,
        institution: organizationName,
        signature,
      }),
    });

    // Sin casilla institucional cargada no hay a quién avisarle, y no se inventa un
    // destinatario. Sin `APP_URL` el aviso no podría enlazar la bandeja.
    const base = appUrl();
    if (!input.contactEmail?.trim() || !base) return;

    await sendAndLogEmail({
      to: input.contactEmail.trim(),
      templateKey: MEMBERSHIP_EMAIL_KEYS.ALERT,
      body: buildApplicationAlertEmail({
        applicantName: `${input.applicant.firstName} ${input.applicant.lastName}`.trim(),
        institution: organizationName,
        inboxUrl: `${base}/members/solicitudes`,
        signature,
      }),
    });
  } catch (error) {
    // Que no se pueda avisar no puede volver atrás una solicitud ya recibida.
    console.error("[fotoffice][alta] no se pudieron enviar los avisos de la solicitud", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }
}

/** Verifica que quien resuelve tenga permiso sobre este workspace. */
async function requireSecretary(): Promise<
  { ok: true; workspaceId: string; user: AuthUser } | { ok: false; error: string }
> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "No tenés permiso para resolver solicitudes." };
  }
  return { ok: true, workspaceId: workspace.id, user };
}

/** Aprueba una solicitud: crea el socio, le asigna número y genera sus cuotas de ingreso. */
export async function approveApplicationAction(
  _prev: ApplicationFormState | undefined,
  formData: FormData,
): Promise<ApplicationFormState> {
  const guard = await requireSecretary();
  if (!guard.ok) return fail(guard.error);

  const applicationId = formData.get("applicationId")?.toString()?.trim();
  if (!applicationId) return fail("Solicitud inválida.");

  let r: Awaited<ReturnType<typeof approveApplication>>;
  try {
    r = await approveApplication({
      applicationId,
      workspaceId: guard.workspaceId,
      resolvedByUserId: guard.user.id,
    });
  } catch (error) {
    if (error instanceof ApprovalError) return fail(error.message);
    console.error("[fotoffice][alta] aprobar falló");
    return fail("No se pudo aprobar la solicitud. Probá de nuevo.");
  }

  revalidatePath("/members/solicitudes");
  revalidatePath("/members");
  revalidatePath(`/members/${r.memberId}`);

  const resumen = `Socio N° ${r.memberNumber} creado. Se generaron ${r.chargeCount} cuotas por $${r.totalArs}.`;

  /*
   * El acceso se da acá, con la aprobación, y no como un trámite aparte.
   *
   * No es una comodidad: las cuotas de ingreso se pagan desde el portal, y el portal exige
   * cuenta. Un socio aprobado sin invitación no tiene por dónde pagar lo que se le acaba de
   * generar, y su solicitud vencería a los 30 días por una puerta que nunca se le abrió.
   *
   * Va un solo email —el de aprobación, que lleva el enlace de activación— en vez de la
   * invitación genérica más un aviso: son el mismo hecho.
   */
  const invitacion = await inviteOneMember(
    { id: guard.workspaceId },
    guard.user,
    r.memberId,
    {
      buildBody: ({ memberFirstName, institution, invitationUrl, signature }) =>
        buildApplicationApprovedEmail({
          firstName: memberFirstName,
          institution,
          memberNumber: r.memberNumber,
          activationUrl: invitationUrl,
          totalLabel: formatMinorArs(decimalArsToMinor(r.totalArs)),
          duesCount: r.chargeCount,
          deadlineLabel: fechaLegible(r.expiresAt),
          includesPrintedCard: r.includesPrintedCard,
          activationTtlLabel: INVITATION_TTL_LABEL,
          signature,
        }),
    },
  );

  if (!invitacion.ok) {
    // La aprobación ya ocurrió: se informa lo que sí pasó y lo que quedó pendiente, con el
    // lugar donde reintentarlo.
    return {
      error: null,
      ok: resumen,
      warn: `El email con el acceso no salió: ${invitacion.error} Reenviálo desde la ficha del socio; sin acceso no puede pagar su ingreso.`,
    };
  }

  return done(`${resumen} Le enviamos a ${invitacion.sentTo} el acceso para activar su cuenta y pagar.`);
}

/** Rechaza una solicitud. El motivo es obligatorio y se le comunica a la persona. */
export async function rejectApplicationAction(
  _prev: ApplicationFormState | undefined,
  formData: FormData,
): Promise<ApplicationFormState> {
  const guard = await requireSecretary();
  if (!guard.ok) return fail(guard.error);

  const applicationId = formData.get("applicationId")?.toString()?.trim();
  const reason = formData.get("reason")?.toString() ?? "";
  if (!applicationId) return fail("Solicitud inválida.");

  let rechazada: Awaited<ReturnType<typeof rejectApplication>>;
  try {
    rechazada = await rejectApplication({
      applicationId,
      workspaceId: guard.workspaceId,
      resolvedByUserId: guard.user.id,
      reason,
    });
  } catch (error) {
    if (error instanceof ApprovalError) return fail(error.message);
    console.error("[fotoffice][alta] rechazar falló");
    return fail("No se pudo rechazar la solicitud. Probá de nuevo.");
  }

  revalidatePath("/members/solicitudes");

  // El motivo es obligatorio justamente para esto. Guardarlo sin comunicarlo convertiría esa
  // exigencia en papeleo.
  const { organizationName, signature } = await loadWorkspaceEmailContext(guard.workspaceId);
  const salida = await sendAndLogEmail({
    to: rechazada.applicant.email,
    templateKey: MEMBERSHIP_EMAIL_KEYS.REJECTED,
    body: buildApplicationRejectedEmail({
      firstName: rechazada.applicant.firstName,
      institution: organizationName,
      reason: reason.trim(),
      signature,
    }),
  });

  if (salida.status !== "SENT") {
    return {
      error: null,
      ok: "Solicitud rechazada.",
      warn: `No pudimos avisarle a ${rechazada.applicant.email}. Quedó registrado para revisarlo; convendría escribirle a mano.`,
    };
  }
  return done(`Solicitud rechazada. Le avisamos a ${rechazada.applicant.email} con el motivo.`);
}
