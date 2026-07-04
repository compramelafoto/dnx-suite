/**
 * Encola el email de confirmación de pedido (álbum) con datos del fotógrafo
 * y, si hay impresas, información de dónde se imprimen.
 * Si tiene fotos digitales: incluye link de descarga directa (sin login).
 */

import { prisma } from "@/lib/prisma";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";
import { getOrderDownloadTokens } from "@/lib/download-tokens";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

/** Formatea un monto en pesos (ARS). La plataforma usa siempre pesos. */
function formatPesos(pesos: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pesos);
}

/**
 * Encola el email de confirmación para un pedido de álbum ya pagado.
 * Incluye: a qué fotógrafo le compró, si tiene fotos impresas dónde se imprimen,
 * y si tiene fotos digitales un link directo para descargar (sin iniciar sesión).
 */
export async function queueOrderConfirmationEmail(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerEmail: true,
      totalCents: true,
      status: true,
      albumId: true,
      album: {
        select: {
          id: true,
          title: true,
          userId: true,
          selectedLabId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          selectedLab: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      items: {
        select: { productType: true },
      },
    },
  });

  if (!order?.buyerEmail || !order.album) {
    return;
  }

  const customerName =
    order.buyerEmail.includes("@") ? order.buyerEmail.split("@")[0] : order.buyerEmail;
  const photographer = order.album.user;
  const photographerInfo =
    photographer?.name || photographer?.email
      ? `Compraste las fotos a: ${photographer?.name || photographer?.email}${photographer?.name && photographer?.email ? ` (${photographer.email})` : ""}.`
      : "Compraste las fotos a través de ComprameLaFoto.";

  const hasPrintItems = order.items.some((i) => i.productType === "PRINT");
  const hasDigitalItems = order.items.some((i) => i.productType === "DIGITAL");
  let printInfo = "";
  if (hasPrintItems && order.album.selectedLab?.name) {
    printInfo = `Las fotos impresas se imprimen en: ${order.album.selectedLab.name}. El laboratorio o el fotógrafo te contactará para coordinar entrega o retiro.`;
  } else if (hasPrintItems && photographer) {
    printInfo = `La impresión está a cargo del fotógrafo (${photographer.name || photographer.email}). Te contactará para coordinar entrega o retiro.`;
  } else if (hasPrintItems) {
    printInfo = "La impresión está a cargo del fotógrafo del álbum. Te contactará para coordinar entrega o retiro.";
  } else {
    printInfo = "No tenés fotos impresas en este pedido.";
  }

  const orderUrl = `${APP_URL}/cliente/pedidos`;
  const loginUrl = `${APP_URL}/cliente/login`;
  // totalCents en la BD está en pesos (la plataforma usa pesos siempre)
  const total = formatPesos(order.totalCents);
  const status = order.status === "PAID" ? "Pagado" : order.status;

  // Link de descarga directa (sin login) - ensureDigitalDelivery ya creó el token antes de este email
  let downloadUrl: string | null = null;
  if (hasDigitalItems) {
    const tokens = await getOrderDownloadTokens(order.id);
    const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
    if (clientToken) {
      downloadUrl = `${APP_URL}/api/downloads/${clientToken.token}`;
    }
  }

  const downloadSectionText = downloadUrl
    ? `\nDescargar tus fotos (sin iniciar sesión):\n${downloadUrl}\n\n`
    : "";
  const downloadSectionHtml = downloadUrl
    ? `<p><a href="${downloadUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Descargar fotos</a></p>`
    : "";

  const accountSectionText = `\nCrear cuenta o ver tus pedidos: ${loginUrl}\n`;
  const accountSectionHtml = `<p><a href="${loginUrl}">Crear cuenta / Iniciar sesión</a> · <a href="${orderUrl}">Mis pedidos</a></p>`;

  const bodyText = `Hola ${customerName},

Tu pedido #${order.id} fue confirmado exitosamente.

${photographerInfo}

${printInfo}

Total del pedido: ${total}
Estado del pago: ${status}
${downloadSectionText}${accountSectionText}
Saludos,
ComprameLaFoto`;

  const bodyHtml = `<p>Hola ${customerName},</p>
<p>Tu pedido <strong>#${order.id}</strong> fue confirmado exitosamente.</p>
<p>${photographerInfo}</p>
<p>${printInfo}</p>
<p><strong>Total del pedido:</strong> ${total}<br>
<strong>Estado del pago:</strong> ${status}</p>
${downloadSectionHtml}
${accountSectionHtml}
<p>Saludos,<br>ComprameLaFoto</p>`;

  await queueEmail({
    to: order.buyerEmail,
    subject: `Tu pedido #${order.id} fue confirmado`,
    body: bodyText,
    htmlBody: bodyHtml,
    idempotencyKey: `order_confirmed_album_${order.id}`,
  });
}

const PHOTOGRAPHER_ORDER_TEMPLATE_KEY = "photographer_new_order" as const;

/**
 * Encola un email al fotógrafo cuando un pedido de álbum es pagado.
 * Incluye datos del cliente, total y, si hay ítems de impresión, indicación de descargar la carpeta desde el panel.
 */
export async function queuePhotographerOrderNotification(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerEmail: true,
      totalCents: true,
      status: true,
      albumId: true,
      album: {
        select: {
          title: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      items: { select: { productType: true } },
    },
  });

  if (!order?.album?.user?.email) return;

  const photographer = order.album.user;
  const hasPrintItems = order.items.some((i) => i.productType === "PRINT");
  const total = formatPesos(order.totalCents);
  const pedidosUrl = `${APP_URL}/fotografo/pedidos`;
  const exportPrintUrl = `${APP_URL}/api/fotografo/pedidos/${order.id}/export-print`;

  let bodyPrint = "";
  if (hasPrintItems) {
    bodyPrint =
      `\n\nEste pedido incluye fotos para imprimir. Descargá la carpeta organizada (por producto, acabado y tamaño) desde este link (tenés que estar logueado como fotógrafo):\n${exportPrintUrl}\n\nTambién podés entrar a tu panel de pedidos: ${pedidosUrl}`;
  } else {
    bodyPrint = "\n\nPodés gestionar las descargas digitales desde tu panel de pedidos.";
  }

  const template = await getOrCreateTemplate(PHOTOGRAPHER_ORDER_TEMPLATE_KEY, {
    name: "Nuevo pedido (fotógrafo)",
    subject: "Nuevo pedido #{{orderId}} en tu álbum",
    bodyText: "",
    bodyHtml: "",
    variables: [],
  });

  await queueEmail({
    to: photographer.email,
    subject: `Nuevo pedido #${order.id} en tu álbum - ${order.buyerEmail}`,
    body: `Hola ${photographer.name || "fotógrafo/a"},\n\nTenés un nuevo pedido en tu álbum "${order.album.title}".\n\nCliente: ${order.buyerEmail}\nTotal: ${total}\nEstado: ${order.status === "PAID" ? "Pagado" : order.status}${bodyPrint}\n\nVer todos tus pedidos: ${pedidosUrl}\n\nSaludos,\nComprameLaFoto`,
    htmlBody: "",
    templateId: template.id,
    templateData: {
      photographerName: photographer.name || "fotógrafo/a",
      orderId: order.id,
      albumTitle: order.album.title,
      buyerEmail: order.buyerEmail,
      total,
      hasPrintItems,
      pedidosUrl,
      exportPrintUrl: hasPrintItems ? exportPrintUrl : "",
    },
    idempotencyKey: `photographer_order_${order.id}`,
  });
}

/**
 * Encola un email al fotógrafo cuando un pedido de impresión (PrintOrder) es pagado.
 * Usado tanto para pedidos creados desde /imprimir como para los espejos de álbum.
 */
export async function queuePhotographerPrintOrderNotification(printOrderId: number): Promise<void> {
  const order = await prisma.printOrder.findUnique({
    where: { id: printOrderId },
    include: {
      photographer: { select: { id: true, name: true, email: true } },
      items: true,
    },
  });

  if (!order?.photographer?.email) return;

  const tags = Array.isArray(order.tags) ? order.tags : [];
  const tagMatch = tags
    .map((t) => String(t))
    .map((t) => t.match(/^ALBUM_ORDER:(\d+)$/))
    .find(Boolean);
  const linkedAlbumOrderId = tagMatch ? Number(tagMatch[1]) : null;
  const displayOrderId = Number.isFinite(linkedAlbumOrderId) ? (linkedAlbumOrderId as number) : order.id;

  const total = formatPesos(order.total);
  const pedidosUrl = `${APP_URL}/fotografo/pedidos`;
  const exportUrl = `${APP_URL}/api/print-orders/${order.id}/export`;
  const itemsCount = order.items?.length ?? 0;

  const extra = linkedAlbumOrderId
    ? `\n\nEste pedido corresponde a una compra desde un álbum (Pedido #${linkedAlbumOrderId}).`
    : "";

  await queueEmail({
    to: order.photographer.email,
    subject: `Nuevo pedido de impresión #${displayOrderId}`,
    body: `Hola ${order.photographer.name || "fotógrafo/a"},\n\nTenés un nuevo pedido de impresión.\n\nPedido: #${displayOrderId}\nCliente: ${order.customerName || "-"} (${order.customerEmail || "-"})\nItems: ${itemsCount}\nTotal: ${total}${extra}\n\nDescargar carpeta de impresión (tenés que estar logueado):\n${exportUrl}\n\nVer todos tus pedidos: ${pedidosUrl}\n\nSaludos,\nComprameLaFoto`,
    htmlBody: "",
    idempotencyKey: `photographer_print_order_${order.id}`,
  });
}
