"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import {
  FOTOFFICE_ORGANIZATION_TYPE_IDS,
  FOTOFFICE_SPECIALTY_IDS,
} from "@/lib/onboarding-constants";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { buildTestEmailBody } from "@/lib/communications/test-email";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { recordTestEmailAttempt } from "@/lib/communications/email-log";
import { checkTestEmailRateLimit } from "@/lib/communications/test-email-rate-limit";
import {
  EMAIL_SIGNATURE_NOTE_MAX,
  SINGLE_EMAIL_RE,
  TEST_EMAIL_MESSAGES,
} from "@/lib/communications/constants";

const PUBLIC_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SettingsState = { error: string | null; ok?: boolean };

export type TestEmailStatus =
  | "SENT"
  | "FORBIDDEN"
  | "NOT_CONFIRMED"
  | "INVALID_EMAIL"
  | "RATE_LIMITED"
  | "CONFIGURATION_ERROR"
  | "PROVIDER_REJECTED"
  | "INTERNAL_ERROR";

export type TestEmailState = { status: TestEmailStatus; message: string };

const ACTIVITY_IDS = FOTOFFICE_ORGANIZATION_TYPE_IDS;

/**
 * Envía UN email de prueba a la dirección que escribió un administrador.
 *
 * Existe para validar la cadena real de envío —clave, remitente, dominio verificado y
 * firma— sin crear un curso ni una inscripción. Usa el mismo transporte que las
 * comunicaciones reales: si usara uno propio, no probaría nada.
 *
 * Toda la verificación vive acá adentro, no en la UI: una server action es alcanzable por
 * POST directo, así que ocultar el panel no es un control de acceso.
 */
export async function sendTestEmailAction(
  _prev: TestEmailState | undefined,
  formData: FormData,
): Promise<TestEmailState> {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
    select: { role: true },
  });
  if (!membership || !canManageWorkspaceSettings(membership.role)) {
    return { status: "FORBIDDEN", message: TEST_EMAIL_MESSAGES.FORBIDDEN };
  }

  // La confirmación en dos pasos también se exige del lado del servidor: si no, un POST
  // directo se saltearía el paso que la UI impone.
  if (formData.get("confirm")?.toString() !== "yes") {
    return { status: "NOT_CONFIRMED", message: TEST_EMAIL_MESSAGES.NOT_CONFIRMED };
  }

  // El destinatario siempre se escribe a mano. Nunca se toma del branding ni del primer
  // OWNER: mandar a una dirección que la persona no tipeó es mandar a ciegas.
  const to = formData.get("to")?.toString().trim() ?? "";
  if (!SINGLE_EMAIL_RE.test(to)) {
    return { status: "INVALID_EMAIL", message: TEST_EMAIL_MESSAGES.INVALID_EMAIL };
  }

  const limit = await checkTestEmailRateLimit({ userId: user.id });
  if (!limit.allowed) {
    // No se registra: un intento bloqueado no debe consumir cupo ni alargar el bloqueo.
    return { status: "RATE_LIMITED", message: TEST_EMAIL_MESSAGES.RATE_LIMITED };
  }

  const { organizationName, signature } = await loadWorkspaceEmailContext(ensured.workspaceId);
  const { subject, html, text } = buildTestEmailBody({
    workspaceName: organizationName,
    signature,
    sentAt: new Date(),
  });

  const outcome = await sendTransactionalEmail({ to, subject, html, text });

  await recordTestEmailAttempt({
    userId: user.id,
    to,
    subject,
    status: outcome.status,
    providerId: outcome.status === "SENT" ? outcome.providerId : null,
    detail: outcome.status === "SENT" ? null : outcome.detail,
  });

  return { status: outcome.status, message: TEST_EMAIL_MESSAGES[outcome.status] };
}

export async function updateWorkspaceSettingsAction(
  _prev: SettingsState | undefined,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId },
    },
    select: { role: true },
  });
  if (!membership || !canManageWorkspaceSettings(membership.role)) {
    return { error: "No tenés permiso para editar este workspace." };
  }

  const commercialName = formData.get("commercialName")?.toString()?.trim() || "";
  const displayName = formData.get("displayName")?.toString()?.trim() || "";
  const publicSlug = formData.get("publicSlug")?.toString()?.trim().toLowerCase() || "";
  const contactEmail = formData.get("contactEmail")?.toString()?.trim() || null;
  const phone = formData.get("phone")?.toString()?.trim() || null;
  const whatsapp = formData.get("whatsapp")?.toString()?.trim() || null;
  const city = formData.get("city")?.toString()?.trim() || null;
  const province = formData.get("province")?.toString()?.trim() || null;
  const country = formData.get("country")?.toString()?.trim() || null;
  const website = formData.get("website")?.toString()?.trim() || null;
  const instagram = formData.get("instagram")?.toString()?.trim() || null;
  // Texto plano: se recorta el borde pero se preservan los saltos de línea internos.
  // Las etiquetas que pegue el administrador se guardan como texto — el escapado es del
  // renderer, no de acá.
  const emailSignatureNote = formData.get("emailSignatureNote")?.toString()?.trim() || null;
  const activityType = formData.get("activityType")?.toString()?.trim() || "";
  const logoUrl = formData.get("logoUrl")?.toString()?.trim() || null;
  const coverImageUrl = formData.get("coverImageUrl")?.toString()?.trim() || null;
  const specialties = formData
    .getAll("specialties")
    .map(String)
    .filter((id) => FOTOFFICE_SPECIALTY_IDS.has(id as never));

  if (!commercialName) return { error: "El nombre comercial es obligatorio." };
  if (emailSignatureNote && emailSignatureNote.length > EMAIL_SIGNATURE_NOTE_MAX) {
    return {
      error: `La nota del pie de los emails no puede superar los ${EMAIL_SIGNATURE_NOTE_MAX} caracteres.`,
    };
  }
  if (!ACTIVITY_IDS.has(activityType)) return { error: "Tipo de organización inválido." };
  if (publicSlug.length < 2 || publicSlug.length > 80 || !PUBLIC_SLUG_RE.test(publicSlug)) {
    return { error: "Slug público inválido." };
  }

  const slugOwner = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug },
    select: { workspaceId: true },
  });
  if (slugOwner && slugOwner.workspaceId !== ensured.workspaceId) {
    return { error: "Ese slug público ya está en uso por otro workspace." };
  }

  await prisma.fotofficeWorkspaceBranding.update({
    where: { workspaceId: ensured.workspaceId },
    data: {
      commercialName,
      publicSlug,
      contactEmail,
      phone,
      whatsapp,
      city,
      province,
      country,
      website,
      instagram,
      emailSignatureNote,
      activityType,
      specialties,
      logoUrl,
      coverImageUrl,
    },
  });
  await prisma.workspace.update({
    where: { id: ensured.workspaceId },
    data: { name: commercialName },
  });
  if (displayName) {
    await prisma.fotofficePhotographerProfile.upsert({
      where: { userId: user.id },
      update: { displayName, phone },
      create: { userId: user.id, displayName, phone },
    });
  }

  revalidatePath("/workspace");
  revalidatePath("/workspace/configuracion");
  revalidatePath("/w");
  return { error: null, ok: true };
}
