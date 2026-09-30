/**
 * El correo para fotógrafos que usan otra plataforma de DNX y todavía no
 * tienen cuenta en Clickatón.
 *
 * Es otro correo, no una variante del de la comunidad, y la diferencia no es
 * de tono: **no pueden copiar un link que todavía no existe**. Las cuentas no
 * se comparten entre plataformas, así que a esta gente hay que pedirle
 * primero que se cree la cuenta; recién ahí tiene sentido hablarle de su link.
 *
 * El asunto dice de dónde viene el correo. Aparecer de la nada en la casilla
 * de alguien que nunca interactuó con Clickatón es lo que dispara el botón de
 * spam.
 */
import { ESCALERA_REFERIDOS } from "../domain/escalera";
import { escapeHtml } from "./referral-invite-content";

const AMARILLO = "#F9B114";
const NEGRO = "#111111";
const GRIS_TEXTO = "#3f3f3f";
const GRIS_SUAVE = "#767676";
const FONDO = "#ededed";

const FUENTE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** De qué plataforma viene la persona, para que el correo lo reconozca. */
export type OrigenOutreach = "compramelafoto" | "fotoffice" | "fotorank";

const NOMBRE_ORIGEN: Record<OrigenOutreach, string> = {
  compramelafoto: "CompraMeLaFoto",
  fotoffice: "FOTOFFICE",
  fotorank: "FotoRank",
};

export type OutreachInviteContentInput = {
  firstName: string | null;
  origen: OrigenOutreach;
  /** Origen público, sin barra final. */
  baseUrl: string;
};

export type OutreachInviteContent = {
  subject: string;
  text: string;
  html: string;
};

function celda(colegas: number, descuento: number): string {
  const esGratis = descuento === 100;
  return `
      <td align="center" width="20%" style="padding:0 3px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" height="74" valign="middle" style="height:74px;background:${esGratis ? AMARILLO : "#ffffff"};border:2px solid ${esGratis ? AMARILLO : "#e4e4e4"};border-radius:10px;padding:8px 1px;">
              <div style="font-family:${FUENTE};font-size:12px;font-weight:600;color:${esGratis ? NEGRO : GRIS_SUAVE};">${colegas}</div>
              <div style="font-family:${FUENTE};font-size:${esGratis ? "13" : "19"}px;font-weight:800;color:${esGratis ? NEGRO : GRIS_SUAVE};padding-top:2px;">${esGratis ? "GRATIS" : `${descuento}%`}</div>
            </td>
          </tr>
        </table>
      </td>`;
}

export function buildOutreachInviteContent(
  input: OutreachInviteContentInput,
): OutreachInviteContent {
  const base = input.baseUrl.replace(/\/+$/, "");
  const crearCuenta = `${base}/crear-cuenta`;
  const logo = `${base}/brand/logo-horizontal-web.png`;
  const plataforma = NOMBRE_ORIGEN[input.origen];

  const saludo = input.firstName?.trim() ? `Hola ${input.firstName.trim()},` : "Hola,";

  const subject = `Te escribimos desde Clickatón, la maratón de los que ya usan ${plataforma}`;

  const escalones = ESCALERA_REFERIDOS.map((e) =>
    e.descuento === 100
      ? `${e.colegas} amigos → tu Clickatón es GRATIS`
      : `${e.colegas} ${e.colegas === 1 ? "amigo" : "amigos"} → ${e.descuento}% de descuento`,
  );

  const text = [
    saludo,
    "",
    `Te escribimos porque usás ${plataforma}, que es parte de la misma casa que Clickatón.`,
    "",
    "La Clickatón es una maratón fotográfica de un día: consignas sorpresa, jurado, premios y un montón de colegas en la calle al mismo tiempo.",
    "",
    "Y arrancamos algo nuevo: podés invitar amigos y que eso te pague tu inscripción.",
    "",
    ...escalones.map((e) => `· ${e}`),
    "",
    "No hace falta que hayas participado antes. Si traés cinco amigos, tu PRIMERA Clickatón te sale gratis. Y el que entra por tu link arranca con 10% de descuento.",
    "",
    `Para empezar necesitás una cuenta en Clickatón —es aparte de la de ${plataforma}—: ${crearCuenta}`,
    "",
    "Cuando la tengas, en Mi cuenta te espera tu link personal.",
    "",
    "Nos vemos en la próxima.",
    "El equipo de Clickatón",
    "",
    `Recibís este correo porque tenés una cuenta en ${plataforma}. Si no querés saber más de Clickatón, respondé este correo y no te escribimos nunca más.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Una maratón fotográfica de un día. Traé cinco amigos y entrás gratis.</div>

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
            <p style="margin:0 0 20px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${GRIS_SUAVE};">
              Te escribimos porque usás <strong style="color:${GRIS_TEXTO};">${escapeHtml(plataforma)}</strong>, que es parte de la misma casa que Clickatón.
            </p>
            <h1 style="margin:0 0 14px;font-family:${FUENTE};font-size:25px;line-height:1.25;color:${NEGRO};font-weight:800;">
              Invitá a tus amigos<br>y vení gratis a la próxima
            </h1>
            <p style="margin:0;font-family:${FUENTE};font-size:16px;line-height:1.6;color:${GRIS_TEXTO};">
              La Clickatón es una maratón fotográfica de un día: consignas sorpresa,
              jurado, premios y un montón de colegas en la calle al mismo tiempo.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 28px 0;">
            <p style="margin:0 0 4px;font-family:${FUENTE};font-size:11px;color:${GRIS_SUAVE};text-transform:uppercase;letter-spacing:.1em;font-weight:700;">Amigos que se suman</p>
            <p style="margin:0 0 12px;font-family:${FUENTE};font-size:13px;color:${GRIS_SUAVE};">…y el descuento que te queda en tu inscripción:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>${ESCALERA_REFERIDOS.map((e) => celda(e.colegas, e.descuento)).join("")}
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 0;">
            <p style="margin:0;font-family:${FUENTE};font-size:15px;line-height:1.7;color:${GRIS_TEXTO};">
              <strong style="color:${NEGRO};">No hace falta que hayas participado antes.</strong>
              Si traés cinco amigos, tu <strong style="color:${NEGRO};">primera</strong> Clickatón te sale gratis.
              Y el que entra por tu link arranca con 10% de descuento.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-radius:999px;background:${AMARILLO};">
                  <a href="${crearCuenta}" style="display:inline-block;padding:15px 30px;font-family:${FUENTE};font-size:16px;font-weight:700;color:${NEGRO};text-decoration:none;">Crear mi cuenta y ver mi link</a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-family:${FUENTE};font-size:13px;color:${GRIS_SUAVE};line-height:1.6;">
              La cuenta de Clickatón es aparte de la de ${escapeHtml(plataforma)}.<br>
              Se crea en un minuto y ahí mismo te espera tu link.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 28px 28px;">
            <p style="margin:0;font-family:${FUENTE};font-size:14px;color:${GRIS_SUAVE};">
              Nos vemos en la próxima.<br><strong style="color:${GRIS_TEXTO};">El equipo de Clickatón</strong>
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:16px 0 0;max-width:520px;font-family:${FUENTE};font-size:12px;line-height:1.6;color:#8c8c8c;">
        Recibís este correo porque tenés una cuenta en ${escapeHtml(plataforma)}.
        Si no querés saber más de Clickatón, respondé este correo y no te escribimos nunca más.
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
