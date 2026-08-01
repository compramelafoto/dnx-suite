"use server";

import { revalidatePath } from "next/cache";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import {
  editionFormInputFromFormData,
  validateEditionFormInput,
  type EditionValidationErrors,
} from "./validation";
import { editionSlugExists, getEditionById } from "./queries";

export type EditionActionState = {
  ok: boolean;
  errors?: EditionValidationErrors;
  message?: string;
};

function revalidateEditionPaths(editionId?: string) {
  revalidatePath(adminRoutes.dashboard);
  revalidatePath(adminRoutes.editions);
  revalidatePath(adminRoutes.venues);
  revalidatePath("/");
  revalidatePath("/maratones");
  if (editionId) {
    revalidatePath(`${adminRoutes.editions}/${editionId}`);
    revalidatePath(`${adminRoutes.editions}/${editionId}/editar`);
  }
}

export async function createEditionAction(
  _prev: EditionActionState | undefined,
  formData: FormData,
): Promise<EditionActionState> {
  await requireClickatonAdmin();
  const input = editionFormInputFromFormData(formData);
  const validated = validateEditionFormInput(input);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const slugCheck = await editionSlugExists(validated.data.slug);
  if (!slugCheck.ok) return { ok: false, message: slugCheck.message };
  if (slugCheck.data) {
    return { ok: false, errors: { slug: "Ese slug ya está en uso." } };
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonEdition.create({ data: validated.data });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateEditionPaths(result.data.id);
  return { ok: true, message: "Edición creada." };
}

export async function updateEditionAction(
  editionId: string,
  _prev: EditionActionState | undefined,
  formData: FormData,
): Promise<EditionActionState> {
  await requireClickatonAdmin();
  const existing = await getEditionById(editionId);
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data) return { ok: false, message: "Edición no encontrada." };

  const input = editionFormInputFromFormData(formData);
  const validated = validateEditionFormInput(input, { existingSlug: existing.data.slug });
  if (!validated.ok) return { ok: false, errors: validated.errors };

  if (validated.data.slug !== existing.data.slug) {
    const slugCheck = await editionSlugExists(validated.data.slug, editionId);
    if (!slugCheck.ok) return { ok: false, message: slugCheck.message };
    if (slugCheck.data) {
      return { ok: false, errors: { slug: "Ese slug ya está en uso." } };
    }
  }

  // Etapa 5: no habilitar inscripciones comerciales sin distribución financiera válida.
  if (validated.data.registrationEnabled && !existing.data.registrationEnabled) {
    const { evaluateEditionFinanceGate } = await import(
      "@/lib/admin/edition-finance/infrastructure/prisma-edition-finance"
    );
    const gate = await evaluateEditionFinanceGate({
      editionId,
      mode: process.env.NODE_ENV === "production" ? "LIVE" : "TEST",
      dnxPaymentsReady:
        process.env.DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED === "true",
      webhookConfigured: Boolean(
        process.env.CLICKATON_DNX_PAYMENTS_WEBHOOK_SECRET ||
          process.env.DNX_PAYMENTS_WEBHOOK_SECRET,
      ),
      hasActivePricePhase: true,
    });
    if (!gate.ok) {
      return {
        ok: false,
        errors: {
          registrationEnabled: gate.blockers.join(" "),
        },
        message: "Gate financiero: no se pueden habilitar inscripciones.",
      };
    }
  }

  const result = await withClickatonDb(async () => {
    return prisma.clickatonEdition.update({
      where: { id: editionId },
      data: validated.data,
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateEditionPaths(editionId);
  return { ok: true, message: "Edición actualizada." };
}

export async function deleteEditionAction(editionId: string): Promise<EditionActionState> {
  await requireClickatonAdmin();
  const existing = await getEditionById(editionId);
  if (!existing.ok) return { ok: false, message: existing.message };
  if (!existing.data) return { ok: false, message: "Edición no encontrada." };

  if (existing.data.status !== "DRAFT") {
    return {
      ok: false,
      message: "Solo se pueden eliminar ediciones en estado borrador.",
    };
  }
  if ((existing.data.venueCount ?? 0) > 0) {
    return {
      ok: false,
      message: "Eliminá o reasigná las sedes antes de borrar la edición.",
    };
  }

  const result = await withClickatonDb(async () => {
    await prisma.clickatonEdition.delete({ where: { id: editionId } });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateEditionPaths();
  return { ok: true, message: "Edición eliminada." };
}

export async function unpublishEditionAction(editionId: string): Promise<EditionActionState> {
  await requireClickatonAdmin();
  const result = await withClickatonDb(async () => {
    return prisma.clickatonEdition.update({
      where: { id: editionId },
      data: { isPublished: false, registrationEnabled: false },
    });
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidateEditionPaths(editionId);
  return { ok: true, message: "Edición despublicada (inscripciones deshabilitadas)." };
}
