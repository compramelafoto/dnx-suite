import { NextRequest, NextResponse } from "next/server";
import { EventFolderScope } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/events/[id]/folders/reorder
 * Reordena hermanos oficiales bajo el mismo parentId (raíz si null).
 *
 * Body: { parentId: number | null, orderedIds: number[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, creatorId: true },
    });
    if (!event || event.creatorId !== user.id) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    let parentKey: number | null = null;
    if (
      body.parentId !== undefined &&
      body.parentId !== null &&
      body.parentId !== ""
    ) {
      const p = parseInt(String(body.parentId), 10);
      if (!Number.isFinite(p) || p <= 0) {
        return NextResponse.json({ error: "parentId inválido." }, { status: 400 });
      }
      parentKey = p;
    }

    const rawList = body.orderedIds;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { error: "Enviá orderedIds como array no vacío de ids." },
        { status: 400 }
      );
    }

    const orderedIds: number[] = [];
    for (const item of rawList) {
      let n: number | undefined;
      if (typeof item === "number" && Number.isFinite(item) && item > 0) n = Math.floor(item);
      else if (typeof item === "string") {
        const t = item.trim();
        const x = parseInt(t, 10);
        if (Number.isFinite(x) && x > 0 && String(x) === t) n = x;
      }
      if (!n) {
        return NextResponse.json({ error: "Cada id en orderedIds debe ser un entero positivo." }, { status: 400 });
      }
      orderedIds.push(n);
    }

    if (new Set(orderedIds).size !== orderedIds.length) {
      return NextResponse.json({ error: "orderedIds no puede tener duplicados." }, { status: 400 });
    }

    const children = await prisma.eventFolder.findMany({
      where: {
        eventId,
        folderScope: EventFolderScope.ORGANIZER,
        parentId: parentKey,
      },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    const expected = new Set(children.map((c) => c.id));
    if (expected.size !== orderedIds.length) {
      return NextResponse.json(
        { error: "La lista debe incluir todas las carpetas hermanas bajo ese padre, en orden." },
        { status: 400 }
      );
    }
    for (const nid of orderedIds) {
      if (!expected.has(nid)) {
        return NextResponse.json(
          {
            error:
              "Un id no coincide con las carpetas oficiales bajo ese padre o pertenece a otro nivel.",
          },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(
      orderedIds.map((fid, idx) =>
        prisma.eventFolder.update({
          where: { id: fid },
          data: { sortOrder: idx },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("POST /api/organizer/events/[id]/folders/reorder ERROR >>>", err);
    return NextResponse.json(
      { error: "Error reordenando", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
