import type { CommunicationBrand } from "../branding/types";
import { escapeHtml } from "../security/escape";

export function EmailHeading(
  text: string,
  brand: CommunicationBrand,
  options: { as?: "h1" | "h2"; align?: "left" | "center" } = {},
): string {
  const tag = options.as ?? "h1";
  const align = options.align ?? "left";
  const size = tag === "h1" ? "24px" : "20px";
  return `<${tag} style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:${size};line-height:1.3;font-weight:700;color:${brand.textColor};text-align:${align};">${escapeHtml(text)}</${tag}>`;
}
