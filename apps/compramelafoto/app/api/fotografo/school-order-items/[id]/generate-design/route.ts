import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { ensureSchoolDesignForPreCompraOrderItem } from "@/lib/school-render/ensure-school-design-for-preventa-order-item";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

function toFriendlyGenerateDesignMessage(reason: string): string {
  if (reason === "not_school_album") {
    return "Este pedido no pertenece a un álbum escolar.";
  }
  if (reason === "order_not_paid") {
    return "El pedido todavía no está pago.";
  }
  if (reason === "no_pack_snapshot") {
    return "No encontramos los datos del pack asociados a este pedido. Si sigue pasando, contactá a soporte.";
  }
  if (reason === "pack_definition_mismatch") {
    return "Este ítem no coincide con el pack de la compra. No se puede generar el diseño automáticamente.";
  }
  if (reason === "no_selection_photos") {
    return "Faltan las fotos seleccionadas para poder generar el diseño.";
  }
  if (reason.startsWith("invalid_snapshot:")) {
    return "Los datos guardados del pack no son válidos o están incompletos. No pudimos preparar el diseño.";
  }
  if (reason.startsWith("template_ambiguous:")) {
    return "La plantilla de diseño está definida de forma ambigua para este pack. Revisá la configuración del pack.";
  }
  if (reason.startsWith("template_missing:")) {
    const sub = reason.slice("template_missing:".length);
    if (sub === "album_product_template_missing") {
      return "El producto indica que requiere diseño pero no tiene plantilla asignada.";
    }
    if (sub === "required_template_missing") {
      return "Falta definir la plantilla obligatoria en la configuración del pack.";
    }
    if (sub === "no_design_required" || sub === "none") {
      return "Según la configuración actual, este ítem no requiere diseño con plantilla.";
    }
    return "No se pudo resolver la plantilla de diseño para este pedido.";
  }
  if (reason === "template_not_found") {
    return "No encontramos la plantilla de diseño configurada. Verificá que siga existiendo en el catálogo.";
  }
  if (reason.startsWith("validation_failed:")) {
    return "La selección de fotos no cumple con la plantilla requerida (cantidad o roles). Revisá la selección.";
  }
  if (reason === "design_project_missing") {
    return "No se pudo crear el proyecto de diseño. Intentá de nuevo o contactá a soporte.";
  }
  if (reason.startsWith("mapping_failed:")) {
    return "No pudimos ubicar las fotos elegidas en los espacios de la plantilla.";
  }
  if (reason.startsWith("preflight_failed:")) {
    return "No se pudo preparar la vista previa inicial del diseño.";
  }
  return "No se pudo generar el diseño en este momento. Intentá de nuevo más tarde.";
}

/**
 * POST: intentar generar diseño escolar para un PreCompraOrderItem (misma lógica que el redeem).
 */
export async function POST(_req: Request, context: RouteCtx) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const itemId = parseInt(id, 10);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const item = await prisma.preCompraOrderItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        packDefinitionId: true,
        albumProduct: {
          select: { requiresDesign: true, defaultTemplateId: true },
        },
        order: {
          select: {
            id: true,
            status: true,
            album: {
              select: { userId: true, schoolId: true },
            },
            packPurchaseEntitlement: {
              select: { snapshotJson: true },
            },
          },
        },
        selection: {
          select: {
            photos: {
              select: {
                id: true,
                role: true,
                position: true,
                photo: {
                  select: {
                    id: true,
                    previewUrl: true,
                    originalKey: true,
                    isRemoved: true,
                  },
                },
              },
              orderBy: [{ position: "asc" }, { id: "asc" }],
            },
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    const album = item.order.album;
    if (!album || album.userId !== user.id) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    if (album.schoolId == null) {
      const reason = "not_school_album";
      return NextResponse.json(
        {
          ok: false,
          outcome: "skipped",
          reason,
          message: toFriendlyGenerateDesignMessage(reason),
        },
        { status: 400 }
      );
    }

    if (item.order.status !== "PAID_HELD") {
      const reason = "order_not_paid";
      return NextResponse.json(
        {
          ok: false,
          outcome: "skipped",
          reason,
          message: toFriendlyGenerateDesignMessage(reason),
        },
        { status: 400 }
      );
    }

    const entitlement = item.order.packPurchaseEntitlement;
    if (!entitlement?.snapshotJson) {
      const reason = "no_pack_snapshot";
      return NextResponse.json(
        {
          ok: false,
          outcome: "skipped",
          reason,
          message: toFriendlyGenerateDesignMessage(reason),
        },
        { status: 400 }
      );
    }

    let snapshot;
    try {
      snapshot = parsePreventaPackSnapshotV1(entitlement.snapshotJson);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "snapshot inválido";
      const reason = `invalid_snapshot:${msg}`;
      return NextResponse.json(
        {
          ok: false,
          outcome: "skipped",
          reason,
          message: toFriendlyGenerateDesignMessage(reason),
        },
        { status: 400 }
      );
    }

    if (item.packDefinitionId == null || item.packDefinitionId !== snapshot.packDefinitionId) {
      const reason = "pack_definition_mismatch";
      return NextResponse.json(
        {
          ok: false,
          outcome: "skipped",
          reason,
          message: toFriendlyGenerateDesignMessage(reason),
        },
        { status: 400 }
      );
    }

    const photos = item.selection?.photos ?? [];
    if (photos.length === 0) {
      const reason = "no_selection_photos";
      return NextResponse.json(
        {
          ok: false,
          outcome: "skipped",
          reason,
          message: toFriendlyGenerateDesignMessage(reason),
        },
        { status: 400 }
      );
    }

    const selectionPhotos = photos.map((p) => ({
      id: p.id,
      role: p.role,
      position: p.position,
      photo: p.photo
        ? {
            previewUrl: p.photo.previewUrl,
            originalKey: p.photo.originalKey,
            isRemoved: p.photo.isRemoved,
          }
        : null,
    }));

    const result = await prisma.$transaction((tx) =>
      ensureSchoolDesignForPreCompraOrderItem(tx, {
        snapshot,
        orderItem: {
          id: item.id,
          albumProduct: item.albumProduct,
        },
        selectionPhotos,
      })
    );

    if (result.outcome === "created") {
      return NextResponse.json({
        ok: true,
        outcome: "created",
        designProjectId: result.designProjectId,
      });
    }

    const reason = result.reason;
    return NextResponse.json({
      ok: false,
      outcome: "skipped",
      reason,
      message: toFriendlyGenerateDesignMessage(reason),
    });
  } catch (err: unknown) {
    console.error("POST /api/fotografo/school-order-items/[id]/generate-design:", err);
    return NextResponse.json({ error: "Error al generar diseño" }, { status: 500 });
  }
}
