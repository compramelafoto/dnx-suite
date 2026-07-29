import { NextRequest, NextResponse } from "next/server";
import { EventFolderScope, EventMemberStatus } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

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

async function assertPhotographerMember(eventId: number, userId: number) {
  const m = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { status: true },
  });
  return m?.status === EventMemberStatus.ACTIVE;
}

/**
 * GET /api/fotografo/events/[id]/folders
 * Carpetas oficiales del organizador (solo lectura para colaboradores).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const okMember = await assertPhotographerMember(eventId, user.id);
    if (!okMember) {
      return NextResponse.json({ error: "No participás activamente en este evento." }, { status: 403 });
    }

    const folders = await prisma.eventFolder.findMany({
      where: {
        eventId,
        isActive: true,
        folderScope: EventFolderScope.ORGANIZER,
      },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: folderSelectArgs,
    });

    return NextResponse.json({ folders });
  } catch (err: unknown) {
    console.error("GET /api/fotografo/events/[id]/folders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando carpetas", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fotografo/events/[id]/folders — bloqueado: solo el organizador crea carpetas.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void params;
  return NextResponse.json(
    {
      error:
        "Los fotógrafos colaboradores no pueden crear carpetas. Usá las carpetas oficiales definidas por el organizador.",
    },
    { status: 403 }
  );
}
