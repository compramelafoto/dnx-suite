const LOGO_URL = "https://compramelafoto.com/watermark.png";

export function emailSignature(): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
    <tr>
      <td style="vertical-align: top; width: 48px;">
        <img src="${LOGO_URL}" alt="ComprameLaFoto" width="48" height="48" style="display: block; border-radius: 6px;" />
      </td>
      <td style="vertical-align: top; padding-left: 12px; font-family: Arial, sans-serif; font-size: 14px; color: #111827;">
        <div style="font-weight: 600;">Equipo de ComprameLaFoto</div>
        <div style="margin-top: 4px;">
          <a href="https://www.compramelafoto.com" style="color: #111827; text-decoration: none;">www.compramelafoto.com</a>
        </div>
        <div style="margin-top: 2px;">
          <a href="mailto:info@compramelafoto.com" style="color: #111827; text-decoration: none;">info@compramelafoto.com</a>
        </div>
      </td>
    </tr>
  </table>
  `.trim();
}
