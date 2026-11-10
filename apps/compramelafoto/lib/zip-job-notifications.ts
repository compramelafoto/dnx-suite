import { prisma } from "@/lib/prisma";
import { queueEmail, renderTemplate } from "@/lib/email-queue";
import { getOrderDownloadTokens } from "@/lib/download-tokens";
import { resolveClientDigitalDownloadLinks } from "@/lib/digital-download/download-center-rollout";
import type { ZipGenerationJob } from "@/lib/prisma";
import { notaDeImpresas } from "@/lib/digital-download/nota-de-impresas";

/**
 * Fotógrafo del pedido y cuántas fotos impresas trae. Sirve para que el correo de descarga
 * aclare que las impresas van en papel y para que "Responder" le llegue al fotógrafo.
 * Si algo falla, el correo sale igual que antes.
 */
async function fotografoEImpresas(orderId: number): Promise<{
  fotografo: { name: string | null; email: string | null } | null;
  cantidadImpresas: number;
}> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { albumId: true } });
    const album = order?.albumId
      ? await prisma.album.findUnique({ where: { id: order.albumId }, select: { userId: true } })
      : null;
    const [fotografo, impresas] = await Promise.all([
      album?.userId
        ? prisma.user.findUnique({ where: { id: album.userId }, select: { name: true, email: true } })
        : null,
      prisma.orderItem.aggregate({
        where: { orderId, productType: "PRINT" },
        _sum: { quantity: true },
      }),
    ]);
    return { fotografo: fotografo ?? null, cantidadImpresas: impresas._sum.quantity ?? 0 };
  } catch (err) {
    console.error("[zip-job-notifications] no se pudo leer fotógrafo/impresas", { orderId, err });
    return { fotografo: null, cantidadImpresas: 0 };
  }
}

/** Pone la nota después del primer párrafo (el saludo); si no lo encuentra, al principio. */
function insertarDespuesDelSaludo(cuerpo: string, nota: string, finDeParrafo: "\n\n" | "</p>"): string {
  const esHtml = finDeParrafo === "</p>";
  const bloque = esHtml ? nota : `${nota}\n\n`;
  const i = cuerpo.indexOf(finDeParrafo);
  if (i < 0) return `${bloque}${cuerpo}`;
  const corte = i + finDeParrafo.length;
  return `${cuerpo.slice(0, corte)}${bloque}${cuerpo.slice(corte)}`;
}

/** Agrega la nota de impresas (si corresponde) al correo de la plantilla. */
function aplicarNotaDeImpresas(
  template: { subject: string; bodyText: string; bodyHtml?: string | null },
  orderId: number,
  datos: Awaited<ReturnType<typeof fotografoEImpresas>>
): { subject: string; bodyText: string; bodyHtml: string } {
  const nota = notaDeImpresas({ orderId, cantidadImpresas: datos.cantidadImpresas, fotografo: datos.fotografo });
  if (!nota) {
    return { subject: template.subject, bodyText: template.bodyText, bodyHtml: template.bodyHtml ?? "" };
  }
  return {
    subject: nota.asunto,
    bodyText: insertarDespuesDelSaludo(template.bodyText, nota.texto, "\n\n"),
    // Sin HTML de plantilla, el envío arma el HTML desde el texto (que ya trae la nota).
    bodyHtml: template.bodyHtml ? insertarDespuesDelSaludo(template.bodyHtml, nota.html, "</p>") : "",
  };
}

const enabled =
  process.env.ENABLE_ZIP_READY_EMAIL === undefined ||
  process.env.ENABLE_ZIP_READY_EMAIL === "1" ||
  process.env.ENABLE_ZIP_READY_EMAIL.toLowerCase() === "true";

export async function notifyClientDigitalZipReady(
  job: ZipGenerationJob | null
): Promise<void> {
  if (!enabled) {
    return;
  }
  if (!job) return;
  if (job.type !== "ORDER_DOWNLOAD") return;
  if (!job.orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: job.orderId },
    select: {
      id: true,
      createdAt: true,
      buyerEmail: true,
      buyerUserId: true,
      isTest: true,
    },
  });

  // Pedido de prueba (p. ej. el DEMO de "Probar como cliente"): el ZIP se arma igual para
  // descargarlo desde Pedidos, pero no se avisa por correo.
  if (!order?.buyerEmail || order.isTest) {
    return;
  }

  // Usar link por token (vigencia según downloadLinkDays) en vez de URL presigned (24h)
  const tokens = await getOrderDownloadTokens(job.orderId);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
  if (!clientToken) {
    console.warn("[zip-job-notifications] No hay token de descarga para order", job.orderId);
    return;
  }

  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const { primaryClientUrl: downloadUrl } = resolveClientDigitalDownloadLinks({
    orderId: order.id,
    orderCreatedAt: order.createdAt,
    accessToken: clientToken.token,
    baseUrl: appUrl,
    context: "zip_job_notify",
  });

  const customerName =
    order.buyerEmail.split("@")[0] ||
    "Cliente";
  const expiresAtLabel = clientToken.expiresAt
    ? clientToken.expiresAt.toLocaleDateString("es-AR")
    : new Date().toLocaleDateString("es-AR");

  const template = await renderTemplate("digital_download", {
    customerName,
    orderId: order.id,
    downloadUrl,
    expiresAt: expiresAtLabel,
  });

  const loginUrl = `${appUrl}/cliente/login`;
  const pedidosUrl = `${appUrl}/cliente/pedidos`;

  const datosDelPedido = await fotografoEImpresas(order.id);
  const conNota = aplicarNotaDeImpresas(template, order.id, datosDelPedido);
  let bodyText = conNota.bodyText;
  let bodyHtml = conNota.bodyHtml;

  if (order.buyerUserId == null) {
    const guestText = `

Compraste como invitado. Si creás una cuenta o iniciás sesión con este email (${order.buyerEmail}), podés ver el estado de tus pedidos y tu historial en cualquier momento.
Iniciar sesión: ${loginUrl}
Mis pedidos: ${pedidosUrl}`;
    const guestHtml = `
<p style="margin-top: 1.25em; padding-top: 1em; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
  Compraste como invitado. Si creás una cuenta o iniciás sesión con este email, podés ver el estado de tus pedidos y tu historial en cualquier momento.<br>
  <a href="${loginUrl}">Iniciar sesión</a> · <a href="${pedidosUrl}">Mis pedidos</a>
</p>`;
    bodyText += guestText;
    bodyHtml += guestHtml;
  }

  await queueEmail({
    to: order.buyerEmail,
    subject: conNota.subject,
    body: bodyText,
    htmlBody: bodyHtml,
    replyTo: datosDelPedido.fotografo?.email,
    idempotencyKey: `zip-job-${job.id}-digital-download`,
  });

  try {
    await prisma.order.update({
      where: { id: order.id },
      data: { digitalDeliveredAt: new Date() } as any,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (!msg.includes("digitalDeliveredAt") && !msg.includes("Unknown field") && !msg.includes("Unknown column")) {
      console.error("Error actualizando digitalDeliveredAt:", err);
    }
  }
}

/**
 * Reenvía el email de descarga digital para un pedido (por orderId).
 * Usa idempotencyKey único para permitir reenvíos.
 */
export async function resendDigitalDownloadEmailForOrder(
  orderId: number,
  options?: { idempotencyKey?: string }
): Promise<{ queued: boolean; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      createdAt: true,
      buyerEmail: true,
      buyerUserId: true,
      albumId: true,
    },
  });

  if (!order?.buyerEmail) {
    return { queued: false, error: "Pedido sin email" };
  }

  const tokens = await getOrderDownloadTokens(orderId);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
  if (!clientToken) {
    return { queued: false, error: "Sin token de descarga" };
  }

  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const { primaryClientUrl: downloadUrl } = resolveClientDigitalDownloadLinks({
    orderId: order.id,
    orderCreatedAt: order.createdAt,
    accessToken: clientToken.token,
    baseUrl: appUrl,
    context: "zip_job_resend",
  });

  const customerName = order.buyerEmail.split("@")[0] || "Cliente";
  const expiresAtLabel = clientToken.expiresAt
    ? clientToken.expiresAt.toLocaleDateString("es-AR")
    : new Date().toLocaleDateString("es-AR");

  const template = await renderTemplate("digital_download", {
    customerName,
    orderId: order.id,
    downloadUrl,
    expiresAt: expiresAtLabel,
  });

  const loginUrl = `${appUrl}/cliente/login`;
  const pedidosUrl = `${appUrl}/cliente/pedidos`;

  const datosDelPedido = await fotografoEImpresas(order.id);
  const conNota = aplicarNotaDeImpresas(template, order.id, datosDelPedido);
  let bodyText = conNota.bodyText;
  let bodyHtml = conNota.bodyHtml;

  if (order.buyerUserId == null) {
    const guestText = `

Compraste como invitado. Si creás una cuenta o iniciás sesión con este email (${order.buyerEmail}), podés ver el estado de tus pedidos y tu historial en cualquier momento.
Iniciar sesión: ${loginUrl}
Mis pedidos: ${pedidosUrl}`;
    const guestHtml = `
<p style="margin-top: 1.25em; padding-top: 1em; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
  Compraste como invitado. Si creás una cuenta o iniciás sesión con este email, podés ver el estado de tus pedidos y tu historial en cualquier momento.<br>
  <a href="${loginUrl}">Iniciar sesión</a> · <a href="${pedidosUrl}">Mis pedidos</a>
</p>`;
    bodyText += guestText;
    bodyHtml += guestHtml;
  }

  const idempotencyKey =
    options?.idempotencyKey ?? `resend-digital-${orderId}-${Date.now()}`;

  const { queued } = await queueEmail({
    to: order.buyerEmail,
    subject: conNota.subject,
    body: bodyText,
    htmlBody: bodyHtml,
    replyTo: datosDelPedido.fotografo?.email,
    idempotencyKey,
  });

  return { queued };
}
