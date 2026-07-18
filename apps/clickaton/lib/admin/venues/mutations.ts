"use server";

import { revalidatePath } from "next/cache";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { getEditionById } from "@/lib/admin/editions/queries";
import {
  validateVenueFormInput,
  venueFormInputFromFormData,
  type VenueValidationErrors,
} from "./validation";
import { getVenueById, venueSlugExistsInEdition } from "./queries";

export type VenueActionState = {
  ok: boolean;
  errors?: VenueValidationErrors;
  message?: string;
};

function revalidateVenuePaths(venueId?: string, editionId?: string) {
  revalidatePath(adminRoutes.dashboard);
  revalidatePath(adminRoutes.venues);
  revalidatePath(adminRoutes.editions);
  if (venueId) {
    revalidatePath(`${adminRoutes.venues}/${venueId}`);
    revalidatePath(`${adminRoutes.venues}/${venueId}/editar`);
  }
  if (editionId) {
    revalidatePath(`${adminRoutes.editions}/${editionId}`);
    revalidatePath(`${adminRoutes.editions}/${editionId}/editar`);
    revalidatePath(`${adminRoutes.editions}/${editionId}/sedes/nueva`);
  }
}

export async function createVenueAction(
  _prev: VenueActionState | undefined,
  formData: FormData,
): Promise<VenueActionState> {
  await requireClickatonAdmin();
  const input = venueFormInputFromFormData(formData);
  const validated = validateVenueFormInput(input);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const edition = await getEditionById(validated.data.editionId);
  if (!edition.ok) return { ok: false, message: edition.message };
  if (!edition.data) return { ok: false, errors: { editionId: "Edición no encontrada." } };

  const slugCheck = await venueSlugExistsInEdition(
    validated.data.editionId,
    validated.data.slug,
  );
  if (!slugCheck.ok) return { ok: false, message: slugCheck.message };
  if (slugCheck.data) {
    return { ok: false, errors: { slug: "Ese slug ya existe en la edición." } };
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonVenue.create({ data: validated.data });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateVenuePaths(result.data.id, validated.data.editionId);
  return { ok: true, message: "Sede creada." };
}

export async function updateVenueAction(
  venueId: string,
  _prev: VenueActionState | undefined,
  formData: FormData,
): Promise<VenueActionState> {
  await requireClickatonAdmin();
  const existing = await getVenueById(venueId);
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data) return { ok: false, message: "Sede no encontrada." };

  const input = venueFormInputFromFormData(formData);
  const validated = validateVenueFormInput(input);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  if (
    validated.data.slug !== existing.data.slug ||
    validated.data.editionId !== existing.data.editionId
  ) {
    const slugCheck = await venueSlugExistsInEdition(
      validated.data.editionId,
      validated.data.slug,
      venueId,
    );
    if (!slugCheck.ok) return { ok: false, message: slugCheck.message };
    if (slugCheck.data) {
      return { ok: false, errors: { slug: "Ese slug ya existe en la edición." } };
    }
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonVenue.update({
      where: { id: venueId },
      data: validated.data,
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateVenuePaths(venueId, validated.data.editionId);
  return { ok: true, message: "Sede actualizada." };
}

export async function deactivateVenueAction(venueId: string): Promise<VenueActionState> {
  await requireClickatonAdmin();
  const existing = await getVenueById(venueId);
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data) return { ok: false, message: "Sede no encontrada." };

  const result = await withClickatonDb(async () => {
    return prisma.clickatonVenue.update({
      where: { id: venueId },
      data: { isActive: false },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateVenuePaths(venueId, existing.data.editionId);
  return { ok: true, message: "Sede desactivada." };
}

export async function deleteVenueAction(venueId: string): Promise<VenueActionState> {
  await requireClickatonAdmin();
  const existing = await getVenueById(venueId);
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data) return { ok: false, message: "Sede no encontrada." };

  const edition = await getEditionById(existing.data.editionId);
  if (!edition.ok) return { ok: false, message: edition.message };
  if (!edition.data) return { ok: false, message: "Edición no encontrada." };

  // MVP: sin modelo de inscripciones — permitir delete si edición DRAFT o sede inactiva confirmada
  const allowed =
    edition.data.status === "DRAFT" ||
    (!existing.data.isActive && edition.data.status !== "COMPLETED");

  if (!allowed) {
    return {
      ok: false,
      message:
        "Solo podés eliminar sedes de ediciones en borrador, o sedes inactivas sin dependencias futuras.",
    };
  }

  const result = await withClickatonDb(async () => {
    await prisma.clickatonVenue.delete({ where: { id: venueId } });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateVenuePaths(undefined, existing.data.editionId);
  return { ok: true, message: "Sede eliminada." };
}
