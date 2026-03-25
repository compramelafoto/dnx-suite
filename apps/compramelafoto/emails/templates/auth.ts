import { emailSignature } from "../signature";

function wrapEmail(content: string) {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #111827; line-height: 1.6;">
    ${content}
    ${emailSignature()}
  </div>
  `.trim();
}

function greet(firstName?: string) {
  return firstName ? `Hola ${firstName},` : "Hola,";
}

export function buildVerifyEmail(params: { firstName?: string; verifyUrl: string }) {
  const { firstName, verifyUrl } = params;
  const subject = "Verificá tu email en ComprameLaFoto";
  const html = wrapEmail(`
    <p>${greet(firstName)}</p>
    <p>Necesitamos confirmar tu email para activar la cuenta.</p>
    <p>
      <a href="${verifyUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
        Verificar email
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Si no fuiste vos, podés ignorar este mensaje.
    </p>
  `);
  return { subject, html };
}

export function buildResetPasswordEmail(params: { firstName?: string; resetUrl: string }) {
  const { firstName, resetUrl } = params;
  const subject = "Recuperación de contraseña";
  const html = wrapEmail(`
    <p>${greet(firstName)}</p>
    <p>Recibimos un pedido para restablecer tu contraseña.</p>
    <p>
      <a href="${resetUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
        Crear nueva contraseña
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Este enlace vence en 1 hora. Si no lo pediste, ignorá este email.
    </p>
  `);
  return { subject, html };
}

export function buildPasswordChangedEmail(params: { firstName?: string }) {
  const { firstName } = params;
  const subject = "Tu contraseña fue actualizada";
  const html = wrapEmail(`
    <p>${greet(firstName)}</p>
    <p>Te confirmamos que tu contraseña se cambió correctamente.</p>
    <p style="font-size: 13px; color: #6b7280;">
      Si no fuiste vos, contactanos cuanto antes.
    </p>
  `);
  return { subject, html };
}

export function buildAlbumInviteEmail(params: {
  albumTitle: string;
  inviteUrl: string;
  invitedByName?: string;
}) {
  const { albumTitle, inviteUrl, invitedByName } = params;
  const subject = `Invitación para ver el álbum "${albumTitle}"`;
  const html = wrapEmail(`
    <p>Hola,</p>
    <p>${invitedByName ? `<strong>${invitedByName}</strong>` : "Un fotógrafo"} te invitó a ver el álbum <strong>${albumTitle}</strong>.</p>
    <p>
      <a href="${inviteUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
        Abrir invitación
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Este enlace vence en 7 días. Si no esperabas esta invitación, podés ignorar este email.
    </p>
  `);
  return { subject, html };
}

export function buildLoginAlertEmail(params: {
  firstName?: string;
  deviceLabel?: string;
  ip?: string;
  city?: string;
  when?: string;
  manageUrl?: string;
}) {
  const { firstName, deviceLabel, ip, city, when, manageUrl } = params;
  const subject = "Alerta de inicio de sesión";
  const location = [city, ip].filter(Boolean).join(" · ");
  const details = [deviceLabel, location, when].filter(Boolean).join(" · ");
  const html = wrapEmail(`
    <p>${greet(firstName)}</p>
    <p>Detectamos un inicio de sesión desde un dispositivo nuevo.</p>
    ${details ? `<p style="font-size: 14px; color: #6b7280;">${details}</p>` : ""}
    ${manageUrl ? `<p><a href="${manageUrl}" style="color: #c27b3d; text-decoration: none;">Revisar actividad</a></p>` : ""}
    <p style="font-size: 13px; color: #6b7280;">
      Si no fuiste vos, cambiá la contraseña y avisános.
    </p>
  `);
  return { subject, html };
}
