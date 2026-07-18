"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";

export type ToggleModuleState = { error: string | null };
const ALLOWED_MODULE_KEYS = new Set([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]);

export async function toggleWorkspaceModuleAction(
  _prev: ToggleModuleState | undefined,
  formData: FormData,
): Promise<ToggleModuleState> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) {
    return { error: "Solo SUPER_ADMIN puede gestionar módulos globales." };
  }
  const workspaceId = formData.get("workspaceId")?.toString()?.trim();
  const enabledRaw = formData.get("enabled")?.toString();
  const moduleKey = formData.get("moduleKey")?.toString()?.trim();
  if (!workspaceId) return { error: "Workspace inválido." };
  if (!moduleKey || !ALLOWED_MODULE_KEYS.has(moduleKey)) {
    return { error: "Módulo inválido." };
  }
  const enabled = enabledRaw === "true" || enabledRaw === "on";

  await prisma.workspaceFeatureModule.upsert({
    where: {
      workspaceId_moduleKey: { workspaceId, moduleKey },
    },
    update: { enabled },
    create: { workspaceId, moduleKey, enabled },
  });

  revalidatePath("/admin/workspace-modules");
  return { error: null };
}

export async function toggleCoursesSalesModuleAction(
  prev: ToggleModuleState | undefined,
  formData: FormData,
): Promise<ToggleModuleState> {
  if (!formData.get("moduleKey")) {
    formData.set("moduleKey", COURSES_SALES_MODULE_KEY);
  }
  return toggleWorkspaceModuleAction(prev, formData);
}
