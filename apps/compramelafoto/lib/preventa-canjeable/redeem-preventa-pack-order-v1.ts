import {
  CheckoutPaymentSource,
  OrderItemLineOrigin,
  OrderItemType,
  OrderOrigin,
  OrderStatus,
  Prisma,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  parsePreventaPackSnapshotV1,
  validateRedeemSelectionsAgainstSnapshot,
  type RedeemUnitSelectionInput,
  type PreventaPackSnapshotV1,
  PreventaPackRedeemValidationError,
} from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { assertPreventaPackOrderRedeemable } from "@/lib/preventa-canjeable/assert-preventa-pack-redeemable";
import {
  ensureSchoolDesignForPreCompraOrderItem,
  PRE_DESIGN_ITEM_STATUSES,
  type TemplateRow,
} from "@/lib/school-render/ensure-school-design-for-preventa-order-item";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";

export { PreventaPackRedeemValidationError };

export type PreventaPackRedeemResultV1 = {
  redemptionOrderId: number;
};

type SelectionChunk = {
  orderItemId: number;
  subjectId: number | null;
  photoIds: number[];
  /** Qué fotos eligió la familia para cada beneficio: el diseño solo puede usar las suyas. */
  photoIdsByBenefitKey: Map<string, number[]>;
};

function collectPhotoIds(selections: RedeemUnitSelectionInput[]): number[] {
  const ids: number[] = [];
  for (const s of selections) {
    for (const unit of s.units) {
      for (const pid of unit) {
        ids.push(pid);
      }
    }
  }
  return ids;
}

function distributeUnitsAcrossPacks(units: number[][], packCount: number): number[][][] {
  const out: number[][][] = Array.from({ length: packCount }, () => []);
  if (packCount <= 1) {
    out[0] = units;
    return out;
  }
  const base = Math.floor(units.length / packCount);
  const remainder = units.length % packCount;
  let cursor = 0;
  for (let i = 0; i < packCount; i += 1) {
    const size = base + (i < remainder ? 1 : 0);
    out[i] = units.slice(cursor, cursor + size);
    cursor += size;
  }
  return out;
}

async function persistSchoolSelectionsFromRedeem(
  tx: Prisma.TransactionClient,
  preCompraOrderId: number | null,
  snapshot: PreventaPackSnapshotV1,
  selections: RedeemUnitSelectionInput[]
): Promise<void> {
  if (!preCompraOrderId) return;
  const preCompra = await tx.preCompraOrder.findUnique({
    where: { id: preCompraOrderId },
    include: {
      album: { select: { schoolId: true } },
      items: {
        where: { packDefinitionId: snapshot.packDefinitionId },
        select: {
          id: true,
          subjectId: true,
          status: true,
          albumProduct: { select: { requiresDesign: true, defaultTemplateId: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!preCompra?.album?.schoolId) return;
  const items = preCompra.items;
  if (items.length === 0) return;

  const existing = await tx.selection.findMany({
    where: { orderItemId: { in: items.map((i) => i.id) } },
    include: {
      photos: {
        select: {
          id: true,
          role: true,
          position: true,
          photoId: true,
          photo: { select: { id: true, previewUrl: true, originalKey: true, isRemoved: true } },
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
  });
  const existingByOrderItemId = new Map(
    existing.map((row) => [row.orderItemId, row] as const)
  );

  const selectionByKey = new Map(
    selections.map((s) => [s.benefitStableKey.trim(), s] as const)
  );
  const benefits = [...snapshot.benefits].sort((a, b) => a.sortOrder - b.sortOrder);

  const perItemPhotoIds: SelectionChunk[] = items.map((item) => ({
    orderItemId: item.id,
    subjectId: item.subjectId ?? null,
    photoIds: [],
    photoIdsByBenefitKey: new Map<string, number[]>(),
  }));

  for (const ben of benefits) {
    const sel = selectionByKey.get(ben.stableKey);
    if (!sel || !Array.isArray(sel.units)) continue;
    const distributed = distributeUnitsAcrossPacks(sel.units, perItemPhotoIds.length);
    for (let i = 0; i < perItemPhotoIds.length; i += 1) {
      const unitGroups = distributed[i] || [];
      const delBeneficio = perItemPhotoIds[i].photoIdsByBenefitKey.get(ben.stableKey) ?? [];
      for (const unit of unitGroups) {
        perItemPhotoIds[i].photoIds.push(...unit);
        delBeneficio.push(...unit);
      }
      perItemPhotoIds[i].photoIdsByBenefitKey.set(ben.stableKey, delBeneficio);
    }
  }

  const templateCache = new Map<number, TemplateRow | null>();

  for (const chunk of perItemPhotoIds) {
    if (chunk.photoIds.length === 0) continue;
    const existingSelection = existingByOrderItemId.get(chunk.orderItemId);
    let totalCount = existingSelection?.photos?.length ?? 0;
    let selectionPhotos: Array<{
      id: number;
      role: string | null;
      position?: number | null;
      photoId?: number | null;
      photo?: { previewUrl?: string | null; originalKey?: string | null; isRemoved?: boolean } | null;
    }> = existingSelection?.photos ?? [];
    if (!existingSelection?.photos?.length) {
      const selectionId =
        existingSelection?.id ??
        (await tx.selection.create({
          data: { orderItemId: chunk.orderItemId },
          select: { id: true },
        })).id;

      await tx.selectionPhoto.createMany({
        data: chunk.photoIds.map((photoId, position) => ({
          selectionId,
          photoId,
          position,
          subjectId: chunk.subjectId,
        })),
      });
      totalCount += chunk.photoIds.length;
      const fresh = await tx.selection.findUnique({
        where: { orderItemId: chunk.orderItemId },
        include: {
          photos: {
            select: {
              id: true,
              role: true,
              position: true,
              photoId: true,
              photo: { select: { previewUrl: true, originalKey: true, isRemoved: true } },
            },
            orderBy: [{ position: "asc" }, { id: "asc" }],
          },
        },
      });
      if (!fresh?.photos?.length) {
        console.warn("[school_redeem_design_gate] selection_reload_failed", {
          orderItemId: chunk.orderItemId,
        });
        continue;
      }
      selectionPhotos = fresh.photos;
    }

    const expectedCount = chunk.photoIds.length;
    if (expectedCount <= 0 || totalCount < expectedCount) {
      continue;
    }

    const item = items.find((i) => i.id === chunk.orderItemId) ?? null;
    const designResult = await ensureSchoolDesignForPreCompraOrderItem(tx, {
      snapshot,
      orderItem: {
        id: chunk.orderItemId,
        albumProduct: item?.albumProduct ?? null,
      },
      selectionPhotos,
      photoIdsByBenefitKey: chunk.photoIdsByBenefitKey,
      templateCache,
    });
    if (designResult.outcome === "skipped") {
      // El pack puede no tener pieza para diseñar (por ejemplo, solo digitales). Igual la familia
      // ya eligió: dejarlo en "Esperando selfie" hace que el panel del fotógrafo mienta.
      await tx.preCompraOrderItem.updateMany({
        where: { id: chunk.orderItemId, status: { in: [...PRE_DESIGN_ITEM_STATUSES] } },
        data: {
          status: "APPROVED_BY_MATCH",
          approvalProof: "SELECTION",
          approvedAt: new Date(),
        },
      });
      continue;
    }
  }
}

/** Fotos ya cargadas del álbum del pedido padre: flags de venta por beneficio. */
function validatePhotosForRedeemSelections(
  snapshot: PreventaPackSnapshotV1,
  selections: RedeemUnitSelectionInput[],
  parentAlbumId: number,
  photoById: Map<
    number,
    { id: number; albumId: number; sellDigital: boolean; sellPrint: boolean }
  >
): void {
  const byKey = new Map(selections.map((s) => [s.benefitStableKey.trim(), s] as const));
  for (const ben of snapshot.benefits) {
    const sel = byKey.get(ben.stableKey);
    if (!sel) continue;
    for (let u = 0; u < sel.units.length; u++) {
      for (const pid of sel.units[u]) {
        const p = photoById.get(pid);
        if (!p || p.albumId !== parentAlbumId) {
          throw new PreventaPackRedeemValidationError(
            `Foto ${pid} inexistente, eliminada o no pertenece a este álbum`
          );
        }
        if (ben.kind === "DIGITAL" && !p.sellDigital) {
          throw new PreventaPackRedeemValidationError(
            `La foto ${pid} no está habilitada para venta digital`
          );
        }
        if (ben.kind === "PHYSICAL" && !p.sellPrint) {
          throw new PreventaPackRedeemValidationError(
            `La foto ${pid} no está habilitada para impresión`
          );
        }
      }
    }
  }
}

/**
 * Canje atómico: crea Order PACK_REDEMPTION, ítems incluidos y enlaza 1:1 con el Order PREVENTA_PACK.
 * Debe llamarse dentro de una transacción con aislamiento serializable desde el caller, o usar el wrapper.
 */
export async function executePreventaPackRedeemV1InTransaction(
  tx: Prisma.TransactionClient,
  preventaOrderId: number,
  selections: RedeemUnitSelectionInput[],
  now: Date = new Date()
): Promise<PreventaPackRedeemResultV1> {
  const parent = await tx.order.findUnique({
    where: { id: preventaOrderId },
    select: {
      id: true,
      albumId: true,
      buyerEmail: true,
      buyerUserId: true,
      buyerPhone: true,
      status: true,
      origin: true,
      redemptionOrderId: true,
      preCompraPaymentRef: true,
      preventaPackSnapshotJson: true,
      organizerSchoolId: true,
      organizerReferralApplied: true,
    },
  });
  if (!parent) {
    throw new PreventaPackRedeemValidationError("Pedido no encontrado");
  }
  if (parent.origin !== OrderOrigin.PREVENTA_PACK) {
    throw new PreventaPackRedeemValidationError(
      "Solo se puede canjear un pedido de preventa (PREVENTA_PACK)"
    );
  }
  if (parent.status !== OrderStatus.PAID) {
    throw new PreventaPackRedeemValidationError("El pedido de preventa debe estar pagado");
  }
  if (parent.redemptionOrderId != null) {
    throw new PreventaPackRedeemValidationError("Este pack ya fue canjeado");
  }
  if (parent.preventaPackSnapshotJson == null) {
    throw new PreventaPackRedeemValidationError("El pedido no tiene snapshot de pack congelado");
  }

  let snapshot: PreventaPackSnapshotV1;
  try {
    snapshot = parsePreventaPackSnapshotV1(parent.preventaPackSnapshotJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new PreventaPackRedeemValidationError(`Snapshot inválido: ${msg}`);
  }

  validateRedeemSelectionsAgainstSnapshot(snapshot, selections, now);
  // VALIDACIÓN GLOBAL: ninguna foto puede repetirse entre beneficios
  const allPhotoIds = [];
  for (const s of selections) {
    for (const unit of s.units) {
      for (const pid of unit) {
        allPhotoIds.push(pid);
      }
    }
  }
  const unique = new Set(allPhotoIds);
  if (unique.size !== allPhotoIds.length) {
    throw new PreventaPackRedeemValidationError(
      "No podés usar la misma foto en más de un beneficio"
    );
  }


  const photoIds = collectPhotoIds(selections);
  const uniqueIds = [...new Set(photoIds)];
  const photos = await tx.photo.findMany({
    where: {
      id: { in: uniqueIds },
      albumId: parent.albumId,
      isRemoved: false,
    },
    select: {
      id: true,
      albumId: true,
      sellDigital: true,
      sellPrint: true,
    },
  });
  const photoById = new Map(photos.map((p) => [p.id, p] as const));
  if (photos.length !== uniqueIds.length) {
    throw new PreventaPackRedeemValidationError(
      "Alguna foto no existe, fue eliminada o no pertenece a este álbum"
    );
  }
  validatePhotosForRedeemSelections(
    snapshot,
    selections,
    parent.albumId,
    photoById
  );

  const productIds = [
    ...new Set(
      snapshot.benefits
        .map((b) => b.photographerProductId)
        .filter((x): x is number => x != null)
    ),
  ];
  const products =
    productIds.length > 0
      ? await tx.photographerProduct.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, size: true, acabado: true },
        })
      : [];
  const productById = new Map(products.map((p) => [p.id, p] as const));
  for (const b of snapshot.benefits) {
    if (b.kind === "PHYSICAL" && b.photographerProductId != null) {
      if (!productById.has(b.photographerProductId)) {
        throw new PreventaPackRedeemValidationError(
          `Producto de laboratorio ${b.photographerProductId} no disponible para el beneficio ${b.stableKey}`
        );
      }
    }
  }

  const selectionByKey = new Map(
    selections.map((s) => [s.benefitStableKey.trim(), s] as const)
  );

  type ItemRow = {
    photoId: number;
    productType: OrderItemType;
    priceCents: number;
    subtotalCents: number;
    quantity: number;
    size: string | null;
    finish: string | null;
    lineOrigin: OrderItemLineOrigin;
    benefitStableKey: string;
    packSlotIndex: number | null;
    metadata: Prisma.InputJsonValue;
  };

  const itemsToCreate: ItemRow[] = [];

  for (const ben of snapshot.benefits) {
    const sel = selectionByKey.get(ben.stableKey);
    if (!sel) continue;
    const product =
      ben.photographerProductId != null
        ? productById.get(ben.photographerProductId)
        : undefined;
    const size =
      ben.kind === "PHYSICAL"
        ? (product?.size ?? null)?.trim() || null
        : null;
    const finishRaw =
      ben.kind === "PHYSICAL" ? (product?.acabado ?? "BRILLO").toString().trim() : "";
    const finish =
      ben.kind === "PHYSICAL"
        ? (finishRaw || "BRILLO").toUpperCase()
        : null;

    for (let unitIdx = 0; unitIdx < sel.units.length; unitIdx++) {
      const unit = sel.units[unitIdx];
      for (const photoId of unit) {
        itemsToCreate.push({
          photoId,
          productType:
            ben.kind === "DIGITAL" ? OrderItemType.DIGITAL : OrderItemType.PRINT,
          priceCents: 0,
          subtotalCents: 0,
          quantity: 1,
          size,
          finish,
          lineOrigin: OrderItemLineOrigin.PACK_INCLUDED,
          benefitStableKey: ben.stableKey,
          packSlotIndex: unitIdx,
          metadata: {
            unitIndex: unitIdx,
            redeemedFromOrderId: parent.id,
            snapshotSchemaVersion: snapshot.schemaVersion,
            packDefinitionIdSnapshot: snapshot.packDefinitionId,
          },
        });
      }
    }
  }

  const pricingSnapshot: Prisma.InputJsonValue = {
    kind: "PACK_REDEMPTION_V1",
    preventaOrderId: parent.id,
    snapshotSchemaVersion: snapshot.schemaVersion,
    packDefinitionId: snapshot.packDefinitionId,
  };

  const child = await tx.order.create({
    data: {
      albumId: parent.albumId,
      buyerEmail: parent.buyerEmail,
      buyerUserId: parent.buyerUserId,
      buyerPhone: parent.buyerPhone,
      status: OrderStatus.PAID,
      totalCents: 0,
      origin: OrderOrigin.PACK_REDEMPTION,
      checkoutPaymentSource: CheckoutPaymentSource.PREPAID_PACK,
      redeemsOrderId: parent.id,
      organizerSchoolId: parent.organizerSchoolId,
      organizerReferralApplied: parent.organizerReferralApplied,
      pricingSnapshot: pricingSnapshot,
      items: {
        create: itemsToCreate,
      },
    },
    select: { id: true },
  });

  const preCompraOrderId = parent.preCompraPaymentRef
    ? parseInt(String(parent.preCompraPaymentRef).trim(), 10)
    : NaN;
  await persistSchoolSelectionsFromRedeem(
    tx,
    Number.isFinite(preCompraOrderId) ? preCompraOrderId : null,
    snapshot,
    selections
  );

  const updated = await tx.order.updateMany({
    where: {
      id: parent.id,
      redemptionOrderId: null,
      origin: OrderOrigin.PREVENTA_PACK,
      status: OrderStatus.PAID,
    },
    data: { redemptionOrderId: child.id },
  });

  if (updated.count !== 1) {
    throw new PreventaPackRedeemValidationError(
      "No se pudo confirmar el canje (condición de carrera); reintentá"
    );
  }

  return { redemptionOrderId: child.id };
}

export async function executePreventaPackRedeemV1(
  preventaOrderId: number,
  selections: RedeemUnitSelectionInput[]
): Promise<PreventaPackRedeemResultV1> {
  const gate = await assertPreventaPackOrderRedeemable(preventaOrderId);
  if (!gate.ok) {
    throw new PreventaPackRedeemValidationError(gate.message, gate.httpStatus, gate.code);
  }

  const now = new Date();
  try {
    const resultado = await prisma.$transaction(
      (tx) => executePreventaPackRedeemV1InTransaction(tx, preventaOrderId, selections, now),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      }
    );

    // El pedido de canje nace pagado sin pasar por el webhook de Mercado Pago, que es quien
    // normalmente prepara la entrega. Sin esto la familia canjea y nunca recibe sus fotos.
    // Fuera de la transacción y sin propagar el error: el canje ya está confirmado.
    try {
      await ensureDigitalDelivery(resultado.redemptionOrderId);
    } catch (err) {
      console.error("[preventa_redeem] digital_delivery_failed", {
        redemptionOrderId: resultado.redemptionOrderId,
        err,
      });
    }

    return resultado;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new PreventaPackRedeemValidationError(
        "Este pack ya fue canjeado o hay un conflicto de canje"
      );
    }
    throw e;
  }
}
