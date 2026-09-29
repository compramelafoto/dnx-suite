import { prisma } from "@repo/db";
import { recordAdminEvent } from "@repo/db/fotoffice-team";
import { tipoPorId } from "@/lib/landing/tipos";

export async function getOrganizationType(workspaceId: string): Promise<string | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { organizationType: true },
  });
  return branding?.organizationType ?? null;
}

export async function setOrganizationType(workspaceId: string, tipoId: string, actorUserId: number): Promise<void> {
  if (!tipoPorId(tipoId)) throw new Error("Tipo de organización desconocido.");
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { organizationType: true },
  });
  if (!branding) throw new Error("Completá primero los datos de la institución.");
  await prisma.fotofficeWorkspaceBranding.update({ where: { workspaceId }, data: { organizationType: tipoId } });
  await recordAdminEvent({
    workspaceId,
    actorUserId,
    kind: "ORG_TYPE_SET",
    detail: tipoId,
  });
}
