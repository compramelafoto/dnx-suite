import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * «Aparecés en N fotos nuevas»: avisa al comprador de las fotos sumadas que todavía no le
 * contamos, con el link a su mismo panel de descarga. Devuelve si salió el mail.
 */
export async function notifyGrowingPackNewPhotos(orderId: number): Promise<boolean> {
  const pending = await prisma.orderAddedPhoto.findMany({
    where: { orderId, notifiedAt: null, removedByClientAt: null },
    select: { id: true },
  });
  if (pending.length === 0) return false;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      buyerEmail: true,
      buyerName: true,
      isTest: true,
      album: { select: { title: true } },
    },
  });
  const token = await prisma.orderDownloadToken.findFirst({
    where: { orderId, type: "CLIENT_DIGITAL", photoId: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  const ids = pending.map((p) => p.id);
  // Pedido de prueba o sin link de descarga: no hay a quién avisar; se marcan para no reintentar.
  if (!order?.buyerEmail || order.isTest || !token) {
    await prisma.orderAddedPhoto.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: new Date() } });
    return false;
  }

  const appUrl = process.env.APP_URL || "https://compramelafoto.com";
  const panelUrl = `${appUrl}/descargas/${token.token}`;
  const count = pending.length;
  const fotos = count === 1 ? "foto nueva" : "fotos nuevas";
  const title = order.album?.title || "el evento";
  const greeting = order.buyerName?.trim() ? `Hola ${order.buyerName.trim()}` : "Hola";

  const text = `${greeting}:\n\nAparecés en ${count} ${fotos} de "${title}". Ya están en tu panel de descarga, junto con las que ya tenías:\n${panelUrl}\n\nSi el fotógrafo sigue subiendo fotos del evento, te vamos a seguir avisando.`;
  const html = `<p>${escapeHtml(greeting)}:</p>
<p>Aparecés en <strong>${count} ${fotos}</strong> de <strong>${escapeHtml(title)}</strong>. Ya están en tu panel de descarga, junto con las que ya tenías.</p>
<p><a href="${panelUrl}" style="display:inline-block;padding:12px 20px;background:#c27b3d;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Ver mis fotos</a></p>
<p style="color:#6b7280;font-size:13px">Si el fotógrafo sigue subiendo fotos del evento, te vamos a seguir avisando.</p>`;

  const sent = await sendEmail({
    to: order.buyerEmail,
    subject: `Aparecés en ${count} ${fotos} de "${title}"`,
    html,
    text,
  });
  if (!sent.success) {
    console.warn("[growing-pack] no salió el mail de fotos nuevas", orderId, sent.error);
    return false;
  }
  await prisma.orderAddedPhoto.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: new Date() } });
  return true;
}
