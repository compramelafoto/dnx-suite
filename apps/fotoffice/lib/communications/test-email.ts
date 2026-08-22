import type { RenderedEmailSignature } from "@repo/communications/signature";

/**
 * Cuerpo del email de "prueba de configuración".
 *
 * Función PURA: sin red, sin base de datos, sin variables de entorno. Así se verifica que la
 * firma entra exactamente una vez en cada variante sin enviar nada.
 *
 * El contenido es deliberadamente austero. Este email existe para comprobar que la cadena
 * clave → remitente → dominio verificado funciona, así que su único contenido real es la
 * firma institucional: es lo que hay que mirar cuando llega.
 */

const DATE_FMT = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** El nombre del workspace lo escribe un administrador y termina dentro del HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type TestEmailInput = {
  workspaceName: string;
  /** Firma institucional ya renderizada. `null` = el workspace todavía no tiene branding. */
  signature: RenderedEmailSignature | null;
  sentAt: Date;
};

export function buildTestEmailBody(input: TestEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  // El asunto viaja como header, no como HTML: escaparlo mostraría entidades al destinatario.
  const subject = `Prueba de configuración de email — ${input.workspaceName}`;
  const when = DATE_FMT.format(input.sentAt);
  const safeName = escapeHtml(input.workspaceName);

  const signatureHtml = input.signature
    ? `\n  <div id="fo-signature" style="margin-top:16px;">${input.signature.html}</div>`
    : "";

  const html = `
<div>
  <p>Este es un email de prueba enviado desde la configuración de <strong>${safeName}</strong>.</p>
  <p>Confirma que el envío de correo está bien configurado. Si lo recibiste, la firma que aparece abajo es la que van a ver quienes reciban comunicaciones reales.</p>
  <p>No hace falta que respondas.</p>
  <p style="color:#6b7280;font-size:12px;">Enviado el ${escapeHtml(when)}.</p>${signatureHtml}
</div>
`.trim();

  // El texto plano se arma aparte, no se deriva del HTML: así no arrastra marcado.
  const text = [
    `Este es un email de prueba enviado desde la configuración de ${input.workspaceName}.`,
    "",
    "Confirma que el envío de correo está bien configurado. Si lo recibiste, la firma que aparece abajo es la que van a ver quienes reciban comunicaciones reales.",
    "",
    "No hace falta que respondas.",
    "",
    `Enviado el ${when}.`,
    ...(input.signature ? ["", input.signature.text] : []),
  ].join("\n");

  return { subject, html, text };
}
