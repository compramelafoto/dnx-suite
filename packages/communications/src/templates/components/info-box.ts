import type { CommunicationBrand } from "../branding/types";
import { escapeHtml } from "../security/escape";

export function EmailInfoBox(text: string, brand: CommunicationBrand): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;"><tr><td style="padding:16px 20px;border:1px solid ${brand.borderColor};border-left:4px solid ${brand.primaryColor};background-color:${brand.surfaceColor};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${brand.textColor};">${escapeHtml(text)}</td></tr></table>`;
}
