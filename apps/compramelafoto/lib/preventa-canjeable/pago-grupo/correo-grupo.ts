/**
 * Comprobante ÚNICO de una compra de varios packs de preventa pagados juntos (función pura).
 * Reemplaza, para esa compra, el comprobante que salía por cada pack.
 */
import { escapeHtml } from "../pack-access-email-content";

export type PackDelComprobanteGrupo = {
  orderId: number;
  packName: string | null;
  quantity: number;
  /** Pesos enteros. */
  totalArs: number;
  /** Enlace personal del pack (sin cuenta). Null si no se pudo generar. */
  packAccessUrl: string | null;
};

export type ComprobanteGrupoInput = {
  buyerName: string | null;
  buyerEmail: string;
  albumTitle: string | null;
  purchasedAt: Date;
  mpPaymentId: string | null;
  recoverUrl: string;
  packs: PackDelComprobanteGrupo[];
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";

function formatPesos(pesos: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(pesos)));
}

function formatFecha(date: Date): string {
  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${fecha} a las ${hora} h (hora de Argentina)`;
}

function nombreDelPack(p: PackDelComprobanteGrupo): string {
  const nombre = p.packName?.trim() || "Pack de preventa";
  return p.quantity > 1 ? `${nombre} (×${p.quantity})` : nombre;
}

export function armarComprobanteGrupo(input: ComprobanteGrupoInput): { subject: string; text: string; html: string } {
  const packs = [...input.packs].sort((a, b) => a.orderId - b.orderId);
  const nombre =
    input.buyerName?.trim() || (input.buyerEmail.includes("@") ? input.buyerEmail.split("@")[0] : input.buyerEmail);
  const total = formatPesos(packs.reduce((s, p) => s + p.totalArs, 0));
  const fecha = formatFecha(input.purchasedAt);
  const album = input.albumTitle?.trim() || null;
  const pedidos = packs.map((p) => `#${p.orderId}`).join(", ");
  const subject = `Comprobante de tu compra — ${packs.length} packs (pedidos ${pedidos})`;
  const medio = input.mpPaymentId ? `Mercado Pago (operación ${input.mpPaymentId})` : "Mercado Pago";
  const faltaAlgunEnlace = packs.some((p) => !p.packAccessUrl);

  const lineasTexto = packs.map((p) => {
    const acceso = p.packAccessUrl ? `\n  Tu acceso: ${p.packAccessUrl}` : "";
    return `• ${nombreDelPack(p)} — ${formatPesos(p.totalArs)} (pedido #${p.orderId})${acceso}`;
  });
  const text = `Hola ${nombre},

Tu compra fue confirmada: pagaste ${packs.length} packs en un solo pago. Guardá este email como comprobante.

Fecha: ${fecha}${album ? `\nÁlbum: ${album}` : ""}

${lineasTexto.join("\n")}

Total pagado: ${total}
Medio de pago: ${medio}

Cada pack tiene su propio link: es tu acceso directo para elegir y canjear tus fotos cuando corresponda (no necesitás crear cuenta).${
    faltaAlgunEnlace
      ? `\nSi a algún pack le falta el link, entrá en ${input.recoverUrl}, ingresá este mismo email y te lo enviamos al instante. Tu compra ya está registrada.`
      : ""
  }

Saludos,
ComprameLaFoto`;

  const filasHtml = packs
    .map((p) => {
      const acceso = p.packAccessUrl
        ? `<a href="${escapeHtml(p.packAccessUrl)}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 8px 14px; border-radius: 6px; text-decoration: none;">Acceder a ${escapeHtml(
            p.packName?.trim() || "tu pack",
          )}</a>`
        : `<span style="color: #6b7280;">Link pendiente: pedilo en <a href="${escapeHtml(input.recoverUrl)}">${escapeHtml(
            input.recoverUrl,
          )}</a></span>`;
      return `<tr>
<td style="padding: 10px 12px 10px 0; vertical-align: top;"><strong>${escapeHtml(nombreDelPack(p))}</strong><br><span style="color: #6b7280;">Pedido #${p.orderId} · ${escapeHtml(
        formatPesos(p.totalArs),
      )}</span></td>
<td style="padding: 10px 0; vertical-align: top;">${acceso}</td>
</tr>`;
    })
    .join("");

  const html = `<p>Hola ${escapeHtml(nombre)},</p>
<p>Tu compra fue confirmada: pagaste <strong>${packs.length} packs</strong> en un solo pago. Guardá este email como comprobante.</p>
<p style="margin: 0 0 12px 0; color: #4b5563;">Fecha: ${escapeHtml(fecha)}${album ? `<br>Álbum: ${escapeHtml(album)}` : ""}</p>
<table style="border-collapse: collapse; margin: 0 0 16px 0; font-size: 14px;">${filasHtml}</table>
<p style="margin: 0 0 4px 0;">Total pagado: <strong>${escapeHtml(total)}</strong></p>
<p style="margin: 0 0 16px 0;">Medio de pago: ${escapeHtml(medio)}</p>
<p style="margin: 0 0 20px 0;">Cada pack tiene su propio link: es tu acceso directo para elegir y canjear tus fotos cuando corresponda (no necesitás crear cuenta).</p>
<p>Saludos,<br>ComprameLaFoto</p>`;

  return { subject, text, html };
}
