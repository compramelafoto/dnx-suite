import type { RenderedEmailSignature } from "@repo/communications/signature";
import { C, FUENTE, escapeHtml } from "@/lib/communications/html";
import { button, safeAccent, safeHttpsUrl, textFooter, wrapMailing, type MailingBrand, type MailingFooter } from "./layout";
import { paragraphsHtml, renderTemplate, type TemplateVars } from "./occasions";

/**
 * El correo de una campaña libre (Comunicación → Campañas). Módulo puro.
 */

export type CustomEmailContent = {
  subject: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export function buildCustomEmail(input: {
  brand: MailingBrand;
  content: CustomEmailContent;
  vars: TemplateVars;
  signature: RenderedEmailSignature | null;
  footer: MailingFooter;
}): { subject: string; html: string; text: string } {
  const subject = renderTemplate(input.content.subject, input.vars).replace(/\s+/g, " ").trim().slice(0, 150);
  const cuerpo = renderTemplate(input.content.body, input.vars);
  const imagen = safeHttpsUrl(input.content.imageUrl);
  const ctaUrl = safeHttpsUrl(input.content.ctaUrl);
  const ctaLabel = input.content.ctaLabel?.trim() || null;
  const accent = safeAccent(input.brand.accentColor);

  const contentHtml = [
    imagen
      ? `<img src="${escapeHtml(imagen)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;margin:0 0 20px;">`
      : "",
    `<div style="font-family:${FUENTE};font-size:16px;line-height:1.6;color:${C.cuerpo};">${paragraphsHtml(cuerpo)}</div>`,
    ctaUrl && ctaLabel ? button(ctaLabel, ctaUrl, accent) : "",
  ].join("\n");

  const html = wrapMailing({
    brand: input.brand,
    preheader: cuerpo.replace(/\s+/g, " ").slice(0, 140),
    contentHtml,
    signature: input.signature,
    footer: input.footer,
  });
  const text = [
    cuerpo.trim(),
    ...(ctaUrl && ctaLabel ? ["", `${ctaLabel}: ${ctaUrl}`] : []),
    ...(input.signature ? ["", input.signature.text] : []),
    "",
    textFooter(input.footer),
  ].join("\n");
  return { subject, html, text };
}
