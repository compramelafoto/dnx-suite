import { createHash, randomBytes } from "node:crypto";
import { normalizePartnerSlug } from "./slug";
import type { DnxPartnerApplication } from "./types";
import { PartnersDomainError } from "./types";

export const DNX_PARTNER_PLACEMENTS = [
  "LOGO",
  "PARTNER_NAME",
  "SPONSOR_SECTION",
  "ORGANIZER_SECTION",
  "PRIZE",
  "BENEFIT",
  "CTA",
  "ASSET",
  "BANNER",
  "ARTICLE",
  "OTHER",
] as const;
export type DnxPartnerPlacement = (typeof DNX_PARTNER_PLACEMENTS)[number];

export const DNX_PARTNER_OUTBOUND_LINK_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type DnxPartnerOutboundLinkStatus = (typeof DNX_PARTNER_OUTBOUND_LINK_STATUSES)[number];

export const DNX_PARTNER_DEVICE_CLASSES = ["MOBILE", "TABLET", "DESKTOP", "OTHER"] as const;
export type DnxPartnerDeviceClass = (typeof DNX_PARTNER_DEVICE_CLASSES)[number];

export type OutboundLinkRecord = {
  id: string;
  trackingKey: string;
  partnerId: string;
  participationId: string | null;
  application: DnxPartnerApplication;
  contextType: string;
  contextId: string | null;
  assetId: string | null;
  placement: DnxPartnerPlacement;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  status: DnxPartnerOutboundLinkStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ClickEventRecord = {
  id: string;
  outboundLinkId: string;
  partnerId: string;
  participationId: string | null;
  application: DnxPartnerApplication;
  contextType: string;
  contextId: string | null;
  assetId: string | null;
  placement: DnxPartnerPlacement;
  occurredAt: Date;
  referrerHost: string | null;
  deviceClass: DnxPartnerDeviceClass;
  browserFamily: string | null;
  countryCode: string | null;
  metadata: Record<string, unknown> | null;
};

export type PartnerTrafficSummary = {
  totalClicks: number;
  last7Days: number;
  last30Days: number;
  byApplication: Record<string, number>;
  byParticipation: Record<string, number>;
  byContext: Record<string, number>;
  byPlacement: Record<string, number>;
};

const BLOCKED_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:"]);

/** Valida destino outbound HTTPS (permite wa.me / Instagram / webs). */
export function assertSafePartnerDestinationUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new PartnersDomainError("VALIDATION", "destinationUrl vacío.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PartnersDomainError("VALIDATION", "destinationUrl inválida.");
  }
  const protocol = parsed.protocol.toLowerCase();
  if (BLOCKED_PROTOCOLS.has(protocol)) {
    throw new PartnersDomainError("VALIDATION", "Protocolo no permitido.");
  }
  if (protocol !== "https:" && protocol !== "http:") {
    throw new PartnersDomainError("VALIDATION", "Solo se permiten URLs http(s).");
  }
  // Preferir https; http se acepta pero se normaliza a https salvo localhost.
  if (protocol === "http:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    parsed.protocol = "https:";
  }
  if (!parsed.hostname) {
    throw new PartnersDomainError("VALIDATION", "Host inválido.");
  }
  return parsed.toString();
}

export function resolveParticipationDestinationUrl(input: {
  participationDestinationUrl?: string | null;
  assetDestinationUrl?: string | null;
  partnerWebsiteUrl?: string | null;
}): string | null {
  for (const candidate of [
    input.participationDestinationUrl,
    input.assetDestinationUrl,
    input.partnerWebsiteUrl,
  ]) {
    if (!candidate?.trim()) continue;
    try {
      return assertSafePartnerDestinationUrl(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

export function buildTrackingKey(partnerSlug: string): string {
  const prefix = normalizePartnerSlug(partnerSlug).slice(0, 24) || "partner";
  const suffix = randomBytes(4).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
  return `${prefix}-${suffix || randomBytes(3).toString("hex")}`.slice(0, 80);
}

export function defaultUtmSource(application: DnxPartnerApplication): string {
  switch (application) {
    case "CLICKATON":
      return "clickaton";
    case "FOTO_RANK":
      return "fotorank";
    case "INFO_SPOT":
      return "infospot";
    case "COMPRAME_LA_FOTO":
      return "compramelafoto";
    case "FOTO_OFFICE":
      return "fotoffice";
    case "DNX_SUITE":
      return "dnxsuite";
    default:
      return "dnx";
  }
}

export function buildPartnerAttributedUrl(input: {
  destinationUrl: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
}): string {
  const base = assertSafePartnerDestinationUrl(input.destinationUrl);
  const url = new URL(base);
  const setIfAbsent = (key: string, value?: string | null) => {
    if (!value?.trim()) return;
    if (!url.searchParams.has(key)) url.searchParams.set(key, value.trim());
  };
  setIfAbsent("utm_source", input.utmSource);
  setIfAbsent("utm_medium", input.utmMedium ?? "partner");
  setIfAbsent("utm_campaign", input.utmCampaign);
  setIfAbsent("utm_content", input.utmContent);
  return url.toString();
}

export function sanitizeReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer?.trim()) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host.slice(0, 255) || null;
  } catch {
    const bare = referrer.trim().replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase();
    return bare ? bare.slice(0, 255) : null;
  }
}

export function classifyDeviceClass(userAgent: string | null | undefined): DnxPartnerDeviceClass {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "OTHER";
  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) return "TABLET";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return "MOBILE";
  if (/windows|macintosh|linux|cros|x11/.test(ua)) return "DESKTOP";
  return "OTHER";
}

export function classifyBrowserFamily(userAgent: string | null | undefined): string | null {
  const ua = userAgent ?? "";
  if (!ua) return null;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other";
}

const BOT_UA =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|preview|healthcheck|uptime|pingdom|curl\/|wget|python-requests|go-http-client/i;

export function isLikelyBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false;
  return BOT_UA.test(userAgent);
}

/** Rate-limit en memoria por proceso (sin Redis). */
const hitBuckets = new Map<string, { count: number; resetAt: number }>();

export function shouldSkipClickForRateLimit(key: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = hitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    hitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

export function isOutboundLinkCurrentlyValid(
  link: Pick<OutboundLinkRecord, "status" | "archivedAt" | "startsAt" | "endsAt">,
  now = new Date(),
): boolean {
  if (link.archivedAt) return false;
  if (link.status !== "ACTIVE") return false;
  if (link.startsAt && link.startsAt.getTime() > now.getTime()) return false;
  if (link.endsAt && link.endsAt.getTime() < now.getTime()) return false;
  return true;
}

export function isPartnerClickTrackingEnabled(): boolean {
  return process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED !== "false";
}

export function partnerRedirectPath(trackingKey: string): string {
  return `/r/${encodeURIComponent(trackingKey)}`;
}

/** Hash efímero rotativo (hora UTC) — solo rate-limit, no se persiste. */
export function ephemeralClientKey(seed: string): string {
  const hour = new Date().toISOString().slice(0, 13);
  return createHash("sha256").update(`${hour}:${seed}`).digest("hex").slice(0, 16);
}

export function emptyTrafficSummary(): PartnerTrafficSummary {
  return {
    totalClicks: 0,
    last7Days: 0,
    last30Days: 0,
    byApplication: {},
    byParticipation: {},
    byContext: {},
    byPlacement: {},
  };
}

export function aggregateClickEvents(
  events: Array<
    Pick<
      ClickEventRecord,
      "occurredAt" | "application" | "participationId" | "contextId" | "placement"
    >
  >,
  now = new Date(),
): PartnerTrafficSummary {
  const summary = emptyTrafficSummary();
  const t7 = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const t30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  for (const e of events) {
    summary.totalClicks += 1;
    const t = e.occurredAt.getTime();
    if (t >= t7) summary.last7Days += 1;
    if (t >= t30) summary.last30Days += 1;
    summary.byApplication[e.application] = (summary.byApplication[e.application] ?? 0) + 1;
    if (e.participationId) {
      summary.byParticipation[e.participationId] =
        (summary.byParticipation[e.participationId] ?? 0) + 1;
    }
    const ctx = e.contextId ?? "none";
    summary.byContext[ctx] = (summary.byContext[ctx] ?? 0) + 1;
    summary.byPlacement[e.placement] = (summary.byPlacement[e.placement] ?? 0) + 1;
  }
  return summary;
}
