import type { RenderedEmailSignature } from "@repo/communications/signature";
import { C, FUENTE, escapeHtml } from "@/lib/communications/html";

/**
 * Molde de los correos a socios (blog, resumen, y después efemérides y campañas). Módulo puro.
 *
 * Tablas y estilos en línea: es lo único que Gmail, Outlook y Apple Mail dibujan igual. Lleva la
 * marca de la institución —logo y color—, no la de FOTOFFICE: el correo es de la SFPR.
 */

export type MailingBrand = {
  /** Nombre visible: «SFPR». */
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
};

export type MailingFooter = {
  /** «Recibís este correo porque sos socio de SFPR.» */
  reason: string;
  unsubscribeUrl: string;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function safeAccent(color: string | null | undefined): string {
  const c = (color ?? "").trim();
  return HEX_RE.test(c) ? c : C.acentoFuerte;
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export function button(label: string, url: string, accent: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;"><tr><td style="border-radius:8px;background:${accent};"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-family:${FUENTE};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

/** Envuelve el contenido con encabezado, firma y pie. `preheader` es el texto que se ve en la bandeja. */
export function wrapMailing(input: {
  brand: MailingBrand;
  preheader: string;
  contentHtml: string;
  signature: RenderedEmailSignature | null;
  footer: MailingFooter;
}): string {
  const accent = safeAccent(input.brand.accentColor);
  const logo = safeHttpsUrl(input.brand.logoUrl);
  const cabecera = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(input.brand.name)}" height="56" style="display:block;height:56px;width:auto;max-width:220px;border:0;">`
    : `<span style="font-family:${FUENTE};font-size:20px;font-weight:700;color:${C.tinta};">${escapeHtml(input.brand.name)}</span>`;
  const firma = input.signature
    ? `<tr><td style="padding:8px 32px 24px;font-family:${FUENTE};font-size:14px;color:${C.cuerpo};">${input.signature.html}</td></tr>`
    : "";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.brand.name)}</title></head>
<body style="margin:0;padding:0;background:${C.lienzo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.lienzo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;overflow:hidden;">
<tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 8px;">${cabecera}</td></tr>
<tr><td style="padding:8px 32px 8px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${C.cuerpo};">${input.contentHtml}</td></tr>
${firma}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:16px 32px;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${C.apagado};text-align:center;">
${escapeHtml(input.footer.reason)}<br>
<a href="${escapeHtml(input.footer.unsubscribeUrl)}" style="color:${C.apagado};text-decoration:underline;">Darme de baja de estos correos</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function textFooter(footer: MailingFooter): string {
  return `—\n${footer.reason}\nDarme de baja de estos correos: ${footer.unsubscribeUrl}`;
}
