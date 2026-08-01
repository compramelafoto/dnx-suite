import type { CommunicationBrand } from "../branding/types";
import type { LocaleBundle } from "../locales/types";
import { escapeHtml, escapeHtmlAttribute } from "../security/escape";
import { trySafeUrl } from "../security/urls";

export type EmailFooterOptions = {
  allowHttp?: boolean;
};

/**
 * Footer con sitio, soporte y notas legales informativas.
 * Unsubscribe: preparado, sin URL inventada (LEGAL_REVIEW futuras etapas).
 */
export function EmailFooter(
  brand: CommunicationBrand,
  copy: LocaleBundle["common"],
  options: EmailFooterOptions = {},
): string {
  const links: string[] = [];

  const website = brand.websiteUrl
    ? trySafeUrl(brand.websiteUrl, { allowHttp: options.allowHttp })
    : undefined;
  if (website) {
    links.push(
      `<a href="${escapeHtmlAttribute(website)}" style="color:${brand.mutedTextColor};text-decoration:underline;">${escapeHtml(copy.websiteLabel)}</a>`,
    );
  }

  if (brand.supportEmail) {
    const mailto = `mailto:${brand.supportEmail}`;
    // mailto es aceptable en footer de soporte; no pasa por assertSafeUrl https.
    links.push(
      `<a href="${escapeHtmlAttribute(mailto)}" style="color:${brand.mutedTextColor};text-decoration:underline;">${escapeHtml(copy.supportLabel)}</a>`,
    );
  }

  const linksRow =
    links.length > 0
      ? `<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${brand.mutedTextColor};">${links.join(" · ")}</p>`
      : "";

  const footerBrand = brand.footerText
    ? `<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${brand.mutedTextColor};">${escapeHtml(brand.footerText)}</p>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;"><tr><td style="border-top:1px solid ${brand.borderColor};padding-top:20px;">${footerBrand}${linksRow}<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${brand.mutedTextColor};">${escapeHtml(copy.transactionalNotice)}</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${brand.mutedTextColor};">${escapeHtml(copy.unsubscribeFutureNote)}</p></td></tr></table>`;
}
