import { NextRequest, NextResponse } from "next/server";
import {
  CheckoutPaymentSource,
  Role,
  StudentIdentificationMode,
  StudentSourceType,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG = "[TEST_CHECKOUT] create order";

/**
 * POST /api/precompra/order/test
 * Pedido preventa pack simulado (solo dueño + álbum isTest). Sin Mercado Pago.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
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
      items,
    } = parsePrecompraRequest(body);

    if (!Number.isInteger(albumId) || albumId <= 0 || !buyerEmail) {
      return NextResponse.json({ error: "albumId y buyerEmail son requeridos" }, { status: 400 });
    }
    if (!buyerName?.trim()) {
      return NextResponse.json(
        { error: "El nombre y apellido del comprador es requerido" },
        { status: 400 }
      );
    }
    if (!buyerPhone?.trim()) {
      return NextResponse.json({ error: "El teléfono del comprador es requerido" }, { status: 400 });
    }

    if (hasLegacyAlbumProductItem(items)) {
      return NextResponse.json(
        {
          error:
            "La preventa por productos del catálogo anterior ya no está disponible. Elegí un pack de la lista.",
        },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Álbum no encontrado o pre-venta cerrada" }, { status: 404 });
    }

    if (!isAlbumTestOwnerPhotographer(album, user)) {
      return NextResponse.json(
        { error: "Solo el dueño del álbum en modo prueba puede crear pedidos de simulación." },
        { status: 403 }
      );
    }

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
          return NextResponse.json({ error: "Seleccioná el curso/división del alumno" }, { status: 400 });
        }
        if (!studentFirstName?.trim()) {
          return NextResponse.json({ error: "El nombre del alumno es requerido" }, { status: 400 });
        }
        if (!studentLastName?.trim()) {
          return NextResponse.json({ error: "El apellido del alumno es requerido" }, { status: 400 });
        }
        const courseExists = album.school?.courses.some((c) => c.id === schoolCourseId);
        if (!courseExists) {
          return NextResponse.json({ error: "Curso no válido para esta escuela" }, { status: 400 });
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
          return NextResponse.json(
            { error: "Tenés que elegir o cargar los datos del alumno antes de pagar." },
            { status: 400 }
          );
        }
        const rosterEntry = await prisma.albumStudentRosterEntry.findFirst({
          where: {
            id: rid,
            albumId: album.id,
            isActive: true,
          },
        });
        if (!rosterEntry) {
          return NextResponse.json(
            { error: "El alumno elegido no es válido para este álbum" },
            { status: 400 }
          );
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
      return NextResponse.json(
        { error: "Agregá al menos un pack válido de la lista" },
        { status: 400 }
      );
    }

    const mergedByPack = mergePackLines(orderItems);
    if (mergedByPack.size !== 1) {
      return NextResponse.json(
        {
          error:
            "En un solo pedido solo podés comprar un tipo de pack. Quitá el otro pack o hacé un pedido aparte.",
        },
        { status: 400 }
      );
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
        organizerReferralSchoolId: null,
      })
    );

    console.info(LOG, {
      albumId,
      preCompraOrderId: preCompraOrder.id,
      orderId: albumPackOrder.id,
      userId: user.id,
    });

    const created = await prisma.preCompraOrder.findUnique({
      where: { id: preCompraOrder.id },
      include: {
        items: { include: { albumProduct: true, packDefinition: true } },
      },
    });

    return NextResponse.json({
      order: created,
      preCompraOrderId: preCompraOrder.id,
      orderId: albumPackOrder.id,
    });
  } catch (e) {
    console.error("precompra order test create error:", e);
    if (e instanceof Error && e.message === "pack_not_found_for_snapshot") {
      return NextResponse.json({ error: "Pack no válido para este álbum" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear el pedido de prueba" }, { status: 500 });
  }
}
