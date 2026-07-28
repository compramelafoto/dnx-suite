"use server";

import { revalidatePath } from "next/cache";
import {
  isValidPromotionCodeFormat,
  normalizePromotionCode,
} from "@repo/promotions";
import { prisma } from "@repo/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { parseDateTimeInput } from "@/lib/admin/datetime-input";
import { CatalogValidationError } from "@/lib/admin-catalog/domain/errors";
import { pesosInputToMinorUnits } from "@/lib/admin-catalog/ui/money-ui";
import { adminRoutes } from "@/config/admin/navigation";
import { CLICKATON_PROMOTION_PLATFORM } from "@/lib/promotions/prisma-promotions-adapter";

export type PromotionActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

function revalidatePromotions() {
  revalidatePath(adminRoutes.promotions);
}

export async function createPromotionFormAction(
  formData: FormData,
): Promise<void> {
  await requireClickatonAdmin();

  const code = normalizePromotionCode(formData.get("code")?.toString() ?? "");
  const name = (formData.get("name")?.toString() ?? "").trim();
  const description = (formData.get("description")?.toString() ?? "").trim() || null;
  const discountType = (formData.get("discountType")?.toString() ?? "PERCENTAGE") as
    | "PERCENTAGE"
    | "FIXED_AMOUNT";
  const discountValueRaw = (formData.get("discountValue")?.toString() ?? "").trim();
  const editionId = (formData.get("editionId")?.toString() ?? "").trim() || null;
  const startsAt = parseDateTimeInput(formData.get("startsAt")?.toString() ?? "");
  const endsAt = parseDateTimeInput(formData.get("endsAt")?.toString() ?? "");
  const isActive =
    formData.get("isActive") === "on" || formData.get("isActive") === "true";

  const errors: Record<string, string> = {};
  if (!isValidPromotionCodeFormat(code)) {
    errors.code = "Código inválido (3–40 chars, A-Z 0-9 _ -).";
  }
  if (!name) errors.name = "El nombre es obligatorio.";
  if (!startsAt) errors.startsAt = "Inicio inválido.";
  if (!endsAt) errors.endsAt = "Fin inválido.";
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    errors.endsAt = "El fin debe ser ≥ inicio.";
  }

  let discountValue = 0;
  if (discountType === "PERCENTAGE") {
    discountValue = Number.parseInt(discountValueRaw, 10);
    if (!Number.isInteger(discountValue) || discountValue < 1 || discountValue > 100) {
      errors.discountValue = "Porcentaje entre 1 y 100.";
    }
  } else {
    try {
      discountValue = pesosInputToMinorUnits(discountValueRaw, "discountValue");
    } catch (err) {
      if (err instanceof CatalogValidationError) {
        Object.assign(errors, err.fieldErrors);
      } else {
        errors.discountValue = "Monto inválido.";
      }
    }
  }

  let maxDiscountAmount: number | null = null;
  const maxPesos = (formData.get("maxDiscountAmountPesos")?.toString() ?? "").trim();
  if (maxPesos) {
    try {
      maxDiscountAmount = pesosInputToMinorUnits(maxPesos, "maxDiscountAmountPesos");
    } catch (err) {
      if (err instanceof CatalogValidationError) {
        Object.assign(errors, err.fieldErrors);
      }
    }
  }

  let minimumPurchaseAmount: number | null = null;
  const minPesos = (formData.get("minimumPurchaseAmountPesos")?.toString() ?? "").trim();
  if (minPesos) {
    try {
      minimumPurchaseAmount = pesosInputToMinorUnits(minPesos, "minimumPurchaseAmountPesos");
    } catch (err) {
      if (err instanceof CatalogValidationError) {
        Object.assign(errors, err.fieldErrors);
      }
    }
  }

  const totalUsageLimitRaw = (formData.get("totalUsageLimit")?.toString() ?? "").trim();
  let totalUsageLimit: number | null = null;
  if (totalUsageLimitRaw) {
    totalUsageLimit = Number.parseInt(totalUsageLimitRaw, 10);
    if (!Number.isInteger(totalUsageLimit) || totalUsageLimit < 1) {
      errors.totalUsageLimit = "Límite total inválido.";
    }
  }

  const perUserRaw = (formData.get("perUserUsageLimit")?.toString() ?? "1").trim();
  const perUserUsageLimit = Number.parseInt(perUserRaw, 10);
  if (!Number.isInteger(perUserUsageLimit) || perUserUsageLimit < 1) {
    errors.perUserUsageLimit = "Límite por usuario inválido.";
  }

  if (Object.keys(errors).length || !startsAt || !endsAt) {
    throw new Error(Object.values(errors)[0] ?? "Datos inválidos.");
  }

  const result = await withClickatonDb(async () => {
    return prisma.dnxPromotion.create({
      data: {
        code,
        name,
        description,
        discountType,
        discountValue,
        maxDiscountAmount,
        minimumPurchaseAmount,
        startsAt,
        endsAt,
        totalUsageLimit,
        perUserUsageLimit,
        isActive,
        platform: CLICKATON_PROMOTION_PLATFORM,
        editionId,
      },
    });
  });
  if (!result.ok) {
    throw new Error(result.message ?? "No se pudo crear la promoción.");
  }

  revalidatePromotions();
}

export async function setPromotionActiveAction(
  promotionId: string,
  isActive: boolean,
): Promise<PromotionActionState> {
  await requireClickatonAdmin();
  const result = await withClickatonDb(async () => {
    return prisma.dnxPromotion.update({
      where: { id: promotionId },
      data: { isActive },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePromotions();
  return { ok: true, message: isActive ? "Promoción activada." : "Promoción desactivada." };
}
