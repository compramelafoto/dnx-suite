import { wrapEmailLayout } from "../layout";

export function buildSupportReplyEmail(params: {
  requesterName: string | null;
  ticketId: number;
  message: string;
  supportUrl: string;
  adminName?: string | null;
}) {
  const { requesterName, ticketId, message, supportUrl, adminName } = params;
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
    <p><a href="${supportUrl}">Ver incidencia y hacer seguimiento</a></p>
    <p style="font-size: 14px; color: #6b7280;">
      Si el botón no funciona, copiá este link en tu navegador:<br>
      <a href="${supportUrl}" style="color: #c27b3d; word-break: break-all;">${supportUrl}</a>
    </p>
    <p>Saludos,<br>${signer}</p>
  `);

  return {
    subject: `Respuesta a tu consulta #${ticketId} - ComprameLaFoto`,
    html,
  };
}
