"use server";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { COVERAGE_EMAIL_KEYS } from "@/lib/communications/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { parseConsents } from "@/lib/coverages/consents";
import {
  buildCoordinatorAlertEmail,
  buildRequestReceivedEmail,
} from "@/lib/coverages/emails";
import { fechaArgentina } from "@/lib/coverages/format";
import { hashOrigen } from "@/lib/coverages/rate-limit";
import { parseCoverageRequest } from "@/lib/coverages/request-form";
import {
  countRecentSubmissions,
  findDuplicateRequest,
  loadSettings,
} from "@/lib/coverages/repository";
import { planSubmission } from "@/lib/coverages/submit-plan";
import { saveCoverageRequest } from "@/lib/coverages/submit";

export type CoverageRequestFormState = {
  error: string | null;
  ok: string | null;
  publicCode?: string;
};

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * El envío del formulario público.
 *
 * Público a propósito: quien pide una cobertura no tiene cuenta. Lo que protege este endpoint
 * no es una sesión sino que **nada ocurre hasta que una persona evalúe**: una solicitud es un
 * pedido, no un compromiso.
 */
export async function submitCoverageRequestAction(
  workspaceSlug: string,
  _prev: CoverageRequestFormState | undefined,
  formData: FormData,
): Promise<CoverageRequestFormState> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, contactEmail: true },
  });
  if (!branding) return { error: "No encontramos la organización.", ok: null };

  const parsed = parseCoverageRequest(readForm(formData));
  if (!parsed.ok) return { error: parsed.error, ok: null };

  const settings = await loadSettings(branding.workspaceId);

  const consents = parseConsents(readForm(formData), settings.consentTextVersion);
  if (!consents.ok) return { error: consents.error, ok: null };

  // La sal sale del entorno: sin ella el hash de una IPv4 se revierte con una tabla, porque
  // el espacio de direcciones es chico.
  const cabeceras = await headers();
  const originHash = hashOrigen(
    cabeceras.get("x-forwarded-for")?.split(",")[0] ?? null,
    process.env.COVERAGE_ORIGIN_SALT ?? branding.workspaceId,
  );

  const [recientes, duplicada] = await Promise.all([
    countRecentSubmissions({
      workspaceId: branding.workspaceId,
      email: parsed.data.contactEmail,
      originHash,
    }),
    findDuplicateRequest({
      workspaceId: branding.workspaceId,
      email: parsed.data.contactEmail,
      startsAt: parsed.data.startsAt,
    }),
  ]);

  const plan = planSubmission({ settings, recientes, duplicada, parsed: parsed.data });
  if (plan.kind === "RECHAZAR") return { error: plan.error, ok: null };
  if (plan.kind === "YA_EXISTE") {
    return {
      error: null,
      ok: "Ya tenemos este pedido y lo estamos revisando. Te avisamos por correo.",
      publicCode: plan.publicCode,
    };
  }

  const guardada = await saveCoverageRequest({
    workspaceId: branding.workspaceId,
    parsed: parsed.data,
    consents: consents.data,
    settings,
    originHash,
    userAgent: cabeceras.get("user-agent")?.slice(0, 500) ?? null,
  });

  const contexto = await loadWorkspaceEmailContext(branding.workspaceId);
  const base = appUrl();
  const trackingUrl = base ? `${base}/sc/${guardada.rawToken}` : "";

  // Los avisos salen después del hecho consumado y no pueden voltearlo: `sendAndLogEmail`
  // nunca lanza, y el resultado queda registrado para poder responder «¿le avisamos?».
  await sendAndLogEmail({
    to: parsed.data.contactEmail,
    templateKey: COVERAGE_EMAIL_KEYS.RECEIVED,
    body: buildRequestReceivedEmail({
      context: contexto,
      publicCode: guardada.publicCode,
      eventTitle: parsed.data.eventTitle,
      contactName: parsed.data.contactName,
      trackingUrl,
    }),
  });

  const destinatarios = settings.notifyEmails.length
    ? settings.notifyEmails
    : branding.contactEmail
      ? [branding.contactEmail]
      : [];

  for (const destino of destinatarios) {
    await sendAndLogEmail({
      to: destino,
      templateKey: COVERAGE_EMAIL_KEYS.ALERT,
      body: buildCoordinatorAlertEmail({
        publicCode: guardada.publicCode,
        eventTitle: parsed.data.eventTitle,
        orgName: parsed.data.orgName,
        // `DD.MM.AAAA` en zona Argentina, no el formato de `toLocaleDateString`: es la
        // misma regla de fechas del resto del módulo (ver `restricciones-globales.md`).
        startsAtLabel: fechaArgentina(parsed.data.startsAt),
        panelUrl: base ? `${base}/coberturas/${guardada.requestId}` : "",
      }),
    });
  }

  return {
    error: null,
    ok: "Recibimos tu pedido. Te mandamos un correo con el número y un enlace para seguirlo.",
    publicCode: guardada.publicCode,
  };
}
