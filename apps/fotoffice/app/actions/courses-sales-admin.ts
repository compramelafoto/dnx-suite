"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { isFotofficePlatformAdmin } from "@/lib/platform-admin";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";

export type ToggleModuleState = { error: string | null };

export async function toggleCoursesSalesModuleAction(
  _prev: ToggleModuleState | undefined,
  formData: FormData,
): Promise<ToggleModuleState> {
  const user = await requireAuth();
  if (!(await isFotofficePlatformAdmin(user.id))) {
    return { error: "Solo SUPER_ADMIN puede gestionar módulos globales." };
  }
  const workspaceId = formData.get("workspaceId")?.toString()?.trim();
  const enabledRaw = formData.get("enabled")?.toString();
  if (!workspaceId) return { error: "Workspace inválido." };
  const enabled = enabledRaw === "true" || enabledRaw === "on";

  await prisma.workspaceFeatureModule.upsert({
    where: {
      workspaceId_moduleKey: { workspaceId, moduleKey: COURSES_SALES_MODULE_KEY },
    },
    update: { enabled },
    create: { workspaceId, moduleKey: COURSES_SALES_MODULE_KEY, enabled },
  });

  revalidatePath("/admin/workspace-modules");
  return { error: null };
}
