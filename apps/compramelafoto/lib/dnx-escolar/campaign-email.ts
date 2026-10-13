/**
 * Correo de la campaña de DNX Estudio a colegios. Funciones puras: arman asunto, HTML,
 * texto plano y encabezados a partir del nombre de la institución. El texto del cuerpo es
 * fijo (lo definió Daniel); sólo cambian el saludo y los enlaces.
 */

export const DNX_ESCOLAR_CAMPAIGN_KEY = "dnx-escolar-2026-10";
export const DNX_ESCOLAR_CONTACT_EMAIL = "dnxfotografia@gmail.com";
export const DNX_ESCOLAR_FROM_NAME = "Daniel Cuart | DNX Estudio";
export const DNX_ESCOLAR_FROM_EMAIL = "info@compramelafoto.com";
export const DNX_ESCOLAR_LANDING_URL = "https://www.compramelafoto.com/dnx/escolar";
export const DNX_ESCOLAR_SUBJECT = "Fotografía escolar sin gestionar cobros";

export type CampaignEmailInput = {
  institutionName: string;
  landingUrl?: string;
  contactEmail?: string;
  campaignKey?: string;
};

export type CampaignEmail = {
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
  headers: Record<string, string>;
  proposalUrl: string;
  mailtoUrl: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Quita saltos de línea y caracteres de control: evita inyectar encabezados. */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildProposalUrl(landingUrl: string, campaignKey: string): string {
  const url = new URL(landingUrl);
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", campaignKey);
  url.searchParams.set("utm_content", "conocer-la-propuesta");
  return url.toString();
}

export function buildMailtoUrl(contactEmail: string, institutionName: string): string {
  const subject = `Consulta fotografía escolar — ${sanitizeHeaderValue(institutionName)}`;
  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
}

export function buildCampaignEmail(input: CampaignEmailInput): CampaignEmail {
  const institution = sanitizeHeaderValue(input.institutionName);
  if (!institution) throw new Error("Falta el nombre de la institución");
  const contactEmail = input.contactEmail ?? DNX_ESCOLAR_CONTACT_EMAIL;
  const proposalUrl = buildProposalUrl(
    input.landingUrl ?? DNX_ESCOLAR_LANDING_URL,
    input.campaignKey ?? DNX_ESCOLAR_CAMPAIGN_KEY
  );
  const mailtoUrl = buildMailtoUrl(contactEmail, institution);
  const unsubscribeMailto = `mailto:${contactEmail}?subject=${encodeURIComponent(`Baja — ${institution}`)}`;

  const p = 'style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#1f2937"';
  const link = 'style="color:#0f766e;font-weight:600;text-decoration:underline"';
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(DNX_ESCOLAR_SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:560px;margin:0 auto;padding:24px 18px;font-family:Arial,Helvetica,sans-serif">
<p ${p}>Hola, equipo de ${escapeHtml(institution)}:</p>
<p ${p}>Soy Daniel Cuart, fotógrafo de DNX Estudio, en Funes. Ofrecemos fotografía escolar con un sistema que gestiona ventas, cobros y entregas, con pagos 100% virtuales y una comisión acordada para el colegio, registrada de forma transparente.</p>
<p ${p}><a href="${escapeHtml(proposalUrl)}" ${link}>Conocer la propuesta</a> &middot; <a href="${escapeHtml(mailtoUrl)}" ${link}>Escribirme por email</a></p>
<p ${p}>Atendemos en San José 1672, Local 5, Funes.</p>
<p ${p}>Daniel Cuart | DNX Estudio</p>
<p style="margin:22px 0 0 0;font-size:12px;line-height:1.4;color:#6b7280">Si preferís no recibir más mensajes, respondé «baja».</p>
</div>
</body></html>`;

  const text = [
    `Hola, equipo de ${institution}:`,
    "",
    "Soy Daniel Cuart, fotógrafo de DNX Estudio, en Funes. Ofrecemos fotografía escolar con un sistema que gestiona ventas, cobros y entregas, con pagos 100% virtuales y una comisión acordada para el colegio, registrada de forma transparente.",
    "",
    `Conocer la propuesta: ${proposalUrl}`,
    `Escribirme por email: ${contactEmail}`,
    "",
    "Atendemos en San José 1672, Local 5, Funes.",
    "",
    "Daniel Cuart | DNX Estudio",
    "",
    "Si preferís no recibir más mensajes, respondé «baja».",
  ].join("\n");

  return {
    subject: DNX_ESCOLAR_SUBJECT,
    html,
    text,
    from: `${DNX_ESCOLAR_FROM_NAME} <${DNX_ESCOLAR_FROM_EMAIL}>`,
    replyTo: contactEmail,
    headers: { "List-Unsubscribe": `<${unsubscribeMailto}>` },
    proposalUrl,
    mailtoUrl,
  };
}
