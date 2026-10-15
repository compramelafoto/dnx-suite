import { escaparHtml } from "@/lib/course-classroom/email";

export function buildAvisoBeneficiarioEmail(input: {
  dueno: string;
  curso: string;
  porcentaje: string;
  rol: string;
  enlace: string;
}): { subject: string; html: string; text: string } {
  const subject = `Te sumaron como beneficiario de ${input.curso}`;
  const html = `
<div>
  <p><strong>${escaparHtml(input.dueno)}</strong> te sumó como beneficiario del curso <strong>${escaparHtml(input.curso)}</strong>.</p>
  <p>Tu parte: <strong>${escaparHtml(input.porcentaje)}</strong> de cada venta, como ${escaparHtml(input.rol)}.</p>
  <p>Entrá a FOTOFFICE para ver cómo se reparte cada venta y aceptar o rechazar:</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver la invitación</a></p>
</div>`.trim();
  const text = [
    `${input.dueno} te sumó como beneficiario del curso ${input.curso}.`,
    `Tu parte: ${input.porcentaje} de cada venta, como ${input.rol}.`,
    "",
    `Ver la invitación: ${input.enlace}`,
  ].join("\n");
  return { subject, html, text };
}
