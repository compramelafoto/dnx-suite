import "server-only";
import { createHash } from "node:crypto";
import { Prisma, prisma } from "@repo/db";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { loadWorkspaceSender } from "@/lib/communications/load-workspace-sender";
import { sendBatchEmails, type OutboundEmail } from "@/lib/communications/send-email";
import { DETAIL_MAX } from "@/lib/communications/constants";
import { FOTOFFICE_BLOG_PLATFORM } from "@/lib/blog/scope";
import { buildAudience, type Recipient } from "./audience";
import { buildBlogDigestEmail, buildBlogPostEmail, blogDigestSubject, blogPostSubject, type BlogEmailPost, type EmailBody } from "./blog-email";
import { blogUrl, loadMailingContext, postUrl, unsubscribeHeaders, type MailingContext } from "./context";
import { campaignStatusFor, isPermanentFailure } from "./delivery-plan";
import {
  CAMPAIGN_KINDS,
  MAILING_BATCH_PAUSE_MS,
  MAILING_BATCH_SIZE,
  MAILING_STALE_CLAIM_MS,
  MAILING_TEST_TEMPLATE_KEY,
} from "./constants";
import { getMailingSettings } from "./settings";
import { DIGEST_LOOKBACK_MS, isoWeekKey } from "./schedule";

/**
 * Envíos a muchos socios: crear el envío, mandarlo de a tandas y retomarlo si se corta.
 *
 * - Cada destinatario es una fila (`FotofficeEmailDelivery`). Antes de mandar una tanda, sus filas
 *   se TOMAN con una actualización condicional: si el botón y la tarea programada llegan a la vez,
 *   cada fila la manda uno solo.
 * - La tanda va con una `Idempotency-Key` derivada de sus filas: si se reintenta dentro de las
 *   24 h, Resend no la repite.
 * - Nunca se manda un correo masivo sin enlace de baja.
 */

type PostRow = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  category: { name: string } | null;
};

const POST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  heroImageUrl: true,
  category: { select: { name: true } },
} as const;

function publishedWhere(workspaceId: string, now: Date) {
  return {
    platform: FOTOFFICE_BLOG_PLATFORM,
    workspaceKey: workspaceId,
    status: "PUBLISHED" as const,
    publishedAt: { lte: now },
  };
}

async function loadPublishedPost(workspaceId: string, postId: number): Promise<PostRow | null> {
  return prisma.blogPost.findFirst({ where: { id: postId, ...publishedWhere(workspaceId, new Date()) }, select: POST_SELECT });
}

function toEmailPost(ctx: MailingContext, p: PostRow): BlogEmailPost | null {
  const url = postUrl(ctx, p.slug);
  if (!url) return null;
  return { title: p.title, excerpt: p.excerpt, heroImageUrl: p.heroImageUrl, url, categoryName: p.category?.name ?? null };
}

/** Socios que recibirían un envío del tema, y cuántos quedan afuera por haberse dado de baja. */
export async function loadAudience(workspaceId: string, topic: string) {
  const [members, optOuts] = await Promise.all([
    prisma.member.findMany({
      where: { workspaceId, status: "ACTIVE", email: { not: null } },
      select: { id: true, email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fotofficeEmailOptOut.findMany({ where: { workspaceId }, select: { email: true, topic: true } }),
  ]);
  return buildAudience(members, optOuts, topic);
}

// ─── Armado del correo de cada destinatario ────────────────────────────────────────────────

type Renderer = (r: { email: string; firstName: string | null }) => { body: EmailBody; oneClickUrl: string };

async function rendererFor(campaign: {
  workspaceId: string;
  kind: string;
  blogPostId: number | null;
  blogPostIds: number[];
  topic: string;
}): Promise<Renderer> {
  const ctx = await loadMailingContext(campaign.workspaceId);
  const unsubscribe = ctx.unsubscribe;
  if (!unsubscribe) throw new Error("Falta la dirección pública o la clave del enlace de baja.");

  if (campaign.kind === CAMPAIGN_KINDS.BLOG_POST) {
    const row = campaign.blogPostId ? await loadPublishedPost(campaign.workspaceId, campaign.blogPostId) : null;
    const post = row ? toEmailPost(ctx, row) : null;
    if (!post) throw new Error("El artículo ya no está publicado o el sitio no tiene dirección pública.");
    return (r) => {
      const links = unsubscribe(r.email, campaign.topic);
      return {
        body: buildBlogPostEmail({
          brand: ctx.brand,
          post,
          firstName: r.firstName,
          signature: ctx.signature,
          footer: { reason: ctx.reason, unsubscribeUrl: links.pageUrl },
        }),
        oneClickUrl: links.oneClickUrl,
      };
    };
  }

  if (campaign.kind === CAMPAIGN_KINDS.BLOG_DIGEST) {
    const rows = await prisma.blogPost.findMany({
      where: { id: { in: campaign.blogPostIds }, ...publishedWhere(campaign.workspaceId, new Date()) },
      select: POST_SELECT,
      orderBy: { publishedAt: "desc" },
    });
    const posts = rows.map((p) => toEmailPost(ctx, p)).filter((p): p is BlogEmailPost => p !== null);
    const todoElBlog = blogUrl(ctx);
    if (posts.length === 0 || !todoElBlog) throw new Error("No quedan artículos publicados para el resumen.");
    return (r) => {
      const links = unsubscribe(r.email, campaign.topic);
      return {
        body: buildBlogDigestEmail({
          brand: ctx.brand,
          posts,
          firstName: r.firstName,
          signature: ctx.signature,
          footer: { reason: ctx.reason, unsubscribeUrl: links.pageUrl },
          blogUrl: todoElBlog,
        }),
        oneClickUrl: links.oneClickUrl,
      };
    };
  }

  throw new Error(`Tipo de envío desconocido: ${campaign.kind}`);
}

// ─── Crear ─────────────────────────────────────────────────────────────────────────────────

export type CreateCampaignResult =
  | { ok: true; campaignId: string; recipients: number; optedOut: number }
  | { ok: false; reason: "DUPLICATE" | "NO_RECIPIENTS" };

async function createCampaign(input: {
  workspaceId: string;
  kind: string;
  topic: string;
  dedupeKey: string;
  subject: string;
  blogPostId?: number | null;
  blogPostIds?: number[];
  createdByUserId?: number | null;
}): Promise<CreateCampaignResult> {
  const { recipients, optedOut } = await loadAudience(input.workspaceId, input.topic);
  if (recipients.length === 0) return { ok: false, reason: "NO_RECIPIENTS" };
  try {
    const campaign = await prisma.$transaction(async (tx) => {
      const c = await tx.fotofficeEmailCampaign.create({
        data: {
          workspaceId: input.workspaceId,
          kind: input.kind,
          topic: input.topic,
          dedupeKey: input.dedupeKey,
          subject: input.subject,
          blogPostId: input.blogPostId ?? null,
          blogPostIds: input.blogPostIds ?? [],
          recipientsTotal: recipients.length,
          optedOutCount: optedOut,
          createdByUserId: input.createdByUserId ?? null,
        },
        select: { id: true },
      });
      await tx.fotofficeEmailDelivery.createMany({
        data: recipients.map((r: Recipient) => ({
          campaignId: c.id,
          memberId: r.memberId,
          email: r.email,
          firstName: r.firstName,
        })),
        skipDuplicates: true,
      });
      return c;
    });
    return { ok: true, campaignId: campaign.id, recipients: recipients.length, optedOut };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "DUPLICATE" };
    }
    throw error;
  }
}

export function blogPostDedupeKey(workspaceId: string, postId: number): string {
  return `blog-post:${workspaceId}:${postId}`;
}

// ─── Mandar ────────────────────────────────────────────────────────────────────────────────

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

function corto(detail: string): string {
  const d = detail.replace(/re_[A-Za-z0-9_-]{8,}/g, "[redactado]");
  return d.length > DETAIL_MAX ? `${d.slice(0, DETAIL_MAX - 1)}…` : d;
}

export type ProcessReport = { sent: number; failed: number; retry: number; done: boolean };

/**
 * Manda lo pendiente de un envío, de a tandas, hasta terminar o hasta `deadline`. Se puede llamar
 * las veces que haga falta: retoma donde quedó.
 */
export async function processCampaign(campaignId: string, opts: { deadline?: number } = {}): Promise<ProcessReport> {
  const deadline = opts.deadline ?? Date.now() + 50_000;
  const report: ProcessReport = { sent: 0, failed: 0, retry: 0, done: false };

  const campaign = await prisma.fotofficeEmailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, workspaceId: true, kind: true, topic: true, blogPostId: true, blogPostIds: true, status: true },
  });
  if (!campaign) return { ...report, done: true };

  // Filas tomadas por una pasada que se cortó: vuelven a la cola. La clave de idempotencia evita
  // que una tanda que sí había salido se repita.
  await prisma.fotofficeEmailDelivery.updateMany({
    where: { campaignId, status: "SENDING", claimedAt: { lt: new Date(Date.now() - MAILING_STALE_CLAIM_MS) } },
    data: { status: "PENDING", claimedAt: null },
  });

  let render: Renderer;
  let sender: Awaited<ReturnType<typeof loadWorkspaceSender>>;
  try {
    [render, sender] = await Promise.all([rendererFor(campaign), loadWorkspaceSender(campaign.workspaceId)]);
  } catch (error) {
    // Sin artículo o sin enlace de baja no hay correo posible: se cierra con error, no se reintenta.
    const detail = corto(error instanceof Error ? error.message : "error desconocido");
    await prisma.fotofficeEmailDelivery.updateMany({
      where: { campaignId, status: { in: ["PENDING", "SENDING"] } },
      data: { status: "FAILED", error: detail },
    });
    await refreshCampaign(campaignId);
    console.error("[fotoffice][correo] no se pudo armar el envío", { campaignId, detail });
    return { ...report, done: true };
  }

  let primero = true;
  while (Date.now() < deadline) {
    const candidatas = await prisma.fotofficeEmailDelivery.findMany({
      where: { campaignId, status: "PENDING" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: MAILING_BATCH_SIZE,
    });
    if (candidatas.length === 0) break;

    const ids = candidatas.map((c) => c.id);
    const stamp = new Date();
    await prisma.fotofficeEmailDelivery.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "SENDING", claimedAt: stamp },
    });
    const tomadas = await prisma.fotofficeEmailDelivery.findMany({
      where: { id: { in: ids }, status: "SENDING", claimedAt: stamp },
      select: { id: true, email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    });
    if (tomadas.length === 0) continue;

    if (!primero) await pausa(MAILING_BATCH_PAUSE_MS);
    primero = false;

    const mensajes: OutboundEmail[] = tomadas.map((d) => {
      const { body, oneClickUrl } = render({ email: d.email, firstName: d.firstName });
      return { to: d.email, ...body, sender, headers: unsubscribeHeaders(oneClickUrl) };
    });
    const clave = createHash("sha256")
      .update(tomadas.map((t) => t.id).sort().join(","))
      .digest("hex")
      .slice(0, 32);
    const salida = await sendBatchEmails(mensajes, { idempotencyKey: `fo-mail-${clave}` });

    if (salida.status === "SENT") {
      const ahora = new Date();
      await prisma.$transaction(
        tomadas.map((d, i) =>
          prisma.fotofficeEmailDelivery.update({
            where: { id: d.id },
            data: { status: "SENT", sentAt: ahora, resendId: salida.providerIds[i] ?? null, error: null },
          }),
        ),
      );
      report.sent += tomadas.length;
      continue;
    }

    const detail = corto(salida.detail);
    if (isPermanentFailure(salida.status, salida.detail)) {
      await prisma.fotofficeEmailDelivery.updateMany({
        where: { id: { in: tomadas.map((t) => t.id) } },
        data: { status: "FAILED", error: detail },
      });
      report.failed += tomadas.length;
      continue;
    }
    // Pasajero (red, 429, 5xx, configuración): vuelve a la cola y lo retoma la tarea programada.
    await prisma.fotofficeEmailDelivery.updateMany({
      where: { id: { in: tomadas.map((t) => t.id) } },
      data: { status: "PENDING", claimedAt: null, error: detail },
    });
    report.retry += tomadas.length;
    console.error("[fotoffice][correo] tanda rechazada, se reintenta", { campaignId, status: salida.status, detail });
    break;
  }

  const status = await refreshCampaign(campaignId);
  return { ...report, done: status !== "SENDING" };
}

/** Recalcula los contadores del envío desde sus filas y lo cierra si no queda nada. */
async function refreshCampaign(campaignId: string) {
  const grupos = await prisma.fotofficeEmailDelivery.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const n = (s: string) => grupos.find((g) => g.status === s)?._count._all ?? 0;
  const counts = { pending: n("PENDING"), sending: n("SENDING"), sent: n("SENT"), failed: n("FAILED") };
  const status = campaignStatusFor(counts);
  await prisma.fotofficeEmailCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: counts.sent,
      failedCount: counts.failed,
      status,
      finishedAt: status === "SENDING" ? null : new Date(),
    },
  });
  return status;
}

/** Retoma los envíos que quedaron a medias (lo llama la tarea programada). */
export async function resumePendingCampaigns(deadline: number) {
  const abiertas = await prisma.fotofficeEmailCampaign.findMany({
    where: { status: "SENDING" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let sent = 0;
  for (const c of abiertas) {
    if (Date.now() >= deadline) break;
    const r = await processCampaign(c.id, { deadline });
    sent += r.sent;
  }
  return { campaigns: abiertas.length, sent };
}

// ─── Blog: un artículo ─────────────────────────────────────────────────────────────────────

export type BlogSendResult =
  | { ok: true; campaignId: string; recipients: number; sent: number; done: boolean }
  | { ok: false; error: string };

export async function sendBlogPostToMembers(input: {
  workspaceId: string;
  postId: number;
  userId: number;
}): Promise<BlogSendResult> {
  const settings = await getMailingSettings(input.workspaceId);
  if (!settings.bulkEnabled) {
    return { ok: false, error: "Los envíos a socios están apagados. Se encienden en Comunicación → Correo." };
  }
  const post = await loadPublishedPost(input.workspaceId, input.postId);
  if (!post) return { ok: false, error: "Sólo se pueden enviar artículos publicados." };
  const ctx = await loadMailingContext(input.workspaceId);
  if (!ctx.unsubscribe || !postUrl(ctx, post.slug)) {
    return { ok: false, error: "Falta configuración del sistema para el enlace del artículo o la baja. Avisale al equipo técnico." };
  }

  const creado = await createCampaign({
    workspaceId: input.workspaceId,
    kind: CAMPAIGN_KINDS.BLOG_POST,
    topic: "blog",
    dedupeKey: blogPostDedupeKey(input.workspaceId, post.id),
    subject: blogPostSubject(post),
    blogPostId: post.id,
    createdByUserId: input.userId,
  });
  if (!creado.ok) {
    return {
      ok: false,
      error: creado.reason === "DUPLICATE" ? "Este artículo ya se envió a los socios." : "No hay socios activos con correo para enviarle.",
    };
  }
  const r = await processCampaign(creado.campaignId, { deadline: Date.now() + 45_000 });
  return { ok: true, campaignId: creado.campaignId, recipients: creado.recipients, sent: r.sent, done: r.done };
}

/** Una prueba del correo del artículo a quien está mirando (no cuenta como envío a socios). */
export async function sendBlogPostTest(input: {
  workspaceId: string;
  postId: number;
  to: string;
  firstName: string | null;
  userId: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const post = await loadPublishedPost(input.workspaceId, input.postId);
  if (!post) return { ok: false, error: "Sólo se pueden probar artículos publicados." };
  const ctx = await loadMailingContext(input.workspaceId);
  const emailPost = toEmailPost(ctx, post);
  if (!emailPost || !ctx.unsubscribe) {
    return { ok: false, error: "Falta configuración del sistema para el enlace del artículo o la baja. Avisale al equipo técnico." };
  }
  const body = buildBlogPostEmail({
    brand: ctx.brand,
    post: emailPost,
    firstName: input.firstName,
    signature: ctx.signature,
    footer: { reason: ctx.reason, unsubscribeUrl: ctx.unsubscribe(input.to, "blog").pageUrl },
  });
  const salida = await sendAndLogEmail({
    to: input.to,
    templateKey: MAILING_TEST_TEMPLATE_KEY,
    body: { ...body, subject: `[Prueba] ${body.subject}` },
    userId: input.userId,
    workspaceId: input.workspaceId,
  });
  return salida.status === "SENT" ? { ok: true } : { ok: false, error: "No se pudo enviar la prueba. Quedó registrado para revisarlo." };
}

// ─── Blog: resumen semanal ─────────────────────────────────────────────────────────────────

/** Artículos de los últimos 7 días que no salieron solos. */
async function digestPosts(workspaceId: string, now: Date) {
  const [rows, yaEnviados] = await Promise.all([
    prisma.blogPost.findMany({
      where: { ...publishedWhere(workspaceId, now), publishedAt: { lte: now, gte: new Date(now.getTime() - DIGEST_LOOKBACK_MS) } },
      select: { id: true, title: true },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
    prisma.fotofficeEmailCampaign.findMany({
      where: { workspaceId, kind: CAMPAIGN_KINDS.BLOG_POST, blogPostId: { not: null } },
      select: { blogPostId: true },
    }),
  ]);
  const enviados = new Set(yaEnviados.map((c) => c.blogPostId));
  return rows.filter((r) => !enviados.has(r.id));
}

/** Crea y manda el resumen de la semana de una institución, si corresponde y no salió ya. */
export async function sendWeeklyDigest(workspaceId: string, now: Date, deadline: number) {
  const settings = await getMailingSettings(workspaceId);
  if (!settings.bulkEnabled || !settings.weeklyBlogDigest) return { status: "OFF" as const };
  const posts = await digestPosts(workspaceId, now);
  if (posts.length === 0) return { status: "NOTHING_NEW" as const };
  const ctx = await loadMailingContext(workspaceId);
  if (!ctx.unsubscribe || !ctx.siteBase) return { status: "NOT_CONFIGURED" as const };

  const creado = await createCampaign({
    workspaceId,
    kind: CAMPAIGN_KINDS.BLOG_DIGEST,
    topic: "blog",
    dedupeKey: `blog-digest:${workspaceId}:${isoWeekKey(now)}`,
    subject: blogDigestSubject(ctx.brand.name, posts),
    blogPostIds: posts.map((p) => p.id),
  });
  if (!creado.ok) return { status: creado.reason };
  const r = await processCampaign(creado.campaignId, { deadline });
  return { status: "CREATED" as const, sent: r.sent };
}
