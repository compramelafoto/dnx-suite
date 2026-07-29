import { NextRequest, NextResponse } from "next/server";
import { EventFolderScope } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  normalizeEventFolderName,
  normalizeEventFolderSlug,
  normalizeOptionalDescription,
  parseSortOrder,
} from "@/lib/events/event-folder-validation";
import {
  childrenByParentMap,
  foldersByEventId,
  validateReparent,
  type FolderNode,
} from "@/lib/events/event-folder-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureFolderForOrganizer(
  organizerUserId: number,
  eventIdStr: string,
  folderIdStr: string
) {
  const eventId = parseInt(eventIdStr, 10);
  const folderId = parseInt(folderIdStr, 10);
  if (!Number.isFinite(eventId) || !Number.isFinite(folderId)) {
    return { ok: false as const, status: 400 as const, message: "ID inválido" };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, creatorId: true },
  });
  if (!event || event.creatorId !== organizerUserId) {
    return { ok: false as const, status: 404 as const, message: "Evento no encontrado" };
  }

  const folder = await prisma.eventFolder.findFirst({
    where: { id: folderId, eventId },
  });
  if (!folder) {
    return { ok: false as const, status: 404 as const, message: "Carpeta no encontrada" };
  }

  return {
    ok: true as const,
    eventId,
    folderId,
    folder,
  };
}

/**
 * PATCH /api/organizer/events/[id]/folders/[folderId]
 */
export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resolved = await Promise.resolve(params);
    const check = await ensureFolderForOrganizer(user.id, resolved.id, resolved.folderId);
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }

    if (check.folder.folderScope !== EventFolderScope.ORGANIZER) {
      return NextResponse.json(
        { error: "Las carpetas de fotógrafos no se editan desde el panel del organizador." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const data: {
      name?: string;
      slug?: string | null;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      parentId?: number | null;
      listedInPublicGallery?: boolean;
    } = {};

    if (body.parentId !== undefined) {
      if (body.parentId === null || body.parentId === "") {
        data.parentId = null;
      } else {
        const p = parseInt(String(body.parentId), 10);
        if (!Number.isFinite(p) || p <= 0) {
          return NextResponse.json({ error: "parentId inválido." }, { status: 400 });
        }
        if (p === check.folderId) {
          return NextResponse.json(
            { error: "La carpeta no puede ser su propio padre." },
            { status: 400 }
          );
        }
        data.parentId = p;
      }
    }

    if (body.name !== undefined) {
      const nameRes = normalizeEventFolderName(body.name);
      if (!nameRes.ok) {
        return NextResponse.json({ error: nameRes.error }, { status: 400 });
      }

      const duplicateName = await prisma.eventFolder.findFirst({
        where: {
          eventId: check.eventId,
          name: nameRes.value,
          id: { not: check.folderId },
        },
      });
      if (duplicateName) {
        return NextResponse.json(
          { error: `Ya existe una carpeta llamada "${nameRes.value}" en este evento.` },
          { status: 409 }
        );
      }
      data.name = nameRes.value;
    }

    if (body.slug !== undefined) {
      const slugRes = normalizeEventFolderSlug(body.slug);
      if (!slugRes.ok) {
        return NextResponse.json({ error: slugRes.error }, { status: 400 });
      }
      if (slugRes.value != null) {
        const dupSlug = await prisma.eventFolder.findFirst({
          where: {
            eventId: check.eventId,
            slug: slugRes.value,
            id: { not: check.folderId },
          },
        });
        if (dupSlug) {
          return NextResponse.json(
            { error: "Ya existe una carpeta con ese slug en este evento." },
            { status: 409 }
          );
        }
      }
      data.slug = slugRes.value;
    }

    if (body.description !== undefined) {
      const descRes = normalizeOptionalDescription(body.description);
      if (!descRes.ok) {
        return NextResponse.json({ error: descRes.error }, { status: 400 });
      }
      data.description = descRes.value;
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = parseSortOrder(body.sortOrder);
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive debe ser boolean." }, { status: 400 });
      }
      data.isActive = body.isActive;
    }

    if (body.listedInPublicGallery !== undefined) {
      if (typeof body.listedInPublicGallery !== "boolean") {
        return NextResponse.json(
          { error: "listedInPublicGallery debe ser boolean." },
          { status: 400 }
        );
      }
      data.listedInPublicGallery = body.listedInPublicGallery;
    }

    if (data.parentId !== undefined) {
      const rowList = (await prisma.eventFolder.findMany({
        where: { eventId: check.eventId },
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

      if (data.parentId != null) {
        const par = rowList.find((r) => r.id === data.parentId);
        if (!par) {
          return NextResponse.json({ error: "La carpeta padre no existe." }, { status: 400 });
        }
        if (par.folderScope !== EventFolderScope.ORGANIZER) {
          return NextResponse.json(
            { error: "Solo podés anidar bajo carpetas oficiales." },
            { status: 400 }
          );
        }
      }

      const byId = foldersByEventId(rowList);
      const childrenMap = childrenByParentMap(rowList);
      const vr = validateReparent({
        candidateId: check.folderId,
        newParentId: data.parentId,
        byId,
        childrenMap,
        enforceScope: EventFolderScope.ORGANIZER,
        allowParentScopes: [EventFolderScope.ORGANIZER],
      });
      if (!vr.ok) {
        return NextResponse.json({ error: vr.error }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Sin cambios (envía campos a actualizar)." },
        { status: 400 }
      );
    }

    try {
      const updated = await prisma.eventFolder.update({
        where: { id: check.folderId },
        data,
      });
      return NextResponse.json(updated);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "Slug duplicado u otro conflicto único para este evento." },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (err: unknown) {
    console.error("PATCH /api/organizer/events/[id]/folders/[folderId] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando carpeta", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizer/events/[id]/folders/[folderId]
 */
export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const resolved = await Promise.resolve(params);
    const check = await ensureFolderForOrganizer(user.id, resolved.id, resolved.folderId);
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status });
    }

    if (check.folder.folderScope !== EventFolderScope.ORGANIZER) {
      return NextResponse.json(
        { error: "No se pueden eliminar carpetas de fotógrafos desde acá." },
        { status: 403 }
      );
    }

    const childCount = await prisma.eventFolder.count({ where: { parentId: check.folderId } });
    if (childCount > 0) {
      return NextResponse.json(
        { error: "Tenés subcarpetas: borralas o movélas antes de eliminar esta." },
        { status: 409 }
      );
    }

    const photoCount = await prisma.photo.count({
      where: { eventFolderId: check.folderId, isRemoved: false },
    });
    if (photoCount > 0) {
      return NextResponse.json(
        {
          error: `Hay ${photoCount} foto(s) en esta carpeta. Desasigná las fotos desde los álbumes o desactivá la carpeta para ocultarla.`,
        },
        { status: 409 }
      );
    }

    await prisma.eventFolder.delete({ where: { id: check.folderId } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/organizer/events/[id]/folders/[folderId] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error borrando carpeta", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
