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
import { prisma } from "@/lib/prisma";

export type SituationAlert = { level: "bloquea_ventas" | "aviso"; text: string; albumId?: number };

const DAY = 24 * 60 * 60 * 1000;
const MAX_ALBUMS = 30;
const SOON_DAYS = 7;

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

function organizerFixedPrice(pricing: CollaborativeEventPricingLockSnapshot | null): number | null {
  if (!pricing?.locksPhotographerDigitalPricing) return null;
  const fixed = pricing.fixedPhotoPrice;
  return typeof fixed === "number" && Number.isFinite(fixed) && fixed > 0 ? fixed : null;
}

/**
 * Diagnóstico de la cuenta del fotógrafo para DNX Bot: se arma en cada pedido y va
 * fuera de la guía cacheada. Todos los importes son pesos enteros (no centavos).
 */
export async function buildPhotographerSituation(userId: number): Promise<{ text: string; alerts: SituationAlert[] }> {
  const now = Date.now();
  const [albums, activeProducts, failedJobs, orders30, mp] = await Promise.all([
    prisma.album.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: MAX_ALBUMS,
      select: {
        id: true, title: true, isPublic: true, isTest: true, eventId: true,
        firstPhotoDate: true, expirationExtensionDays: true, isHidden: true, deletedAt: true, cleanupStatus: true,
        enableDigitalPhotos: true, enablePrintedPhotos: true, digitalPhotoPriceCents: true,
        termsAcceptedAt: true, termsVersion: true, albumProfitMarginPercent: true,
        selectedLabId: true, pickupBy: true, printPricingSource: true,
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
  ]);

  // Precio fijado por el organizador: sólo para los álbumes que son parte de un evento.
  const eventIds = [...new Set(albums.map((a) => a.eventId).filter((id): id is number => id != null))];
  const eventPricing = new Map(
    await Promise.all(
      eventIds.map(async (id) => [id, await loadCollaborativeEventPricingSnapshot(id).catch(() => null)] as const),
    ),
  );

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
    `Ventas pagadas últimos 30 días: ${orders30._count._all} por ${formatPurchaseArs(orders30._sum.totalCents ?? 0)}`,
    albums.length
      ? `Álbumes (más recientes primero${albums.length === MAX_ALBUMS ? `, sólo los últimos ${MAX_ALBUMS}` : ""}):`
      : "No tiene álbumes.",
    ...lines,
    alerts.length ? "Alertas:\n" + alerts.map((x) => `- [${x.level}] ${x.text}`).join("\n") : "Sin alertas.",
  ].join("\n");
  return { text, alerts };
}
