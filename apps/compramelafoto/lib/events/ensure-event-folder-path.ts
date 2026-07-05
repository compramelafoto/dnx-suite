import { EventFolderScope } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  childrenByParentMap,
  depthFromRoot,
  foldersByEventId,
  MAX_EVENT_FOLDER_DEPTH_LEVELS,
  type FolderNode,
} from "@/lib/events/event-folder-domain";
import { normalizeEventFolderName } from "@/lib/events/event-folder-validation";
import { PhotoEventFolderValidationError } from "@/lib/events/resolve-photo-event-folder";

function validateEventRelativePathSegments(
  segments: string[]
): { ok: true; segments: string[] } | { ok: false; error: string } {
  const normalized: string[] = [];
  for (const seg of segments) {
    const nameRes = normalizeEventFolderName(seg);
    if (!nameRes.ok) {
      return { ok: false, error: nameRes.error };
    }
    normalized.push(nameRes.value);
  }
  if (normalized.length > MAX_EVENT_FOLDER_DEPTH_LEVELS) {
    return {
      ok: false,
      error: `La ruta supera el máximo de ${MAX_EVENT_FOLDER_DEPTH_LEVELS} niveles de carpeta del evento.`,
    };
  }
  return { ok: true, segments: normalized };
}

async function uniqueOrganizerNameInEvent(eventId: number, name: string): Promise<boolean> {
  const dupe = await prisma.eventFolder.findFirst({
    where: { eventId, name },
  });
  return !dupe;
}

/**
 * Resuelve o crea carpetas oficiales (`ORGANIZER`) para una ruta de subida en evento colaborativo.
 */
export async function ensureEventOrganizerFolderPath(opts: {
  eventId: number;
  createdByUserId: number;
  segments: string[];
  allowCreate: boolean;
}): Promise<number | null> {
  if (opts.segments.length === 0) return null;

  const validated = validateEventRelativePathSegments(opts.segments);
  if (!validated.ok) {
    throw new PhotoEventFolderValidationError(validated.error);
  }

  let parentId: number | null = null;

  for (const segment of validated.segments) {
    const currentParentId: number | null = parentId;
    const existing: { id: number } | null = await prisma.eventFolder.findFirst({
      where: {
        eventId: opts.eventId,
        parentId: currentParentId,
        name: segment,
        folderScope: EventFolderScope.ORGANIZER,
        isActive: true,
      },
      select: { id: true },
    });

    if (existing) {
      parentId = existing.id;
      continue;
    }

    if (!opts.allowCreate) {
      throw new PhotoEventFolderValidationError(
        `La carpeta oficial "${segment}" no existe. Pedí al organizador que cree la estructura antes de subir la carpeta completa.`
      );
    }

    const rows = (await prisma.eventFolder.findMany({
      where: { eventId: opts.eventId },
      select: {
        id: true,
        eventId: true,
        parentId: true,
        folderScope: true,
        ownerPhotographerId: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
        listedInPublicGallery: true,
      },
    })) as FolderNode[];

    const byId = foldersByEventId(rows);
    if (parentId != null) {
      const parent = byId.get(parentId);
      if (!parent || parent.folderScope !== EventFolderScope.ORGANIZER) {
        throw new PhotoEventFolderValidationError(
          "La carpeta padre no es una carpeta oficial del organizador."
        );
      }
      const d = depthFromRoot(parentId, byId);
      if (d + 1 > MAX_EVENT_FOLDER_DEPTH_LEVELS) {
        throw new PhotoEventFolderValidationError(
          `Máximo ${MAX_EVENT_FOLDER_DEPTH_LEVELS} niveles de carpeta en el evento.`
        );
      }
    }

    if (!(await uniqueOrganizerNameInEvent(opts.eventId, segment))) {
      throw new PhotoEventFolderValidationError(
        `Ya existe una carpeta llamada "${segment}" en este evento con otra ubicación.`
      );
    }

    const map = childrenByParentMap(
      rows.filter((r) => r.folderScope === EventFolderScope.ORGANIZER)
    );
    const siblingList = map.get(parentId) ?? [];
    const sortOrder =
      siblingList.length === 0
        ? 0
        : Math.max(...siblingList.map((s) => s.sortOrder), -1) + 1;

    const created: { id: number } = await prisma.eventFolder.create({
      data: {
        eventId: opts.eventId,
        parentId,
        folderScope: EventFolderScope.ORGANIZER,
        createdByUserId: opts.createdByUserId,
        listedInPublicGallery: true,
        name: segment,
        slug: null,
        description: null,
        sortOrder,
        isActive: true,
      },
      select: { id: true },
    });
    parentId = created.id;
  }

  return parentId;
}
