/**
 * POST /api/dashboard/albums/[id]/photos/bulk-set-folder
 * Asigna o quita carpeta en varias fotos del álbum (solo dueño del álbum).
 * Álbum simple: folderId. Álbum de evento: eventFolderId.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  PhotoEventFolderValidationError,
  resolvePhotoEventFolder,
} from "@/lib/events/resolve-photo-event-folder";
import {
  PhotoAlbumFolderValidationError,
  resolvePhotoAlbumFolder,
} from "@/lib/albums/resolve-photo-album-folder";
import { albumSupportsAlbumFolders } from "@/lib/albums/album-folder-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 500;

function parseOptionalPositiveIntOrNull(raw: unknown): number | null | "invalid" {
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "") return "invalid";
    const num = parseInt(t, 10);
    if (Number.isInteger(num) && num > 0 && String(num) === t) return num;
  }
  return "invalid";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true, deletedAt: true, eventId: true },
    });

    if (!album || album.deletedAt) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (album.userId !== user.id) {
      return NextResponse.json(
        { error: "Solo el dueño del álbum puede mover fotos entre carpetas." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
    }

    const rawIds = (body as { photoIds?: unknown }).photoIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "Enviá photoIds como array de números con al menos un id." },
        { status: 400 }
      );
    }

    if (rawIds.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: `Podés mover como máximo ${MAX_PHOTOS} fotos por solicitud.` },
        { status: 400 }
      );
    }

    const parsedIds: number[] = [];
    for (const item of rawIds) {
      let n: number | null = null;
      if (typeof item === "number" && Number.isInteger(item) && item > 0) {
        n = item;
      } else if (typeof item === "string") {
        const t = item.trim();
        const parsed = parseInt(t, 10);
        if (Number.isInteger(parsed) && parsed > 0 && String(parsed) === t) {
          n = parsed;
        }
      }
      if (n === null) {
        return NextResponse.json(
          { error: "Cada elemento de photoIds debe ser un entero positivo válido." },
          { status: 400 }
        );
      }
      parsedIds.push(n);
    }

    const photoIds = [...new Set(parsedIds)];
    const usesAlbumFolders = albumSupportsAlbumFolders(album.eventId);

    const rawEventFolder = (body as { eventFolderId?: unknown }).eventFolderId;
    const rawAlbumFolder = (body as { folderId?: unknown }).folderId;

    const hasEventField = Object.prototype.hasOwnProperty.call(body, "eventFolderId");
    const hasAlbumField = Object.prototype.hasOwnProperty.call(body, "folderId");

    if (!hasEventField && !hasAlbumField) {
      return NextResponse.json(
        {
          error: usesAlbumFolders
            ? "Enviá folderId (número de carpeta o null para quitar carpeta)."
            : "Enviá eventFolderId (número de carpeta o null para quitar carpeta).",
        },
        { status: 400 }
      );
    }

    if (hasEventField && hasAlbumField) {
      return NextResponse.json(
        { error: "Enviá solo eventFolderId o folderId, no ambos." },
        { status: 400 }
      );
    }

    let updateData: { eventFolderId?: number | null; folderId?: number | null } = {};

    if (usesAlbumFolders) {
      if (!hasAlbumField) {
        return NextResponse.json(
          { error: "Este álbum usa carpetas de álbum; enviá folderId." },
          { status: 400 }
        );
      }
      const parsed = parseOptionalPositiveIntOrNull(rawAlbumFolder);
      if (parsed === "invalid") {
        return NextResponse.json({ error: "folderId inválido." }, { status: 400 });
      }
      if (parsed !== null) {
        try {
          await resolvePhotoAlbumFolder({
            albumId,
            albumEventId: album.eventId,
            folderIdRaw: parsed,
          });
        } catch (e: unknown) {
          if (e instanceof PhotoAlbumFolderValidationError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
          }
          throw e;
        }
      }
      updateData = { folderId: parsed, eventFolderId: null };
    } else {
      if (!hasEventField) {
        return NextResponse.json(
          { error: "Este álbum usa carpetas de evento; enviá eventFolderId." },
          { status: 400 }
        );
      }
      const eventId = album.eventId;
      if (typeof eventId !== "number" || !Number.isFinite(eventId) || eventId <= 0) {
        return NextResponse.json(
          { error: "Este álbum no está vinculado a un evento." },
          { status: 400 }
        );
      }
      const parsed = parseOptionalPositiveIntOrNull(rawEventFolder);
      if (parsed === "invalid") {
        return NextResponse.json({ error: "eventFolderId inválido." }, { status: 400 });
      }
      if (parsed !== null) {
        try {
          await resolvePhotoEventFolder({
            albumEventId: eventId,
            eventFolderIdRaw: parsed,
            uploadedByUserId: user.id,
          });
        } catch (e: unknown) {
          if (e instanceof PhotoEventFolderValidationError) {
            return NextResponse.json({ error: e.message }, { status: 400 });
          }
          throw e;
        }
      }
      updateData = { eventFolderId: parsed, folderId: null };
    }

    const belonging = await prisma.photo.count({
      where: {
        albumId,
        id: { in: photoIds },
      },
    });

    if (belonging !== photoIds.length) {
      return NextResponse.json(
        {
          error:
            "Una o más fotos no pertenecen a este álbum o no existen. Refrescá la página y volvé a intentar.",
        },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await prisma.photo.updateMany({
        where: { albumId, id: { in: photoIds } },
        data: updateData,
      });
    } catch (dbErr: unknown) {
      const msg = String((dbErr as { message?: string })?.message ?? dbErr);
      if (
        msg.includes("eventFolderId") ||
        msg.includes("folderId") ||
        msg.includes("Unknown argument")
      ) {
        return NextResponse.json(
          { error: "El servidor no tiene aplicada la migración de carpetas en fotos." },
          { status: 503 }
        );
      }
      throw dbErr;
    }

    return NextResponse.json({
      updated: result.count,
      ...updateData,
    });
  } catch (err: unknown) {
    console.error("POST bulk-set-folder ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando carpetas", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
