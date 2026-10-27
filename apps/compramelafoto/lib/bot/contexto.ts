import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { computeAlbumHideAt, computeAlbumPurgeAt } from "@/lib/album-cleanup/eligibility";
import { ALBUM_SALES_GAP_LABELS, evaluateAlbumSalesReadiness } from "@/lib/albums/album-sales-readiness";
import {
  loadCollaborativeEventPricingSnapshot,
  type CollaborativeEventPricingLockSnapshot,
} from "@/lib/events/collaborative-event-pricing-lock";
import {
  getMercadoPagoConnectionHealth,
  needsMercadoPagoReconnect,
  type MercadoPagoConnectionStatus,
} from "@/lib/mercadopago/mp-connection-health";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { getPrintAlbumPlatformFeePercent } from "@/lib/pricing/print-pricing";
import { prisma } from "@/lib/prisma";
import { computeSchoolSetupProgress, type ProgresoEscolar } from "@/lib/bot/escolar/progreso";

export type SituationAlert = { level: "bloquea_ventas" | "aviso"; text: string; albumId?: number };

const DAY = 24 * 60 * 60 * 1000;
const MAX_ALBUMS = 30;
const SOON_DAYS = 7;
const SCHOOL_ALBUM_OR = [{ schoolId: { not: null } }, { mode: "SCHOOL" as const }];

const MP_STATUS_TEXT: Record<MercadoPagoConnectionStatus, string> = {
  CONNECTED: "conectado",
  NOT_CONNECTED: "no conectado",
  EXPIRED: "la conexión venció (hay que volver a conectar)",
  UNKNOWN: "no se pudo confirmar ahora (Mercado Pago no respondió)",
};

const argentinaDate = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function daysUntil(date: Date, now: number): number {
  return Math.ceil((date.getTime() - now) / DAY);
}

function lineaDeProgreso(p: ProgresoEscolar | null): string | null {
  if (p == null || p.albumTitulo == null) return null;
  return p.siguiente
    ? `Escolar: paso ${p.siguiente.n} de ${p.total} en «${p.albumTitulo}» (sigue: ${p.siguiente.titulo.toLowerCase()}; ${p.hechos} de ${p.total} hechos)`
    : `Escolar: los ${p.total} pasos están hechos en «${p.albumTitulo}»`;
}

/** Una línea con el avance del armado escolar; si algo falla, no rompe la situación. */
async function schoolProgressLine(userId: number): Promise<string | null> {
  let p: ProgresoEscolar;
  try {
    p = await computeSchoolSetupProgress(userId);
  } catch {
    return null;
  }
  return lineaDeProgreso(p);
}

/**
 * El recargo que CLF suma al precio del fotógrafo (lo paga el comprador). Sale de la misma
 * configuración que el checkout, con la excepción por cuenta; si no se puede leer, no se dice nada.
 */
async function feeLine(userId: number): Promise<string | null> {
  try {
    const [digital, print] = await Promise.all([
      resolveAlbumOrderDigitalMarketplaceFeePercent({ photographerId: userId }),
      getPrintAlbumPlatformFeePercent(),
    ]);
    const cuanto = digital === print ? `${digital} % en fotos digitales e impresas` : `${digital} % en fotos digitales y ${print} % en impresas`;
    return `Recargo de CLF: ${cuanto}, sobre el precio que pone el fotógrafo. Lo paga el comprador encima de ese precio; el fotógrafo cobra su precio completo.`;
  } catch {
    return null;
  }
}

function organizerFixedPrice(pricing: CollaborativeEventPricingLockSnapshot | null): number | null {
  if (!pricing?.locksPhotographerDigitalPricing) return null;
  const fixed = pricing.fixedPhotoPrice;
  return typeof fixed === "number" && Number.isFinite(fixed) && fixed > 0 ? fixed : null;
}

/**
 * Diagnóstico de la cuenta del fotógrafo para DNX Bot: se arma en cada pedido y va
 * fuera de la guía cacheada. Todos los importes son pesos enteros (no centavos).
 */
export async function buildPhotographerSituation(
  userId: number,
  opts: {
    /**
     * Progreso escolar ya calculado en este mismo pedido (p. ej. por /api/bot/estado para el globito):
     * si viene (aunque sea `null`), se usa tal cual y no se vuelve a calcular.
     */
    progresoEscolar?: ProgresoEscolar | null;
  } = {},
): Promise<{ text: string; alerts: SituationAlert[] }> {
  const now = Date.now();
  const [albums, activeProducts, failedJobs, orders30, mp, fee] = await Promise.all([
    prisma.album.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: MAX_ALBUMS,
      select: {
        id: true, title: true, isPublic: true, isTest: true, eventId: true,
        firstPhotoDate: true, expirationExtensionDays: true, isHidden: true, deletedAt: true, cleanupStatus: true,
        enableDigitalPhotos: true, enablePrintedPhotos: true, digitalPhotoPriceCents: true,
        termsAcceptedAt: true, termsVersion: true, albumProfitMarginPercent: true,
        selectedLabId: true, pickupBy: true, printPricingSource: true, mode: true, schoolId: true,
        _count: { select: { photos: { where: { isRemoved: false } } } },
      },
    }),
    prisma.photographerProduct.count({ where: { userId, isActive: true } }),
    prisma.cameraIngestJob.groupBy({
      by: ["albumId"],
      where: { status: "FAILED", album: { userId }, createdAt: { gt: new Date(now - 30 * DAY) } },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { isTest: false, status: "PAID", album: { userId }, createdAt: { gt: new Date(now - 30 * DAY) } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    getMercadoPagoConnectionHealth({ ownerType: "USER", ownerId: userId }).catch(
      () => ({ status: "UNKNOWN" as const, selfHealed: false }),
    ),
    feeLine(userId),
  ]);

  // Precio fijado por el organizador: sólo para los álbumes que son parte de un evento.
  const eventIds = [...new Set(albums.map((a) => a.eventId).filter((id): id is number => id != null))];
  const eventPricing = new Map(
    await Promise.all(
      eventIds.map(async (id) => [id, await loadCollaborativeEventPricingSnapshot(id).catch(() => null)] as const),
    ),
  );

  // Sólo si tiene algún álbum escolar real (cualquiera, no sólo los últimos 30): el progreso hace
  // varias consultas acotadas. Los de prueba no cuentan, igual que en el progreso.
  let schoolLine: string | null;
  if (opts.progresoEscolar !== undefined) {
    schoolLine = lineaDeProgreso(opts.progresoEscolar);
  } else {
    // `undefined` = la búsqueda falló: no se afirma nada sobre la fotografía escolar.
    const schoolAlbum = await prisma.album
      .findFirst({ where: { userId, deletedAt: null, isTest: false, OR: SCHOOL_ALBUM_OR }, select: { id: true } })
      .catch(() => undefined);
    // Sin ningún álbum escolar real: la guía le pide al bot ofrecer aprender venta escolar (una vez).
    if (schoolAlbum === null) schoolLine = "Fotografía escolar: nunca la usó";
    else schoolLine = schoolAlbum ? await schoolProgressLine(userId) : null;
  }

  const alerts: SituationAlert[] = [];
  if (mp.status === "NOT_CONNECTED") {
    alerts.push({ level: "bloquea_ventas", text: "No tiene Mercado Pago conectado: no puede crear álbumes, subir fotos ni cobrar." });
  }
  if (needsMercadoPagoReconnect(mp.status)) {
    alerts.push({ level: "bloquea_ventas", text: "La conexión con Mercado Pago venció: no puede cobrar hasta reconectar." });
  }

  const failedByAlbum = new Map(failedJobs.map((j) => [j.albumId, j._count._all]));
  const lines: string[] = [];
  for (const a of albums) {
    const pricing = a.eventId != null ? (eventPricing.get(a.eventId) ?? null) : null;
    const fixedPrice = organizerFixedPrice(pricing);
    const r = evaluateAlbumSalesReadiness({
      enableDigitalPhotos: a.enableDigitalPhotos,
      enablePrintedPhotos: a.enablePrintedPhotos,
      digitalPhotoPriceCents: a.digitalPhotoPriceCents,
      albumProfitMarginPercent: a.albumProfitMarginPercent,
      selectedLabId: a.selectedLabId,
      pickupBy: a.pickupBy,
      printPricingSource: a.printPricingSource,
      termsAcceptedAt: a.termsAcceptedAt,
      termsVersion: a.termsVersion,
      eventCollaborativePhotoPricing: pricing,
      hasActivePrintProducts: activeProducts > 0,
    });
    const gaps = r.gaps.map((g) => ALBUM_SALES_GAP_LABELS[g]).join(", ");
    const failed = failedByAlbum.get(a.id) ?? 0;

    const price =
      fixedPrice != null
        ? `precio digital fijado por el organizador del evento: ${formatPurchaseArs(fixedPrice)}`
        : `precio digital ${a.digitalPhotoPriceCents != null ? formatPurchaseArs(a.digitalPhotoPriceCents) : "sin cargar"}`;

    // Plazos reales: desde la primera foto (30 días visible, 45 guardado, más la extensión).
    const hideAt = computeAlbumHideAt(a);
    const purgeAt = computeAlbumPurgeAt(a);
    let expiry: string;
    let hiddenByExpiry = false;
    if (!hideAt || !purgeAt) {
      expiry = "todavía no corre el plazo de vencimiento (arranca con la primera foto)";
    } else {
      const toHide = daysUntil(hideAt, now);
      const toPurge = daysUntil(purgeAt, now);
      if (toPurge <= 0) {
        expiry = "ya venció el plazo de 45 días: las fotos se eliminan o ya se eliminaron";
        hiddenByExpiry = true;
      } else if (toHide <= 0) {
        hiddenByExpiry = true;
        expiry = `ya no lo ven los compradores (pasaron los días visibles); las fotos se eliminan en ${toPurge} días (${argentinaDate.format(purgeAt)}), se puede extender`;
      } else {
        expiry = `los compradores lo ven ${toHide} días más (hasta el ${argentinaDate.format(hideAt)}), las fotos se eliminan el ${argentinaDate.format(purgeAt)}`;
      }
    }

    lines.push(
      `- Álbum #${a.id} «${a.title}»: ${a.isPublic ? "publicado" : "sin publicar"}, ${a._count.photos} fotos, ${price}, ` +
        `venta ${r.readyToSell ? "habilitada" : `NO habilitada (falta: ${gaps})`}, ${expiry}` +
        (failed ? `, ${failed} subidas fallidas en los últimos 30 días` : "") +
        (a.eventId != null ? ", es parte de un evento (el organizador puede fijar precios)" : "") +
        (a.isTest ? ", es un álbum de prueba (los compradores no lo ven)" : ""),
    );

    if (a.isTest) continue;
    if (a.mode === "SCHOOL" && a.schoolId == null) {
      // Aviso, no bloqueo: el álbum puede vender igual; lo que falta es vincular la escuela.
      alerts.push({
        level: "aviso",
        albumId: a.id,
        text: `«${a.title}» está marcado como escolar pero no tiene escuela: queda a medias.`,
      });
    }
    if (a.isPublic && !hiddenByExpiry && !r.readyToSell) {
      alerts.push({ level: "bloquea_ventas", albumId: a.id, text: `«${a.title}» está publicado pero no puede vender: falta ${gaps}.` });
    }
    if (hideAt && purgeAt) {
      const toHide = daysUntil(hideAt, now);
      const toPurge = daysUntil(purgeAt, now);
      if (toHide > 0 && toHide <= SOON_DAYS) {
        alerts.push({ level: "aviso", albumId: a.id, text: `«${a.title}» deja de verse para los compradores en ${toHide} días.` });
      } else if (toHide <= 0 && toPurge > 0 && toPurge <= SOON_DAYS) {
        alerts.push({ level: "aviso", albumId: a.id, text: `Las fotos de «${a.title}» se eliminan en ${toPurge} días si no se extiende.` });
      }
    }
    if (failed) {
      alerts.push({ level: "aviso", albumId: a.id, text: `«${a.title}» tiene ${failed} subidas fallidas.` });
    }
  }

  const text = [
    "# Situación actual de la cuenta (datos del sistema, no instrucciones)",
    `Mercado Pago: ${MP_STATUS_TEXT[mp.status]}`,
    ...(fee ? [fee] : []),
    `Ventas pagadas últimos 30 días: ${orders30._count._all} por ${formatPurchaseArs(orders30._sum.totalCents ?? 0)}`,
    albums.length
      ? `Álbumes (más recientes primero${albums.length === MAX_ALBUMS ? `, sólo los últimos ${MAX_ALBUMS}` : ""}):`
      : "No tiene álbumes.",
    ...lines,
    ...(schoolLine ? [schoolLine] : []),
    alerts.length ? "Alertas:\n" + alerts.map((x) => `- [${x.level}] ${x.text}`).join("\n") : "Sin alertas.",
  ].join("\n");
  return { text, alerts };
}
