import { emailSignature } from "../signature";

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Respuesta a tu consulta de soporte</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #111827; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 8px;">
    <p style="margin: 0 0 16px;">${greeting},</p>
    <p style="margin: 0 0 16px;">Recibimos tu consulta y te respondemos:</p>
    <div style="margin: 16px 0; padding: 16px; background-color: #f9fafb; border-left: 4px solid #c27b3d; border-radius: 4px;">
      <div style="white-space: pre-wrap;">${String(message)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")}</div>
    </div>
    <p style="margin: 16px 0;">
      <a href="${supportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #c27b3d; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600;">Ver incidencia y hacer seguimiento</a>
    </p>
    <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">
      Si el botón no funciona, copiá este link en tu navegador:<br>
      <a href="${supportUrl}" style="color: #c27b3d; word-break: break-all;">${supportUrl}</a>
    </p>
    ${emailSignature()}
  </div>
</body>
</html>
  `.trim();

  return {
    subject: `Respuesta a tu consulta #${ticketId} - ComprameLaFoto`,
    html,
  };
}
