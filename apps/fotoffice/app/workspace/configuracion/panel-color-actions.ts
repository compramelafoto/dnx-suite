"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { normalizarColor } from "@/lib/panel-tema/tema";

export type PanelColorState = { ok?: boolean; error?: string };

/** Prende, cambia o apaga los colores propios del panel. Sólo dueño o admin, como el resto de la configuración. */
export async function guardarColorPanelAction(_prev: PanelColorState | undefined, formData: FormData): Promise<PanelColorState> {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
    select: { role: true },
  });
  if (!membership || !canManageWorkspaceSettings(membership.role)) {
    return { error: "No tenés permiso para cambiar los colores del panel." };
  }

  const usar = formData.get("usar") === "on";
  const color = normalizarColor(formData.get("color"));
  if (usar && !color) return { error: "Ese color no se entiende. Usá el selector o un código como #F5A42A." };

  const r = await prisma.fotofficeWorkspaceBranding.updateMany({
    where: { workspaceId: ensured.workspaceId },
    data: { panelColor: usar ? color : null },
  });
  if (r.count === 0) return { error: "Primero completá los datos de la institución." };

  // El tema vive en el marco del panel: todas las pantallas lo tienen que tomar.
  revalidatePath("/", "layout");
  return { ok: true };
}
