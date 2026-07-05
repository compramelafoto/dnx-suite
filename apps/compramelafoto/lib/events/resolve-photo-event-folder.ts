import { EventFolderScope } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { isEventOrganizerUser } from "@/lib/events/event-organizer-access";

/** Error controlado para respuestas 400 desde las rutas de subida */
export class PhotoEventFolderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoEventFolderValidationError";
  }
}

function parsePositiveIntOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = parseInt(trimmed, 10);
    if (Number.isInteger(n) && n > 0 && String(n) === trimmed) {
      return n;
    }
  }
  throw new PhotoEventFolderValidationError("eventFolderId no es válido.");
}

/**
 * Valida `eventFolderId` opcional frente al evento del álbum.
 *
 * @returns Carpeta válida; `null` si no se envió carpeta (u omisión).
 * @throws PhotoEventFolderValidationError si hay conflicto de datos del cliente (400).
 */
export async function resolvePhotoEventFolder(params: {
  albumEventId: number | null;
  /** Valor sin parsear desde JSON o FormData */
  eventFolderIdRaw: unknown;
  /** Si se provee, colaboradores solo pueden usar carpetas oficiales del organizador. */
  uploadedByUserId?: number;
}): Promise<{ id: number; eventId: number; isActive: boolean } | null> {
  const folderId = parsePositiveIntOrNull(params.eventFolderIdRaw);
  if (folderId === null) {
    return null;
  }

  const albumEvent =
    typeof params.albumEventId === "number" &&
    Number.isFinite(params.albumEventId) &&
    params.albumEventId > 0
      ? params.albumEventId
      : null;

  if (albumEvent == null) {
    throw new PhotoEventFolderValidationError(
      "Este álbum no está vinculado a un evento; no podés asignar carpeta de evento."
    );
  }

  const folder = await prisma.eventFolder.findUnique({
    where: { id: folderId },
    select: { id: true, eventId: true, isActive: true, folderScope: true },
  });

  if (!folder) {
    throw new PhotoEventFolderValidationError("La carpeta del evento no existe.");
  }

  if (folder.eventId !== albumEvent) {
    throw new PhotoEventFolderValidationError(
      "La carpeta no pertenece al mismo evento que este álbum."
    );
  }

  if (!folder.isActive) {
    throw new PhotoEventFolderValidationError(
      "La carpeta del evento no está activa; elegí otra carpeta o pedí que la reactive el organizador."
    );
  }

  if (params.uploadedByUserId != null) {
    const isOrganizer = await isEventOrganizerUser(params.uploadedByUserId, folder.eventId);
    if (!isOrganizer && folder.folderScope !== EventFolderScope.ORGANIZER) {
      throw new PhotoEventFolderValidationError(
        "Solo podés subir a carpetas oficiales del organizador."
      );
    }
  }

  return folder;
}
