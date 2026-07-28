"use server";

import { revalidatePath } from "next/cache";
import { findDuplicateProductsAcrossLevels } from "@/lib/catalog/domain/resolve-included-items";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma, withClickatonDb, type ClickatonDbResult } from "@/lib/admin/db";
import { getPricePhaseById } from "./queries";

export type PricePhaseItemRecord = {
  id: string;
  pricePhaseId: string;
  productId: string;
  quantity: number;
  requiresVariantChoice: boolean;
  sortOrder: number;
  isIncluded: boolean;
  stockLimit: number | null;
  fulfillmentRequired: boolean;
  displayTitle: string | null;
  displayDescription: string | null;
  product: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    archivedAt: Date | null;
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      stock: number;
      reservedStock: number;
      isActive: boolean;
    }>;
  };
};

export type PricePhaseItemActionState = {
  ok: boolean;
  message?: string;
  /** Aviso no bloqueante (p. ej. inscripciones existentes). */
  warning?: string;
  errors?: Partial<Record<string, string>>;
};

export type PricePhaseItemFormInput = {
  productId: string;
  quantity: number;
  requiresVariantChoice: boolean;
  sortOrder: number;
  stockLimit: number | null;
  fulfillmentRequired: boolean;
  displayTitle: string | null;
  displayDescription: string | null;
};

function revalidatePricingPaths(editionId: string) {
  revalidatePath(`${adminRoutes.editions}/${editionId}`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/precios`);
}

function formString(formData: FormData, key: string): string {
  return formData.get(key)?.toString().trim() ?? "";
}

function parseOptionalInt(raw: string, field: string, errors: Record<string, string>): number | null {
  if (!raw.trim()) return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0 || String(n) !== raw.trim()) {
    errors[field] = "Número entero inválido.";
    return null;
  }
  return n;
}

function parsePhaseItemForm(formData: FormData): {
  ok: true;
  data: PricePhaseItemFormInput;
} | {
  ok: false;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const productId = formString(formData, "productId");
  if (!productId) errors.productId = "Elegí un producto.";

  const quantityRaw = formString(formData, "quantity") || "1";
  const quantity = Number.parseInt(quantityRaw, 10);
  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = "Cantidad debe ser ≥ 1.";
  }

  const sortOrderRaw = formString(formData, "sortOrder") || "100";
  const sortOrder = Number.parseInt(sortOrderRaw, 10);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    errors.sortOrder = "Orden inválido.";
  }

  const stockLimit = parseOptionalInt(formString(formData, "stockLimit"), "stockLimit", errors);
  if (stockLimit != null && stockLimit < 1) {
    errors.stockLimit = "Cupo debe ser ≥ 1 o vacío.";
  }

  const displayTitle = formString(formData, "displayTitle") || null;
  const displayDescription = formString(formData, "displayDescription") || null;

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      productId,
      quantity,
      requiresVariantChoice: formData.has("requiresVariantChoice"),
      sortOrder,
      stockLimit,
      fulfillmentRequired: formData.has("fulfillmentRequired"),
      displayTitle,
      displayDescription,
    },
  };
}

async function assertPhaseBelongsToEdition(
  editionId: string,
  phaseId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const phase = await getPricePhaseById(phaseId);
  if (!phase.ok) return { ok: false, message: phase.message };
  if (!phase.data || phase.data.editionId !== editionId) {
    return { ok: false, message: "Fase no encontrada en esta edición." };
  }
  return { ok: true };
}

async function getEditionTicketProductIds(editionId: string): Promise<string[]> {
  const rows = await prisma.clickatonTicketTypeItem.findMany({
    where: { ticketType: { editionId } },
    select: { productId: true },
  });
  return [...new Set(rows.map((r) => r.productId))];
}

async function countPhaseRegistrations(phaseId: string): Promise<number> {
  return prisma.clickatonRegistration.count({
    where: {
      pricePhaseId: phaseId,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
  });
}

async function validateProductForPhaseItem(input: {
  editionId: string;
  phaseId: string;
  productId: string;
  requiresVariantChoice: boolean;
  excludeItemId?: string;
}): Promise<{ ok: true; warning?: string } | { ok: false; message: string; errors?: Record<string, string> }> {
  const product = await prisma.clickatonProduct.findUnique({
    where: { id: input.productId },
    include: { variants: true },
  });
  if (!product || product.editionId !== input.editionId) {
    return { ok: false, message: "Producto no pertenece a la edición.", errors: { productId: "Producto inválido." } };
  }
  if (!product.isActive || product.archivedAt) {
    return {
      ok: false,
      message: "El producto está inactivo o archivado.",
      errors: { productId: "Producto inactivo o archivado." },
    };
  }

  const duplicateOnPhase = await prisma.clickatonPricePhaseItem.findFirst({
    where: {
      pricePhaseId: input.phaseId,
      productId: input.productId,
      ...(input.excludeItemId ? { NOT: { id: input.excludeItemId } } : {}),
    },
  });
  if (duplicateOnPhase) {
    return {
      ok: false,
      message: "Este producto ya está incluido en la fase.",
      errors: { productId: "Producto duplicado en la fase." },
    };
  }

  const ticketProductIds = await getEditionTicketProductIds(input.editionId);
  const dupes = findDuplicateProductsAcrossLevels(ticketProductIds, [input.productId]);
  if (dupes.length > 0) {
    return {
      ok: false,
      message:
        "Este producto ya está en la composición de alguna entrada (ticket base). " +
        "Quitálo del ticket o elegí otro producto (política Etapa 8B).",
      errors: { productId: "Conflicto con ticket base." },
    };
  }

  if (input.requiresVariantChoice) {
    const activeVariants = product.variants.filter((v) => v.isActive);
    if (activeVariants.length === 0) {
      return {
        ok: false,
        message: "El producto exige talle pero no tiene variantes activas.",
        errors: { requiresVariantChoice: "Sin variantes activas." },
      };
    }
  }

  const regCount = await countPhaseRegistrations(input.phaseId);
  const warning =
    regCount > 0
      ? `Hay ${regCount} inscripción(es) con esta fase. Los cambios no alteran snapshots ya guardados.`
      : undefined;

  return { ok: true, warning };
}

function mapItem(row: {
  id: string;
  pricePhaseId: string;
  productId: string;
  quantity: number;
  requiresVariantChoice: boolean;
  sortOrder: number;
  isIncluded: boolean;
  stockLimit: number | null;
  fulfillmentRequired: boolean;
  displayTitle: string | null;
  displayDescription: string | null;
  product: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    archivedAt: Date | null;
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      stock: number;
      reservedStock: number;
      isActive: boolean;
    }>;
  };
}): PricePhaseItemRecord {
  return {
    id: row.id,
    pricePhaseId: row.pricePhaseId,
    productId: row.productId,
    quantity: row.quantity,
    requiresVariantChoice: row.requiresVariantChoice,
    sortOrder: row.sortOrder,
    isIncluded: row.isIncluded,
    stockLimit: row.stockLimit,
    fulfillmentRequired: row.fulfillmentRequired,
    displayTitle: row.displayTitle,
    displayDescription: row.displayDescription,
    product: row.product,
  };
}

export async function listPricePhaseItems(
  phaseId: string,
): Promise<ClickatonDbResult<PricePhaseItemRecord[]>> {
  return withClickatonDb(async () => {
    const rows = await prisma.clickatonPricePhaseItem.findMany({
      where: { pricePhaseId: phaseId, isIncluded: true },
      orderBy: { sortOrder: "asc" },
      include: {
        product: {
          include: { variants: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    return rows.map(mapItem);
  });
}

export async function addPricePhaseItemAction(
  editionId: string,
  phaseId: string,
  _prev: PricePhaseItemActionState | undefined,
  formData: FormData,
): Promise<PricePhaseItemActionState> {
  await requireClickatonAdmin();

  const phaseCheck = await assertPhaseBelongsToEdition(editionId, phaseId);
  if (!phaseCheck.ok) return { ok: false, message: phaseCheck.message };

  const parsed = parsePhaseItemForm(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const validation = await validateProductForPhaseItem({
    editionId,
    phaseId,
    productId: parsed.data.productId,
    requiresVariantChoice: parsed.data.requiresVariantChoice,
  });
  if (!validation.ok) {
    return { ok: false, message: validation.message, errors: validation.errors };
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonPricePhaseItem.create({
      data: {
        pricePhaseId: phaseId,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        requiresVariantChoice: parsed.data.requiresVariantChoice,
        sortOrder: parsed.data.sortOrder,
        stockLimit: parsed.data.stockLimit,
        fulfillmentRequired: parsed.data.fulfillmentRequired,
        displayTitle: parsed.data.displayTitle,
        displayDescription: parsed.data.displayDescription,
        isIncluded: true,
      },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePricingPaths(editionId);
  return {
    ok: true,
    message: "Producto agregado a la fase.",
    warning: validation.warning,
  };
}

export async function updatePricePhaseItemAction(
  editionId: string,
  phaseId: string,
  itemId: string,
  _prev: PricePhaseItemActionState | undefined,
  formData: FormData,
): Promise<PricePhaseItemActionState> {
  await requireClickatonAdmin();

  const phaseCheck = await assertPhaseBelongsToEdition(editionId, phaseId);
  if (!phaseCheck.ok) return { ok: false, message: phaseCheck.message };

  const existing = await withClickatonDb(async () =>
    prisma.clickatonPricePhaseItem.findFirst({
      where: { id: itemId, pricePhaseId: phaseId },
    }),
  );
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data) return { ok: false, message: "Ítem no encontrado." };

  const parsed = parsePhaseItemForm(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  if (parsed.data.productId !== existing.data.productId) {
    return {
      ok: false,
      message: "No se puede cambiar el producto de un ítem existente. Quitá y volvé a agregar.",
      errors: { productId: "Cambiá el producto quitando y agregando de nuevo." },
    };
  }

  const validation = await validateProductForPhaseItem({
    editionId,
    phaseId,
    productId: parsed.data.productId,
    requiresVariantChoice: parsed.data.requiresVariantChoice,
    excludeItemId: itemId,
  });
  if (!validation.ok) {
    return { ok: false, message: validation.message, errors: validation.errors };
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonPricePhaseItem.update({
      where: { id: itemId },
      data: {
        quantity: parsed.data.quantity,
        requiresVariantChoice: parsed.data.requiresVariantChoice,
        sortOrder: parsed.data.sortOrder,
        stockLimit: parsed.data.stockLimit,
        fulfillmentRequired: parsed.data.fulfillmentRequired,
        displayTitle: parsed.data.displayTitle,
        displayDescription: parsed.data.displayDescription,
      },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePricingPaths(editionId);
  return {
    ok: true,
    message: "Ítem actualizado.",
    warning: validation.warning,
  };
}

export async function removePricePhaseItemAction(
  editionId: string,
  phaseId: string,
  itemId: string,
): Promise<PricePhaseItemActionState> {
  await requireClickatonAdmin();

  const phaseCheck = await assertPhaseBelongsToEdition(editionId, phaseId);
  if (!phaseCheck.ok) return { ok: false, message: phaseCheck.message };

  const regCount = await countPhaseRegistrations(phaseId);
  const warning =
    regCount > 0
      ? `Hay ${regCount} inscripción(es) con esta fase. Quitar el producto no altera snapshots ya guardados.`
      : undefined;

  const result = await withClickatonDb(async () => {
    const row = await prisma.clickatonPricePhaseItem.findFirst({
      where: { id: itemId, pricePhaseId: phaseId },
    });
    if (!row) return null;
    await prisma.clickatonPricePhaseItem.delete({ where: { id: itemId } });
    return row;
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (!result.data) return { ok: false, message: "Ítem no encontrado." };

  revalidatePricingPaths(editionId);
  return { ok: true, message: "Producto quitado de la fase.", warning };
}

export async function duplicatePhaseItemsFromPhaseAction(
  editionId: string,
  targetPhaseId: string,
  sourcePhaseId: string,
): Promise<PricePhaseItemActionState> {
  await requireClickatonAdmin();

  if (targetPhaseId === sourcePhaseId) {
    return { ok: false, message: "Elegí una fase distinta como origen." };
  }

  const [targetCheck, sourceCheck] = await Promise.all([
    assertPhaseBelongsToEdition(editionId, targetPhaseId),
    assertPhaseBelongsToEdition(editionId, sourcePhaseId),
  ]);
  if (!targetCheck.ok) return { ok: false, message: targetCheck.message };
  if (!sourceCheck.ok) return { ok: false, message: sourceCheck.message };

  const [sourceItems, targetItems] = await Promise.all([
    listPricePhaseItems(sourcePhaseId),
    listPricePhaseItems(targetPhaseId),
  ]);
  if (!sourceItems.ok) return { ok: false, message: sourceItems.message };
  if (!targetItems.ok) return { ok: false, message: targetItems.message };

  const existingProductIds = new Set(targetItems.data.map((i) => i.productId));
  let copied = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of sourceItems.data) {
    if (existingProductIds.has(item.productId)) {
      skipped += 1;
      continue;
    }

    const validation = await validateProductForPhaseItem({
      editionId,
      phaseId: targetPhaseId,
      productId: item.productId,
      requiresVariantChoice: item.requiresVariantChoice,
    });
    if (!validation.ok) {
      errors.push(`${item.product.name}: ${validation.message}`);
      skipped += 1;
      continue;
    }

    const createResult = await withClickatonDb(async () =>
      prisma.clickatonPricePhaseItem.create({
        data: {
          pricePhaseId: targetPhaseId,
          productId: item.productId,
          quantity: item.quantity,
          requiresVariantChoice: item.requiresVariantChoice,
          sortOrder: item.sortOrder,
          stockLimit: item.stockLimit,
          fulfillmentRequired: item.fulfillmentRequired,
          displayTitle: item.displayTitle,
          displayDescription: item.displayDescription,
          isIncluded: true,
        },
      }),
    );
    if (!createResult.ok) {
      errors.push(`${item.product.name}: ${createResult.message}`);
      skipped += 1;
      continue;
    }
    copied += 1;
    existingProductIds.add(item.productId);
  }

  revalidatePricingPaths(editionId);

  const regCount = await countPhaseRegistrations(targetPhaseId);
  const warning =
    regCount > 0
      ? `Hay ${regCount} inscripción(es) en la fase destino. Los snapshots existentes no cambian.`
      : undefined;

  if (copied === 0 && skipped > 0) {
    return {
      ok: false,
      message:
        errors.length > 0
          ? `No se copió ningún producto. ${errors[0]}`
          : "No hay productos nuevos para copiar (todos duplicados o inválidos).",
      warning,
    };
  }

  return {
    ok: true,
    message: `Copiados ${copied} producto(s)${skipped ? `; omitidos ${skipped}` : ""}.`,
    warning,
  };
}
