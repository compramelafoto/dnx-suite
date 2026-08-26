"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";

export type SetOperatorResult = { ok: true } | { ok: false; error: string };

/**
 * El dueño decide quién opera los carnets.
 *
 * Solo el dueño o un administrador puede otorgar permisos: si el impresor pudiera darse
 * permisos a sí mismo, el permiso no significaría nada.
 */
export async function setCardOperatorAction(formData: FormData): Promise<SetOperatorResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };

  const puede = await canManageWorkspaceCollection(user.id, workspace.id);
  if (!puede) {
    return { ok: false, error: "Solo el dueño o un administrador puede cambiar estos permisos." };
  }

  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: "El pedido no es válido." };
  }

  const canProduce = formData.get("canProduce") === "1";
  const canDeliver = formData.get("canDeliver") === "1";

  // Se exige que la persona ya pertenezca al workspace: un permiso para alguien que no
  // puede entrar quedaría escrito y sin efecto.
  const [unificada, legado] = await Promise.all([
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      select: { userId: true },
    }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: workspace.id } },
      select: { userId: true },
    }),
  ]);
  if (!unificada && !legado) {
    return { ok: false, error: "Esa persona no pertenece a la institución." };
  }

  if (!canProduce && !canDeliver) {
    // Sin ninguna capacidad, se borra el registro en vez de dejar una fila en falso: una
    // lista de permisos llena de gente sin permisos no se lee.
    await prisma.memberCardOperator.deleteMany({
      where: { workspaceId: workspace.id, userId },
    });
  } else {
    await prisma.memberCardOperator.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
      create: {
        workspaceId: workspace.id,
        userId,
        canProduce,
        canDeliver,
        grantedByUserId: user.id,
      },
      update: { canProduce, canDeliver, grantedByUserId: user.id },
    });
  }

  revalidatePath("/members/carnets/permisos");
  revalidatePath("/members/carnets");
  return { ok: true };
}
