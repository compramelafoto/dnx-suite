import { NextRequest, NextResponse } from "next/server";
import { Role, StudentIdentificationMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

type DiagnosticAlert = {
  code: string;
  severity: "warning" | "error";
  message: string;
};

function parseSchoolId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildDiagnostics(input: {
  albums: Array<{
    id: number;
    title: string;
    schoolId: number | null;
    isTest: boolean;
    studentIdentificationMode: StudentIdentificationMode | null;
    studentCount: number;
    paidOrderCount: number;
  }>;
  packs: Array<{
    id: number;
    albumId: number;
    name: string;
    albumTitle: string;
    isActive: boolean;
    availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD" | null;
    benefitsCount: number;
    orderCount: number;
    validFrom: Date | null;
    validUntil: Date | null;
    albumHasPhotos: boolean;
  }>;
  orphanSchoolTypeAlbums: Array<{ id: number; title: string }>;
}): DiagnosticAlert[] {
  const alerts: DiagnosticAlert[] = [];
  const now = new Date();
  const activePacksByAlbumId = new Map<number, number>();
  for (const pack of input.packs) {
    if (!pack.isActive) continue;
    activePacksByAlbumId.set(pack.albumId, (activePacksByAlbumId.get(pack.albumId) ?? 0) + 1);
  }

  for (const album of input.albums) {
    if (!album.schoolId) {
      alerts.push({
        code: `album_missing_school_${album.id}`,
        severity: "error",
        message: `[!] Álbum "${album.title}" no tiene schoolId asignado`,
      });
    }
    if (album.studentCount === 0) {
      alerts.push({
        code: `album_without_students_${album.id}`,
        severity: "warning",
        message: `[!] Álbum "${album.title}" está vinculado a escuela pero no tiene alumnos`,
      });
    }
    if (
      album.studentCount > 0 &&
      (!album.studentIdentificationMode || album.studentIdentificationMode === "NONE")
    ) {
      alerts.push({
        code: `album_ident_mode_missing_${album.id}`,
        severity: "warning",
        message: `[!] Álbum "${album.title}" tiene alumnos pero sin configuración de identificación`,
      });
    }
    if (album.isTest && album.paidOrderCount > 0) {
      alerts.push({
        code: `album_test_with_paid_orders_${album.id}`,
        severity: "error",
        message: `[!] Álbum TEST "${album.title}" tiene pedidos reales pagados`,
      });
    }
    if (album.studentCount > 0 && (activePacksByAlbumId.get(album.id) ?? 0) === 0) {
      alerts.push({
        code: `album_without_active_packs_${album.id}`,
        severity: "warning",
        message: `[!] Álbum "${album.title}" tiene alumnos pero no tiene packs activos`,
      });
    }
  }

  for (const pack of input.packs) {
    if (!pack.availabilityPhase) {
      alerts.push({
        code: `pack_without_phase_${pack.id}`,
        severity: "warning",
        message: `[!] Pack "${pack.name}" (${pack.albumTitle}) no tiene fase PRE/POST definida`,
      });
    }
    if (pack.isActive && pack.benefitsCount === 0) {
      alerts.push({
        code: `pack_active_without_products_${pack.id}`,
        severity: "error",
        message: `[!] Pack activo "${pack.name}" (${pack.albumTitle}) no tiene productos/beneficios`,
      });
    }
    if (
      pack.isActive &&
      ((pack.validFrom != null && pack.validFrom > now) ||
        (pack.validUntil != null && pack.validUntil < now))
    ) {
      alerts.push({
        code: `pack_active_out_of_validity_${pack.id}`,
        severity: "warning",
        message: `[!] Pack activo "${pack.name}" (${pack.albumTitle}) está fuera de vigencia`,
      });
    }
    if (
      pack.isActive &&
      pack.availabilityPhase &&
      ((pack.availabilityPhase === "PRE_UPLOAD" && pack.albumHasPhotos) ||
        (pack.availabilityPhase === "POST_UPLOAD" && !pack.albumHasPhotos))
    ) {
      alerts.push({
        code: `pack_phase_mismatch_${pack.id}`,
        severity: "warning",
        message: `[!] Pack "${pack.name}" (${pack.albumTitle}) tiene fase que no coincide con el estado actual del álbum`,
      });
    }
  }

  for (const orphan of input.orphanSchoolTypeAlbums) {
    alerts.push({
      code: `orphan_school_album_${orphan.id}`,
      severity: "warning",
      message: `[!] Álbum de tipo SCHOOL "${orphan.title}" no está vinculado a una escuela`,
    });
  }

  return alerts;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            companyName: true,
          },
        },
      },
    });

    if (!school) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const albumsRaw = await prisma.album.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        publicSlug: true,
        eventDate: true,
        isTest: true,
        schoolId: true,
        studentIdentificationMode: true,
        allowManualStudentFallback: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: true,
        organizerCommissionAppliesTo: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const albumIds = albumsRaw.map((album) => album.id);

    const [photoCounts, rosterCounts, preOrderCounts, paidTestOrderCounts] = await Promise.all([
      albumIds.length
        ? prisma.photo.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds }, isRemoved: false },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      albumIds.length
        ? prisma.albumStudentRosterEntry.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds }, isActive: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      albumIds.length
        ? prisma.preCompraOrder.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      albumIds.length
        ? prisma.preCompraOrder.groupBy({
            by: ["albumId"],
            where: {
              albumId: { in: albumIds },
              isTest: false,
              status: "PAID_HELD",
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const photoCountMap = new Map(photoCounts.map((row) => [row.albumId, row._count._all]));
    const rosterCountMap = new Map(rosterCounts.map((row) => [row.albumId, row._count._all]));
    const preOrderCountMap = new Map(preOrderCounts.map((row) => [row.albumId, row._count._all]));
    const paidTestOrderCountMap = new Map(
      paidTestOrderCounts.map((row) => [row.albumId, row._count._all])
    );

    const albums = albumsRaw.map((album) => ({
      id: album.id,
      title: album.title,
      publicSlug: album.publicSlug,
      eventDate: album.eventDate,
      schoolId: album.schoolId,
      isTest: album.isTest,
      studentIdentificationMode: album.studentIdentificationMode,
      allowManualStudentFallback: album.allowManualStudentFallback,
      organizerCommissionEnabled: album.organizerCommissionEnabled,
      organizerCommissionPercentage: album.organizerCommissionPercentage,
      organizerCommissionAppliesTo: album.organizerCommissionAppliesTo,
      createdAt: album.createdAt,
      ownerUser: album.user,
      metrics: {
        photoCount: photoCountMap.get(album.id) ?? 0,
        studentCount: rosterCountMap.get(album.id) ?? 0,
        orderCount: preOrderCountMap.get(album.id) ?? 0,
      },
    }));

    const packDefinitions = albumIds.length
      ? await prisma.packDefinition.findMany({
          where: { albumId: { in: albumIds } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
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
            album: { select: { title: true } },
            benefits: {
              select: {
                id: true,
                templateId: true,
                templatePolicy: true,
              },
            },
          },
        })
      : [];

    const albumProducts = albumIds.length
      ? await prisma.albumProduct.findMany({
          where: { albumId: { in: albumIds } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            name: true,
            price: true,
            requiresDesign: true,
            defaultTemplateId: true,
            createdAt: true,
            albumId: true,
            album: { select: { title: true } },
          },
        })
      : [];

    const [packOrderCounts, albumProductOrderCounts] = await Promise.all([
      packDefinitions.length
        ? prisma.preCompraOrderItem.groupBy({
            by: ["packDefinitionId"],
            where: {
              packDefinitionId: { in: packDefinitions.map((pack) => pack.id) },
              order: { isTest: false },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      albumProducts.length
        ? prisma.preCompraOrderItem.groupBy({
            by: ["albumProductId"],
            where: {
              albumProductId: { in: albumProducts.map((product) => product.id) },
              order: { isTest: false },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const packOrderCountMap = new Map<number, number>();
    for (const row of packOrderCounts) {
      if (row.packDefinitionId != null) {
        packOrderCountMap.set(row.packDefinitionId, row._count._all);
      }
    }

    const albumProductOrderCountMap = new Map<number, number>();
    for (const row of albumProductOrderCounts) {
      if (row.albumProductId != null) {
        albumProductOrderCountMap.set(row.albumProductId, row._count._all);
      }
    }

    const packs = [
      ...packDefinitions.map((pack) => {
        const firstTemplateId =
          pack.benefits.find((benefit) => benefit.templateId != null)?.templateId ?? null;
        const requiresDesign = pack.benefits.some(
          (benefit) => benefit.templatePolicy === "REQUIRED" || benefit.templateId != null
        );
        const orderCount = packOrderCountMap.get(pack.id) ?? 0;
        return {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          priceClientArs: pack.priceClientArs,
          availabilityPhase: pack.availabilityPhase,
          isActive: pack.isActive,
          validFrom: pack.validFrom,
          validUntil: pack.validUntil,
          createdAt: pack.createdAt,
          orderCount,
          inUse: orderCount > 0,
          requiresDesign,
          templateId: firstTemplateId,
          albumId: pack.albumId,
          albumTitle: pack.album.title,
          source: "PACK_DEFINITION" as const,
          metrics: {
            benefitsCount: pack.benefits.length,
          },
        };
      }),
      ...albumProducts.map((product) => ({
        id: product.id,
        name: product.name,
        description: null,
        priceClientArs: product.price,
        availabilityPhase: null,
        isActive: true,
        validFrom: null,
        validUntil: null,
        createdAt: product.createdAt,
        orderCount: albumProductOrderCountMap.get(product.id) ?? 0,
        inUse: (albumProductOrderCountMap.get(product.id) ?? 0) > 0,
        requiresDesign: product.requiresDesign,
        templateId: product.defaultTemplateId,
        albumId: product.albumId,
        albumTitle: product.album.title,
        source: "ALBUM_PRODUCT" as const,
        metrics: {
          benefitsCount: product.requiresDesign ? 1 : 0,
        },
      })),
    ];

    const studentsRaw = await prisma.albumStudentRosterEntry.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        studentId: true,
        albumId: true,
        level: true,
        courseName: true,
        division: true,
        shift: true,
        notes: true,
        snapshotFirstName: true,
        snapshotLastName: true,
      },
    });

    const studentIds = [...new Set(studentsRaw.map((entry) => entry.studentId))];
    const rosterEntryIds = studentsRaw.map((entry) => entry.id);

    const [preCompraByStudent, preCompraByRosterEntry] = await Promise.all([
      studentIds.length
        ? prisma.preCompraOrder.groupBy({
            by: ["studentId"],
            where: {
              studentId: { in: studentIds },
              album: { schoolId },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      rosterEntryIds.length
        ? prisma.preCompraOrder.groupBy({
            by: ["albumRosterEntryId"],
            where: {
              albumRosterEntryId: { in: rosterEntryIds },
              album: { schoolId },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const preCompraByStudentId = new Map<number, number>();
    for (const row of preCompraByStudent) {
      if (row.studentId != null) {
        preCompraByStudentId.set(row.studentId, row._count._all);
      }
    }

    const preCompraByRosterEntryId = new Map<number, number>();
    for (const row of preCompraByRosterEntry) {
      if (row.albumRosterEntryId != null) {
        preCompraByRosterEntryId.set(row.albumRosterEntryId, row._count._all);
      }
    }

    const students = studentsRaw.map((entry) => {
      const preCompraOrdersCount = preCompraByStudentId.get(entry.studentId) ?? 0;
      const rosterPreCompraOrdersCount = preCompraByRosterEntryId.get(entry.id) ?? 0;
      const hasSensitiveRelations =
        preCompraOrdersCount > 0 || rosterPreCompraOrdersCount > 0;

      return {
        id: entry.id,
        studentId: entry.studentId,
        firstName: entry.snapshotFirstName,
        lastName: entry.snapshotLastName,
        level: entry.level,
        course: entry.courseName,
        division: entry.division,
        shift: entry.shift,
        notes: entry.notes,
        albumId: entry.albumId,
        hasSensitiveRelations,
        sensitiveRelationsSummary: hasSensitiveRelations
          ? {
              preCompraOrdersCount,
              rosterPreCompraOrdersCount,
            }
          : null,
      };
    });

    const ordersRaw = await prisma.preCompraOrder.findMany({
      where: { album: { schoolId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        albumId: true,
        buyerEmail: true,
        buyerName: true,
        studentFirstName: true,
        studentLastName: true,
        status: true,
        createdAt: true,
        items: {
          take: 1,
          select: {
            packDefinition: { select: { name: true } },
            albumProduct: { select: { name: true } },
          },
        },
      },
    });

    const orders = ordersRaw.map((order) => {
      const firstItem = order.items[0];
      return {
        id: order.id,
        studentName:
          `${order.studentFirstName ?? ""} ${order.studentLastName ?? ""}`.trim() || "Sin alumno",
        clientEmail: order.buyerEmail,
        packName:
          firstItem?.packDefinition?.name ??
          firstItem?.albumProduct?.name ??
          "Sin pack",
        albumId: order.albumId,
        paymentStatus: order.status,
        createdAt: order.createdAt,
      };
    });

    const orphanSchoolTypeAlbums = await prisma.album.findMany({
      where: {
        type: "SCHOOL",
        schoolId: null,
        userId: { in: [...new Set(albumsRaw.map((album) => album.user.id))] },
        deletedAt: null,
      },
      take: 20,
      select: {
        id: true,
        title: true,
      },
    });

    const diagnostics = buildDiagnostics({
      albums: albumsRaw.map((album) => ({
        id: album.id,
        title: album.title,
        schoolId: album.schoolId,
        isTest: album.isTest,
        studentIdentificationMode: album.studentIdentificationMode,
        studentCount: rosterCountMap.get(album.id) ?? 0,
        paidOrderCount: paidTestOrderCountMap.get(album.id) ?? 0,
      })),
      packs: packDefinitions.map((pack) => ({
        id: pack.id,
        albumId: pack.albumId,
        name: pack.name,
        albumTitle: pack.album.title,
        isActive: pack.isActive,
        availabilityPhase: pack.availabilityPhase,
        benefitsCount: pack.benefits.length,
        orderCount: packOrderCountMap.get(pack.id) ?? 0,
        validFrom: pack.validFrom,
        validUntil: pack.validUntil,
        albumHasPhotos: (photoCountMap.get(pack.albumId) ?? 0) > 0,
      })),
      orphanSchoolTypeAlbums,
    });

    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: [{ isCurrent: "desc" }, { id: "desc" }],
      select: { id: true, label: true, isCurrent: true },
    });

    const summary = {
      albumsCount: albums.length,
      studentsCount: students.length,
      ordersCount: orders.length,
      activePacksCount: packs.filter((pack) => pack.isActive).length,
      totalPacksCount: packs.length,
    };

    return NextResponse.json({
      school,
      summary,
      albums,
      packs,
      students,
      orders,
      diagnostics,
      academicYears,
      limits: {
        students: 100,
        orders: 50,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/schools/[schoolId]:", err);
    return NextResponse.json(
      { error: "Error obteniendo detalle de escuela" },
      { status: 500 }
    );
  }
}

type SchoolPatchBody = {
  name?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  address?: unknown;
  city?: unknown;
  province?: unknown;
  country?: unknown;
  notes?: unknown;
  logoUrl?: unknown;
};

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

    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const existing = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as SchoolPatchBody;
    const data: Record<string, string | null> = {};
    const changedFields: string[] = [];

    if (body.name !== undefined) {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
      }
      data.name = name;
      changedFields.push("name");
    }

    if (body.contactEmail !== undefined) {
      const email = String(body.contactEmail ?? "").trim();
      if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: "contactEmail inválido" }, { status: 400 });
      }
      data.contactEmail = email || null;
      changedFields.push("contactEmail");
    }

    if (body.contactPhone !== undefined) {
      data.contactPhone = String(body.contactPhone ?? "").trim() || null;
      changedFields.push("contactPhone");
    }
    if (body.address !== undefined) {
      data.address = String(body.address ?? "").trim() || null;
      changedFields.push("address");
    }
    if (body.city !== undefined) {
      data.city = String(body.city ?? "").trim() || null;
      changedFields.push("city");
    }
    if (body.province !== undefined) {
      data.province = String(body.province ?? "").trim() || null;
      changedFields.push("province");
    }
    if (body.country !== undefined) {
      data.country = String(body.country ?? "").trim() || null;
      changedFields.push("country");
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes ?? "").trim() || null;
      changedFields.push("notes");
    }
    if (body.logoUrl !== undefined) {
      data.logoUrl = String(body.logoUrl ?? "").trim() || null;
      changedFields.push("logoUrl");
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    if (!("name" in data) && !existing.name.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log("[admin_schools] school_updated", {
      adminUserId: user.id,
      schoolId,
      changedFields,
    });

    return NextResponse.json({ school: updated });
  } catch (err) {
    console.error("PATCH /api/admin/schools/[schoolId]:", err);
    return NextResponse.json(
      { error: "Error actualizando escuela" },
      { status: 500 }
    );
  }
}
