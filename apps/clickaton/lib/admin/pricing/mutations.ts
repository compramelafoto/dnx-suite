"use server";

import { revalidatePath } from "next/cache";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { getEditionById } from "@/lib/admin/editions/queries";
import { listPricePhasesByEdition } from "./queries";
import {
  pricePhaseFormFromFormData,
  validatePricePhaseForm,
  type PricePhaseFormErrors,
} from "./validation";

export type PricePhaseActionState = {
  ok: boolean;
  errors?: PricePhaseFormErrors;
  message?: string;
};

function revalidatePricingPaths(editionId: string) {
  revalidatePath(`${adminRoutes.editions}/${editionId}`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/precios`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/editar`);
}

export async function createPricePhaseAction(
  editionId: string,
  _prev: PricePhaseActionState | undefined,
  formData: FormData,
): Promise<PricePhaseActionState> {
  await requireClickatonAdmin();
  const edition = await getEditionById(editionId);
  if (!edition.ok) return { ok: false, message: edition.message };
  if (!edition.data) return { ok: false, message: "Edición no encontrada." };

  const existing = await listPricePhasesByEdition(editionId);
  if (!existing.ok) return { ok: false, message: existing.message };

  const input = pricePhaseFormFromFormData(formData);
  const validated = validatePricePhaseForm(input, { existingPhases: existing.data });
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const result = await withClickatonDb(async () => {
    return prisma.clickatonRegistrationPricePhase.create({
      data: {
        editionId,
        ...validated.data,
      },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePricingPaths(editionId);
  return { ok: true, message: "Fase de precio creada." };
}

export async function updatePricePhaseAction(
  editionId: string,
  phaseId: string,
  _prev: PricePhaseActionState | undefined,
  formData: FormData,
): Promise<PricePhaseActionState> {
  await requireClickatonAdmin();
  const existing = await listPricePhasesByEdition(editionId);
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data.some((p) => p.id === phaseId)) {
    return { ok: false, message: "Fase no encontrada." };
  }

  const input = pricePhaseFormFromFormData(formData);
  const validated = validatePricePhaseForm(input, {
    existingPhases: existing.data,
    excludePhaseId: phaseId,
  });
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const result = await withClickatonDb(async () => {
    return prisma.clickatonRegistrationPricePhase.update({
      where: { id: phaseId },
      data: validated.data,
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePricingPaths(editionId);
  return { ok: true, message: "Fase actualizada." };
}

export async function setPricePhaseActiveAction(
  editionId: string,
  phaseId: string,
  isActive: boolean,
): Promise<PricePhaseActionState> {
  await requireClickatonAdmin();
  const existing = await listPricePhasesByEdition(editionId);
  if (!existing.ok) return { ok: false, message: existing.message };
  const phase = existing.data.find((p) => p.id === phaseId);
  if (!phase) return { ok: false, message: "Fase no encontrada." };

  if (isActive) {
    const candidate = { ...phase, isActive: true };
    const pool = existing.data.map((p) => (p.id === phaseId ? candidate : p));
    const { findActivePhaseOverlaps } = await import(
      "@/lib/pricing/domain/resolve-price-phase"
    );
    const overlaps = findActivePhaseOverlaps(pool);
    if (overlaps.length > 0) {
      return {
        ok: false,
        message: `No se puede activar: solapa con «${overlaps[0]!.aName}» / «${overlaps[0]!.bName}».`,
      };
    }
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonRegistrationPricePhase.update({
      where: { id: phaseId },
      data: { isActive },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePricingPaths(editionId);
  return {
    ok: true,
    message: isActive ? "Fase activada." : "Fase desactivada.",
  };
}
