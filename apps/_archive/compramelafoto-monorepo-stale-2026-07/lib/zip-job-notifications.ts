import { prisma, type ZipGenerationJob } from "@/lib/prisma";
import { queueEmail, renderTemplate } from "@/lib/email-queue";
import { getOrderDownloadTokens } from "@/lib/download-tokens";

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
      buyerEmail: true,
      buyerUserId: true,
    },
  });

  if (!order?.buyerEmail) {
    return;
  }

  // Usar link por token (válido ~30 días) en vez de URL presigned (24h)
  const tokens = await getOrderDownloadTokens(job.orderId);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
  if (!clientToken) {
    console.warn("[zip-job-notifications] No hay token de descarga para order", job.orderId);
    return;
  }

  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const downloadUrl = `${appUrl}/api/downloads/${clientToken.token}`;

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

  let bodyText = template.bodyText;
  let bodyHtml = template.bodyHtml ?? "";

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
    subject: template.subject,
    body: bodyText,
    htmlBody: bodyHtml,
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
  const downloadUrl = `${appUrl}/api/downloads/${clientToken.token}`;

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

  let bodyText = template.bodyText;
  let bodyHtml = template.bodyHtml ?? "";

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
    subject: template.subject,
    body: bodyText,
    htmlBody: bodyHtml,
    idempotencyKey,
  });

  return { queued };
}
