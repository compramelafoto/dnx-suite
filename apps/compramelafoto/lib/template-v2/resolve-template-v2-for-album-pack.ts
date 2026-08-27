import { prisma } from "@/lib/prisma";
import { duplicateTemplateV2InsideTransaction } from "@/lib/template-v2/server";
import { loadTemplateV2DuplicateGraph } from "@/lib/template-v2/server";

/**
 * Para packs/album del fotógrafo: enlaza SIEMPRE un `templateV2Id` perteneciente al dueño del álbum.
 * Si elige una plantilla pública APPROVED, devuelve (y persiste si hace falta) una copia nueva de ese usuario.
 */
export async function resolveTemplateV2IdOwnedByAlbumPhotographer(opts: {
  templateV2Id: string | null | undefined;
  albumOwnerUserId: number;
}): Promise<string | null> {
  const raw = opts.templateV2Id;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return null;

  const row = await prisma.templateV2.findFirst({
    where: { id: trimmed },
    select: { id: true, name: true, description: true, ownerUserId: true },
  });
  if (!row) {
    throw new Error("template_v2_not_found");
  }

  if (row.ownerUserId === opts.albumOwnerUserId) {
    return trimmed;
  }

  const pub = await prisma.templateV2Publication.findUnique({
    where: { templateId: trimmed },
    select: { reviewStatus: true, visibility: true },
  });

  const isPublicCatalogApproved =
    pub?.reviewStatus === "APPROVED" && pub?.visibility === "PUBLIC";
  if (!isPublicCatalogApproved) {
    throw new Error("template_v2_fork_forbidden");
  }

  const source = await loadTemplateV2DuplicateGraph(trimmed);
  if (!source) throw new Error("template_v2_not_found");

  const created = await prisma.$transaction(async (tx) =>
    duplicateTemplateV2InsideTransaction(tx, {
      source,
      newOwnerUserId: opts.albumOwnerUserId,
      createdByUserId: opts.albumOwnerUserId,
      versionMetaStrategy: "fork_from_public_catalog",
      catalogTemplateIdForMeta: trimmed,
    })
  );

  return created.templateId;
}
