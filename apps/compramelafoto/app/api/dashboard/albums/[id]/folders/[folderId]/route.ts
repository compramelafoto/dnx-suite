import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  albumChildrenByParentMap,
  albumFoldersById,
  validateAlbumFolderReparent,
  type AlbumFolderNode,
} from "@/lib/albums/album-folder-domain";
import {
  buildAlbumFolderPath,
  normalizeAlbumFolderName,
  parseSortOrder,
} from "@/lib/albums/album-folder-validation";
import { refreshAlbumFolderSubtreePaths } from "@/lib/albums/album-folder-path";
import {
  assertAlbumFolderFeature,
  canManageAlbumFolders,
} from "@/lib/albums/album-folder-permissions";
import { cascadeDeleteAlbumFolder } from "@/lib/albums/delete-album-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const folderSelect = {
  id: true,
  albumId: true,
  parentId: true,
  name: true,
  path: true,
  sortOrder: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      photos: { where: { isRemoved: false } },
      children: true,
    },
  },
} as const;

async function ensureFolderInAlbum(albumId: number, folderId: number, userId: number) {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, userId: true, eventId: true, deletedAt: true },
  });
  if (!album || album.deletedAt) {
    return { ok: false as const, status: 404 as const, message: "Álbum no encontrado" };
  }

  const feature = assertAlbumFolderFeature(album);
  if (!feature.ok) {
    return { ok: false as const, status: feature.status, message: feature.error };
  }

  if (!canManageAlbumFolders(album, userId)) {
    return { ok: false as const, status: 403 as const, message: "No autorizado para modificar carpetas." };
  }

  const folder = await prisma.albumFolder.findFirst({
    where: { id: folderId, albumId },
  });
  if (!folder) {
    return { ok: false as const, status: 404 as const, message: "Carpeta no encontrada" };
  }

  return { ok: true as const, album, folder };
}

async function uniqueNameInParent(
  albumId: number,
  parentId: number | null,
  name: string,
  excludeId?: number
): Promise<boolean> {
  const dupe = await prisma.albumFolder.findFirst({
    where: {
      albumId,
      parentId,
      name,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
  });
  return !dupe;
}

/**
 * PATCH /api/dashboard/albums/[id]/folders/[folderId]
 * DELETE /api/dashboard/albums/[id]/folders/[folderId]
 */
export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resolved = await Promise.resolve(params);
    const albumId = parseInt(resolved.id, 10);
    const folderId = parseInt(resolved.folderId, 10);
    if (!Number.isFinite(albumId) || !Number.isFinite(folderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const check = await ensureFolderInAlbum(albumId, folderId, user.id);
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }

    const body = await req.json().catch(() => ({}));
    const data: {
      name?: string;
      parentId?: number | null;
      sortOrder?: number;
    } = {};

    if (body.parentId !== undefined) {
      if (body.parentId === null || body.parentId === "") {
        data.parentId = null;
      } else {
        const p = parseInt(String(body.parentId), 10);
        if (!Number.isFinite(p) || p <= 0) {
          return NextResponse.json({ error: "parentId inválido." }, { status: 400 });
        }
        if (p === folderId) {
          return NextResponse.json(
            { error: "La carpeta no puede ser su propio padre." },
            { status: 400 }
          );
        }
        data.parentId = p;
      }
    }

    if (body.name !== undefined) {
      const nameRes = normalizeAlbumFolderName(body.name);
      if (!nameRes.ok) {
        return NextResponse.json({ error: nameRes.error }, { status: 400 });
      }
      data.name = nameRes.value;
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = parseSortOrder(body.sortOrder);
    }

    const rows = (await prisma.albumFolder.findMany({
      where: { albumId },
      select: {
        id: true,
        albumId: true,
        parentId: true,
        name: true,
        path: true,
        sortOrder: true,
      },
    })) as AlbumFolderNode[];

    const byId = albumFoldersById(rows);
    const childrenMap = albumChildrenByParentMap(rows);

    const nextParentId =
      data.parentId !== undefined ? data.parentId : (check.folder.parentId ?? null);
    const nextName = data.name ?? check.folder.name;

    if (data.parentId !== undefined) {
      const rep = validateAlbumFolderReparent({
        candidateId: folderId,
        newParentId: nextParentId,
        byId,
        childrenMap,
      });
      if (!rep.ok) return NextResponse.json({ error: rep.error }, { status: 400 });
    }

    if (!(await uniqueNameInParent(albumId, nextParentId, nextName, folderId))) {
      return NextResponse.json(
        { error: `Ya existe una carpeta llamada "${nextName}" en este nivel.` },
        { status: 409 }
      );
    }

    let newPath: string;
    if (nextParentId == null) {
      newPath = buildAlbumFolderPath(null, nextName);
    } else {
      const parent = byId.get(nextParentId);
      if (!parent) {
        return NextResponse.json({ error: "La carpeta padre no existe." }, { status: 400 });
      }
      newPath = buildAlbumFolderPath(parent.path, nextName);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.albumFolder.update({
        where: { id: folderId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          path: newPath,
        },
        select: folderSelect,
      });

      if (data.name !== undefined || data.parentId !== undefined) {
        await refreshAlbumFolderSubtreePaths(tx, folderId, newPath);
      }

      return row;
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error("PATCH /api/dashboard/albums/[id]/folders/[folderId] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando carpeta", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resolved = await Promise.resolve(params);
    const albumId = parseInt(resolved.id, 10);
    const folderId = parseInt(resolved.folderId, 10);
    if (!Number.isFinite(albumId) || !Number.isFinite(folderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const check = await ensureFolderInAlbum(albumId, folderId, user.id);
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }

    const cascade =
      req.nextUrl.searchParams.get("cascade") === "true" ||
      req.nextUrl.searchParams.get("cascade") === "1";

    if (cascade) {
      const result = await cascadeDeleteAlbumFolder({ albumId, folderId });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({
        ok: true,
        cascade: true,
        deletedPhotos: result.deletedPhotos,
        deletedFolders: result.deletedFolders,
      });
    }

    const childCount = await prisma.albumFolder.count({ where: { parentId: folderId } });
    if (childCount > 0) {
      return NextResponse.json(
        {
          error:
            "Esta carpeta tiene subcarpetas. Usá eliminación completa o movelas antes de borrarla.",
        },
        { status: 409 }
      );
    }

    const photoCount = await prisma.photo.count({
      where: { folderId, isRemoved: false },
    });
    if (photoCount > 0) {
      return NextResponse.json(
        {
          error: `Hay ${photoCount} foto(s) en esta carpeta. Usá eliminación completa o movelas las fotos antes de borrarla.`,
        },
        { status: 409 }
      );
    }

    await prisma.albumFolder.delete({ where: { id: folderId } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/dashboard/albums/[id]/folders/[folderId] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error borrando carpeta", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
