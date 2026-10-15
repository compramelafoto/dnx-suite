import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  duplicateTemplateV2InsideTransaction,
  loadTemplateV2DuplicateGraph,
} from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DESIGNER_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * POST /api/admin/template-v2/templates/[templateId]/transfer
 * Body: `{ targetUserId: number, mode: "move" | "copy" }`
 *
 * - `move` cambia el dueño: la plantilla deja de aparecerle a quien la tenía.
 * - `copy` le crea al destinatario una copia independiente y deja la original donde estaba.
 *
 * No se mueve una plantilla que ya usa algún pack de álbum: el pack quedaría apuntando a una
 * plantilla de otra persona y, al volver a guardarlo, el panel del fotógrafo lo rechazaría
 * (`resolveTemplateV2IdOwnedByAlbumPhotographer`). Para ese caso está la copia.
 */
export async function POST(req: Request, context: Ctx) {
  const { error, user: admin } = await requireAuth([Role.ADMIN]);
  if (error || !admin) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { templateId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { targetUserId?: unknown; mode?: unknown };
  const targetUserId = Number(body.targetUserId);
  const mode = body.mode === "copy" ? "copy" : body.mode === "move" ? "move" : null;

  if (!mode || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const [template, target] = await Promise.all([
    prisma.templateV2.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        _count: { select: { albumPacksDesign: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  if (!template) {
    return NextResponse.json({ ok: false, error: "La plantilla no existe" }, { status: 404 });
  }
  if (!target || !DESIGNER_ROLES.includes(target.role)) {
    return NextResponse.json(
      { ok: false, error: "El destinatario tiene que ser un fotógrafo con acceso al diseñador" },
      { status: 400 }
    );
  }

  if (mode === "move") {
    if (template.ownerUserId === target.id) {
      return NextResponse.json({ ok: false, error: "La plantilla ya es de ese fotógrafo" }, { status: 400 });
    }
    if (template._count.albumPacksDesign > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `La plantilla se usa en ${template._count.albumPacksDesign} pack(s) de álbum. Copiala en lugar de moverla.`,
        },
        { status: 409 }
      );
    }
    await prisma.templateV2.update({
      where: { id: template.id },
      data: { ownerUserId: target.id },
    });
    return NextResponse.json({ ok: true, mode, templateId: template.id });
  }

  const source = await loadTemplateV2DuplicateGraph(template.id);
  if (!source) {
    return NextResponse.json({ ok: false, error: "La plantilla no tiene una versión para copiar" }, { status: 404 });
  }
  const created = await prisma.$transaction(async (tx) =>
    duplicateTemplateV2InsideTransaction(tx, {
      source,
      newOwnerUserId: target.id,
      createdByUserId: admin.id,
      versionMetaStrategy: "copy",
      customCloneName: template.name,
    })
  );

  return NextResponse.json({ ok: true, mode, templateId: created.templateId, versionId: created.versionId });
}
