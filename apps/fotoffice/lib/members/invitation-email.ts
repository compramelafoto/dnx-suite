import type { RenderedEmailSignature } from "@repo/communications/signature";
import { chargePeriodLabel } from "@/lib/membership/charge-labels";
import { INVITATION_TTL_LABEL } from "./invitations";

/**
 * Email de invitación al socio.
 *
 * Función PURA: sin red, sin base y sin variables de entorno, así se verifica que la firma
 * entra una sola vez y que no se filtra vocabulario interno sin enviar nada.
 *
 * Lo escribe una institución para su socio, que no sabe —ni tiene por qué— qué es un
 * workspace o un token.
 *
 * Menciona la cuota SOLO cuando el socio tiene una abierta (`dues`). Un honorario no tiene
 * cargo, y decirle que entre a pagar sería mandarlo a una pantalla que le va a decir que
 * está al día.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type InvitationEmailInput = {
  memberFirstName: string;
  institution: string;
  invitationUrl: string;
  /** Firma institucional ya renderizada. `null` = el workspace todavía no tiene branding. */
  signature: RenderedEmailSignature | null;
  /**
   * Cuota abierta del socio. `null` = no tiene ninguna y el email no habla de pagos.
   *
   * Los importes llegan ya formateados porque el formato de moneda vive en la capa de
   * dinero; acá solo se los escapa y se los ubica en la frase.
   */
  dues?: { period: string; amountLabel: string; dueDateLabel: string } | null;
};

export function buildInvitationEmailBody(input: InvitationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  // El asunto viaja como header, no como HTML: escaparlo mostraría entidades al destinatario.
  const subject = `${input.institution} te invita a acceder a FotoOffice`;

  const name = escapeHtml(input.memberFirstName);
  const institution = escapeHtml(input.institution);
  const url = escapeHtml(input.invitationUrl);
  const plazo = INVITATION_TTL_LABEL;

  const dues = input.dues ?? null;
  const duesText = dues
    ? `Ahí adentro vas a poder pagar tu cuota de ${chargePeriodLabel(dues.period)}: ${dues.amountLabel}, con vencimiento el ${dues.dueDateLabel}.`
    : null;
  const duesHtml = duesText
    ? `\n  <p>${escapeHtml(duesText)}</p>`
    : "";

  const signatureHtml = input.signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${input.signature.html}</div>`
    : "";

  const html = `
<div>
  <p>Hola ${name},</p>
  <p><strong>${institution}</strong> te invita a activar tu acceso a FotoOffice. Desde allí vas a poder acceder a la información y los servicios que la institución pone a disposición de sus socios.</p>${duesHtml}
  <p style="margin:24px 0;">
    <a href="${url}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Activar mi acceso</a>
  </p>
  <p style="font-size:13px;color:#6b7280;">Si el botón no funciona, copiá y pegá esta dirección en tu navegador:<br>${url}</p>
  <p style="font-size:13px;color:#6b7280;">El enlace vence en ${plazo}.</p>
  <p style="font-size:13px;color:#6b7280;">Si no esperabas esta invitación, ignorá este mensaje.</p>${signatureHtml}
</div>
`.trim();

  // El texto plano se arma aparte, no se deriva del HTML: así no arrastra marcado.
  const text = [
    `Hola ${input.memberFirstName},`,
    "",
    `${input.institution} te invita a activar tu acceso a FotoOffice. Desde allí vas a poder acceder a la información y los servicios que la institución pone a disposición de sus socios.`,
    ...(duesText ? ["", duesText] : []),
    "",
    "Activar mi acceso:",
    input.invitationUrl,
    "",
    `El enlace vence en ${plazo}.`,
    "",
    "Si no esperabas esta invitación, ignorá este mensaje.",
    ...(input.signature ? ["", input.signature.text] : []),
  ].join("\n");

  return { subject, html, text };
}
