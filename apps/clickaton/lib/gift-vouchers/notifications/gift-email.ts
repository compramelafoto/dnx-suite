import { sendIdentityEmail, type IdentityEmailResult } from "@repo/auth";
import {
  isClickatonProductionAudience,
  resolveClickatonPublicOrigin,
} from "@/lib/site/public-origin";
import { PRODUCTION_SITE_ORIGIN } from "@/lib/registration/ui/post-payment-public-copy";

/**
 * Correos del regalo de inscripción.
 *
 * Mismo mecanismo que los del participante: `sendIdentityEmail`, con el mismo
 * resguardo de destinatario para no escribirle a terceros desde staging.
 */
export type GiftEmailKind =
  | "gift_purchased_buyer"
  | "gift_invitation_recipient"
  | "gift_redeemed_buyer"
  | "gift_reminder_recipient";

/**
 * En producción siempre va al correo real. En staging/dev se redirige, para
 * que una prueba no termine en la casilla del amigo de alguien.
 *
 * Ojo: sin variables configuradas, `resolveClickatonPublicOrigin` devuelve el
 * dominio de producción, así que la audiencia da producción y el correo sale
 * al destinatario real. Para probar sin escribirle a nadie hay que definir
 * `CLICKATON_EMAIL_TEST_TO` o un origen de staging.
 */
export function resolveGiftRecipient(
  to: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (isClickatonProductionAudience(env)) return to.trim();
  const override = env.CLICKATON_EMAIL_TEST_TO?.trim();
  if (override) return override;
  const lower = to.toLowerCase();
  if (
    lower.endsWith(".test") ||
    lower.includes("+test@") ||
    env.CLICKATON_EMAIL_ALLOW_ANY === "true"
  ) {
    return to;
  }
  return (
    env.CLICKATON_EMAIL_FALLBACK_TO?.trim() || "clickaton-funnel-test@example.test"
  );
}

function baseUrl(): string {
  if (isClickatonProductionAudience()) return PRODUCTION_SITE_ORIGIN;
  return resolveClickatonPublicOrigin().replace(/\/$/, "");
}

function subjectLine(body: string): string {
  return isClickatonProductionAudience() ? body : `[TEST] ${body}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BRAND = "#F9B114";

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:999px;background:${BRAND};color:#111;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function shell(inner: string, support: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;">
      <tr><td style="padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;">
        ${inner}
        <p style="margin:24px 0 0;color:#777;font-size:12px;">${escapeHtml(support)}</p>
        <p style="margin:12px 0 0;color:#999;font-size:11px;">maratonfotografica.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();
}

export type GiftEmailBuilt = IdentityEmailResult & {
  deliveredTo: string;
  subject: string;
  text: string;
  html: string;
};

export type SendGiftEmailInput = {
  kind: GiftEmailKind;
  to: string;
  /** Nombre de pila de quien regala. */
  buyerName: string;
  recipientName?: string | null;
  editionName: string;
  voucherCode: string;
  giftMessage?: string | null;
  editionDate?: string | null;
  /** Sólo para el aviso de activación: quién activó el regalo. */
  redeemedByName?: string | null;
  /** Armá el asunto y el cuerpo sin enviar (para pruebas). */
  dryRunBuildOnly?: boolean;
};

const SUPPORT =
  "Soporte Clickatón: escribinos desde Contacto en maratonfotografica.com o respondé este email.";

export async function sendGiftEmail(input: SendGiftEmailInput): Promise<GiftEmailBuilt> {
  const deliveredTo = resolveGiftRecipient(input.to);
  const link = `${baseUrl()}/regalo/${input.voucherCode}`;
  const whatsappText = `¡Te regalo tu lugar en ${input.editionName}! 🎉\n\nActivalo acá y cargá tus datos: ${link}\n\nCódigo: ${input.voucherCode}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
  const amigo = input.recipientName?.trim() || "tu amigo";
  const fecha = input.editionDate ? ` del ${input.editionDate}` : "";

  let subject = "";
  let text = "";
  let html = "";

  switch (input.kind) {
    case "gift_purchased_buyer": {
      subject = subjectLine(`Tu regalo está listo — ${input.editionName}`);
      text = [
        `Hola ${input.buyerName},`,
        ``,
        `Listo: ya pagaste el lugar en ${input.editionName}${fecha}.`,
        ``,
        `Código del regalo: ${input.voucherCode}`,
        `Link para activarlo: ${link}`,
        ``,
        `Pasale ese link a ${amigo}. Con eso entra, carga sus datos, elige sede y talle, y queda inscripto. No tiene que pagar nada.`,
        ``,
        `Mandalo por WhatsApp: ${whatsappHref}`,
        ``,
        SUPPORT,
      ].join("\n");
      html = shell(
        `
        <p style="margin:0 0 8px;color:${BRAND};font-size:12px;font-weight:800;letter-spacing:0.08em;">TU REGALO ESTÁ LISTO</p>
        <p style="margin:0 0 16px;">Hola ${escapeHtml(input.buyerName)},</p>
        <p style="margin:0 0 16px;">Ya pagaste el lugar en <strong>${escapeHtml(input.editionName)}</strong>${escapeHtml(fecha)}.</p>
        <div style="margin:0 0 20px;padding:20px;border:2px solid ${BRAND};border-radius:12px;text-align:center;">
          <p style="margin:0 0 6px;color:#777;font-size:12px;letter-spacing:0.08em;">CÓDIGO DEL REGALO</p>
          <p style="margin:0;font-size:24px;font-weight:800;letter-spacing:0.15em;">${escapeHtml(input.voucherCode)}</p>
        </div>
        <p style="margin:0 0 16px;">Pasale este link a ${escapeHtml(amigo)}. Con eso entra, carga sus datos, elige sede y talle, y queda inscripto. No tiene que pagar nada.</p>
        <p style="margin:0 0 16px;">${button(whatsappHref, "Enviar por WhatsApp")}${button(link, "Ver el regalo")}</p>
        <p style="margin:0 0 8px;color:#555;font-size:13px;">O copiá este link: ${escapeHtml(link)}</p>
        `,
        SUPPORT,
      );
      break;
    }

    case "gift_invitation_recipient": {
      subject = subjectLine(`${input.buyerName} te regaló la ${input.editionName}`);
      text = [
        `Hola${input.recipientName ? ` ${input.recipientName}` : ""},`,
        ``,
        `${input.buyerName} te regaló tu lugar en ${input.editionName}${fecha}.`,
        input.giftMessage ? `\n«${input.giftMessage}»\n` : "",
        `Ya está pago. Sólo falta que cargues tus datos para activarlo:`,
        link,
        ``,
        `Código: ${input.voucherCode}`,
        ``,
        SUPPORT,
      ]
        .filter((l) => l !== "")
        .join("\n");
      html = shell(
        `
        <p style="margin:0 0 8px;color:${BRAND};font-size:12px;font-weight:800;letter-spacing:0.08em;">TE HICIERON UN REGALO</p>
        <p style="margin:0 0 16px;font-size:20px;font-weight:700;">${escapeHtml(input.buyerName)} te regaló tu lugar en ${escapeHtml(input.editionName)}${escapeHtml(fecha)}</p>
        ${
          input.giftMessage
            ? `<blockquote style="margin:0 0 20px;padding:16px;border-left:4px solid ${BRAND};background:#faf7f0;color:#333;">«${escapeHtml(input.giftMessage)}»</blockquote>`
            : ""
        }
        <p style="margin:0 0 20px;">Ya está pago. Sólo falta que cargues tus datos, elijas sede y talle, y listo.</p>
        <p style="margin:0 0 16px;">${button(link, "Activar mi lugar")}</p>
        <p style="margin:0 0 8px;color:#555;font-size:13px;">Tu código: <strong>${escapeHtml(input.voucherCode)}</strong></p>
        `,
        SUPPORT,
      );
      break;
    }

    case "gift_redeemed_buyer": {
      const quien = input.redeemedByName?.trim() || amigo;
      subject = subjectLine(`${quien} activó tu regalo — ${input.editionName}`);
      text = [
        `Hola ${input.buyerName},`,
        ``,
        `${quien} activó el regalo que le hiciste y ya está inscripto en ${input.editionName}${fecha}.`,
        ``,
        `Gracias por invitar a alguien más a maratonear con nosotros.`,
        ``,
        SUPPORT,
      ].join("\n");
      html = shell(
        `
        <p style="margin:0 0 8px;color:${BRAND};font-size:12px;font-weight:800;letter-spacing:0.08em;">REGALO ACTIVADO</p>
        <p style="margin:0 0 16px;">Hola ${escapeHtml(input.buyerName)},</p>
        <p style="margin:0 0 16px;"><strong>${escapeHtml(quien)}</strong> activó el regalo que le hiciste y ya está inscripto en ${escapeHtml(input.editionName)}${escapeHtml(fecha)}.</p>
        <p style="margin:0 0 16px;">Gracias por invitar a alguien más a maratonear con nosotros.</p>
        `,
        SUPPORT,
      );
      break;
    }

    case "gift_reminder_recipient": {
      subject = subjectLine(`No te olvides de activar tu regalo — ${input.editionName}`);
      text = [
        `Hola${input.recipientName ? ` ${input.recipientName}` : ""},`,
        ``,
        `${input.buyerName} te regaló un lugar en ${input.editionName}${fecha} y todavía no lo activaste.`,
        ``,
        `Falta poco para que cierren las inscripciones. Activalo acá:`,
        link,
        ``,
        `Código: ${input.voucherCode}`,
        ``,
        SUPPORT,
      ].join("\n");
      html = shell(
        `
        <p style="margin:0 0 8px;color:${BRAND};font-size:12px;font-weight:800;letter-spacing:0.08em;">TU REGALO TE ESPERA</p>
        <p style="margin:0 0 16px;">${escapeHtml(input.buyerName)} te regaló un lugar en <strong>${escapeHtml(input.editionName)}</strong>${escapeHtml(fecha)} y todavía no lo activaste.</p>
        <p style="margin:0 0 20px;">Falta poco para que cierren las inscripciones.</p>
        <p style="margin:0 0 16px;">${button(link, "Activar mi lugar")}</p>
        <p style="margin:0 0 8px;color:#555;font-size:13px;">Tu código: <strong>${escapeHtml(input.voucherCode)}</strong></p>
        `,
        SUPPORT,
      );
      break;
    }
  }

  if (input.dryRunBuildOnly) {
    return {
      sent: false,
      skipped: true,
      reason: "dry_run_build_only",
      deliveredTo,
      subject,
      text,
      html,
    };
  }

  const result = await sendIdentityEmail({
    to: deliveredTo,
    subject,
    text,
    html,
    templateKey: `clickaton_${input.kind}`,
  });

  return { ...result, deliveredTo, subject, text, html };
}
