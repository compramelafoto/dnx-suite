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
  depthFromRoot,
  foldersByEventId,
  type FolderNode,
  MAX_EVENT_FOLDER_DEPTH_LEVELS,
} from "@/lib/events/event-folder-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const folderSelectArgs = {
  id: true,
  eventId: true,
  parentId: true,
  folderScope: true,
  createdByUserId: true,
  ownerPhotographerId: true,
  listedInPublicGallery: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      photos: { where: { isRemoved: false } },
      children: true,
    },
  },
} as const;

async function ensureOrganizerOwnsEvent(userId: number, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, creatorId: true },
  });
  if (!event || event.creatorId !== userId) {
    return { ok: false as const };
  }
  return { ok: true as const, event };
}

async function uniqueNameInEvent(eventId: number, name: string, excludeId?: number) {
  const dupe = await prisma.eventFolder.findFirst({
    where: {
      eventId,
      name,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
  });
  return !dupe;
}

function validateCreateOrganizer(opts: {
  parentId: number | null;
  rows: FolderNode[];
}): { ok: true } | { ok: false; error: string } {
  const byId = foldersByEventId(opts.rows);
  if (opts.parentId != null) {
    const parent = byId.get(opts.parentId);
    if (!parent) return { ok: false, error: "La carpeta padre no existe en este evento." };
    if (parent.folderScope !== EventFolderScope.ORGANIZER) {
      return { ok: false, error: "Solo las carpetas oficiales pueden ser padres de nuevas carpetas oficiales." };
    }
    const d = depthFromRoot(opts.parentId, byId);
    if (d + 1 > MAX_EVENT_FOLDER_DEPTH_LEVELS) {
      return { ok: false, error: `Máximo ${MAX_EVENT_FOLDER_DEPTH_LEVELS} niveles de carpeta.` };
    }
  }
  return { ok: true };
}

/**
 * GET /api/organizer/events/[id]/folders
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const owner = await ensureOrganizerOwnsEvent(user.id, eventId);
    if (!owner.ok) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const folders = await prisma.eventFolder.findMany({
      where: { eventId },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: folderSelectArgs,
    });

    return NextResponse.json({ folders });
  } catch (err: unknown) {
    console.error("GET /api/organizer/events/[id]/folders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando carpetas", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/events/[id]/folders
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const owner = await ensureOrganizerOwnsEvent(user.id, eventId);
    if (!owner.ok) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
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

    const rows = (
      await prisma.eventFolder.findMany({
        where: { eventId },
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
      })
    ) as FolderNode[];

    const vc = validateCreateOrganizer({ parentId, rows });
    if (!vc.ok) return NextResponse.json({ error: vc.error }, { status: 400 });

    const nameRes = normalizeEventFolderName(body.name);
    if (!nameRes.ok) {
      return NextResponse.json({ error: nameRes.error }, { status: 400 });
    }

    const slugRes = normalizeEventFolderSlug(body.slug);
    if (!slugRes.ok) {
      return NextResponse.json({ error: slugRes.error }, { status: 400 });
    }

    const descRes = normalizeOptionalDescription(body.description);
    if (!descRes.ok) {
      return NextResponse.json({ error: descRes.error }, { status: 400 });
    }

    if (!(await uniqueNameInEvent(eventId, nameRes.value))) {
      return NextResponse.json(
        { error: `Ya existe una carpeta llamada "${nameRes.value}" en este evento.` },
        { status: 409 }
      );
    }

    if (slugRes.value != null) {
      const dupSlug = await prisma.eventFolder.findFirst({
        where: { eventId, slug: slugRes.value },
      });
      if (dupSlug) {
        return NextResponse.json(
          { error: "Ya existe una carpeta con ese slug en este evento." },
          { status: 409 }
        );
      }
    }

    const map = childrenByParentMap(rows);
    const siblingList = map.get(parentId) ?? [];

    let sortOrder = parseSortOrder(body.sortOrder);
    if (sortOrder === 0 && body.sortOrder === undefined) {
      const maxSibling = siblingList.reduce((mx, x) => Math.max(mx, x.sortOrder), -1);
      sortOrder = maxSibling + 1;
    }

    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    try {
      const folder = await prisma.eventFolder.create({
        data: {
          eventId,
          parentId,
          folderScope: EventFolderScope.ORGANIZER,
          createdByUserId: user.id,
          listedInPublicGallery: true,
          name: nameRes.value,
          slug: slugRes.value,
          description: descRes.value,
          sortOrder,
          isActive,
        },
      });
      return NextResponse.json(folder, { status: 201 });
    } catch (createErr: unknown) {
      const msg = String((createErr as { code?: string })?.code ?? "");
      if (msg === "P2002") {
        return NextResponse.json(
          { error: "Slug duplicado u otro conflicto único para este evento." },
          { status: 409 }
        );
      }
      throw createErr;
    }
  } catch (err: unknown) {
    console.error("POST /api/organizer/events/[id]/folders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando carpeta", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
