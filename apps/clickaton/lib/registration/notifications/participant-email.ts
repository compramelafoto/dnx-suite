import { sendIdentityEmail, type IdentityEmailResult } from "@repo/auth";
import { siteConfig } from "@/config/site";

export type ParticipantEmailKind =
  | "reservation_created"
  | "payment_confirmed"
  | "free_confirmed"
  | "hold_expired";

function testRecipientOverride(to: string): string {
  const override = process.env.CLICKATON_EMAIL_TEST_TO?.trim();
  if (override) return override;
  const lower = to.toLowerCase();
  if (
    lower.endsWith(".test") ||
    lower.includes("+test@") ||
    lower.endsWith("@clickaton.staging.test") ||
    process.env.CLICKATON_EMAIL_ALLOW_ANY === "true"
  ) {
    return to;
  }
  return (
    process.env.CLICKATON_EMAIL_FALLBACK_TO?.trim() ||
    "clickaton-funnel-test@example.test"
  );
}

function baseUrl(): string {
  return (
    process.env.CLICKATON_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "") ||
    siteConfig.url
  );
}

export type ParticipantFunnelEmailBuilt = IdentityEmailResult & {
  deliveredTo: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendParticipantFunnelEmail(input: {
  kind: ParticipantEmailKind;
  to: string;
  participantName: string;
  editionName: string;
  editionSlug: string;
  registrationId: string;
  accessToken?: string | null;
  amountLabel?: string | null;
  holdExpiresAt?: Date | null;
  city?: string | null;
  startAt?: Date | null;
  includedItemLabels?: string[] | null;
  visibleCode?: string | null;
  instagramHandle?: string | null;
  paymentStatus?: string | null;
  /** Build subject/body only — caller owns durable send. */
  dryRunBuildOnly?: boolean;
}): Promise<ParticipantFunnelEmailBuilt> {
  const deliveredTo = testRecipientOverride(input.to);
  const accountUrl = `${baseUrl()}/mi-cuenta`;
  const summaryUrl = input.accessToken
    ? `${baseUrl()}/maratones/${input.editionSlug}/inscripcion/resumen/${input.registrationId}?t=${encodeURIComponent(input.accessToken)}`
    : `${baseUrl()}/mi-cuenta/inscripciones/${input.registrationId}`;
  const support =
    "Soporte Clickatón: respondé este email o escribinos desde Mi cuenta / Contacto.";
  const included =
    input.includedItemLabels?.filter((l) => l.trim().length > 0) ?? [];
  const includedText =
    included.length > 0 ? `Incluido: ${included.join("; ")}` : "";
  const includedHtml =
    included.length > 0
      ? `<p>Incluido: ${included.map(escapeHtml).join("; ")}</p>`
      : "";

  let subject = "";
  let text = "";
  let html = "";

  switch (input.kind) {
    case "reservation_created":
      subject = `[TEST] Reserva creada — ${input.editionName}`;
      text = [
        `Hola ${input.participantName},`,
        ``,
        `Tu reserva para ${input.editionName} está pendiente de pago.`,
        input.amountLabel ? `Importe: ${input.amountLabel}` : "",
        includedText,
        input.holdExpiresAt
          ? `Vence: ${input.holdExpiresAt.toISOString()}`
          : "",
        `Continuar: ${summaryUrl}`,
        support,
      ]
        .filter(Boolean)
        .join("\n");
      html = `<p>Hola ${escapeHtml(input.participantName)},</p><p>Tu reserva para <strong>${escapeHtml(input.editionName)}</strong> está pendiente de pago.</p>${includedHtml}<p><a href="${summaryUrl}">Continuar al pago</a></p><p>${escapeHtml(support)}</p>`;
      break;
    case "payment_confirmed":
    case "free_confirmed":
      subject = `[TEST] Inscripción confirmada — ${input.editionName}`;
      text = [
        `Hola ${input.participantName},`,
        ``,
        `Tu inscripción a ${input.editionName} está CONFIRMADA.`,
        input.paymentStatus ? `Estado de pago: ${input.paymentStatus}` : "Estado de pago: APPROVED",
        input.visibleCode ? `Número de participante: ${input.visibleCode}` : "",
        input.instagramHandle ? `Instagram: ${input.instagramHandle}` : "",
        input.city ? `Ciudad: ${input.city}` : "",
        input.startAt ? `Fecha: ${input.startAt.toISOString()}` : "",
        includedText,
        `Ver inscripción: ${summaryUrl}`,
        `Mi cuenta: ${accountUrl}`,
        `Ahí podés ver tu QR y credencial.`,
        support,
      ]
        .filter(Boolean)
        .join("\n");
      html = [
        `<p>Hola ${escapeHtml(input.participantName)},</p>`,
        `<p>Tu inscripción a <strong>${escapeHtml(input.editionName)}</strong> está <strong>CONFIRMADA</strong>.</p>`,
        input.visibleCode
          ? `<p>Número de participante: <strong>${escapeHtml(input.visibleCode)}</strong></p>`
          : "",
        input.instagramHandle
          ? `<p>Instagram: ${escapeHtml(input.instagramHandle)}</p>`
          : "",
        input.startAt
          ? `<p>Fecha: ${escapeHtml(input.startAt.toISOString())}</p>`
          : "",
        includedHtml,
        `<p><a href="${summaryUrl}">Ver inscripción</a> · <a href="${accountUrl}">Mi cuenta</a></p>`,
        `<p>Desde ahí descargás QR y credencial.</p>`,
        `<p>${escapeHtml(support)}</p>`,
      ]
        .filter(Boolean)
        .join("");
      break;
    case "hold_expired":
      subject = `[TEST] Reserva vencida — ${input.editionName}`;
      text = [
        `Hola ${input.participantName},`,
        ``,
        `Tu reserva para ${input.editionName} venció y el cupo fue liberado.`,
        `Si hay cupo, podés iniciar una nueva inscripción: ${baseUrl()}/maratones/${input.editionSlug}/inscripcion`,
        support,
      ].join("\n");
      html = `<p>Hola ${escapeHtml(input.participantName)},</p><p>Tu reserva para <strong>${escapeHtml(input.editionName)}</strong> venció.</p><p><a href="${baseUrl()}/maratones/${input.editionSlug}/inscripcion">Nueva inscripción</a></p>`;
      break;
  }

  if (input.dryRunBuildOnly) {
    return {
      sent: false,
      skipped: true,
      reason: "dry_run_build_only",
      deliveredTo,
      subject,
      text,
      html,
    };
  }

  const result = await sendIdentityEmail({
    to: deliveredTo,
    subject,
    text,
    html,
    templateKey: `clickaton_${input.kind}`,
  });

  return { ...result, deliveredTo, subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
