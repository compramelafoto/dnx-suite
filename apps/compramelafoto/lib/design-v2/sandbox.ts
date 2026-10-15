import "server-only";
import { prisma } from "@/lib/prisma";
import { DesignProjectError, type DesignActor } from "./projects";
import { loadDesignTemplateVersion, type DesignTemplateVersion } from "./template";

/**
 * Modo prueba: el fotógrafo arma una plantilla con fotos de sus álbumes para ver cómo queda.
 * No se guarda nada; solo hay que cuidar que use plantillas y fotos a las que tiene acceso.
 */

/** La plantilla, si el usuario puede probarla: es suya, es admin, o está publicada en el catálogo. */
export async function loadTemplateForSandbox(templateId: string, actor: DesignActor): Promise<DesignTemplateVersion> {
  const template = await loadDesignTemplateVersion({ templateId });
  if (!template) throw new DesignProjectError("No encontramos esa plantilla.", 404);
  if (actor.role === "ADMIN" || template.ownerUserId === actor.id) return template;
  const publication = await prisma.templateV2Publication.findUnique({
    where: { templateId },
    select: { visibility: true, reviewStatus: true },
  });
  if (publication?.visibility === "PUBLIC" && publication.reviewStatus === "APPROVED") return template;
  throw new DesignProjectError("No encontramos esa plantilla.", 404);
}

/** Verifica que todas las fotos sean de álbumes del usuario (o que sea admin). */
export async function assertPhotosUsable(photoIds: number[], actor: DesignActor): Promise<void> {
  if (photoIds.length === 0) return;
  if (photoIds.length > 50) throw new DesignProjectError("Elegí hasta 50 fotos para probar.", 422);
  const photos = await prisma.photo.findMany({
    where: { id: { in: photoIds }, isRemoved: false },
    select: { id: true, album: { select: { userId: true } } },
  });
  if (photos.length !== new Set(photoIds).size) {
    throw new DesignProjectError("Alguna de las fotos ya no está disponible.", 422);
  }
  if (actor.role !== "ADMIN" && photos.some((p) => p.album.userId !== actor.id)) {
    throw new DesignProjectError("Solo podés probar con fotos de tus álbumes.", 403);
  }
}
