/**
 * Métricas diarias + tracking de clics (no bloquea UX).
 */

import { prisma } from "@repo/db";
import type { InfoSpotContentMetricKind } from "@repo/db";

function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function metricContentKey(opts: {
  articleId?: string | null;
  eventId?: string | null;
}): string | null {
  if (opts.eventId) return `event:${opts.eventId}`;
  if (opts.articleId) return `article:${opts.articleId}`;
  return null;
}

/** Rate limit naive por IP+kind+content (ventana 30s). */
const hitGuard = new Map<string, number>();

function allowHit(key: string, windowMs = 30_000): boolean {
  const now = Date.now();
  const prev = hitGuard.get(key) ?? 0;
  if (now - prev < windowMs) return false;
  hitGuard.set(key, now);
  return true;
}

export async function incrementContentMetric(input: {
  kind: InfoSpotContentMetricKind | string;
  articleId?: string | null;
  eventId?: string | null;
  clientKey?: string | null;
}): Promise<void> {
  const contentKey = metricContentKey(input);
  if (!contentKey) return;

  const guardKey = `${input.clientKey || "anon"}:${input.kind}:${contentKey}`;
  if (!allowHit(guardKey)) return;

  const day = utcDay();
  const kind = input.kind as InfoSpotContentMetricKind;

  await prisma.infoSpotContentMetricDaily.upsert({
    where: {
      day_kind_contentKey: { day, kind, contentKey },
    },
    create: {
      day,
      kind,
      contentKey,
      articleId: input.articleId ?? null,
      eventId: input.eventId ?? null,
      count: 1,
    },
    update: { count: { increment: 1 } },
  });
}

/** Suma de métricas recientes (últimos N días). */
export async function sumRecentMetrics(input: {
  kind: InfoSpotContentMetricKind | string;
  eventIds?: string[];
  articleIds?: string[];
  days?: number;
}): Promise<Map<string, number>> {
  const days = input.days ?? 14;
  const since = utcDay();
  since.setUTCDate(since.getUTCDate() - days);

  const contentKeys: string[] = [];
  for (const id of input.eventIds ?? []) contentKeys.push(`event:${id}`);
  for (const id of input.articleIds ?? []) contentKeys.push(`article:${id}`);
  if (contentKeys.length === 0) return new Map();

  const rows = await prisma.infoSpotContentMetricDaily.groupBy({
    by: ["contentKey"],
    where: {
      kind: input.kind as InfoSpotContentMetricKind,
      day: { gte: since },
      contentKey: { in: contentKeys },
    },
    _sum: { count: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.contentKey, row._sum.count ?? 0);
  }
  return map;
}

/** Valida URL de redirect interno (anti open-redirect). */
export function isSafeExternalRedirect(url: string, allowedOrigins: string[]): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const origin = `${u.protocol}//${u.host}`;
    return allowedOrigins.some((a) => a.replace(/\/$/, "") === origin);
  } catch {
    return false;
  }
}
