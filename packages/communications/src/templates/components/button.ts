import type { CommunicationBrand } from "../branding/types";
import { escapeHtml, escapeHtmlAttribute } from "../security/escape";
import { assertSafeUrl, type SafeUrlOptions } from "../security/urls";

export type EmailButtonOptions = SafeUrlOptions & {
  /**
   * Punto de extensión futuro para tracking de clicks.
   * Etapa 02: no transformar; no insertar query params ni píxeles.
   */
  hrefTransform?: (safeUrl: string) => string;
};

export function EmailButton(
  label: string,
  href: string,
  brand: CommunicationBrand,
  options: EmailButtonOptions = {},
): string {
  const safeHref = assertSafeUrl(href, { allowHttp: options.allowHttp });
  const finalHref = options.hrefTransform
    ? options.hrefTransform(safeHref)
    : safeHref;

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;"><tr><td align="left" bgcolor="${brand.primaryColor}" style="border-radius:6px;background-color:${brand.primaryColor};"><a href="${escapeHtmlAttribute(finalHref)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.2;color:${brand.buttonTextColor};text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a></td></tr></table>`;
}
