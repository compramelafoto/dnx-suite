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

export type InvitacionASociarse = { institucion: string; url: string };

function bloqueInvitacion(invitacion: InvitacionASociarse | null): { html: string; text: string[] } {
  if (!invitacion) return { html: "", text: [] };
  const institucion = escaparHtml(invitacion.institucion);
  return {
    html: `\n  <p>¿Todavía no sos socio? <a href="${escaparHtml(invitacion.url)}">Hacete socio de ${institucion}</a>.</p>`,
    text: ["", `¿Todavía no sos socio? Hacete socio de ${invitacion.institucion}: ${invitacion.url}`],
  };
}

function lineaVencimiento(expiresAt: Date | null): string | null {
  return expiresAt ? `Tenés acceso hasta el ${fechaLegibleArgentina(expiresAt)}.` : null;
}

function firmaHtml(signature: RenderedEmailSignature | null): string {
  return signature ? `\n  <div id="fo-signature" style="margin-top:16px;">${signature.html}</div>` : "";
}

type CursoEnTuPortalInput = {
  studentName: string;
  courseTitle: string;
  portalUrl: string;
  expiresAt: Date | null;
  invitacion: InvitacionASociarse | null;
};

/** Para quien ya tiene cómo entrar al portal: el curso apareció ahí. */
export function buildCursoEnTuPortalEmailBody(
  input: CursoEnTuPortalInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const nombre = escaparHtml(input.studentName);
  const curso = escaparHtml(input.courseTitle);
  const vence = lineaVencimiento(input.expiresAt);
  const invitacion = bloqueInvitacion(input.invitacion);

  const html = `
<div>
  <p>Hola ${nombre},</p>
  <p><strong>${curso}</strong> ya está en tu portal.</p>
  <p><a href="${escaparHtml(input.portalUrl)}">Ir a mis cursos</a></p>${vence ? `\n  <p>${vence}</p>` : ""}${invitacion.html}
  <p>Gracias por elegirnos.</p>${firmaHtml(signature)}
</div>
`.trim();

  const text = [
    `Hola ${input.studentName},`,
    "",
    `${input.courseTitle} ya está en tu portal.`,
    "",
    `Ir a mis cursos: ${input.portalUrl}`,
    ...(vence ? [vence] : []),
    ...invitacion.text,
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

type BienvenidaInput = {
  studentName: string;
  courseTitle: string;
  crearContrasenaUrl: string;
  loginUrl: string;
  expiresAt: Date | null;
  invitacion: InvitacionASociarse | null;
};

/** Para quien todavía no puede entrar: elige su contraseña (o entra con Google) y ve el curso. */
export function buildBienvenidaAlumnoEmailBody(
  input: BienvenidaInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const nombre = escaparHtml(input.studentName);
  const curso = escaparHtml(input.courseTitle);
  const vence = lineaVencimiento(input.expiresAt);
  const invitacion = bloqueInvitacion(input.invitacion);

  const html = `
<div>
  <p>Hola ${nombre},</p>
  <p>Tu pago fue aprobado. <strong>${curso}</strong> te espera en tu portal.</p>
  <p>Para entrar, elegí tu contraseña:</p>
  <p><a href="${escaparHtml(input.crearContrasenaUrl)}">Crear mi contraseña</a></p>
  <p>Si usás Gmail, también podés <a href="${escaparHtml(input.loginUrl)}">entrar con Google</a> usando este mismo correo.</p>${vence ? `\n  <p>${vence}</p>` : ""}${invitacion.html}
  <p>Gracias por elegirnos.</p>${firmaHtml(signature)}
</div>
`.trim();

  const text = [
    `Hola ${input.studentName},`,
    "",
    `Tu pago fue aprobado. ${input.courseTitle} te espera en tu portal.`,
    "",
    `Crear mi contraseña: ${input.crearContrasenaUrl}`,
    `O entrar con Google usando este mismo correo: ${input.loginUrl}`,
    ...(vence ? ["", vence] : []),
    ...invitacion.text,
    "",
    "Gracias por elegirnos.",
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}

export async function sendCursoEnTuPortalEmail(
  input: CursoEnTuPortalInput & { to: string; signature?: RenderedEmailSignature | null },
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { html, text } = buildCursoEnTuPortalEmailBody(input, input.signature ?? null);
  const outcome = await sendTransactionalEmail({
    to: input.to,
    subject: `Tu curso ya está en tu portal: ${input.courseTitle}`,
    html,
    text,
  });
  return outcome.status === "SENT" ? { sent: true } : { sent: false, reason: outcome.detail };
}

export async function sendBienvenidaAlumnoEmail(
  input: BienvenidaInput & { to: string; signature?: RenderedEmailSignature | null },
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const { html, text } = buildBienvenidaAlumnoEmailBody(input, input.signature ?? null);
  const outcome = await sendTransactionalEmail({
    to: input.to,
    subject: `Bienvenido: tu acceso a ${input.courseTitle}`,
    html,
    text,
  });
  return outcome.status === "SENT" ? { sent: true } : { sent: false, reason: outcome.detail };
}
