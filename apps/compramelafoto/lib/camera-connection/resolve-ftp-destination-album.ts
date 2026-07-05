/**
 * Resuelve el álbum destino de una subida FTP según el modo de asignación.
 */

import { CameraConnectionAssignmentMode } from "@/lib/prisma";
import {
  artEndOfDayUtc,
  artStartOfDayUtc,
  buildAlbumEventScheduleFromDb,
} from "@/lib/albums/album-event-datetime";
import { prisma } from "@/lib/prisma";
import { validateActiveAlbumForCameraConnection } from "@/lib/camera-connection/camera-connection-service";

export const FTP_DESTINATION_REASON = {
  UNASSIGNED: "UNASSIGNED",
  AMBIGUOUS_ALBUM_TIME_MATCH: "AMBIGUOUS_ALBUM_TIME_MATCH",
} as const;

export type FtpDestinationFailureReason =
  (typeof FTP_DESTINATION_REASON)[keyof typeof FTP_DESTINATION_REASON];

export type ResolveFtpDestinationAlbumInput = {
  userId: number;
  receivedAt: Date;
  assignmentMode: CameraConnectionAssignmentMode;
  activeAlbumId: number | null;
};

export type ResolveFtpDestinationAlbumResult =
  | { ok: true; albumId: number }
  | { ok: false; reason: FtpDestinationFailureReason; message: string };

export type AlbumScheduleRow = {
  id: number;
  startsAt: Date | null;
  endsAt: Date | null;
  eventDate: Date | null;
};

/**
 * Ventana efectiva para matching FTP (no persiste horarios virtuales).
 * - startsAt + endsAt → usarlos
 * - solo eventDate → día completo ART 00:00–23:59:59
 */
export function getAlbumFtpEffectiveWindow(album: AlbumScheduleRow): {
  start: Date;
  end: Date;
} | null {
  if (album.startsAt != null && album.endsAt != null) {
    return { start: album.startsAt, end: album.endsAt };
  }

  if (album.eventDate != null) {
    const form = buildAlbumEventScheduleFromDb({
      eventDate: album.eventDate,
      startsAt: null,
      endsAt: null,
    });
    if (!form.eventDate) return null;
    return {
      start: artStartOfDayUtc(form.eventDate),
      end: artEndOfDayUtc(form.eventDate),
    };
  }

  return null;
}

export function albumMatchesReceivedAt(
  album: AlbumScheduleRow,
  receivedAt: Date
): boolean {
  const window = getAlbumFtpEffectiveWindow(album);
  if (!window) return false;
  const t = receivedAt.getTime();
  return t >= window.start.getTime() && t <= window.end.getTime();
}

export function resolveAlbumIdFromTimeMatches(
  matches: AlbumScheduleRow[]
): ResolveFtpDestinationAlbumResult {
  if (matches.length === 0) {
    return {
      ok: false,
      reason: FTP_DESTINATION_REASON.UNASSIGNED,
      message: "Ningún álbum coincide con la fecha y hora de la fotografía.",
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: FTP_DESTINATION_REASON.AMBIGUOUS_ALBUM_TIME_MATCH,
      message:
        "Varios álbumes coinciden con la misma franja horaria. Ajustá los horarios en tus álbumes.",
    };
  }
  return { ok: true, albumId: matches[0]!.id };
}

export async function resolveFtpDestinationAlbum(
  input: ResolveFtpDestinationAlbumInput
): Promise<ResolveFtpDestinationAlbumResult> {
  const { userId, receivedAt, assignmentMode, activeAlbumId } = input;

  if (assignmentMode === CameraConnectionAssignmentMode.MANUAL) {
    if (activeAlbumId == null) {
      return {
        ok: false,
        reason: FTP_DESTINATION_REASON.UNASSIGNED,
        message: "No hay álbum activo configurado.",
      };
    }
    const check = await validateActiveAlbumForCameraConnection(userId, activeAlbumId);
    if (!check.ok) {
      return {
        ok: false,
        reason: FTP_DESTINATION_REASON.UNASSIGNED,
        message: check.error,
      };
    }
    return { ok: true, albumId: activeAlbumId };
  }

  const candidates = await prisma.album.findMany({
    where: {
      deletedAt: null,
      OR: [{ userId }, { isPublic: true, isHidden: false }],
      AND: [
        {
          OR: [
            { AND: [{ startsAt: { not: null } }, { endsAt: { not: null } }] },
            { eventDate: { not: null } },
          ],
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      isPublic: true,
      isHidden: true,
      startsAt: true,
      endsAt: true,
      eventDate: true,
    },
  });

  const matches: AlbumScheduleRow[] = [];
  for (const album of candidates) {
    if (album.userId !== userId && (!album.isPublic || album.isHidden)) {
      continue;
    }
    if (albumMatchesReceivedAt(album, receivedAt)) {
      matches.push(album);
    }
  }

  return resolveAlbumIdFromTimeMatches(matches);
}
