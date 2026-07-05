import { prisma } from "@/lib/prisma";

export type TemplateV2PickerRow = { id: string; name: string };

/**
 * Plantillas V2 que el fotógrafo puede asignar a un pack: propias + públicas aprobadas.
 */
export async function listTemplateV2ForAlbumPackPicker(userId: number): Promise<TemplateV2PickerRow[]> {
  const publicRows = await prisma.templateV2Publication.findMany({
    where: { reviewStatus: "APPROVED", visibility: "PUBLIC" },
    select: { templateId: true },
  });
  const publicIds = publicRows.map((r) => r.templateId);

  return prisma.templateV2.findMany({
    where: {
      OR: [{ ownerUserId: userId }, { id: { in: publicIds } }],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function isTemplateV2AssignableToUserPack(params: {
  templateV2Id: string;
  userId: number;
}): Promise<boolean> {
  const publicRows = await prisma.templateV2Publication.findMany({
    where: { reviewStatus: "APPROVED", visibility: "PUBLIC" },
    select: { templateId: true },
  });
  const publicIds = new Set(publicRows.map((r) => r.templateId));

  const row = await prisma.templateV2.findFirst({
    where: {
      id: params.templateV2Id,
      OR: [{ ownerUserId: params.userId }, { id: { in: [...publicIds] } }],
    },
    select: { id: true },
  });
  return Boolean(row);
}
