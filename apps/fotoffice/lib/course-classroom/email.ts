// lib/course-classroom/email.ts
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { fechaLegibleArgentina } from "./access-rules";

/** El nombre lo escribe cualquiera en un formulario público: no puede llegar como HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

type InvitacionSinCargoInput = {
  studentName: string;
  courseTitle: string;
  /** El texto del dueño, tal cual lo escribió. Se escapa y cada renglón es un párrafo. */
  mensaje: string;
  /** Para quien todavía no puede entrar: el enlace para elegir su contraseña. */
  crearContrasenaUrl: string | null;
  loginUrl: string;
  portalUrl: string;
  expiresAt: Date | null;
};

/**
 * La invitación sin cargo a un curso grabado.
 *
 * Quien ya tiene cómo entrar recibe el enlace a sus cursos; quien no, el de elegir su
 * contraseña (su usuario es este correo) y la opción de entrar con Google.
 */
export function buildInvitacionSinCargoEmailBody(
  input: InvitacionSinCargoInput,
  signature: RenderedEmailSignature | null,
): { html: string; text: string } {
  const saludo = input.studentName.trim() ? `Hola ${input.studentName.trim()}:` : "Hola:";
  const parrafos = input.mensaje
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const vence = lineaVencimiento(input.expiresAt);

  const acceso = input.crearContrasenaUrl
    ? {
        html: `\n  <p>Tu usuario es este correo. Para entrar, elegí tu contraseña:</p>\n  <p><a href="${escaparHtml(input.crearContrasenaUrl)}"><strong>Crear mi contraseña y entrar</strong></a></p>\n  <p>Si usás Gmail, también podés <a href="${escaparHtml(input.loginUrl)}">entrar con Google</a> usando este mismo correo.</p>`,
        text: [
          "Tu usuario es este correo. Para entrar, elegí tu contraseña:",
          `Crear mi contraseña y entrar: ${input.crearContrasenaUrl}`,
          `O entrar con Google usando este mismo correo: ${input.loginUrl}`,
        ],
      }
    : {
        html: `\n  <p>Ya tenés cuenta: <a href="${escaparHtml(input.portalUrl)}"><strong>entrá a tus cursos</strong></a> con este correo.</p>`,
        text: [`Ya tenés cuenta: entrá a tus cursos con este correo: ${input.portalUrl}`],
      };

  const html = `
<div>
  <p>${escaparHtml(saludo)}</p>${parrafos.map((p) => `\n  <p>${escaparHtml(p)}</p>`).join("")}${acceso.html}${vence ? `\n  <p>${vence}</p>` : ""}${firmaHtml(signature)}
</div>
`.trim();

  const text = [
    saludo,
    "",
    ...parrafos.flatMap((p) => [p, ""]),
    ...acceso.text,
    ...(vence ? ["", vence] : []),
    ...(signature ? ["", signature.text] : []),
  ].join("\n");

  return { html, text };
}
