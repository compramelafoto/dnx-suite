import { NextRequest, NextResponse } from "next/server";
import { PreCompraOrderItemStatus, Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDesignProjectForOrderItem } from "@/lib/school-design/ensure-design-project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Persiste selección de fotos y pasa el ítem a READY_TO_DESIGN (panel fotógrafo / operador).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string; orderItemId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { albumId: aid, orderItemId: oi } = await params;
    const albumId = parseInt(aid, 10);
    const orderItemId = parseInt(oi, 10);
    const body = await req.json().catch(() => ({}));

    type PhotoEntry = { photoId: number; role?: string | null };
    let entries: PhotoEntry[] = [];
    if (Array.isArray(body.photos)) {
      for (const row of body.photos) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const photoId = Number(r.photoId);
        if (!Number.isInteger(photoId)) continue;
        const role = r.role != null && r.role !== "" ? String(r.role) : null;
        entries.push({ photoId, role });
      }
    } else if (Array.isArray(body.photoIds)) {
      entries = body.photoIds
        .map((x: unknown) => Number(x))
        .filter((n: number): n is number => Number.isInteger(n))
        .map((photoId: number) => ({ photoId, role: null as string | null }));
    }

    const photoIds = entries.map((e) => e.photoId);

    if (!Number.isInteger(albumId) || !Number.isInteger(orderItemId) || photoIds.length === 0) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const item = await prisma.preCompraOrderItem.findFirst({
      where: {
        id: orderItemId,
        order: { albumId, album: { userId: user.id } },
      },
      include: { albumProduct: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds }, albumId },
      select: { id: true },
    });
    if (photos.length !== photoIds.length) {
      return NextResponse.json({ error: "Alguna foto no pertenece al álbum" }, { status: 400 });
    }

    if (photoIds.length < item.albumProduct.minFotos || photoIds.length > item.albumProduct.maxFotos) {
      return NextResponse.json(
        { error: `Cantidad de fotos fuera de rango (${item.albumProduct.minFotos}–${item.albumProduct.maxFotos})` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const sel =
        (await tx.selection.findUnique({ where: { orderItemId: item.id } })) ??
        (await tx.selection.create({ data: { orderItemId: item.id } }));

      await tx.selectionPhoto.deleteMany({ where: { selectionId: sel.id } });
      await tx.selectionPhoto.createMany({
        data: entries.map((e, idx) => ({
          selectionId: sel.id,
          photoId: e.photoId,
          position: idx,
          role: e.role,
        })),
      });

      await tx.preCompraOrderItem.update({
        where: { id: item.id },
        data: { status: PreCompraOrderItemStatus.READY_TO_DESIGN },
      });
    });

    console.log("[school_redeem_design_gate] selection saved", { orderItemId, n: photoIds.length });
    console.log("[school_design_flow] selection_completed", {
      orderItemId: item.id,
      albumId,
      photoCount: photoIds.length,
    });

    let designProjectId: number | null = null;
    let designEnsure: {
      ok: boolean;
      created?: boolean;
      code?: string;
      message?: string;
    } = { ok: false };

    console.log("[school_design_flow] ensure_design_triggered", { orderItemId: item.id });
    try {
      const ensureRes = await ensureDesignProjectForOrderItem(item.id);
      if (ensureRes.ok) {
        designProjectId = ensureRes.designProjectId;
        designEnsure = { ok: true, created: ensureRes.created };
        if (ensureRes.created) {
          console.log("[school_design_flow] design_project_created", {
            orderItemId: item.id,
            designProjectId: ensureRes.designProjectId,
          });
        } else {
          console.log("[school_design_flow] design_project_already_exists", {
            orderItemId: item.id,
            designProjectId: ensureRes.designProjectId,
          });
        }
      } else {
        designEnsure = { ok: false, code: ensureRes.code, message: ensureRes.message };
        console.warn("[school_design_flow] design_not_created_validation_failed", {
          orderItemId: item.id,
          code: ensureRes.code,
          message: ensureRes.message,
        });
      }
    } catch (ensureErr) {
      const msg = ensureErr instanceof Error ? ensureErr.message : String(ensureErr);
      console.error("[school_design_flow] ensure_design_exception", {
        orderItemId: item.id,
        error: msg,
      });
      designEnsure = { ok: false, code: "ENSURE_EXCEPTION", message: msg };
    }

    return NextResponse.json({
      ok: true,
      designProjectId,
      designEnsure,
    });
  } catch (e) {
    console.error("[school_redeem_design_gate] selection POST", e);
    return NextResponse.json({ error: "Error al guardar selección" }, { status: 500 });
  }
}
