import sharp from "sharp";
import { buildPublishRequestInput, renderSocialPiece } from "@repo/social-pieces";
import { Prisma, prisma } from "@repo/db";
import { getPublicUrl, uploadToR2 } from "@/lib/r2-client";
import { PLATFORM_HANDLE } from "./build-album-pieces";
import { normalizeConsentHandle } from "./album-social-consent";
import { artDateKey } from "./album-stories-plan";
import { logSocialRequest, resolveClfInstagramAccount } from "./prisma-store";
import {
  decideWelcome,
  planWelcomeSlots,
  WELCOME_LOOKBACK_DAYS,
  WELCOME_SETTLE_HOURS,
  type WelcomeSkipReason,
} from "./welcome-stories-plan";
import {
  readWelcomeBrandResource,
  WELCOME_CARD,
  WELCOME_CONTRACT,
  WELCOME_DOCUMENT,
  WELCOME_LOGO_REF,
  WELCOME_TEMPLATE_ID,
  welcomeNameLine,
} from "./welcome-story-template";

/**
 * Historia de bienvenida en @compramelafoto para cada fotógrafo que sube su primer álbum
 * (pedido 2026-11-24). La arma el mismo cron diario que las historias de álbumes, la deja
 * en `SCHEDULED` y la publica `social-publish` en su horario; hasta entonces el admin la
 * puede vetar desde `/admin/social`, igual que las otras.
 *
 * Reglas: una sola vez por fotógrafo, solo con logo e Instagram cargados, hasta 30 días
 * después del primer álbum, como mucho 3 por día (11, 16 y 20 h) y dentro del tope diario
 * común de historias.
 */

export const WELCOME_STORY_ENTITY_TYPE = "PHOTOGRAPHER_WELCOME";
const APPLICATION = "COMPRAMELAFOTO";
const TIMEZONE = "America/Argentina/Buenos_Aires";
/** Renderizar una bienvenida es liviano (un logo): entran varias por corrida. */
const MAX_WELCOMES_PER_RUN = 12;

export function welcomeStoryKey(userId: number): string {
  return `clf:welcome-story:${userId}`;
}

const OCCUPYING: Prisma.EnumDnxSocialPublishStatusFilter["in"] = [
  "SCHEDULED",
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
];

export type WelcomeStoriesSummary = {
  ok: boolean;
  reason?: "NO_ACCOUNT";
  candidates: number;
  scheduled: Array<{ userId: number; handle: string; scheduleAt: string }>;
  skipped: Partial<Record<WelcomeSkipReason | "QUEUE_FULL" | "LOGO_UNREADABLE", number>>;
  failed: Array<{ userId: number; error: string }>;
};

type FotografoNuevo = {
  id: number;
  name: string | null;
  city: string | null;
  logoUrl: string | null;
  instagram: string | null;
  role: string;
  isBlocked: boolean;
};

/**
 * Nombre (o comienzo del nombre) de las campañas de correo que avisan «cargá tu logo y tu
 * Instagram para recibir la bienvenida». A quien recibió una, el plazo de 30 días se le
 * cuenta desde el aviso: si no, al que se sumó hace 28 días no le daría el tiempo.
 */
export const WELCOME_REMINDER_CAMPAIGN_PREFIX = "Bienvenida IG · aviso";

/**
 * Fotógrafos cuyo primer álbum (de todos los que creó) cae dentro de la ventana, más los
 * que recibieron el aviso de la bienvenida dentro de la ventana.
 */
async function fotografosConPrimerAlbumReciente(now: Date) {
  const desde = new Date(now.getTime() - WELCOME_LOOKBACK_DAYS * 24 * 3600_000);
  const hasta = new Date(now.getTime() - WELCOME_SETTLE_HOURS * 3600_000);
  const [grupos, avisados] = await Promise.all([
    prisma.album.groupBy({
      by: ["userId"],
      _min: { createdAt: true },
      having: { createdAt: { _min: { gte: desde, lte: hasta } } },
    }),
    prisma.emailSend.findMany({
      where: {
        status: "SENT",
        sentAt: { gte: desde },
        toUserId: { not: null },
        campaign: { name: { startsWith: WELCOME_REMINDER_CAMPAIGN_PREFIX } },
      },
      select: { toUserId: true },
    }),
  ]);
  const ids = [...new Set([...grupos.map((g) => g.userId), ...avisados.map((a) => a.toUserId!)])];
  if (ids.length === 0) return { usuarios: [] as FotografoNuevo[], conAlbumReal: new Set<number>(), primerAlbum: new Map<number, Date>() };
  const [usuarios, reales, primeros] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, city: true, logoUrl: true, instagram: true, role: true, isBlocked: true },
    }),
    prisma.album.groupBy({ by: ["userId"], where: { userId: { in: ids }, isTest: false, deletedAt: null }, _count: { _all: true } }),
    prisma.album.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _min: { createdAt: true } }),
  ]);
  const primerAlbum = new Map(primeros.map((g) => [g.userId, g._min.createdAt ?? now]));
  // Los más viejos primero: si no entran todos hoy, el que espera hace más sale antes.
  usuarios.sort((a, b) => (primerAlbum.get(a.id) ?? now).getTime() - (primerAlbum.get(b.id) ?? now).getTime());
  return { usuarios: usuarios as FotografoNuevo[], conAlbumReal: new Set(reales.map((r) => r.userId)), primerAlbum };
}

export async function generateWelcomeStories(now: Date = new Date()): Promise<WelcomeStoriesSummary> {
  const summary: WelcomeStoriesSummary = { ok: true, candidates: 0, scheduled: [], skipped: {}, failed: [] };
  const skip = (r: keyof WelcomeStoriesSummary["skipped"]) => {
    summary.skipped[r] = (summary.skipped[r] ?? 0) + 1;
  };

  const account = await resolveClfInstagramAccount();
  if (!account) return { ...summary, ok: false, reason: "NO_ACCOUNT" };

  const { usuarios, conAlbumReal } = await fotografosConPrimerAlbumReciente(now);
  summary.candidates = usuarios.length;
  if (usuarios.length === 0) return summary;

  const generados = await prisma.dnxSocialPublishRequest.findMany({
    where: { idempotencyKey: { in: usuarios.map((u) => welcomeStoryKey(u.id)) } },
    select: { idempotencyKey: true },
  });
  const yaGenerados = new Set(generados.map((g) => g.idempotencyKey));

  const elegibles = usuarios.filter((u) => {
    const d = decideWelcome({
      role: u.role,
      isBlocked: u.isBlocked,
      logoUrl: u.logoUrl,
      handle: normalizeConsentHandle(u.instagram),
      hasRealAlbum: conAlbumReal.has(u.id),
      alreadyGenerated: yaGenerados.has(welcomeStoryKey(u.id)),
    });
    if (!d.eligible) skip(d.reason);
    return d.eligible;
  });
  if (elegibles.length === 0) return summary;

  // Agenda común: las historias de álbumes y las bienvenidas comparten horarios y tope.
  const inicioHoyArt = new Date(`${artDateKey(now)}T00:00:00-03:00`);
  const ocupados = await prisma.dnxSocialPublishRequest.findMany({
    where: { application: APPLICATION, status: { in: OCCUPYING }, scheduleAt: { gte: inicioHoyArt } },
    select: { scheduleAt: true, entityType: true },
  });
  const taken = ocupados.map((o) => o.scheduleAt!).filter(Boolean);
  const bienvenidas = ocupados.filter((o) => o.entityType === WELCOME_STORY_ENTITY_TYPE).map((o) => o.scheduleAt!);
  const tanda = elegibles.slice(0, MAX_WELCOMES_PER_RUN);
  const horarios = planWelcomeSlots(taken, bienvenidas, now, tanda.length);

  for (const [i, u] of tanda.entries()) {
    const scheduleAt = horarios[i];
    if (!scheduleAt) {
      skip("QUEUE_FULL");
      continue;
    }
    const handle = normalizeConsentHandle(u.instagram)!;
    try {
      const bytes = await renderWelcomeStory(u);
      if (!bytes) {
        skip("LOGO_UNREADABLE");
        continue;
      }
      const key = `social/clf/bienvenidas/${u.id}-${Date.now()}.jpg`;
      await uploadToR2(Buffer.from(bytes), key, "image/jpeg");
      const input = buildPublishRequestInput(
        {
          application: APPLICATION,
          entityType: WELCOME_STORY_ENTITY_TYPE,
          entityId: String(u.id),
          pieceId: WELCOME_TEMPLATE_ID,
          format: "STORY",
          caption: "",
          mentionCandidates: [
            { handle, priority: 1, role: "PHOTOGRAPHER" },
            { handle: PLATFORM_HANDLE, priority: 100, role: "PLATFORM" },
          ],
          socialAccountId: account.id,
          idempotencyKey: welcomeStoryKey(u.id),
          approvalRequired: false,
          extraMetadata: {
            userId: u.id,
            photographerHandle: handle,
            photographerName: u.name,
            collage: WELCOME_TEMPLATE_ID,
            welcome: true,
          },
        },
        [getPublicUrl(key)],
      );
      const creada = await prisma.dnxSocialPublishRequest.create({
        data: {
          application: input.application,
          entityType: input.entityType,
          entityId: input.entityId,
          templateRef: input.templateRef ?? null,
          caption: input.caption,
          hashtags: input.hashtags ?? [],
          mentions: input.mentions ?? [],
          assets: input.assets as unknown as Prisma.InputJsonValue,
          socialAccountId: account.id,
          platform: "INSTAGRAM",
          status: "SCHEDULED",
          approvalRequired: false,
          scheduleAt,
          timezone: TIMEZONE,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });
      await logSocialRequest(creada.id, "SCHEDULED", null, { scheduleAt: scheduleAt.toISOString(), auto: true, welcome: true });
      summary.scheduled.push({ userId: u.id, handle, scheduleAt: scheduleAt.toISOString() });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[social] bienvenida del fotógrafo ${u.id} no se pudo armar: ${msg}`);
      summary.failed.push({ userId: u.id, error: msg.slice(0, 200) });
    }
  }
  return summary;
}

/**
 * Dibuja la placa de un fotógrafo. No sube ni guarda nada (lo usa también la vista previa).
 * Devuelve `null` si el logo no se puede bajar o no es una imagen.
 */
export async function renderWelcomeStory(u: {
  name: string | null;
  city: string | null;
  logoUrl: string | null;
  instagram: string | null;
}): Promise<Uint8Array | null> {
  const handle = normalizeConsentHandle(u.instagram);
  if (!handle || !u.logoUrl) return null;
  const logo = await prepararLogo(u.logoUrl);
  if (!logo) return null;
  const pieza = await renderSocialPiece({
    pieceId: WELCOME_TEMPLATE_ID,
    format: "STORY",
    document: WELCOME_DOCUMENT,
    contract: WELCOME_CONTRACT,
    values: { handle: `@${handle}`, nombre: welcomeNameLine(u.name, u.city) },
    resources: {
      read: async (ref: string) => (ref === WELCOME_LOGO_REF ? logo : readWelcomeBrandResource(ref)),
    },
    dpi: 96,
  });
  const imagen = pieza.images[0];
  if (!imagen) throw new Error("El render no devolvió imagen");
  return imagen.bytes;
}

/**
 * Baja el logo y arma la tarjeta que va en el medio de la placa: el logo recortado (sin
 * el aire de alrededor) y centrado sobre una tarjeta redondeada. La tarjeta es blanca,
 * salvo que el logo sea claro sobre transparente (blanco, gris claro): ahí es casi negra,
 * porque sobre blanco no se vería.
 */
export async function prepararTarjeta(logoBytes: Buffer): Promise<Uint8Array | null> {
  const { width: W, height: H, radius: R, padding: P } = WELCOME_CARD;
  try {
    const base = sharp(logoBytes, { failOn: "none" }).rotate().resize(1400, 1400, { fit: "inside", withoutEnlargement: true });
    const { data, info } = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let opacos = 0;
    let transparentes = 0;
    let luz = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a < 16) {
        transparentes++;
        continue;
      }
      opacos++;
      luz += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    }
    if (opacos === 0) return null;
    const claro = transparentes / (info.width * info.height) > 0.1 && luz / opacos > 200;
    const fondo = claro ? "#111111" : "#ffffff";

    const plano = await base.clone().flatten({ background: fondo }).png().toBuffer();
    let recortado: Buffer;
    try {
      recortado = await sharp(plano).trim({ background: fondo, threshold: 12 }).png().toBuffer();
    } catch {
      recortado = plano; // nada que recortar
    }
    const logo = await sharp(recortado)
      .resize(W - 2 * P, H - 2 * P, { fit: "contain", background: fondo })
      .png()
      .toBuffer();
    const mascara = Buffer.from(
      `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${R}" ry="${R}" fill="#fff"/></svg>`,
    );
    const tarjeta = await sharp({ create: { width: W, height: H, channels: 4, background: fondo } })
      .composite([
        { input: logo, left: P, top: P },
        { input: mascara, blend: "dest-in" },
      ])
      .png()
      .toBuffer();
    return new Uint8Array(tarjeta);
  } catch {
    return null;
  }
}

async function prepararLogo(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    return prepararTarjeta(Buffer.from(await r.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Antes de publicar: el fotógrafo sigue existiendo, no está bloqueado y tiene Instagram. */
export async function isWelcomeStillPublishable(userId: number): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true, instagram: true } });
  return Boolean(u && !u.isBlocked && normalizeConsentHandle(u.instagram));
}

/** Vista previa de la bienvenida de un fotógrafo, sin guardar ni publicar. */
export async function previewWelcomeStory(userId: number): Promise<Uint8Array | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, city: true, logoUrl: true, instagram: true },
  });
  return u ? renderWelcomeStory(u) : null;
}
