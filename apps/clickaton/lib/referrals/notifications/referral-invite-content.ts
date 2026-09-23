/**
 * El contenido del correo que le presenta a cada participante su link.
 *
 * Separado del envío para poder previsualizarlo y probarlo sin tocar Resend.
 *
 * **Un email no puede copiar al portapapeles**: los clientes de correo no
 * ejecutan JavaScript, así que un botón "copiar mi link" no haría nada. En su
 * lugar el link va escrito y seleccionable, con dos botones que sí funcionan:
 * uno abre WhatsApp con la invitación ya redactada, y el otro lleva al panel,
 * donde el botón de copiar sí existe.
 *
 * Maquetado con tablas y estilos en línea a propósito: Gmail, Outlook y
 * compañía descartan las hojas de estilo y no entienden flexbox ni grid.
 */
import { ESCALERA_REFERIDOS } from "../domain/escalera";
import { buildReferralWhatsappUrl } from "../ui/referral-share";

/** Amarillo de marca. */
const AMARILLO = "#F9B114";
const NEGRO = "#111111";
const GRIS_TEXTO = "#3f3f3f";
const GRIS_SUAVE = "#767676";
const FONDO = "#ededed";

const FUENTE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ReferralInviteContentInput = {
  firstName: string | null;
  code: string;
  /** Amigos que ya se sumaron por su link. */
  colegas: number;
  /** Origen público, sin barra final. */
  baseUrl: string;
};

export type ReferralInviteContent = {
  subject: string;
  text: string;
  html: string;
  link: string;
};

/**
 * Un escalón de la escalera, como celda de la tabla.
 *
 * Sólo el número, sin la palabra "amigos": con cinco columnas en la pantalla
 * de un teléfono, la etiqueta se partía en dos líneas y dejaba los recuadros
 * desparejos. El encabezado de la tabla ya dice de qué se trata.
 */
function celdaEscalon(
  colegas: number,
  descuento: number,
  alcanzado: boolean,
): string {
  const esGratis = descuento === 100;
  const fondo = alcanzado ? AMARILLO : "#ffffff";
  const borde = alcanzado ? AMARILLO : esGratis ? "#c9c9c9" : "#e4e4e4";
  const color = alcanzado || esGratis ? NEGRO : GRIS_SUAVE;

  return `
      <td align="center" width="20%" style="padding:0 3px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" height="74" valign="middle" style="height:74px;background:${fondo};border:2px solid ${borde};border-radius:10px;padding:8px 1px;">
              <div style="font-family:${FUENTE};font-size:12px;font-weight:600;color:${alcanzado ? NEGRO : GRIS_SUAVE};">${colegas}</div>
              <div style="font-family:${FUENTE};font-size:${esGratis ? "13" : "19"}px;font-weight:800;color:${color};padding-top:2px;">${esGratis ? "GRATIS" : `${descuento}%`}</div>
            </td>
          </tr>
        </table>
      </td>`;
}

export function buildReferralInviteContent(
  input: ReferralInviteContentInput,
): ReferralInviteContent {
  const base = input.baseUrl.replace(/\/+$/, "");
  const link = `${base}/i/${input.code}`;
  const panel = `${base}/mi-cuenta`;
  const whatsapp = buildReferralWhatsappUrl({ link });
  const logo = `${base}/brand/logo-horizontal-web.png`;

  const saludo = input.firstName?.trim() ? `Hola ${input.firstName.trim()},` : "Hola,";

  const yaTiene =
    input.colegas === 1
      ? "Ya se sumó 1 amigo por tu link."
      : input.colegas > 1
        ? `Ya se sumaron ${input.colegas} amigos por tu link.`
        : null;

  const escalones = ESCALERA_REFERIDOS.map((e) =>
    e.descuento === 100
      ? `${e.colegas} amigos → tu próxima Clickatón es GRATIS`
      : `${e.colegas} ${e.colegas === 1 ? "amigo" : "amigos"} → ${e.descuento}% de descuento`,
  );

  const subject = yaTiene
    ? `Ya vas ${input.colegas} de 5 para tu próxima Clickatón gratis`
    : "Invitá a tus amigos a Clickatón y vení gratis a la próxima";

  const text = [
    saludo,
    "",
    "Ahora podés invitar amigos a Clickatón y que eso te descuente tu próxima inscripción.",
    "",
    "Este es tu link personal:",
    link,
    "",
    ...(yaTiene ? [yaTiene, ""] : []),
    "Cómo funciona:",
    ...escalones.map((e) => `· ${e}`),
    "",
    "El amigo que entra por tu link también arranca con 10% de descuento.",
    "",
    "Tres cosas que conviene saber:",
    "· Un amigo cuenta cuando su pago queda aprobado, no cuando le mandás el link.",
    "· Lo que acumulás no vence nunca: se suma edición tras edición.",
    "· Al inscribirte, iniciá sesión. El descuento sale de tu cuenta.",
    "",
    `Tu panel, con el botón para copiar el link: ${panel}`,
    "",
    "Nos vemos en la próxima.",
    "El equipo de Clickatón",
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu link personal para invitar amigos. Con 5, tu próxima Clickatón es gratis.</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${FONDO};">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;">

        <tr>
          <td align="center" style="background:${NEGRO};padding:28px 24px;">
            <img src="${logo}" width="240" alt="Clickatón — Maratón Fotográfica" style="display:block;width:240px;max-width:75%;height:auto;border:0;">
          </td>
        </tr>

        <tr>
          <td style="padding:32px 28px 8px;">
            <p style="margin:0 0 16px;font-family:${FUENTE};font-size:16px;color:${NEGRO};">${escapeHtml(saludo)}</p>
            <h1 style="margin:0 0 12px;font-family:${FUENTE};font-size:25px;line-height:1.25;color:${NEGRO};font-weight:800;">
              Invitá a tus amigos<br>y vení gratis a la próxima
            </h1>
            <p style="margin:0;font-family:${FUENTE};font-size:16px;line-height:1.6;color:${GRIS_TEXTO};">
              Cada amigo que se suma por tu link te descuenta tu próxima inscripción.
              Y el que viene <strong style="color:${NEGRO};">también entra con 10% de descuento</strong>.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 4px;">
            <p style="margin:0 0 8px;font-family:${FUENTE};font-size:11px;color:${GRIS_SUAVE};text-transform:uppercase;letter-spacing:.1em;font-weight:700;">Tu link personal</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="background:#f7f7f7;border:1px dashed #cfcfcf;border-radius:10px;padding:14px 16px;">
                  <a href="${link}" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:15px;color:${NEGRO};text-decoration:none;word-break:break-all;">${escapeHtml(link)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
${
  yaTiene
    ? `
        <tr>
          <td style="padding:16px 28px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="background:#fff8e6;border-left:4px solid ${AMARILLO};border-radius:0 8px 8px 0;padding:12px 16px;">
                  <p style="margin:0;font-family:${FUENTE};font-size:15px;font-weight:700;color:${NEGRO};">${escapeHtml(yaTiene)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : ""
}
        <tr>
          <td align="center" style="padding:24px 28px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-radius:999px;background:${AMARILLO};">
                  <a href="${whatsapp}" style="display:inline-block;padding:15px 30px;font-family:${FUENTE};font-size:16px;font-weight:700;color:${NEGRO};text-decoration:none;">Invitar por WhatsApp</a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-family:${FUENTE};font-size:14px;">
              <a href="${panel}" style="color:${GRIS_SUAVE};text-decoration:underline;">o abrí tu panel para copiar el link</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 28px 0;">
            <p style="margin:0 0 4px;font-family:${FUENTE};font-size:11px;color:${GRIS_SUAVE};text-transform:uppercase;letter-spacing:.1em;font-weight:700;">Amigos que se suman</p>
            <p style="margin:0 0 12px;font-family:${FUENTE};font-size:13px;color:${GRIS_SUAVE};">…y el descuento que te queda en la próxima:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>${ESCALERA_REFERIDOS.map((e) =>
                celdaEscalon(e.colegas, e.descuento, input.colegas >= e.colegas),
              ).join("")}
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 28px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #eaeaea;">
              <tr><td style="height:20px;"></td></tr>
              <tr>
                <td style="font-family:${FUENTE};font-size:14px;line-height:1.7;color:${GRIS_TEXTO};">
                  <p style="margin:0 0 10px;"><strong style="color:${NEGRO};">Un amigo cuenta cuando su pago queda aprobado</strong>, no cuando le mandás el link.</p>
                  <p style="margin:0 0 10px;"><strong style="color:${NEGRO};">Lo que acumulás no vence nunca</strong>: se suma edición tras edición.</p>
                  <p style="margin:0;"><strong style="color:${NEGRO};">Al inscribirte, iniciá sesión</strong>. El descuento sale de tu cuenta.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:28px;">
            <p style="margin:0;font-family:${FUENTE};font-size:14px;color:${GRIS_SUAVE};">
              Nos vemos en la próxima.<br><strong style="color:${GRIS_TEXTO};">El equipo de Clickatón</strong>
            </p>
          </td>
        </tr>

      </table>

      <p style="margin:16px 0 0;font-family:${FUENTE};font-size:12px;color:#8c8c8c;">
        Recibís este correo porque participaste de una Clickatón.
      </p>

    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html, link };
}
