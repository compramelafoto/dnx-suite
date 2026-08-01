import { sendIdentityEmail, type IdentityEmailResult } from "@repo/auth";
import { siteConfig } from "@/config/site";
import {
  POST_PAYMENT_ACCREDITATION,
  POST_PAYMENT_CAPTURE_WARNING,
  POST_PAYMENT_PAYMENT_SEAL,
  POST_PAYMENT_SCHEDULE,
  POST_PAYMENT_SUBTITLE,
  POST_PAYMENT_TITLE,
  PRODUCTION_SITE_ORIGIN,
} from "@/lib/registration/ui/post-payment-public-copy";

export type ParticipantEmailKind =
  | "reservation_created"
  | "payment_confirmed"
  | "free_confirmed"
  | "hold_expired";

/**
 * Destinatario efectivo.
 * En audiencia Production (maratonfotografica.com / VERCEL_ENV=production)
 * SIEMPRE se envía al email real del participante — nunca al sink de test.
 * Staging/dev: permite TEST_TO / FALLBACK / ALLOW_ANY para no spamear terceros.
 */
function resolveRecipient(to: string): string {
  if (isProductionAudience()) {
    return to.trim();
  }
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
  if (isProductionAudience()) {
    return PRODUCTION_SITE_ORIGIN;
  }
  return (
    process.env.CLICKATON_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "") ||
    siteConfig.url
  );
}

function isProductionAudience(): boolean {
  const env = process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV?.trim();
  if (env === "production") return true;
  const configured =
    process.env.CLICKATON_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "") ||
    siteConfig.url;
  return /maratonfotografica\.com/i.test(configured);
}

function subjectLine(body: string): string {
  return isProductionAudience() ? body : `[TEST] ${body}`;
}

function formatEditionDate(value: Date): string {
  return value.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Cordoba",
  });
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
  const deliveredTo = resolveRecipient(input.to);
  const accountUrl = `${baseUrl()}/mi-cuenta`;
  const summaryUrl = input.accessToken
    ? `${baseUrl()}/maratones/${input.editionSlug}/inscripcion/resumen/${input.registrationId}?t=${encodeURIComponent(input.accessToken)}`
    : `${baseUrl()}/mi-cuenta/inscripciones/${input.registrationId}`;
  const credentialUrl = `${baseUrl()}/mi-cuenta/inscripciones/${input.registrationId}`;
  const activateUrl = input.accessToken
    ? `${baseUrl()}/maratones/${input.editionSlug}/inscripcion/activar/${input.registrationId}?t=${encodeURIComponent(input.accessToken)}`
    : accountUrl;
  const termsUrl = `${baseUrl()}/legal/terminos`;
  const support =
    "Soporte Clickatón: escribinos desde Contacto en maratonfotografica.com o respondé este email.";
  const included =
    input.includedItemLabels?.filter((l) => l.trim().length > 0) ?? [];
  const includedText =
    included.length > 0 ? `Incluido: ${included.join("; ")}` : "";
  const includedHtml =
    included.length > 0
      ? `<p style="margin:0 0 12px;color:#333">Incluido: ${included.map(escapeHtml).join("; ")}</p>`
      : "";

  let subject = "";
  let text = "";
  let html = "";

  const editionDate = input.startAt ? formatEditionDate(input.startAt) : null;
  const brand = "#F9B114";

  switch (input.kind) {
    case "reservation_created":
      subject = subjectLine(`Reserva creada — ${input.editionName}`);
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
      subject = subjectLine(`¡Inscripción confirmada! — ${input.editionName}`);
      text = [
        POST_PAYMENT_TITLE,
        ``,
        `Hola ${input.participantName},`,
        POST_PAYMENT_SUBTITLE,
        POST_PAYMENT_PAYMENT_SEAL,
        input.visibleCode ? `Número de participante: ${input.visibleCode}` : "",
        input.instagramHandle
          ? `Instagram: @${input.instagramHandle.replace(/^@/, "")}`
          : "",
        includedText,
        ``,
        POST_PAYMENT_ACCREDITATION.heading,
        `Lugar: ${POST_PAYMENT_ACCREDITATION.venueName} — ${POST_PAYMENT_ACCREDITATION.city}`,
        `Fecha: ${POST_PAYMENT_ACCREDITATION.dateLabel}`,
        `Horario de acreditación: ${POST_PAYMENT_ACCREDITATION.accreditationWindow}`,
        `Charla introductoria: ${POST_PAYMENT_ACCREDITATION.talkWindow}`,
        POST_PAYMENT_ACCREDITATION.presentWithQr,
        ``,
        `CRONOGRAMA`,
        ...POST_PAYMENT_SCHEDULE.map((row) => `${row.time} ${row.label}`),
        POST_PAYMENT_CAPTURE_WARNING,
        ``,
        `Ver mi QR / credencial: ${credentialUrl}`,
        `Activar / ir a Mi cuenta: ${activateUrl}`,
        `Bases y Condiciones: ${termsUrl}`,
        support,
      ]
        .filter(Boolean)
        .join("\n");
      html = buildConfirmedHtml({
        brand,
        participantName: input.participantName,
        editionName: input.editionName,
        visibleCode: input.visibleCode,
        instagramHandle: input.instagramHandle,
        editionDate,
        includedHtml,
        credentialUrl,
        activateUrl,
        accountUrl,
        termsUrl,
        summaryUrl,
        support,
      });
      break;
    case "hold_expired":
      subject = subjectLine(`Reserva vencida — ${input.editionName}`);
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

function buildConfirmedHtml(input: {
  brand: string;
  participantName: string;
  editionName: string;
  visibleCode?: string | null;
  instagramHandle?: string | null;
  editionDate: string | null;
  includedHtml: string;
  credentialUrl: string;
  activateUrl: string;
  accountUrl: string;
  termsUrl: string;
  summaryUrl: string;
  support: string;
}): string {
  const ig = input.instagramHandle
    ? `@${input.instagramHandle.replace(/^@/, "")}`
    : null;
  const btn = (href: string, label: string, primary = false) =>
    `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;${
      primary
        ? `background:${input.brand};color:#111;`
        : `background:transparent;color:#111;border:2px solid ${input.brand};`
    }">${escapeHtml(label)}</a>`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#111;padding:20px 24px;border-bottom:4px solid ${input.brand};">
        <p style="margin:0;color:${input.brand};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Clickatón</p>
        <h1 style="margin:10px 0 0;color:#fff;font-size:26px;line-height:1.2;">${escapeHtml(POST_PAYMENT_TITLE)}</h1>
        <p style="margin:10px 0 0;color:#ddd;font-size:15px;">${escapeHtml(POST_PAYMENT_SUBTITLE)}</p>
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="display:inline-block;margin:0 0 16px;padding:6px 12px;background:${input.brand};color:#111;font-size:12px;font-weight:800;letter-spacing:0.06em;border-radius:999px;">${escapeHtml(POST_PAYMENT_PAYMENT_SEAL)}</p>
        <p style="margin:0 0 8px;color:#111;">Hola <strong>${escapeHtml(input.participantName)}</strong>,</p>
        <p style="margin:0 0 8px;color:#333;">Edición: <strong>${escapeHtml(input.editionName)}</strong></p>
        ${input.visibleCode ? `<p style="margin:0 0 8px;color:#111;">Número de participante: <strong style="color:${input.brand}">${escapeHtml(input.visibleCode)}</strong></p>` : ""}
        ${ig ? `<p style="margin:0 0 8px;color:#333;">Instagram: ${escapeHtml(ig)}</p>` : ""}
        ${input.editionDate ? `<p style="margin:0 0 8px;color:#333;">Fecha del evento: <strong>${escapeHtml(input.editionDate)}</strong></p>` : ""}
        ${input.includedHtml}
        <div style="margin:20px 0;padding:16px;border:1px solid #eee;border-radius:12px;background:#fafafa;">
          <p style="margin:0 0 8px;color:${input.brand};font-size:12px;font-weight:800;letter-spacing:0.08em;">${escapeHtml(POST_PAYMENT_ACCREDITATION.heading)}</p>
          <p style="margin:0 0 4px;color:#111;"><strong>${escapeHtml(POST_PAYMENT_ACCREDITATION.venueName)}</strong> — ${escapeHtml(POST_PAYMENT_ACCREDITATION.city)}</p>
          <p style="margin:0 0 4px;color:#333;">${escapeHtml(POST_PAYMENT_ACCREDITATION.dateLabel)}</p>
          <p style="margin:0 0 4px;color:#333;">Acreditación: ${escapeHtml(POST_PAYMENT_ACCREDITATION.accreditationWindow)}</p>
          <p style="margin:0 0 8px;color:#333;">Charla introductoria: ${escapeHtml(POST_PAYMENT_ACCREDITATION.talkWindow)}</p>
          <p style="margin:0;color:#555;font-size:13px;">${escapeHtml(POST_PAYMENT_ACCREDITATION.presentWithQr)}</p>
          <p style="margin:8px 0 0;color:#888;font-size:11px;">${escapeHtml(POST_PAYMENT_ACCREDITATION.venueAddressConfigFlag)} — dirección postal exacta pendiente en configuración.</p>
        </div>
        <div style="margin:0 0 20px;padding:16px;border:1px solid #eee;border-radius:12px;">
          <p style="margin:0 0 8px;color:${input.brand};font-size:12px;font-weight:800;letter-spacing:0.08em;">CRONOGRAMA</p>
          ${POST_PAYMENT_SCHEDULE.map((row) => `<p style="margin:0 0 4px;color:#333;">${escapeHtml(row.time)} · ${escapeHtml(row.label)}</p>`).join("")}
          <p style="margin:8px 0 0;color:#111;font-size:13px;"><strong>${escapeHtml(POST_PAYMENT_CAPTURE_WARNING)}</strong></p>
        </div>
        <p style="margin:0 0 16px;">
          ${btn(input.credentialUrl, "VER MI QR DE ACREDITACIÓN", true)}
          ${btn(input.activateUrl, "CREAR / ACTIVAR MI CUENTA DNX")}
          ${btn(input.summaryUrl, "Ver mi inscripción")}
          ${btn(input.termsUrl, "Bases y Condiciones")}
        </p>
        <p style="margin:0;color:#777;font-size:12px;">${escapeHtml(input.support)}</p>
        <p style="margin:12px 0 0;color:#999;font-size:11px;">maratonfotografica.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
