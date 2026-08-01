import type { CommunicationBrand } from "../branding/types";
import { escapeHtml, escapeHtmlAttribute } from "../security/escape";

export function EmailHeader(brand: CommunicationBrand): string {
  const mark = brand.logoUrl
    ? `<img src="${escapeHtmlAttribute(brand.logoUrl)}" alt="${escapeHtml(brand.displayName)}" width="140" style="display:block;border:0;outline:none;text-decoration:none;max-width:140px;height:auto;" />`
    : `<span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.02em;color:${brand.primaryColor};">${escapeHtml(brand.displayName)}</span>`;

  const accentBar = brand.accentColor
    ? `<tr><td style="height:4px;line-height:4px;font-size:0;background-color:${brand.accentColor};">&nbsp;</td></tr>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">${accentBar}<tr><td align="left" style="padding:20px 0 8px 0;">${mark}</td></tr></table>`;
}
