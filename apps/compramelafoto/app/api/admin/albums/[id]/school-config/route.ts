import { NextRequest, NextResponse } from "next/server";
import {
  Role,
  StudentIdentificationMode,
  OrganizerCommissionAppliesTo,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AlbumPatchBody = {
  title?: unknown;
  publicSlug?: unknown;
  eventDate?: unknown;
  schoolId?: unknown;
  isTest?: unknown;
  studentIdentificationMode?: unknown;
  allowManualStudentFallback?: unknown;
  organizerCommissionEnabled?: unknown;
  organizerCommissionPercentage?: unknown;
  organizerCommissionAppliesTo?: unknown;
};

function parseAlbumId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("eventDate inválida");
  }
  return date;
}

function parseNullableSchoolId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("schoolId inválido");
  }
  return parsed;
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

    const { id } = await params;
    const albumId = parseAlbumId(id);
    if (!albumId) {
      return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        eventDate: true,
        schoolId: true,
        isTest: true,
        studentIdentificationMode: true,
        allowManualStudentFallback: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: true,
        organizerCommissionAppliesTo: true,
      },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as AlbumPatchBody;
    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (body.title !== undefined) {
      const title = String(body.title ?? "").trim();
      if (!title) {
        return NextResponse.json({ error: "title no puede estar vacío" }, { status: 400 });
      }
      updateData.title = title;
      changedFields.push("title");
    }

    if (body.publicSlug !== undefined) {
      const publicSlug = String(body.publicSlug ?? "").trim();
      if (!publicSlug) {
        return NextResponse.json({ error: "publicSlug no puede estar vacío" }, { status: 400 });
      }
      const existingSlug = await prisma.album.findFirst({
        where: { publicSlug, id: { not: albumId } },
        select: { id: true },
      });
      if (existingSlug) {
        return NextResponse.json({ error: "publicSlug ya está en uso" }, { status: 400 });
      }
      updateData.publicSlug = publicSlug;
      changedFields.push("publicSlug");
    }

    if (body.eventDate !== undefined) {
      try {
        updateData.eventDate = parseNullableDate(body.eventDate);
      } catch (dateError) {
        return NextResponse.json(
          { error: dateError instanceof Error ? dateError.message : "eventDate inválida" },
          { status: 400 }
        );
      }
      changedFields.push("eventDate");
    }

    let nextSchoolId: number | null = album.schoolId;
    if (body.schoolId !== undefined) {
      try {
        nextSchoolId = parseNullableSchoolId(body.schoolId);
      } catch (schoolIdError) {
        return NextResponse.json(
          { error: schoolIdError instanceof Error ? schoolIdError.message : "schoolId inválido" },
          { status: 400 }
        );
      }

      if (nextSchoolId != null) {
        const schoolExists = await prisma.school.findUnique({
          where: { id: nextSchoolId },
          select: { id: true },
        });
        if (!schoolExists) {
          return NextResponse.json({ error: "La escuela indicada no existe" }, { status: 400 });
        }
      }

      if (nextSchoolId !== album.schoolId) {
        const [preOrdersCount, ordersCount, rosterCount, packsCount, photosCount] =
          await Promise.all([
            prisma.preCompraOrder.count({ where: { albumId } }),
            prisma.order.count({ where: { albumId, isTest: false } }),
            prisma.albumStudentRosterEntry.count({ where: { albumId } }),
            prisma.packDefinition.count({ where: { albumId } }),
            prisma.photo.count({ where: { albumId, isRemoved: false } }),
          ]);

        if (preOrdersCount > 0 || ordersCount > 0) {
          return NextResponse.json(
            {
              error:
                "No se puede cambiar schoolId porque el álbum ya tiene preventas/pedidos asociados.",
              guardrail: {
                preOrdersCount,
                ordersCount,
                rosterCount,
                packsCount,
                photosCount,
              },
            },
            { status: 400 }
          );
        }
      }

      updateData.schoolId = nextSchoolId;
      changedFields.push("schoolId");
    }

    if (body.isTest !== undefined) {
      if (typeof body.isTest !== "boolean") {
        return NextResponse.json({ error: "isTest debe ser boolean" }, { status: 400 });
      }
      updateData.isTest = body.isTest;
      changedFields.push("isTest");
    }

    if (body.studentIdentificationMode !== undefined) {
      const rawMode = body.studentIdentificationMode;
      if (rawMode === null || rawMode === "") {
        updateData.studentIdentificationMode = null;
      } else if (
        typeof rawMode === "string" &&
        ([
          "NONE",
          "MANUAL",
          "ROSTER_OPTIONAL",
          "ROSTER_REQUIRED",
        ] as StudentIdentificationMode[]).includes(rawMode as StudentIdentificationMode)
      ) {
        updateData.studentIdentificationMode = rawMode;
      } else {
        return NextResponse.json(
          {
            error:
              "studentIdentificationMode inválido (NONE, MANUAL, ROSTER_OPTIONAL, ROSTER_REQUIRED, null)",
          },
          { status: 400 }
        );
      }
      changedFields.push("studentIdentificationMode");
    }

    if (body.allowManualStudentFallback !== undefined) {
      if (typeof body.allowManualStudentFallback !== "boolean") {
        return NextResponse.json(
          { error: "allowManualStudentFallback debe ser boolean" },
          { status: 400 }
        );
      }
      updateData.allowManualStudentFallback = body.allowManualStudentFallback;
      changedFields.push("allowManualStudentFallback");
    }

    if (body.organizerCommissionEnabled !== undefined) {
      if (typeof body.organizerCommissionEnabled !== "boolean") {
        return NextResponse.json(
          { error: "organizerCommissionEnabled debe ser boolean" },
          { status: 400 }
        );
      }
      updateData.organizerCommissionEnabled = body.organizerCommissionEnabled;
      changedFields.push("organizerCommissionEnabled");
    }

    if (body.organizerCommissionPercentage !== undefined) {
      if (
        body.organizerCommissionPercentage === null ||
        body.organizerCommissionPercentage === ""
      ) {
        updateData.organizerCommissionPercentage = null;
      } else {
        const value = Number(body.organizerCommissionPercentage);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          return NextResponse.json(
            { error: "organizerCommissionPercentage inválido (0-100)" },
            { status: 400 }
          );
        }
        updateData.organizerCommissionPercentage = value;
      }
      changedFields.push("organizerCommissionPercentage");
    }

    if (body.organizerCommissionAppliesTo !== undefined) {
      const allowed: OrganizerCommissionAppliesTo[] = ["PREVENTA", "POST_EVENT", "EXTRAS"];
      if (!Array.isArray(body.organizerCommissionAppliesTo)) {
        return NextResponse.json(
          { error: "organizerCommissionAppliesTo debe ser array" },
          { status: 400 }
        );
      }
      const parsed = body.organizerCommissionAppliesTo
        .map((entry) => String(entry))
        .filter((entry): entry is OrganizerCommissionAppliesTo =>
          allowed.includes(entry as OrganizerCommissionAppliesTo)
        );
      updateData.organizerCommissionAppliesTo = parsed;
      changedFields.push("organizerCommissionAppliesTo");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updated = await prisma.album.update({
      where: { id: albumId },
      data: updateData,
      select: {
        id: true,
        title: true,
        publicSlug: true,
        eventDate: true,
        schoolId: true,
        isTest: true,
        studentIdentificationMode: true,
        allowManualStudentFallback: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: true,
        organizerCommissionAppliesTo: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log("[admin_schools] album_school_config_updated", {
      adminUserId: user.id,
      albumId,
      changedFields,
    });

    return NextResponse.json({ album: updated });
  } catch (err) {
    console.error("PATCH /api/admin/albums/[id]/school-config:", err);
    return NextResponse.json(
      { error: "Error actualizando configuración escolar del álbum" },
      { status: 500 }
    );
  }
}
