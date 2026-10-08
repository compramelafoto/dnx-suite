import "server-only";
import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { getOrderDownloadTokens } from "@/lib/download-tokens";
import { buildDownloadCenterUrl } from "@/lib/digital-download/download-center-url";

/**
 * Avisos por correo del circuito de diseño. Ninguno frena la operación: si el correo no se
 * encola, el diseño queda igual en el estado correcto y se registra el error.
 */

const APP_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com")
).replace(/\/$/, "");

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function button(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block;background:#c27b3d;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}

type DesignContext = {
  projectId: number;
  buyerEmail: string | null;
  buyerName: string | null;
  /** Pedido donde el cliente ve sus descargas. */
  orderId: number | null;
  albumTitle: string | null;
  photographer: { name: string | null; email: string | null } | null;
};

async function loadDesignContext(projectId: number): Promise<DesignContext | null> {
  const project = await prisma.designProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      albumOrderId: true,
      albumId: true,
      orderItemId: true,
      photographerUserId: true,
    },
  });
  if (!project) return null;

  let buyerEmail: string | null = null;
  let buyerName: string | null = null;
  if (project.albumOrderId) {
    const order = await prisma.order.findUnique({
      where: { id: project.albumOrderId },
      select: { buyerEmail: true, buyerName: true },
    });
    buyerEmail = order?.buyerEmail ?? null;
    buyerName = order?.buyerName ?? null;
  } else if (project.orderItemId) {
    const item = await prisma.preCompraOrderItem.findUnique({
      where: { id: project.orderItemId },
      select: { order: { select: { buyerEmail: true, buyerName: true } } },
    });
    buyerEmail = item?.order.buyerEmail ?? null;
    buyerName = item?.order.buyerName ?? null;
  }

  const [album, photographer] = await Promise.all([
    project.albumId
      ? prisma.album.findUnique({ where: { id: project.albumId }, select: { title: true } })
      : null,
    project.photographerUserId
      ? prisma.user.findUnique({ where: { id: project.photographerUserId }, select: { name: true, email: true } })
      : null,
  ]);

  return {
    projectId: project.id,
    buyerEmail,
    buyerName,
    orderId: project.albumOrderId,
    albumTitle: album?.title ?? null,
    photographer,
  };
}

async function downloadLinkFor(orderId: number | null): Promise<string> {
  if (orderId) {
    const tokens = await getOrderDownloadTokens(orderId);
    const client = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
    if (client) return buildDownloadCenterUrl(client.token);
  }
  return `${APP_URL}/cliente/pedidos`;
}

function greeting(ctx: DesignContext): string {
  const name = ctx.buyerName?.trim() || (ctx.buyerEmail?.split("@")[0] ?? "");
  return name ? `Hola ${name},` : "Hola,";
}

function photographerLabel(ctx: DesignContext): string {
  return ctx.photographer?.name?.trim() || ctx.photographer?.email || "tu fotógrafo";
}

/** Al fotógrafo: hay un diseño nuevo para revisar. */
export async function notifyPhotographerDesignToReview(projectId: number): Promise<void> {
  try {
    const ctx = await loadDesignContext(projectId);
    if (!ctx?.photographer?.email) return;
    const url = `${APP_URL}/fotografo/disenos/${projectId}`;
    const album = ctx.albumTitle ? ` del álbum "${ctx.albumTitle}"` : "";
    await queueEmail({
      to: ctx.photographer.email,
      subject: `Tenés un diseño para revisar${album}`,
      body: `Un cliente${album} eligió sus fotos y el diseño ya está armado.\n\nRevisalo, corregilo si hace falta y aprobalo:\n${url}\n`,
      htmlBody: `<p>Un cliente${escapeHtml(album)} eligió sus fotos y el diseño ya está armado.</p><p>Revisalo, corregilo si hace falta y aprobalo.</p>${button(url, "Revisar el diseño")}`,
      idempotencyKey: `design_v2_to_review_${projectId}`,
    });
  } catch (err) {
    console.error("[design_v2] no se pudo avisar al fotógrafo", { projectId, err });
  }
}

/** Al cliente: el diseño está aprobado y se puede descargar. */
export async function notifyBuyerDesignReady(projectId: number, generatedAt: string): Promise<void> {
  try {
    const ctx = await loadDesignContext(projectId);
    if (!ctx?.buyerEmail) return;
    const url = await downloadLinkFor(ctx.orderId);
    await queueEmail({
      to: ctx.buyerEmail,
      subject: "Tu diseño está listo",
      body: `${greeting(ctx)}\n\n${photographerLabel(ctx)} aprobó el diseño con las fotos que elegiste. Ya lo podés ver y descargar:\n${url}\n`,
      htmlBody: `<p>${escapeHtml(greeting(ctx))}</p><p>${escapeHtml(photographerLabel(ctx))} aprobó el diseño con las fotos que elegiste. Ya lo podés ver y descargar.</p>${button(url, "Ver mi diseño")}`,
      // Una aprobación nueva (después de corregir) vuelve a avisar.
      idempotencyKey: `design_v2_ready_${projectId}_${generatedAt}`,
    });
  } catch (err) {
    console.error("[design_v2] no se pudo avisar al cliente (listo)", { projectId, err });
  }
}

/** Al cliente: el fotógrafo necesita algo para terminar el diseño. */
export async function notifyBuyerDesignChanges(projectId: number, note: string): Promise<void> {
  try {
    const ctx = await loadDesignContext(projectId);
    if (!ctx?.buyerEmail) return;
    const who = photographerLabel(ctx);
    const contact = ctx.photographer?.email ? `\n\nRespondele a ${ctx.photographer.email}.` : "";
    const contactHtml = ctx.photographer?.email
      ? `<p>Respondele a <a href="mailto:${escapeHtml(ctx.photographer.email)}">${escapeHtml(ctx.photographer.email)}</a>.</p>`
      : "";
    await queueEmail({
      to: ctx.buyerEmail,
      subject: "Tu fotógrafo necesita un cambio para terminar tu diseño",
      body: `${greeting(ctx)}\n\n${who} revisó el diseño con las fotos que elegiste y te pide:\n\n"${note}"${contact}\n`,
      htmlBody: `<p>${escapeHtml(greeting(ctx))}</p><p>${escapeHtml(who)} revisó el diseño con las fotos que elegiste y te pide:</p><blockquote style="border-left:3px solid #c27b3d;margin:0;padding:6px 12px;color:#374151;">${escapeHtml(note).replace(/\n/g, "<br>")}</blockquote>${contactHtml}`,
      idempotencyKey: `design_v2_changes_${projectId}_${Date.now()}`,
    });
  } catch (err) {
    console.error("[design_v2] no se pudo avisar al cliente (cambios)", { projectId, err });
  }
}
