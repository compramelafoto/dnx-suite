"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { parseFeeValue, validateDuesSettings } from "@/lib/membership/fee-value-rules";
import { parseRecommendationPercent } from "@/lib/membership/settings";
import { parseWhatsappGroupUrl } from "@/lib/membership/community-link";
import { minorToDecimalString } from "@/lib/membership/money";
import { sendDuesReminders } from "@/lib/membership/dues-reminder";

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
  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"))) {
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

  // El porcentaje se valida aparte: no es un día del mes, y su tope —100— responde a otra
  // razón, que bonificar más que la cuota dejaría saldo a favor.
  const porcentaje = parseRecommendationPercent(formData.get("recommendationBenefitPercent"));
  if (!porcentaje.ok) return porcentaje;

  const datos = {
    ...entrada,
    recommendationEnabled: formData.get("recommendationEnabled") === "on",
    recommendationBenefitPercent: porcentaje.value.toFixed(2),
  };

  await prisma.membershipDuesSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...datos },
    update: datos,
  });

  revalidatePath("/members/cuotas/configuracion");
  return { ok: true };
}

/**
 * El grupo de WhatsApp de los socios.
 *
 * Va por separado del calendario de cobranza: es otro formulario en la misma pantalla, y
 * guardar uno no tiene por qué tocar lo del otro.
 */
export async function saveCommunityLinkAction(formData: FormData): Promise<SettingsResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"))) {
    return { ok: false, error: "Solo el dueño o un administrador puede cambiar esto." };
  }

  const enlace = parseWhatsappGroupUrl(formData.get("communityWhatsappUrl"));
  if (!enlace.ok) return enlace;

  await prisma.membershipDuesSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, communityWhatsappUrl: enlace.value },
    update: { communityWhatsappUrl: enlace.value },
  });

  revalidatePath("/members/cuotas/configuracion");
  revalidatePath("/portal");
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
  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"))) {
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

/**
 * Manda el recordatorio de cuota ahora, sin esperar el día configurado.
 *
 * Mismo permiso que la configuración: es un correo a todo el padrón que debe. A quien ya lo
 * recibió este mes no se le repite, así que apretarlo dos veces no duplica nada.
 */
export async function sendDuesReminderNowAction(): Promise<
  { ok: true; message: string } | { ok: false; error: string }
> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"))) {
    return { ok: false, error: "Solo el dueño o un administrador puede mandar el recordatorio." };
  }

  const r = await sendDuesReminders({ workspaceId: workspace.id, mode: "MANUAL" });
  revalidatePath("/members/cuotas/configuracion");

  const partes = [`Enviados: ${r.enviados}.`];
  if (r.yaRecordados > 0) partes.push(`Ya lo habían recibido este mes: ${r.yaRecordados}.`);
  if (r.sinEmail > 0) partes.push(`Sin email cargado: ${r.sinEmail}.`);
  if (r.fallidos > 0) partes.push(`No salieron: ${r.fallidos} (quedaron registrados; volvé a apretar para reintentar).`);
  return { ok: true, message: partes.join(" ") };
}
