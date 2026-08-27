"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { parseFeeValue, validateDuesSettings } from "@/lib/membership/fee-value-rules";
import { minorToDecimalString } from "@/lib/membership/money";

export type SettingsResult = { ok: true } | { ok: false; error: string };

/**
 * Configuración de cuotas de la institución.
 *
 * Solo el dueño o un administrador: estos números deciden cuándo y cuánto se le cobra a
 * todos los socios.
 */
export async function saveDuesSettingsAction(formData: FormData): Promise<SettingsResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "Solo el dueño o un administrador puede cambiar esto." };
  }

  const numero = (clave: string) => Number(formData.get(clave));
  const entrada = {
    generationDay: numero("generationDay"),
    dueDay: numero("dueDay"),
    graceDays: numero("graceDays"),
    reminderDay: numero("reminderDay"),
    initialDuesCount: numero("initialDuesCount"),
  };

  const control = validateDuesSettings(entrada);
  if (!control.ok) return control;

  await prisma.membershipDuesSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...entrada },
    update: entrada,
  });

  revalidatePath("/members/cuotas/configuracion");
  return { ok: true };
}

/**
 * Carga un valor de cuota.
 *
 * **No se edita el valor vigente: se carga uno nuevo con su fecha.** Los cargos ya emitidos
 * apuntan al valor con el que se calcularon, así que reescribirlo cambiaría la historia de
 * lo que se le cobró a la gente. El valor anterior queda cerrado con la fecha del nuevo.
 */
export async function saveFeeValueAction(formData: FormData): Promise<SettingsResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "Solo el dueño o un administrador puede cambiar esto." };
  }

  const parsed = parseFeeValue({
    amountRaw: String(formData.get("amount") ?? ""),
    validFromRaw: String(formData.get("validFrom") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "") || null,
    boardMinutesRef: String(formData.get("boardMinutesRef") ?? "") || null,
  });
  if (!parsed.ok) return parsed;

  const { amountMinor, validFrom, categoryId, boardMinutesRef } = parsed.value;

  if (categoryId) {
    const existe = await prisma.memberCategory.findFirst({
      where: { id: categoryId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!existe) return { ok: false, error: "Esa categoría no es de tu institución." };
  }

  await prisma.$transaction(async (tx) => {
    // Se cierra el valor anterior del mismo alcance. Sin esto quedarían dos vigentes a la vez
    // y el que gane dependería del orden de la consulta.
    await tx.membershipFeeValue.updateMany({
      where: {
        workspaceId: workspace.id,
        categoryId,
        validUntil: null,
        validFrom: { lt: validFrom },
      },
      data: { validUntil: validFrom },
    });

    await tx.membershipFeeValue.create({
      data: {
        workspaceId: workspace.id,
        categoryId,
        amountArs: minorToDecimalString(amountMinor),
        validFrom,
        boardMinutesRef,
      },
    });
  });

  revalidatePath("/members/cuotas/configuracion");
  revalidatePath("/members/cuotas");
  return { ok: true };
}
