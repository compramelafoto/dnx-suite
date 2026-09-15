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
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

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

  // La pantalla (`app/w/[workspaceSlug]/coberturas/solicitar/page.tsx`) ya devuelve 404 si el
  // módulo está apagado, pero eso sólo esconde el formulario: una referencia a esta Server
  // Action guardada en una pestaña vieja —tomada mientras el módulo estaba encendido— sigue
  // siendo invocable directamente, sin pasar por la pantalla. Por eso el módulo se comprueba
  // acá también, antes que cualquier otra cosa.
  //
  // Mismo mensaje que cuando el formulario está cerrado, a propósito: quien envía no tiene
  // por qué distinguir "la organización apagó el módulo" de "cerró el formulario". Para quien
  // está afuera, es la misma respuesta.
  const moduloEncendido = await isModuleEnabledForWorkspace(
    branding.workspaceId,
    COVERAGES_MODULE_KEY,
  );
  if (!moduloEncendido) {
    return { error: "Las solicitudes no están abiertas en este momento.", ok: null };
  }

  const parsed = parseCoverageRequest(readForm(formData));
  if (!parsed.ok) return { error: parsed.error, ok: null };

  const settings = await loadSettings(branding.workspaceId);

  const consents = parseConsents(readForm(formData), settings.consentTextVersion);
  if (!consents.ok) return { error: consents.error, ok: null };

  // La sal sale del entorno (`COVERAGE_ORIGIN_SALT`). Si no está configurada, se usa el
  // `workspaceId` como respaldo: sirve porque es un cuid, no un valor público ni adivinable,
  // pero conviene configurar la variable igual para que la sal no dependa de un dato del
  // dominio. El `console.warn` deja el olvido visible en los registros en vez de que se
  // note sólo el día que alguien necesite ver por qué el respaldo entró en juego.
  if (!process.env.COVERAGE_ORIGIN_SALT) {
    console.warn(
      "COVERAGE_ORIGIN_SALT no está configurada; usando branding.workspaceId como respaldo.",
    );
  }
  const cabeceras = await headers();
  const originHash = hashOrigen(
    cabeceras.get("x-forwarded-for")?.split(",")[0] ?? null,
    process.env.COVERAGE_ORIGIN_SALT ?? branding.workspaceId,
  );

  // Antes de consultar la base: si el formulario está cerrado, cortar acá evita las dos
  // consultas de abajo en cada POST. Esto es sólo una optimización de costo — el control
  // real, el que garantiza que la comprobación exista aunque alguien reordene esta action,
  // es el que hace `planSubmission` más abajo. No se borra esa comprobación.
  if (!settings.publicFormEnabled) {
    return { error: "Las solicitudes no están abiertas en este momento.", ok: null };
  }

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

  // Una solicitud que nadie mira es peor que una que falló, porque nadie la va a reclamar:
  // si no hay ni `notifyEmails` ni `contactEmail`, la solicitud queda guardada pero el
  // aviso a la coordinación no sale para nadie. Sin este `console.warn` eso pasaría en
  // silencio, sin dejar ni rastro en los registros.
  if (destinatarios.length === 0) {
    console.warn(
      `Solicitud ${guardada.publicCode} del workspace ${branding.workspaceId} guardada, ` +
        "pero no hay a quién avisarle: no hay notifyEmails ni contactEmail configurados.",
    );
  }

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
