import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDesignTemplatePayload } from "@/lib/design-v2/client-payload";
import type { DesignV2Edit } from "@/lib/design-v2/design-data";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import {
  designPhotoDisplayUrl,
  loadDesignProjectForActor,
  loadTemplateForDesign,
  saveDesignEdits,
} from "@/lib/design-v2/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/fotografo/disenos/[id] — todo lo que necesita la pantalla de revisión. */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });

  try {
    const { project, data } = await loadDesignProjectForActor(id, actor);
    const template = await loadTemplateForDesign(data);

    const [photos, album, order, item] = await Promise.all([
      prisma.photo.findMany({
        where: { id: { in: data.photoIds } },
        select: { id: true, previewUrl: true, originalKey: true },
      }),
      project.albumId
        ? prisma.album.findUnique({ where: { id: project.albumId }, select: { id: true, title: true } })
        : null,
      project.albumOrderId
        ? prisma.order.findUnique({
            where: { id: project.albumOrderId },
            select: { id: true, buyerName: true, buyerEmail: true },
          })
        : null,
      project.orderItemId
        ? prisma.preCompraOrderItem.findUnique({
            where: { id: project.orderItemId },
            select: {
              id: true,
              order: { select: { buyerName: true, buyerEmail: true, studentFirstName: true, studentLastName: true } },
            },
          })
        : null,
    ]);
    const photoById = new Map(photos.map((p) => [p.id, p]));

    return NextResponse.json({
      ok: true,
      design: {
        id: project.id,
        status: project.status,
        reviewNote: project.reviewNote,
        approvedAt: project.approvedAt?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
        album: album ? { id: album.id, title: album.title } : null,
        orderId: order?.id ?? null,
        buyer: {
          name: order?.buyerName ?? item?.order.buyerName ?? null,
          email: order?.buyerEmail ?? item?.order.buyerEmail ?? null,
          student:
            [item?.order.studentFirstName, item?.order.studentLastName].filter(Boolean).join(" ").trim() || null,
        },
      },
      data,
      template: toDesignTemplatePayload(template),
      photos: data.photoIds.map((pid) => {
        const p = photoById.get(pid);
        return { id: pid, url: p ? designPhotoDisplayUrl(p) : null };
      }),
    });
  } catch (err) {
    return designErrorResponse(err, "leer diseño");
  }
}

const EDIT_KINDS = new Set(["set-photo", "swap", "set-crop", "set-value", "reset"]);

/** PATCH /api/fotografo/disenos/[id] — guarda correcciones. Body: `{ edits: DesignV2Edit[] }`. */
export async function PATCH(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { edits?: unknown };
  const edits = Array.isArray(body.edits) ? body.edits : [];
  if (edits.length === 0 || edits.length > 50) {
    return NextResponse.json({ ok: false, error: "No hay cambios para guardar." }, { status: 400 });
  }
  for (const e of edits) {
    const kind = (e as { kind?: unknown })?.kind;
    if (typeof kind !== "string" || !EDIT_KINDS.has(kind)) {
      return NextResponse.json({ ok: false, error: "Cambio inválido." }, { status: 400 });
    }
  }

  try {
    // `reset` no necesita los huecos del navegador: se recalculan con la plantilla del diseño.
    const normalized = edits.map((e) =>
      (e as { kind: string }).kind === "reset" ? ({ kind: "reset", slots: [] } as DesignV2Edit) : (e as DesignV2Edit),
    );
    const data = await saveDesignEdits(id, actor, normalized);
    const project = await prisma.designProject.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json({ ok: true, data, status: project?.status ?? null });
  } catch (err) {
    return designErrorResponse(err, "guardar diseño");
  }
}
