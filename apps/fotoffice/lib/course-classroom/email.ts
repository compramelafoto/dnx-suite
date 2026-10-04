// lib/course-classroom/email.ts
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { fechaLegibleArgentina } from "./access-rules";

/**
 * El correo que le da al alumno la entrada a su aula.
 *
 * Es la **única** vez que viaja el token crudo: en la base queda sólo su hash. Si el correo
 * se pierde, el alumno pide uno nuevo en /aula/recuperar.
 */

export function enlaceDelAula(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/aula/${token}`;
}

/** El nombre lo escribe cualquiera en un formulario público: no puede llegar como HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type CuerpoInput = {
  studentName: string;
  courseTitle: string;
  enlace: string;
  expiresAt: Date;
  /** Es un enlace nuevo pedido por el alumno, no el primer aviso de pago. */
  reenvio?: boolean;
};

export function buildClassroomAccessEmailBody(
  input: CuerpoInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const vence = fechaLegibleArgentina(input.expiresAt);
  const nombre = escaparHtml(input.studentName);
  const curso = escaparHtml(input.courseTitle);
  const enlace = escaparHtml(input.enlace);
  const signatureHtml = signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${signature.html}</div>`
    : "";

  const intro = input.reenvio
    ? `Te mandamos un enlace nuevo para entrar a <strong>${curso}</strong>. El anterior ya no funciona.`
    : `Tu pago fue aprobado. Ya podés entrar a <strong>${curso}</strong>.`;
  const introTexto = input.reenvio
    ? `Te mandamos un enlace nuevo para entrar a ${input.courseTitle}. El anterior ya no funciona.`
    : `Tu pago fue aprobado. Ya podés entrar a ${input.courseTitle}.`;

  const html = `
<div>
  <p>Hola ${nombre},</p>
  <p>${intro}</p>
  <p><a href="${enlace}">Entrar al aula</a></p>
  <p>Ese enlace es personal: es tu llave del curso. No lo compartas.</p>
  <p>Tenés acceso hasta el ${vence}.</p>
  <p>Gracias por elegirnos.</p>${signatureHtml}
</div>
`.trim();

  const text = [
    `Hola ${input.studentName},`,
    "",
    introTexto,
    "",
    `Entrar al aula: ${input.enlace}`,
    "",
    "Ese enlace es personal: es tu llave del curso. No lo compartas.",
    `Tenés acceso hasta el ${vence}.`,
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

export async function sendClassroomAccessEmail(
  input: CuerpoInput & { to: string; signature?: RenderedEmailSignature | null },
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { html, text } = buildClassroomAccessEmailBody(input, input.signature ?? null);
  const outcome = await sendTransactionalEmail({
    to: input.to,
    subject: input.reenvio ? `Tu nuevo enlace a ${input.courseTitle}` : `Tu acceso a ${input.courseTitle}`,
    html,
    text,
  });
  if (outcome.status === "SENT") return { sent: true };
  return { sent: false, reason: outcome.detail };
}
