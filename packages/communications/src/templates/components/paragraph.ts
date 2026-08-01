import type { CommunicationBrand } from "../branding/types";
import { escapeHtml } from "../security/escape";

export function EmailParagraph(
  text: string,
  brand: CommunicationBrand,
  options: { muted?: boolean; align?: "left" | "center" } = {},
): string {
  const color = options.muted ? brand.mutedTextColor : brand.textColor;
  const align = options.align ?? "left";
  return `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${color};text-align:${align};">${escapeHtml(text)}</p>`;
}
