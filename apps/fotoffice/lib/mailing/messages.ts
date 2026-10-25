import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { FOTOFFICE_BLOG_PLATFORM } from "@/lib/blog/scope";
import { CAMPAIGN_KINDS } from "./constants";
import { createCampaign, loadAudience, processCampaign } from "./campaigns";
import { loadMailingContext } from "./context";
import { readyToSend, type MessageFields } from "./message-form";
import { getMailingSettings } from "./settings";
import { holdForLinkedPost, linkedBlogPostSlug, linkedPostWarning, type LinkedPost } from "./linked-post";
import type { MetricCounts } from "./webhook-events";

/**
 * Campañas libres (Comunicación → Campañas): borrador → (aprobación) → programada → enviada.
 *
 * Cada cambio de estado es una actualización condicional sobre el estado esperado: si dos personas
 * aprietan a la vez (o la tarea programada y alguien desde el panel), sólo una avanza.
 * Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapa-4-campanas-design.md
 */

export const MESSAGE_TOPIC = "novedades";

const SELECT = {
  id: true,
  name: true,
  subject: true,
  body: true,
  imageUrl: true,
  ctaLabel: true,
  ctaUrl: true,
  categoryIds: true,
  specialties: true,
  status: true,
  scheduledAt: true,
  createdByUserId: true,
  approvalRequestedAt: true,
  approvedByUserId: true,
  approvedAt: true,
  campaignId: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
} as const;


export function getMessage(workspaceId: string, id: string) {
  return prisma.fotofficeMailingMessage.findFirst({ where: { id, workspaceId }, select: SELECT });
}

export function listMessages(workspaceId: string) {
  return prisma.fotofficeMailingMessage.findMany({
    where: { workspaceId },
    select: SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createDraft(workspaceId: string, userId: number): Promise<string> {
  const m = await prisma.fotofficeMailingMessage.create({
    data: {
      workspaceId,
      name: "Campaña nueva",
      subject: "",
      body: "¡Hola, {nombre}!\n\n",
      createdByUserId: userId,
    },
    select: { id: true },
  });
  return m.id;
}

/** Sólo un borrador se edita. Una programada o en aprobación primero vuelve a borrador. */
export async function saveDraft(workspaceId: string, id: string, f: MessageFields): Promise<boolean> {
  const r = await prisma.fotofficeMailingMessage.updateMany({
    where: { id, workspaceId, status: "DRAFT" },
    data: {
      name: f.name,
      subject: f.subject,
      body: f.body,
      imageUrl: f.imageUrl,
      ctaLabel: f.ctaLabel,
      ctaUrl: f.ctaUrl,
      categoryIds: f.categoryIds,
      specialties: f.specialties,
      scheduledAt: f.scheduledAt,
    },
  });
  return r.count === 1;
}

export async function deleteDraft(workspaceId: string, id: string): Promise<boolean> {
  const r = await prisma.fotofficeMailingMessage.deleteMany({ where: { id, workspaceId, status: "DRAFT" } });
  return r.count === 1;
}

/** Programada o esperando aprobación → borrador (se puede volver a editar). */
export async function backToDraft(workspaceId: string, id: string): Promise<boolean> {
  const r = await prisma.fotofficeMailingMessage.updateMany({
    where: { id, workspaceId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } },
    data: { status: "DRAFT", approvalRequestedAt: null, approvedAt: null, approvedByUserId: null },
  });
  return r.count === 1;
}

export async function countMessageAudience(workspaceId: string, m: { categoryIds: string[]; specialties: string[] }) {
  const { recipients, optedOut } = await loadAudience(workspaceId, MESSAGE_TOPIC, {
    categoryIds: m.categoryIds,
    specialties: m.specialties,
  });
  return { recipients: recipients.length, optedOut };
}

/**
 * El artículo del blog propio al que lleva el botón, si lleva a uno. `post` es null si no existe.
 * Ver `lib/mailing/linked-post.ts`.
 */
export async function loadLinkedPost(
  workspaceId: string,
  ctaUrl: string | null,
): Promise<{ slug: string; post: LinkedPost | null } | null> {
  if (!ctaUrl) return null;
  const [branding, domain] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
    prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId }, select: { domain: true } }).catch(() => null),
  ]);
  const slug = linkedBlogPostSlug(ctaUrl, {
    appBase: appUrl() || null,
    publicSlug: branding?.publicSlug ?? null,
    domain: domain?.domain ?? null,
  });
  if (!slug) return null;
  const post = await prisma.blogPost.findUnique({
    where: { platform_workspaceKey_slug: { platform: FOTOFFICE_BLOG_PLATFORM, workspaceKey: workspaceId, slug } },
    select: { title: true, status: true, publishedAt: true },
  });
  return { slug, post };
}

/** Aviso del panel sobre el artículo enlazado (null si no hay nada que avisar). */
export async function linkedPostWarningFor(
  workspaceId: string,
  m: { ctaUrl: string | null; scheduledAt: Date | null },
  now: Date,
  opts: { test?: boolean } = {},
): Promise<string | null> {
  const linked = await loadLinkedPost(workspaceId, m.ctaUrl);
  if (!linked) return null;
  return linkedPostWarning({ ...linked, sendAt: m.scheduledAt, now, test: opts.test });
}

export type Outcome = { ok: true; message: string } | { ok: false; error: string };

async function precondiciones(workspaceId: string, m: { subject: string; body: string }): Promise<string | null> {
  const falta = readyToSend(m);
  if (falta) return falta;
  const settings = await getMailingSettings(workspaceId);
  if (!settings.bulkEnabled) return "Los envíos a socios están apagados. Se encienden en Comunicación → Correo.";
  const ctx = await loadMailingContext(workspaceId);
  if (!ctx.unsubscribe) return "Falta configuración del sistema para el enlace de baja. Avisale al equipo técnico.";
  return null;
}

/**
 * «Enviar» desde el borrador: pide aprobación si hace falta; si no, la programa (si tiene fecha
 * futura) o la manda ya.
 */
export async function submitMessage(workspaceId: string, id: string, now: Date): Promise<Outcome> {
  const m = await getMessage(workspaceId, id);
  if (!m || m.status !== "DRAFT") return { ok: false, error: "Sólo se puede enviar un borrador." };
  const problema = await precondiciones(workspaceId, m);
  if (problema) return { ok: false, error: problema };
  if (m.scheduledAt && m.scheduledAt <= now) {
    return { ok: false, error: "La fecha programada ya pasó. Cambiala o borrala para enviar ahora." };
  }

  const settings = await getMailingSettings(workspaceId);
  if (settings.requireApproval) {
    const r = await prisma.fotofficeMailingMessage.updateMany({
      where: { id, workspaceId, status: "DRAFT" },
      data: { status: "PENDING_APPROVAL", approvalRequestedAt: now },
    });
    return r.count === 1
      ? { ok: true, message: "Quedó esperando aprobación. La tiene que aprobar otra persona que gestione Comunicación." }
      : { ok: false, error: "Alguien la cambió recién. Recargá la página." };
  }
  return scheduleOrLaunch(workspaceId, id, "DRAFT", m.scheduledAt, now);
}

export async function approveMessage(workspaceId: string, id: string, approverUserId: number, now: Date): Promise<Outcome> {
  const m = await getMessage(workspaceId, id);
  if (!m || m.status !== "PENDING_APPROVAL") return { ok: false, error: "Esta campaña no está esperando aprobación." };
  if (m.createdByUserId === approverUserId) {
    return { ok: false, error: "La tiene que aprobar otra persona, no quien la escribió." };
  }
  const problema = await precondiciones(workspaceId, m);
  if (problema) return { ok: false, error: problema };
  const r = await prisma.fotofficeMailingMessage.updateMany({
    where: { id, workspaceId, status: "PENDING_APPROVAL" },
    data: { approvedByUserId: approverUserId, approvedAt: now },
  });
  if (r.count !== 1) return { ok: false, error: "Alguien la cambió recién. Recargá la página." };
  // Si la fecha programada pasó mientras esperaba, sale ya.
  const futura = m.scheduledAt && m.scheduledAt > now ? m.scheduledAt : null;
  return scheduleOrLaunch(workspaceId, id, "PENDING_APPROVAL", futura, now);
}

async function scheduleOrLaunch(
  workspaceId: string,
  id: string,
  from: "DRAFT" | "PENDING_APPROVAL",
  scheduledAt: Date | null,
  now: Date,
): Promise<Outcome> {
  if (scheduledAt && scheduledAt > now) {
    const r = await prisma.fotofficeMailingMessage.updateMany({
      where: { id, workspaceId, status: from },
      data: { status: "SCHEDULED" },
    });
    // Si el artículo del botón se publica después, la página lo avisa (y la tarea programada espera).
    return r.count === 1
      ? { ok: true, message: "Programada. Sale sola a la hora elegida (con unos minutos de margen)." }
      : { ok: false, error: "Alguien la cambió recién. Recargá la página." };
  }
  // Sin fecha futura saldría ya: con el artículo todavía invisible, el enlace no abriría.
  const m = await getMessage(workspaceId, id);
  const aviso = m ? await linkedPostWarningFor(workspaceId, { ctaUrl: m.ctaUrl, scheduledAt: null }, now) : null;
  if (aviso) return { ok: false, error: aviso };
  return launchMessage(workspaceId, id, from, Date.now() + 45_000);
}

/** Crea el envío y lo manda. Toma la campaña con una actualización condicional: sale una vez. */
async function launchMessage(
  workspaceId: string,
  id: string,
  from: "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED",
  deadline: number,
): Promise<Outcome> {
  const tomada = await prisma.fotofficeMailingMessage.updateMany({
    where: { id, workspaceId, status: from },
    data: { status: "SENT", sentAt: new Date() },
  });
  if (tomada.count !== 1) return { ok: false, error: "Alguien la cambió recién. Recargá la página." };
  const m = await getMessage(workspaceId, id);
  if (!m) return { ok: false, error: "La campaña ya no existe." };

  const devolver = (error: string) =>
    prisma.fotofficeMailingMessage
      .update({ where: { id }, data: { status: "DRAFT", sentAt: null, approvalRequestedAt: null, approvedAt: null, approvedByUserId: null } })
      .then(() => ({ ok: false as const, error }));

  try {
    const creado = await createCampaign({
      workspaceId,
      kind: CAMPAIGN_KINDS.CUSTOM,
      topic: MESSAGE_TOPIC,
      dedupeKey: `custom:${id}`,
      subject: m.subject,
      messageId: id,
      categoryIds: m.categoryIds,
      specialties: m.specialties,
      createdByUserId: m.createdByUserId,
    });
    if (!creado.ok) {
      return creado.reason === "NO_RECIPIENTS"
        ? devolver("Ningún socio cumple esos filtros (o todos se dieron de baja). Quedó como borrador.")
        : { ok: false, error: "Esta campaña ya se envió." };
    }
    await prisma.fotofficeMailingMessage.update({ where: { id }, data: { campaignId: creado.campaignId } });
    const r = await processCampaign(creado.campaignId, { deadline });
    return {
      ok: true,
      message: r.done
        ? `Listo: salió a ${r.sent} de ${creado.recipients} socios.`
        : `En camino: ya salieron ${r.sent} de ${creado.recipients}. El resto sale en los próximos minutos.`,
    };
  } catch (error) {
    console.error("[fotoffice][correo] no se pudo lanzar la campaña", {
      id,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return devolver("No se pudo enviar. Quedó como borrador para reintentar.");
  }
}

/** Las programadas que ya tienen que salir (lo llama la tarea programada). */
export async function sendDueMessages(now: Date, deadline: number) {
  const vencidas = await prisma.fotofficeMailingMessage.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, workspaceId: true, ctaUrl: true },
    orderBy: { scheduledAt: "asc" },
    // Holgura para que las que esperan un artículo no tapen a las demás.
    take: 50,
  });
  const resultado: Record<string, string> = {};
  for (const m of vencidas) {
    if (Date.now() >= deadline) break;
    const settings = await getMailingSettings(m.workspaceId);
    if (!settings.bulkEnabled) {
      resultado[m.id] = "OFF";
      continue;
    }
    // Sigue programada: se reintenta en la próxima vuelta, hasta que el artículo se vea.
    const linked = await loadLinkedPost(m.workspaceId, m.ctaUrl);
    const espera = linked ? holdForLinkedPost(linked.slug, linked.post, new Date()) : null;
    if (espera) {
      resultado[m.id] = `ESPERA_ARTICULO:${espera}`;
      console.warn("[fotoffice][correo] campaña retenida: el artículo del botón todavía no se ve", {
        id: m.id,
        workspaceId: m.workspaceId,
        articulo: linked?.slug,
        motivo: espera,
      });
      continue;
    }
    const r = await launchMessage(m.workspaceId, m.id, "SCHEDULED", deadline);
    resultado[m.id] = r.ok ? "SENT" : r.error;
  }
  return resultado;
}

/** Métricas por envío: entregados, abiertos, clics y rebotes (los informa Resend por webhook). */
export async function metricsByCampaign(campaignIds: string[]): Promise<Map<string, Omit<MetricCounts, "sent">>> {
  if (campaignIds.length === 0) return new Map();
  const filas = await prisma.fotofficeEmailDelivery.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: campaignIds } },
    _count: { deliveredAt: true, openedAt: true, clickedAt: true, bouncedAt: true },
  });
  return new Map(
    filas.map((f) => [
      f.campaignId,
      { delivered: f._count.deliveredAt, opened: f._count.openedAt, clicked: f._count.clickedAt, bounced: f._count.bouncedAt },
    ]),
  );
}
