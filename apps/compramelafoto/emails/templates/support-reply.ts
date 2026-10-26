import { wrapEmailLayout } from "../layout";

export function buildSupportReplyEmail(params: {
  requesterName: string | null;
  ticketId: number;
  message: string;
  supportUrl: string;
  adminName?: string | null;
  /** Link al caso en el DNX Bot. Si viene, reemplaza el seguimiento en el panel por el botón "Responder". */
  responderUrl?: string;
}) {
  const { requesterName, ticketId, message, supportUrl, adminName, responderUrl } = params;
  const greeting = requesterName ? `Hola ${requesterName}` : "Hola";
  const signer = adminName || "El equipo de ComprameLaFoto";

  const html = wrapEmailLayout(`
    <p>${greeting},</p>
    <p>Recibimos tu consulta y te respondemos:</p>
    <div style="margin: 0 0 16px; padding: 16px; background-color: #faf6f1; border-left: 4px solid #c27b3d; border-radius: 4px;">
      <div style="white-space: pre-wrap;">${String(message)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")}</div>
    </div>
    ${
      responderUrl
        ? `<p style="margin: 24px 0;"><a href="${responderUrl}" style="display: inline-block; padding: 12px 22px; background-color: #c27b3d; color: #ffffff; border-radius: 8px; font-weight: 700; text-decoration: none;">Responder</a></p>
    <p style="font-size: 14px; color: #6b7280;">
      Si con esto se resolvió, no hace falta que hagas nada. El link es personal y sirve sólo para esta consulta.<br>
      Si el botón no funciona, copiá este link en tu navegador:<br>
      <a href="${responderUrl}" style="color: #c27b3d; word-break: break-all;">${responderUrl}</a>
    </p>`
        : `<p><a href="${supportUrl}">Ver incidencia y hacer seguimiento</a></p>
    <p style="font-size: 14px; color: #6b7280;">
      Si el botón no funciona, copiá este link en tu navegador:<br>
      <a href="${supportUrl}" style="color: #c27b3d; word-break: break-all;">${supportUrl}</a>
    </p>`
    }
    <p>Saludos,<br>${signer}</p>
  `);

  return {
    subject: `Respuesta a tu consulta #${ticketId} - ComprameLaFoto`,
    html,
  };
}
