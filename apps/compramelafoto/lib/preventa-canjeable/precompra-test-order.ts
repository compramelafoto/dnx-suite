import {
  CheckoutPaymentSource,
  StudentIdentificationMode,
  StudentSourceType,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { getPreventaRequirements, isSchoolAlbum } from "@/lib/preventa-canjeable/preventa-mode";
import { matchSchoolCourseId } from "@/lib/school-roster/match-school-course-id";
import { createPrecompraPackOrderInTransaction } from "@/lib/preventa-canjeable/precompra-pack-order-transaction";
import {
  buildOrderItems,
  buildPricingSnapshot,
  hasLegacyAlbumProductItem,
  mergePackLines,
  parsePrecompraRequest,
} from "@/lib/preventa-canjeable/precompra-order-request-helpers";
import { isAlbumTestOwnerPhotographer } from "@/lib/public-album-test-access";


export type ResultadoPedidoSimulado =
  | { ok: true; preCompraOrderId: number; orderId: number }
  | { ok: false; status: number; error: string };

/**
 * Pedido de preventa pack simulado (sin Mercado Pago), con las mismas validaciones que la compra
 * real: solo el dueño de un álbum en modo prueba. Lo usan la compra de prueba del panel y las
 * ventas de ejemplo de las demos.
 */
export async function crearPedidoPreventaSimulado(
  user: Parameters<typeof isAlbumTestOwnerPhotographer>[1],
  body: unknown,
): Promise<ResultadoPedidoSimulado> {
  const {
    albumId,
    buyerEmail,
    buyerUserId,
    buyerName,
    buyerPhone,
    schoolCourseId,
    studentFirstName,
    studentLastName,
    albumRosterEntryId,
    organizerReferralSchoolId,
    items,
  } = parsePrecompraRequest(body);

  if (!Number.isInteger(albumId) || albumId <= 0 || !buyerEmail) {
    return { ok: false, status: 400, error: "albumId y buyerEmail son requeridos" };
  }
  if (!buyerName?.trim()) {
    return { ok: false, status: 400, error: "El nombre y apellido del comprador es requerido" };
  }
  if (!buyerPhone?.trim()) {
    return { ok: false, status: 400, error: "El teléfono del comprador es requerido" };
  }

  if (hasLegacyAlbumProductItem(items)) {
    return { ok: false, status: 400, error: "La preventa por productos del catálogo anterior ya no está disponible. Elegí un pack de la lista." };
  }

  const now = new Date();
  const album = await prisma.album.findFirst({
    where: {
      id: albumId,
      deletedAt: null,
    },
    include: { school: { include: { courses: true } } },
  });

  if (!album) {
    return { ok: false, status: 404, error: "Álbum no encontrado o pre-venta cerrada" };
  }

  if (!isAlbumTestOwnerPhotographer(album, user)) {
    return { ok: false, status: 403, error: "Solo el dueño del álbum en modo prueba puede crear pedidos de simulación." };
  }

  // Igual que la preventa real: el link del colegio (`?ref=school_<id>`) le da su comisión.
  const referralSchoolIdNum = Number(organizerReferralSchoolId);
  const resolvedOrganizerReferralSchoolId =
    Number.isInteger(referralSchoolIdNum) && referralSchoolIdNum > 0 && album.schoolId === referralSchoolIdNum
      ? referralSchoolIdNum
      : null;

  const isSchool = isSchoolAlbum(album);
  const preventaReqs = getPreventaRequirements(album);
  const identMode = album.studentIdentificationMode ?? StudentIdentificationMode.NONE;
  const useLegacySchoolFields = isSchool && identMode === StudentIdentificationMode.NONE;

  let resolvedSchoolCourseId: number | null = null;
  let resolvedStudentFirstName: string | null = null;
  let resolvedStudentLastName: string | null = null;
  let resolvedStudentId: number | null = null;
  let resolvedAlbumRosterEntryId: number | null = null;
  let resolvedStudentSourceType: StudentSourceType | null = null;
  let resolvedLevelSnap: string | null = null;
  let resolvedShiftSnap: string | null = null;
  let resolvedCourseSnap: string | null = null;
  let resolvedDivisionSnap: string | null = null;

  if (preventaReqs.requiresSchoolData) {
    if (useLegacySchoolFields) {
      if (!schoolCourseId || !Number.isFinite(schoolCourseId)) {
        return { ok: false, status: 400, error: "Seleccioná el curso/división del alumno" };
      }
      if (!studentFirstName?.trim()) {
        return { ok: false, status: 400, error: "El nombre del alumno es requerido" };
      }
      if (!studentLastName?.trim()) {
        return { ok: false, status: 400, error: "El apellido del alumno es requerido" };
      }
      const courseExists = album.school?.courses.some((c) => c.id === schoolCourseId);
      if (!courseExists) {
        return { ok: false, status: 400, error: "Curso no válido para esta escuela" };
      }
      resolvedSchoolCourseId = schoolCourseId;
      resolvedStudentFirstName = studentFirstName.trim();
      resolvedStudentLastName = studentLastName.trim();
    } else {
      const rid =
        albumRosterEntryId != null && Number.isFinite(Number(albumRosterEntryId))
          ? Math.floor(Number(albumRosterEntryId))
          : NaN;
      if (!Number.isInteger(rid) || rid <= 0) {
        return { ok: false, status: 400, error: "Tenés que elegir o cargar los datos del alumno antes de pagar." };
      }
      const rosterEntry = await prisma.albumStudentRosterEntry.findFirst({
        where: {
          id: rid,
          albumId: album.id,
          isActive: true,
        },
      });
      if (!rosterEntry) {
        return { ok: false, status: 400, error: "El alumno elegido no es válido para este álbum" };
      }
      const courses = album.school?.courses ?? [];
      resolvedSchoolCourseId = matchSchoolCourseId(courses, rosterEntry.courseName, rosterEntry.division);
      resolvedStudentFirstName = rosterEntry.snapshotFirstName.trim();
      resolvedStudentLastName = rosterEntry.snapshotLastName.trim();
      resolvedStudentId = rosterEntry.studentId;
      resolvedAlbumRosterEntryId = rosterEntry.id;
      resolvedStudentSourceType = rosterEntry.sourceType;
      resolvedLevelSnap = rosterEntry.level;
      resolvedShiftSnap = rosterEntry.shift;
      resolvedCourseSnap = rosterEntry.courseName;
      resolvedDivisionSnap = rosterEntry.division;
    }
  }

  const photoCount = await prisma.photo.count({
    where: { albumId, isRemoved: false },
  });
  const hasPhotos = photoCount > 0;
  const purchasablePacks = await listActivePacksForPublicCatalog(albumId, now, {
    hasPhotos,
  });
  const packById = new Map(purchasablePacks.map((p) => [p.id, p]));

  const photographerId = album.userId ?? null;
  const platformPercent = await resolveClientMarketplaceFeePercent({
    photographerId,
    labId: album.selectedLabId ?? null,
  });

  const orderItems = buildOrderItems(items, packById, platformPercent);

  if (orderItems.length === 0) {
    return { ok: false, status: 400, error: "Agregá al menos un pack válido de la lista" };
  }

  const mergedByPack = mergePackLines(orderItems);
  if (mergedByPack.size !== 1) {
    return { ok: false, status: 400, error: "En un solo pedido solo podés comprar un tipo de pack. Quitá el otro pack o hacé un pedido aparte." };
  }
  const mergedLine = [...mergedByPack.values()][0];
  const packDefinitionId = mergedLine.packDefinitionId;
  const packQuantity = mergedLine.quantity;

  let totalCents = 0;
  for (const it of orderItems) {
    totalCents += it.priceCents * it.quantity;
  }

  const orderTotalArs = Math.max(0, Math.round(totalCents / 100));
  const marketplaceFeeCents = feeFromTotal(orderTotalArs, platformPercent);

  const pricingSnapshot = buildPricingSnapshot(
    packDefinitionId,
    platformPercent,
    marketplaceFeeCents
  );

  const { preCompraOrder, albumPackOrder } = await prisma.$transaction((tx) =>
    createPrecompraPackOrderInTransaction(tx, {
      albumId,
      buyerEmail,
      buyerUserId: Number.isFinite(buyerUserId) ? buyerUserId : null,
      buyerName,
      buyerPhone,
      isSchool,
      resolvedSchoolCourseId,
      resolvedStudentFirstName,
      resolvedStudentLastName,
      resolvedStudentId,
      resolvedAlbumRosterEntryId,
      resolvedStudentSourceType,
      resolvedLevelSnap,
      resolvedShiftSnap,
      resolvedCourseSnap,
      resolvedDivisionSnap,
      orderItems,
      packDefinitionId,
      packQuantity,
      totalCents,
      orderTotalArs,
      pricingSnapshot,
      platformPercent,
      now,
      isTest: true,
      checkoutPaymentSource: CheckoutPaymentSource.SIMULATED,
      preventaReqs,
      organizerReferralSchoolId: resolvedOrganizerReferralSchoolId,
    }),
    // Pedido de simulación: se usa en vivo en las demos; mejor esperar que fallar a mitad.
    { timeout: 20_000 }
  );

  return { ok: true, preCompraOrderId: preCompraOrder.id, orderId: albumPackOrder.id };
}
