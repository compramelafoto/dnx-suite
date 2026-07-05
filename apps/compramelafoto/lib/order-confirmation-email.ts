/**
 * Encola el email de confirmación de pedido (álbum) con datos del fotógrafo
 * y, si hay impresas, información de dónde se imprimen.
 * Si hay fotos digitales: link al centro de descargas (sin login).
 * Con 2+ digitales: aviso de ZIP en preparación como opción secundaria.
 */

import { prisma } from "@/lib/prisma";
import { queueEmail, getOrCreateTemplate } from "@/lib/email-queue";
import { getOrderDownloadTokens } from "@/lib/download-tokens";
import { buildDownloadCenterUrl, buildZipDownloadApiUrl } from "@/lib/digital-download/download-center-url";
import {
  logDownloadCenterRolloutDecision,
} from "@/lib/digital-download/download-center-rollout";
import { getAlbumOrderFulfillmentFromItems } from "@/lib/order-fulfillment";
import { formatBuyerContactForPhotographer } from "@/lib/orders/resolve-album-order-buyer-contact";

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

const MULTI_DIGITAL_ZIP_PENDING_TEXT =
  "Estamos preparando tu archivo ZIP con todas las fotos. Te enviaremos un segundo email automáticamente cuando la descarga esté lista.";

const MULTI_DIGITAL_ZIP_PENDING_HTML =
  "<p>Estamos preparando tu archivo ZIP con todas las fotos. Te enviaremos un segundo email automáticamente cuando la descarga esté lista.</p>";

/**
 * Encola el email de confirmación para un pedido de álbum ya pagado.
 * Incluye: a qué fotógrafo le compró, si tiene fotos impresas dónde se imprimen,
 * y si tiene una sola foto digital un link directo para descargar (sin iniciar sesión).
 */
export async function queueOrderConfirmationEmail(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      createdAt: true,
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
  const digitalItemCount = order.items.filter((i) => i.productType === "DIGITAL").length;
  const hasDigitalItems = digitalItemCount > 0;
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

  let downloadCenterUrl: string | null = null;
  let legacyDownloadUrl: string | null = null;
  let downloadPendingSectionText = "";
  let downloadPendingSectionHtml = "";

  if (hasDigitalItems) {
    const tokens = await getOrderDownloadTokens(order.id);
    const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
    if (clientToken) {
      const rolloutActive = logDownloadCenterRolloutDecision({
        orderId: order.id,
        orderCreatedAt: order.createdAt,
        context: "order_confirmation_email",
      });
      if (rolloutActive) {
        downloadCenterUrl = buildDownloadCenterUrl(clientToken.token);
      } else if (digitalItemCount === 1) {
        legacyDownloadUrl = buildZipDownloadApiUrl(clientToken.token, APP_URL);
      }
    }
    if (digitalItemCount >= 2) {
      downloadPendingSectionText = `\n${MULTI_DIGITAL_ZIP_PENDING_TEXT}\n\n`;
      downloadPendingSectionHtml = MULTI_DIGITAL_ZIP_PENDING_HTML;
    }
  }

  const downloadSectionText = downloadCenterUrl
    ? `\nVer tus fotos (sin iniciar sesión):\n${downloadCenterUrl}\n\n${downloadPendingSectionText}`
    : legacyDownloadUrl
      ? `\nDescargar tus fotos (sin iniciar sesión):\n${legacyDownloadUrl}\n\n`
      : downloadPendingSectionText;
  const downloadSectionHtml = downloadCenterUrl
    ? `<p><a href="${downloadCenterUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Ver mis fotos</a></p>${downloadPendingSectionHtml}`
    : legacyDownloadUrl
      ? `<p><a href="${legacyDownloadUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Descargar fotos</a></p>`
      : downloadPendingSectionHtml;

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

/**
 * Encola el email con link seguro para canje de packs (sin login).
 * Se usa cuando el pedido PREVENTA_PACK queda pagado.
 */
export async function queuePreventaPackAccessEmail(
  orderId: number,
  packAccessUrl: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerEmail: true,
      buyerName: true,
      status: true,
      origin: true,
      album: { select: { title: true } },
    },
  });

  if (!order?.buyerEmail || order.origin !== "PREVENTA_PACK") {
    return;
  }

  const customerName =
    order.buyerName?.trim() ||
    (order.buyerEmail.includes("@") ? order.buyerEmail.split("@")[0] : order.buyerEmail);
  const albumTitle = order.album?.title ? ` del álbum "${order.album.title}"` : "";

  const bodyText = `Hola ${customerName},

Tu compra de pack${albumTitle} fue confirmada.

Guardá este link: es tu acceso directo para elegir y canjear tus fotos cuando corresponda (no necesitás crear cuenta).
${packAccessUrl}

Saludos,
ComprameLaFoto`;

  const bodyHtml = `<p>Hola ${customerName},</p>
<p>Tu compra de pack${albumTitle} fue confirmada.</p>
<p>Guardá este link: es tu acceso directo para elegir y canjear tus fotos cuando corresponda (no necesitás crear cuenta).</p>
<p><a href="${packAccessUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Acceder a tu pack</a></p>
<p>Saludos,<br>ComprameLaFoto</p>`;

  await queueEmail({
    to: order.buyerEmail,
    subject: `Acceso a tu pack de preventa #${order.id}`,
    body: bodyText,
    htmlBody: bodyHtml,
    idempotencyKey: `preventa_pack_access_${order.id}`,
  });
}

export async function queuePreventaPackRecoveryEmail(input: {
  email: string;
  packs: Array<{ orderId: number; albumTitle: string | null; packAccessUrl: string }>;
}): Promise<void> {
  const email = input.email.trim();
  if (!email || input.packs.length === 0) return;

  const customerName = email.includes("@") ? email.split("@")[0] : email;
  const listText = input.packs
    .map(
      (p) =>
        `• Pedido #${p.orderId}${p.albumTitle ? ` (${p.albumTitle})` : ""}\n  ${p.packAccessUrl}`
    )
    .join("\n");
  const listHtml = input.packs
    .map(
      (p) =>
        `<li style="margin: 0 0 10px 0;">
<strong>Pedido #${p.orderId}</strong>${p.albumTitle ? ` (${p.albumTitle})` : ""}<br>
<a href="${p.packAccessUrl}">Acceder a tu pack</a>
</li>`
    )
    .join("");

  const bodyText = `Hola ${customerName},

Acá tenés los links para continuar tu pedido de pack:

${listText}

Si no reconocés alguno, podés ignorarlo.

Saludos,
ComprameLaFoto`;

  const bodyHtml = `<p>Hola ${customerName},</p>
<p>Acá tenés los links para continuar tu pedido de pack:</p>
<ul style="padding-left: 18px; margin: 0 0 16px 0;">${listHtml}</ul>
<p>Si no reconocés alguno, podés ignorarlo.</p>
<p>Saludos,<br>ComprameLaFoto</p>`;

  await queueEmail({
    to: email,
    subject: "Recuperá el acceso a tu pack",
    body: bodyText,
    htmlBody: bodyHtml,
    idempotencyKey: `preventa_pack_recovery_${email}_${Date.now()}`,
  });
}

const PHOTOGRAPHER_ORDER_TEMPLATE_KEY = "photographer_new_order" as const;

/**
 * Encola un email al fotógrafo cuando un pedido de álbum es pagado.
 * Incluye datos del cliente, total, y según el tipo: solo digital, solo impresión (carpeta export-print),
 * o pedido mixto (digital + impresión) con ambos contextos en un solo correo.
 */
export async function queuePhotographerOrderNotification(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerEmail: true,
      buyerName: true,
      buyerPhone: true,
      totalCents: true,
      status: true,
      albumId: true,
      buyerUser: { select: { name: true, phone: true, whatsapp: true } },
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
  const buyer = formatBuyerContactForPhotographer(order, order.buyerUser);
  const buyerLabel = buyer.name || buyer.email || "Cliente";
  const buyerContactLines = [
    buyer.name ? `Nombre: ${buyer.name}` : null,
    buyer.email ? `Email: ${buyer.email}` : null,
    buyer.phone ? `WhatsApp / teléfono: ${buyer.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const { hasDigitalItems, hasPrintItems, kind } = getAlbumOrderFulfillmentFromItems(
    order.items
  );
  const isMixed = kind === "MIXED";
  const total = formatPesos(order.totalCents);
  const pedidosUrl = `${APP_URL}/fotografo/pedidos`;
  const exportPrintUrl = `${APP_URL}/api/fotografo/pedidos/${order.id}/export-print`;

  let bodyPrint = "";
  if (isMixed) {
    bodyPrint =
      `\n\nPedido mixto (digital + impresión):\n` +
      `• El cliente tiene fotos digitales en este pedido: gestioná descargas y seguimiento desde tu panel:\n${pedidosUrl}\n` +
      `• También hay ítems para imprimir. Descargá la carpeta organizada (producto, acabado y tamaño) desde este link (logueado como fotógrafo):\n${exportPrintUrl}\n`;
  } else if (hasPrintItems) {
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
    subject: `Nuevo pedido #${order.id} en tu álbum - ${buyerLabel}`,
    body: `Hola ${photographer.name || "fotógrafo/a"},\n\nTenés un nuevo pedido en tu álbum "${order.album.title}".\n\nDatos del cliente:\n${buyerContactLines}\n\nTotal: ${total}\nEstado: ${order.status === "PAID" ? "Pagado" : order.status}${bodyPrint}\n\nVer todos tus pedidos: ${pedidosUrl}\n\nSaludos,\nComprameLaFoto`,
    htmlBody: "",
    templateId: template.id,
    templateData: {
      photographerName: photographer.name || "fotógrafo/a",
      orderId: order.id,
      albumTitle: order.album.title,
      buyerName: buyer.name || "",
      buyerEmail: buyer.email || order.buyerEmail,
      buyerPhone: buyer.phone || "",
      buyerLabel,
      total,
      hasPrintItems,
      hasDigitalItems,
      isMixed,
      fulfillmentKind: kind,
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
  // Espejo de álbum: fileKey en ítems es `photo:{id}`; el ZIP correcto es export-print del Order de álbum.
  const exportUrl =
    linkedAlbumOrderId != null && Number.isFinite(linkedAlbumOrderId)
      ? `${APP_URL}/api/fotografo/pedidos/${linkedAlbumOrderId}/export-print`
      : `${APP_URL}/api/print-orders/${order.id}/export`;
  const itemsCount = order.items?.length ?? 0;

  const extra = linkedAlbumOrderId
    ? `\n\nEste pedido corresponde a una compra desde un álbum (Pedido #${linkedAlbumOrderId}).`
    : "";

  await queueEmail({
    to: order.photographer.email,
    subject: `Nuevo pedido de impresión #${displayOrderId}`,
    body: `Hola ${order.photographer.name || "fotógrafo/a"},\n\nTenés un nuevo pedido de impresión.\n\nPedido: #${displayOrderId}\nCliente: ${order.customerName || "-"}\nEmail: ${order.customerEmail || "-"}\nWhatsApp / teléfono: ${order.customerPhone || "-"}\nItems: ${itemsCount}\nTotal: ${total}${extra}\n\nDescargar carpeta de impresión (tenés que estar logueado):\n${exportUrl}\n\nVer todos tus pedidos: ${pedidosUrl}\n\nSaludos,\nComprameLaFoto`,
    htmlBody: "",
    idempotencyKey: `photographer_print_order_${order.id}`,
  });
}
