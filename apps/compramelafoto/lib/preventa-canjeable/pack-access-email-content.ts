/**
 * Arma el email que recibe el comprador de un pack de preventa.
 * Sirve como comprobante: detalle del pack, importe, fecha y medio de pago,
 * además del link de acceso para canjear las fotos más adelante.
 *
 * Es una función pura para poder testearla y reutilizarla en reenvíos.
 */

import type { PreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";

export type PreventaPackAccessEmailInput = {
  orderId: number;
  buyerName: string | null;
  buyerEmail: string;
  albumTitle: string | null;
  /** Fecha de la compra (Order.createdAt) */
  purchasedAt: Date;
  /** Total en ARS enteros (Order.totalCents guarda pesos, no centavos) */
  totalArs: number;
  mpPaymentId: string | null;
  /** Link directo al pack. Si es null, el email explica cómo recuperarlo. */
  packAccessUrl: string | null;
  /** Página pública para pedir de nuevo el link de acceso */
  recoverUrl: string;
  snapshot: PreventaPackSnapshotV1 | null;
  /** Cuántas unidades del mismo pack entraron en el pedido (1 si no se sabe) */
  packQuantity?: number | null;
};

export type PreventaPackAccessEmailContent = {
  subject: string;
  text: string;
  html: string;
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

function formatFechaArgentina(date: Date): string {
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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveCustomerName(input: PreventaPackAccessEmailInput): string {
  const name = input.buyerName?.trim();
  if (name) return name;
  const email = input.buyerEmail.trim();
  return email.includes("@") ? email.split("@")[0] : email;
}

/** Qué incluye el pack, en palabras del cliente (usa `name`, no el `summary` interno del fotógrafo). */
export function buildIncludedLines(snapshot: PreventaPackSnapshotV1 | null): string[] {
  if (!snapshot) return [];
  return [...snapshot.benefits]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((b) => b.includedQuantity > 0)
    .map((b) => b.name.trim())
    .filter((n) => n !== "");
}

export function buildPreventaPackAccessEmailContent(
  input: PreventaPackAccessEmailInput
): PreventaPackAccessEmailContent {
  const customerName = resolveCustomerName(input);
  const packName = input.snapshot?.packName?.trim() || null;
  const packDescription = input.snapshot?.packDescription?.trim() || null;
  const included = buildIncludedLines(input.snapshot);
  const total = formatPesos(input.totalArs);
  const packQuantity = Math.max(1, Math.floor(Number(input.packQuantity ?? 1)) || 1);
  const packLabel = packName
    ? packQuantity > 1
      ? `${packName} (×${packQuantity})`
      : packName
    : null;
  // Con más de una unidad, la descripción del pack habla de UNO solo: hay que aclararlo.
  const descriptionLabel =
    packDescription && packQuantity > 1 ? `Cada pack: ${packDescription}` : packDescription;
  const fecha = formatFechaArgentina(input.purchasedAt);
  const albumTitle = input.albumTitle?.trim() || null;

  const subject = packName
    ? `Comprobante de tu compra #${input.orderId} — ${packName}`
    : `Comprobante de tu compra #${input.orderId} — pack de preventa`;

  // ---------- Texto plano ----------
  const detalle: string[] = [];
  detalle.push(`Pedido: #${input.orderId}`);
  detalle.push(`Fecha: ${fecha}`);
  if (albumTitle) detalle.push(`Álbum: ${albumTitle}`);
  if (packLabel) detalle.push(`Pack: ${packLabel}`);
  if (descriptionLabel) detalle.push(descriptionLabel);
  if (included.length > 0) {
    detalle.push("");
    detalle.push("Incluye:");
    for (const line of included) detalle.push(`• ${line}`);
  }
  detalle.push("");
  detalle.push(`Total pagado: ${total}`);
  detalle.push(
    input.mpPaymentId
      ? `Medio de pago: Mercado Pago (operación ${input.mpPaymentId})`
      : "Medio de pago: Mercado Pago"
  );

  const accesoText = input.packAccessUrl
    ? `Guardá este link: es tu acceso directo para elegir y canjear tus fotos cuando corresponda (no necesitás crear cuenta).
${input.packAccessUrl}`
    : `Todavía no pudimos generar tu link de acceso. Entrá en ${input.recoverUrl}, ingresá este mismo email y te lo enviamos al instante. Tu compra ya está registrada.`;

  const text = `Hola ${customerName},

Tu compra fue confirmada. Guardá este email como comprobante.

${detalle.join("\n")}

${accesoText}

Saludos,
ComprameLaFoto`;

  // ---------- HTML ----------
  const filas: string[] = [];
  const fila = (label: string, value: string) =>
    `<tr><td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;">${escapeHtml(
      label
    )}</td><td style="padding: 6px 0; color: #111827;">${value}</td></tr>`;

  filas.push(fila("Pedido", `#${input.orderId}`));
  filas.push(fila("Fecha", escapeHtml(fecha)));
  if (albumTitle) filas.push(fila("Álbum", escapeHtml(albumTitle)));
  if (packLabel) filas.push(fila("Pack", `<strong>${escapeHtml(packLabel)}</strong>`));
  if (included.length > 0) {
    const items = included
      .map((line) => `<li style="margin: 0 0 4px 0;">${escapeHtml(line)}</li>`)
      .join("");
    filas.push(
      fila("Incluye", `<ul style="margin: 0; padding-left: 18px;">${items}</ul>`)
    );
  }
  filas.push(fila("Total pagado", `<strong>${escapeHtml(total)}</strong>`));
  filas.push(
    fila(
      "Medio de pago",
      input.mpPaymentId
        ? `Mercado Pago (operación ${escapeHtml(input.mpPaymentId)})`
        : "Mercado Pago"
    )
  );

  const descripcionHtml = descriptionLabel
    ? `<p style="margin: 0 0 16px 0; color: #4b5563;">${escapeHtml(descriptionLabel)}</p>`
    : "";

  const accesoHtml = input.packAccessUrl
    ? `<p style="margin: 0 0 12px 0;">Guardá este link: es tu acceso directo para elegir y canjear tus fotos cuando corresponda (no necesitás crear cuenta).</p>
<p style="margin: 0 0 20px 0;"><a href="${escapeHtml(
        input.packAccessUrl
      )}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Acceder a tu pack</a></p>`
    : `<p style="margin: 0 0 20px 0;">Todavía no pudimos generar tu link de acceso. Entrá en <a href="${escapeHtml(
        input.recoverUrl
      )}">${escapeHtml(
        input.recoverUrl
      )}</a>, ingresá este mismo email y te lo enviamos al instante. Tu compra ya está registrada.</p>`;

  const html = `<p>Hola ${escapeHtml(customerName)},</p>
<p>Tu compra fue confirmada. Guardá este email como comprobante.</p>
${descripcionHtml}
<table style="border-collapse: collapse; margin: 0 0 20px 0; font-size: 14px;">${filas.join(
    ""
  )}</table>
${accesoHtml}
<p>Saludos,<br>ComprameLaFoto</p>`;

  return { subject, text, html };
}
