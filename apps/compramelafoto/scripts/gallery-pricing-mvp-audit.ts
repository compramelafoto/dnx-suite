/**
 * Auditoría MVP precios en galería — clasificación A/B/C por álbum.
 * Ejecutar: npx tsx scripts/gallery-pricing-mvp-audit.ts
 */
import { PrismaClient } from "@prisma/client";
import { getAppConfig } from "@/lib/services/settingsService";
import { resolveEventDigitalPhotoBasePrice } from "@/lib/pricing/event-digital-photo-price-resolver";
import { clientTotalFromPhotographerBaseArs } from "@/lib/pricing/client-price";
import { totalFromBase } from "@/lib/pricing/fee-formula";
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

const prisma = new PrismaClient();

type Classification = "A" | "B" | "C";

type AlbumAudit = {
  id: number;
  title: string;
  classification: Classification;
  reasons: string[];
  photoCount: number;
  uniformDigital: boolean;
  distinctDigitalClientPrices: number;
  hasVariablePerPhoto: boolean;
  isCollaborativeBreaksUniform: boolean;
  printsActive: boolean;
  hasQuantityDiscounts: boolean;
  digitalClientPriceArs: number | null;
  printFromClientArs: number | null;
  eventId: number | null;
  uploaderCount: number;
};

function positiveArs(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v);
}

function hasQuantityDiscounts(album: {
  digitalDiscount5Plus: number | null;
  digitalDiscount10Plus: number | null;
  digitalDiscount20Plus: number | null;
  includeDigitalWithPrint: boolean | null;
  digitalWithPrintDiscountPercent: number | null;
}): boolean {
  const tiers = [
    album.digitalDiscount5Plus,
    album.digitalDiscount10Plus,
    album.digitalDiscount20Plus,
  ];
  if (tiers.some((t) => typeof t === "number" && Number.isFinite(t) && t > 0)) return true;
  if (
    album.includeDigitalWithPrint &&
    typeof album.digitalWithPrintDiscountPercent === "number" &&
    album.digitalWithPrintDiscountPercent > 0
  ) {
    return true;
  }
  return false;
}

async function main() {
  const appConfig = await getAppConfig();
  const platformMinDigital = appConfig?.minDigitalPhotoPrice ?? 5000;

  const albums = await prisma.album.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      userId: true,
      eventId: true,
      isPublic: true,
      isHidden: true,
      enableDigitalPhotos: true,
      enablePrintedPhotos: true,
      digitalPhotoPriceCents: true,
      selectedLabId: true,
      albumProfitMarginPercent: true,
      digitalDiscount5Plus: true,
      digitalDiscount10Plus: true,
      digitalDiscount20Plus: true,
      includeDigitalWithPrint: true,
      digitalWithPrintDiscountPercent: true,
      user: {
        select: {
          id: true,
          defaultDigitalPhotoPrice: true,
          preferredLabId: true,
          profitMarginPercent: true,
        },
      },
      photos: {
        where: { isRemoved: false },
        select: {
          id: true,
          userId: true,
          sellDigital: true,
          sellPrint: true,
        },
      },
    },
  });

  const eventIds = [
    ...new Set(albums.map((a) => a.eventId).filter((id): id is number => id != null && id > 0)),
  ];
  const events =
    eventIds.length > 0
      ? await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: {
            id: true,
            photoPricingMode: true,
            fixedPhotoPrice: true,
            minimumPhotoPrice: true,
          },
        })
      : [];
  const eventMap = new Map(events.map((e) => [e.id, e]));

  const labIds = [
    ...new Set(
      albums
        .map((a) => a.selectedLabId ?? a.user?.preferredLabId ?? null)
        .filter((id): id is number => id != null && Number.isFinite(id))
    ),
  ];
  const labs =
    labIds.length > 0
      ? await prisma.lab.findMany({
          where: { id: { in: labIds }, isActive: true },
          select: {
            id: true,
            basePrices: {
              where: { isActive: true },
              select: { size: true, unitPrice: true },
            },
          },
        })
      : [];
  const labMap = new Map(labs.map((l) => [l.id, l]));

  const allUploaderIds = new Set<number>();
  for (const album of albums) {
    for (const p of album.photos) {
      const uid = p.userId ?? album.userId;
      if (uid != null) allUploaderIds.add(uid);
    }
    if (album.userId != null) allUploaderIds.add(album.userId);
  }
  const uploaderUsers = await prisma.user.findMany({
    where: { id: { in: [...allUploaderIds] } },
    select: { id: true, defaultDigitalPhotoPrice: true },
  });
  const uploaderMap = new Map(uploaderUsers.map((u) => [u.id, u]));

  const audits: AlbumAudit[] = [];

  for (const album of albums) {
    const photoCount = album.photos.length;
    const albumOwnerId = album.userId;
    const albumHasPrice = positiveArs(album.digitalPhotoPriceCents) != null;
    const event = album.eventId ? eventMap.get(album.eventId) ?? null : null;

    const digitalFeePercent = await resolveAlbumOrderDigitalMarketplaceFeePercent({
      photographerId: album.userId,
      labId: album.selectedLabId,
    });

    const clientPrices = new Set<number>();
    const basePrices = new Set<number>();
    const uploaderIds = new Set<number>();
    let sellDigitalMixed = false;
    let sellPrintMixed = false;
    const sellDigitalValues = new Set<boolean>();
    const sellPrintValues = new Set<boolean>();

    for (const photo of album.photos) {
      const uploaderId = photo.userId ?? albumOwnerId;
      if (uploaderId != null) uploaderIds.add(uploaderId);
      sellDigitalValues.add(photo.sellDigital);
      sellPrintValues.add(photo.sellPrint);

      const uploaderPrice =
        uploaderId != null
          ? positiveArs(uploaderMap.get(uploaderId)?.defaultDigitalPhotoPrice ?? platformMinDigital)
          : positiveArs(platformMinDigital);

      let legacyBase =
        uploaderId === albumOwnerId && albumHasPrice
          ? positiveArs(album.digitalPhotoPriceCents)
          : uploaderPrice;

      if (legacyBase == null) legacyBase = positiveArs(platformMinDigital) ?? 0;

      if (event && album.eventId) {
        const uploaderRow = uploaderId != null ? uploaderMap.get(uploaderId) : undefined;
        const ownerRow = albumOwnerId != null ? uploaderMap.get(albumOwnerId) : undefined;
        const resolution = resolveEventDigitalPhotoBasePrice({
          album: { digitalPhotoPriceCents: album.digitalPhotoPriceCents },
          event,
          currentResolvedBasePrice: legacyBase,
          albumOwnerUser: ownerRow
            ? { defaultDigitalPhotoPrice: ownerRow.defaultDigitalPhotoPrice }
            : undefined,
          uploaderUser: uploaderRow
            ? { defaultDigitalPhotoPrice: uploaderRow.defaultDigitalPhotoPrice }
            : undefined,
          photo: { id: photo.id },
          globalMinimumPrice: platformMinDigital,
        });
        legacyBase = Math.round(resolution.basePrice);
      }

      basePrices.add(legacyBase);
      if (photo.sellDigital) {
        clientPrices.add(
          clientTotalFromPhotographerBaseArs(legacyBase, digitalFeePercent)
        );
      }
    }

    sellDigitalMixed = sellDigitalValues.size > 1;
    sellPrintMixed = sellPrintValues.size > 1;

    const distinctDigitalClientPrices = clientPrices.size;
    const uniformDigital = distinctDigitalClientPrices <= 1;
    const hasVariablePerPhoto = basePrices.size > 1;

    const collaboratorUploaders = [...uploaderIds].filter((id) => id !== albumOwnerId);
    const isCollaborative = album.eventId != null || collaboratorUploaders.length > 0;
    const isCollaborativeBreaksUniform =
      isCollaborative && hasVariablePerPhoto;

    const labId = album.selectedLabId ?? album.user?.preferredLabId ?? null;
    const lab = labId != null ? labMap.get(labId) : undefined;
    const margin =
      Number(album.albumProfitMarginPercent ?? album.user?.profitMarginPercent ?? 0) || 0;

    let printFromClientArs: number | null = null;
    if (lab && lab.basePrices.length > 0 && labId != null) {
      let platformPercent = 10;
      try {
        platformPercent = await resolvePlatformCommissionPercent({
          photographerId: album.userId,
          labId,
        });
      } catch {
        /* default */
      }
      const clientPrintPrices = lab.basePrices
        .map((bp) => {
          const base = Number(bp.unitPrice) || 0;
          if (base <= 0) return 0;
          const withMargin = Math.round(base * (1 + margin / 100));
          return totalFromBase(withMargin, platformPercent);
        })
        .filter((p) => p > 0);
      if (clientPrintPrices.length > 0) {
        printFromClientArs = Math.min(...clientPrintPrices);
      }
    }

    const printsActive =
      album.enablePrintedPhotos !== false &&
      labId != null &&
      printFromClientArs != null &&
      printFromClientArs > 0;

    const qtyDiscounts = hasQuantityDiscounts(album);

    const digitalClientPriceArs =
      clientPrices.size === 1 ? [...clientPrices][0]! : clientPrices.size > 1 ? null : null;

    const reasons: string[] = [];
    let classification: Classification = "A";

    const enableDigital = album.enableDigitalPhotos !== false;
    const anySellDigital = album.photos.some((p) => p.sellDigital);

    if (photoCount === 0) {
      reasons.push("sin_fotos_publicadas");
      classification = "C";
    } else if (!enableDigital && !printsActive) {
      reasons.push("sin_canal_venta_configurado");
      classification = "C";
    } else if (!enableDigital && printsActive) {
      reasons.push("solo_impresion_sin_digital");
      classification = "C";
    } else if (!anySellDigital && printsActive) {
      reasons.push("fotos_sin_venta_digital");
      classification = "C";
    } else if (digitalClientPriceArs == null && enableDigital && anySellDigital) {
      reasons.push("precio_digital_no_resoluble_o_variable");
      classification = "C";
    } else if (hasVariablePerPhoto || !uniformDigital) {
      reasons.push("precio_digital_variable_por_foto");
      classification = "C";
    } else if (sellDigitalMixed || sellPrintMixed) {
      reasons.push("formatos_venta_mixtos_por_foto");
      classification = "C";
    } else if (isCollaborativeBreaksUniform) {
      reasons.push("colaborativo_precio_no_uniforme");
      classification = "C";
    } else if (printsActive) {
      classification = "B";
      if (qtyDiscounts) reasons.push("tiene_descuentos_cantidad");
      if (isCollaborative) reasons.push("colaborativo_precio_uniforme");
    } else {
      classification = "A";
      if (qtyDiscounts) reasons.push("tiene_descuentos_cantidad");
      if (isCollaborative) reasons.push("colaborativo_precio_uniforme");
    }

    audits.push({
      id: album.id,
      title: album.title,
      classification,
      reasons,
      photoCount,
      uniformDigital,
      distinctDigitalClientPrices,
      hasVariablePerPhoto,
      isCollaborativeBreaksUniform,
      printsActive,
      hasQuantityDiscounts: qtyDiscounts,
      digitalClientPriceArs,
      printFromClientArs,
      eventId: album.eventId,
      uploaderCount: uploaderIds.size,
    });
  }

  const total = audits.length;
  const withPhotos = audits.filter((a) => a.photoCount > 0);
  const publicGallery = audits.filter(
    (a) =>
      a.photoCount > 0 &&
      isAlbumPubliclyAccessible({
        isPublic: albums.find((x) => x.id === a.id)!.isPublic,
        isHidden: albums.find((x) => x.id === a.id)!.isHidden,
      })
  );

  const countBy = (list: AlbumAudit[], key: keyof AlbumAudit, val: unknown) =>
    list.filter((a) => a[key] === val).length;

  const classCount = (list: AlbumAudit[], c: Classification) =>
    list.filter((a) => a.classification === c).length;

  console.log("\n=== AUDITORÍA MVP PRECIOS GALERÍA ===\n");
  console.log(`Total álbumes (deletedAt null): ${total}`);
  console.log(`Con fotos publicadas: ${withPhotos.length}`);
  console.log(`Galería pública accesible con fotos: ${publicGallery.length}\n`);

  for (const label of ["Todos", "Con fotos", "Galería pública"] as const) {
    const list =
      label === "Todos"
        ? audits
        : label === "Con fotos"
          ? withPhotos
          : publicGallery;
    console.log(`--- ${label} (${list.length}) ---`);
    console.log(`  A (digital uniforme): ${classCount(list, "A")}`);
    console.log(`  B (digital + impresión desde): ${classCount(list, "B")}`);
    console.log(`  C (tratamiento especial): ${classCount(list, "C")}`);
    console.log(`  Precio digital uniforme: ${list.filter((a) => a.uniformDigital && a.photoCount > 0).length}`);
    console.log(`  Precio variable por foto: ${list.filter((a) => a.hasVariablePerPhoto).length}`);
    console.log(`  Colaborativo rompe uniforme: ${list.filter((a) => a.isCollaborativeBreaksUniform).length}`);
    console.log(`  Impresiones activas: ${list.filter((a) => a.printsActive).length}`);
    console.log(`  Descuentos por cantidad: ${list.filter((a) => a.hasQuantityDiscounts).length}`);
    console.log("");
  }

  const publicA = publicGallery.filter((a) => a.classification === "A");
  const publicB = publicGallery.filter((a) => a.classification === "B");
  const publicC = publicGallery.filter((a) => a.classification === "C");

  console.log("--- Desglose C (galería pública) ---");
  const cReasons = new Map<string, number>();
  for (const a of publicC) {
    const key = a.reasons[0] ?? "otro";
    cReasons.set(key, (cReasons.get(key) ?? 0) + 1);
  }
  for (const [k, v] of [...cReasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\n--- A+B con descuentos (galería pública, siguen siendo MVP con leyenda) ---");
  const abWithDiscount = publicGallery.filter(
    (a) => (a.classification === "A" || a.classification === "B") && a.hasQuantityDiscounts
  );
  console.log(`  ${abWithDiscount.length} de ${publicA.length + publicB.length} compatibles MVP`);

  console.log("\n--- Muestra colaborativos que SÍ entran en A/B (precio uniforme) ---");
  publicGallery
    .filter(
      (a) =>
        (a.classification === "A" || a.classification === "B") &&
        (a.eventId != null || a.uploaderCount > 1)
    )
    .slice(0, 8)
    .forEach((a) =>
      console.log(
        `  #${a.id} ${a.title.slice(0, 40)} → ${a.classification} uploaders=${a.uploaderCount} event=${a.eventId ?? "-"}`
      )
    );

  console.log("\n--- Muestra C por precio variable ---");
  publicGallery
    .filter((a) => a.classification === "C" && a.hasVariablePerPhoto)
    .slice(0, 8)
    .forEach((a) =>
      console.log(
        `  #${a.id} ${a.title.slice(0, 40)} precios_distintos=${a.distinctDigitalClientPrices} uploaders=${a.uploaderCount}`
      )
    );

  const mvpSafe = publicA.length + publicB.length;
  const mvpPct = publicGallery.length
    ? ((mvpSafe / publicGallery.length) * 100).toFixed(1)
    : "0";
  console.log(`\n=== RESUMEN MVP ===`);
  console.log(
    `Galerías públicas compatibles sin riesgo (A+B): ${mvpSafe} / ${publicGallery.length} (${mvpPct}%)`
  );
  console.log(`Requieren tratamiento especial (C): ${publicC.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
