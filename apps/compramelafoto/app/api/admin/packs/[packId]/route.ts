import { NextRequest, NextResponse } from "next/server";
import { PackAvailabilityPhase, Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

type PackPatchBody = {
  name?: unknown;
  description?: unknown;
  priceClientArs?: unknown;
  availabilityPhase?: unknown;
  isActive?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
};

function parsePackId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseNullableDate(value: unknown, fieldName: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }
  return date;
}

function parseAvailabilityPhase(value: unknown): PackAvailabilityPhase | null {
  if (value === null || value === undefined || value === "") return null;
  if (value === "PRE_UPLOAD" || value === "POST_UPLOAD") {
    return value;
  }
  throw new Error("availabilityPhase inválida (PRE_UPLOAD, POST_UPLOAD o null)");
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { packId: packIdRaw } = await params;
    const packId = parsePackId(packIdRaw);
    if (!packId) {
      return NextResponse.json({ error: "packId inválido" }, { status: 400 });
    }

    const pack = await prisma.packDefinition.findUnique({
      where: { id: packId },
      select: {
        id: true,
        name: true,
        description: true,
        priceClientArs: true,
        availabilityPhase: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        albumId: true,
        _count: {
          select: {
            preCompraOrderItems: true,
          },
        },
      },
    });
    if (!pack) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
    }

    const hasOrders = (pack._count.preCompraOrderItems ?? 0) > 0;
    const body = (await req.json().catch(() => ({}))) as PackPatchBody;
    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ error: "name no puede estar vacío" }, { status: 400 });
      }
      updateData.name = name;
      changedFields.push("name");
    }

    if (body.description !== undefined) {
      updateData.description =
        body.description === null || body.description === undefined
          ? null
          : String(body.description).trim() || null;
      changedFields.push("description");
    }

    if (body.priceClientArs !== undefined) {
      const priceRaw = Number(body.priceClientArs);
      if (!Number.isFinite(priceRaw) || priceRaw < 0) {
        return NextResponse.json(
          { error: "priceClientArs debe ser un número mayor o igual a 0" },
          { status: 400 }
        );
      }
      updateData.priceClientArs = Math.trunc(priceRaw);
      changedFields.push("priceClientArs");
    }

    if (body.availabilityPhase !== undefined) {
      try {
        updateData.availabilityPhase = parseAvailabilityPhase(body.availabilityPhase);
      } catch (parseError) {
        return NextResponse.json(
          { error: parseError instanceof Error ? parseError.message : "availabilityPhase inválida" },
          { status: 400 }
        );
      }
      changedFields.push("availabilityPhase");
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive debe ser boolean" }, { status: 400 });
      }
      updateData.isActive = body.isActive;
      changedFields.push("isActive");
    }

    if (body.validFrom !== undefined) {
      try {
        updateData.validFrom = parseNullableDate(body.validFrom, "validFrom");
      } catch (parseError) {
        return NextResponse.json(
          { error: parseError instanceof Error ? parseError.message : "validFrom inválida" },
          { status: 400 }
        );
      }
      changedFields.push("validFrom");
    }

    if (body.validUntil !== undefined) {
      try {
        updateData.validUntil = parseNullableDate(body.validUntil, "validUntil");
      } catch (parseError) {
        return NextResponse.json(
          { error: parseError instanceof Error ? parseError.message : "validUntil inválida" },
          { status: 400 }
        );
      }
      changedFields.push("validUntil");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    if (hasOrders) {
      const forbiddenFields = changedFields.filter(
        (field) => field !== "isActive" && field !== "validUntil"
      );
      if (forbiddenFields.length > 0) {
        return NextResponse.json(
          {
            error:
              "Este pack ya tiene ventas. Solo podés modificar disponibilidad y vigencia para no afectar compras existentes.",
            blockedFields: forbiddenFields,
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.packDefinition.update({
      where: { id: packId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        priceClientArs: true,
        availabilityPhase: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        createdAt: true,
        albumId: true,
      },
    });

    console.log("[admin_schools] pack_updated", {
      adminUserId: user.id,
      packId,
      albumId: pack.albumId,
      changedFields,
      hasOrders,
    });

    return NextResponse.json({
      pack: updated,
      hasOrders,
      orderCount: pack._count.preCompraOrderItems ?? 0,
      restrictions: hasOrders
        ? {
            allowedFields: ["isActive", "validUntil"],
          }
        : null,
    });
  } catch (err) {
    console.error("PATCH /api/admin/packs/[packId]:", err);
    return NextResponse.json({ error: "Error actualizando pack" }, { status: 500 });
  }
}
