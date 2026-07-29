import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  albumChildrenByParentMap,
  validateAlbumFolderCreate,
  type AlbumFolderNode,
} from "@/lib/albums/album-folder-domain";
import { computePathForNewAlbumFolder } from "@/lib/albums/album-folder-path";
import {
  assertAlbumFolderFeature,
  canManageAlbumFolders,
  canViewAlbumFolders,
} from "@/lib/albums/album-folder-permissions";
import {
  normalizeAlbumFolderName,
  parseSortOrder,
} from "@/lib/albums/album-folder-validation";

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

async function loadAlbumForFolders(albumId: number) {
  return prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, userId: true, eventId: true, deletedAt: true },
  });
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
 * GET /api/dashboard/albums/[id]/folders
 * POST /api/dashboard/albums/[id]/folders
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await loadAlbumForFolders(albumId);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const feature = assertAlbumFolderFeature(album);
    if (!feature.ok) {
      return NextResponse.json({ error: feature.error }, { status: feature.status });
    }

    if (!canViewAlbumFolders(album, user.id)) {
      return NextResponse.json({ error: "No tenés acceso a este álbum." }, { status: 403 });
    }

    const folders = await prisma.albumFolder.findMany({
      where: { albumId },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: folderSelect,
    });

    return NextResponse.json({ folders, canManage: canManageAlbumFolders(album, user.id) });
  } catch (err: unknown) {
    console.error("GET /api/dashboard/albums/[id]/folders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando carpetas", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await loadAlbumForFolders(albumId);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const feature = assertAlbumFolderFeature(album);
    if (!feature.ok) {
      return NextResponse.json({ error: feature.error }, { status: feature.status });
    }

    if (!canManageAlbumFolders(album, user.id)) {
      return NextResponse.json(
        { error: "Solo el dueño del álbum puede crear carpetas." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    let parentId: number | null = null;
    if (body.parentId !== undefined && body.parentId !== null && body.parentId !== "") {
      const p = parseInt(String(body.parentId), 10);
      if (!Number.isFinite(p) || p <= 0) {
        return NextResponse.json({ error: "parentId inválido." }, { status: 400 });
      }
      parentId = p;
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

    const vc = validateAlbumFolderCreate({ parentId, rows });
    if (!vc.ok) return NextResponse.json({ error: vc.error }, { status: 400 });

    const nameRes = normalizeAlbumFolderName(body.name);
    if (!nameRes.ok) {
      return NextResponse.json({ error: nameRes.error }, { status: 400 });
    }

    if (!(await uniqueNameInParent(albumId, parentId, nameRes.value))) {
      return NextResponse.json(
        { error: `Ya existe una carpeta llamada "${nameRes.value}" en este nivel.` },
        { status: 409 }
      );
    }

    const childrenMap = albumChildrenByParentMap(rows);
    const siblingList = childrenMap.get(parentId) ?? [];

    let sortOrder = parseSortOrder(body.sortOrder);
    if (sortOrder === 0 && body.sortOrder === undefined) {
      const maxSibling = siblingList.reduce((mx, x) => Math.max(mx, x.sortOrder), -1);
      sortOrder = maxSibling + 1;
    }

    const path = await computePathForNewAlbumFolder(prisma, parentId, nameRes.value);

    try {
      const folder = await prisma.albumFolder.create({
        data: {
          albumId,
          parentId,
          name: nameRes.value,
          path,
          sortOrder,
          createdById: user.id,
        },
        select: folderSelect,
      });
      return NextResponse.json(folder, { status: 201 });
    } catch (createErr: unknown) {
      const code = String((createErr as { code?: string })?.code ?? "");
      if (code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe una carpeta con ese nombre en este nivel." },
          { status: 409 }
        );
      }
      throw createErr;
    }
  } catch (err: unknown) {
    console.error("POST /api/dashboard/albums/[id]/folders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando carpeta", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
