"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { parseApplication } from "@/lib/membership/application";
import { approveApplication, rejectApplication } from "@/lib/membership/repository";
import { ApprovalError } from "@/lib/membership/approve";

export type ApplicationFormState = { error: string | null; ok: string | null };

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
    select: { workspaceId: true },
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

  return done("Recibimos tu solicitud. La Secretaría la va a revisar y te avisamos por email.");
}

/** Verifica que quien resuelve tenga permiso sobre este workspace. */
async function requireSecretary(): Promise<
  { ok: true; workspaceId: string; userId: number } | { ok: false; error: string }
> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "No tenés permiso para resolver solicitudes." };
  }
  return { ok: true, workspaceId: workspace.id, userId: user.id };
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

  try {
    const r = await approveApplication({
      applicationId,
      workspaceId: guard.workspaceId,
      resolvedByUserId: guard.userId,
    });
    revalidatePath("/members/solicitudes");
    revalidatePath("/members");
    return done(
      `Socio N° ${r.memberNumber} creado. Se generaron ${r.chargeCount} cuotas por $${r.totalArs}.`,
    );
  } catch (error) {
    if (error instanceof ApprovalError) return fail(error.message);
    console.error("[fotoffice][alta] aprobar falló");
    return fail("No se pudo aprobar la solicitud. Probá de nuevo.");
  }
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

  try {
    await rejectApplication({
      applicationId,
      workspaceId: guard.workspaceId,
      resolvedByUserId: guard.userId,
      reason,
    });
    revalidatePath("/members/solicitudes");
    return done("Solicitud rechazada.");
  } catch (error) {
    if (error instanceof ApprovalError) return fail(error.message);
    console.error("[fotoffice][alta] rechazar falló");
    return fail("No se pudo rechazar la solicitud. Probá de nuevo.");
  }
}
