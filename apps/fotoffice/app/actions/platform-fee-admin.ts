"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { listAvailableModuleKeys } from "@/lib/modules/registry";
import { MAX_PLATFORM_FEE_BPS, isValidFeeBps } from "@/lib/platform-fee/fee";

export type PlatformFeeState = { error: string | null; ok: string | null };

/** Whitelist derivada del registry, igual que en `toggleWorkspaceModuleAction`. */
const ALLOWED_MODULE_KEYS = new Set(listAvailableModuleKeys());

/**
 * Convierte "7,5" o "7.5" a 750 puntos básicos.
 * Devuelve null si no es un porcentaje válido con hasta 2 decimales.
 */
function parsePercentToBps(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const bps = Math.round(Number(text) * 100);
  return isValidFeeBps(bps) ? bps : null;
}

/**
 * Fija la comisión de la plataforma para un módulo de un workspace.
 *
 * Solo SUPER_ADMIN: la comisión es de DNX, no del cliente. El dueño del workspace la ve
 * en su configuración pero no puede tocarla — ver `updateCoursesSalesSettingsAction`.
 */
export async function setModuleFeeAction(
  _prev: PlatformFeeState | undefined,
  formData: FormData,
): Promise<PlatformFeeState> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) {
    return { error: "Solo SUPER_ADMIN puede editar la comisión de la plataforma.", ok: null };
  }

  const workspaceId = formData.get("workspaceId")?.toString()?.trim();
  const moduleKey = formData.get("moduleKey")?.toString()?.trim();
  if (!workspaceId) return { error: "Workspace inválido.", ok: null };
  if (!moduleKey || !ALLOWED_MODULE_KEYS.has(moduleKey)) {
    return { error: "Módulo inválido.", ok: null };
  }

  const bps = parsePercentToBps(formData.get("feePercent")?.toString() ?? "");
  if (bps === null) {
    return {
      error: `Comisión inválida. Usá un número entre 0 y ${
        MAX_PLATFORM_FEE_BPS / 100
      }, con hasta 2 decimales.`,
      ok: null,
    };
  }

  await prisma.workspaceModuleFee.upsert({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
    update: { feeBps: bps, updatedByUserId: user.id },
    create: { workspaceId, moduleKey, feeBps: bps, updatedByUserId: user.id },
  });

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { error: null, ok: "Comisión actualizada." };
}
