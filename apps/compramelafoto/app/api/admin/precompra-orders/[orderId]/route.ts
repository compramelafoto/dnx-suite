import { NextRequest, NextResponse } from "next/server";
import { Role, StudentSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

type DiagnosticAlert = {
  code: string;
  severity: "warning" | "error";
  message: string;
};

function parseOrderId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function isManualStudentSource(sourceType: StudentSourceType | null): boolean {
  if (!sourceType) return false;
  return (
    sourceType === "MANUAL_PARENT_FALLBACK" ||
    sourceType === "MANUAL_ORGANIZER" ||
    sourceType === "MANUAL_PHOTOGRAPHER"
  );
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

    const { orderId: orderIdRaw } = await params;
    const orderId = parseOrderId(orderIdRaw);
    if (!orderId) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    const order = await prisma.preCompraOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        createdAt: true,
        status: true,
        totalCents: true,
        isTest: true,
        buyerName: true,
        buyerEmail: true,
        buyerPhone: true,
        studentId: true,
        albumRosterEntryId: true,
        studentSourceType: true,
        studentFirstName: true,
        studentLastName: true,
        studentLevelSnapshot: true,
        studentCourseSnapshot: true,
        studentDivisionSnapshot: true,
        studentShiftSnapshot: true,
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            isTest: true,
            school: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        albumRosterEntry: {
          select: {
            id: true,
            snapshotFirstName: true,
            snapshotLastName: true,
            level: true,
            courseName: true,
            division: true,
            shift: true,
          },
        },
        items: {
          select: {
            id: true,
            status: true,
            priceCents: true,
            albumProductId: true,
            packDefinitionId: true,
            albumProduct: {
              select: {
                id: true,
                name: true,
                requiresDesign: true,
              },
            },
            packDefinition: {
              select: {
                id: true,
                name: true,
                isActive: true,
                benefits: {
                  select: {
                    id: true,
                    templateId: true,
                    templatePolicy: true,
                  },
                },
              },
            },
            selection: {
              select: {
                id: true,
                photos: {
                  select: {
                    id: true,
                    position: true,
                    role: true,
                    photo: {
                      select: {
                        id: true,
                        previewUrl: true,
                      },
                    },
                  },
                  orderBy: [{ position: "asc" }, { id: "asc" }],
                },
              },
            },
            designProject: {
              select: {
                id: true,
                status: true,
                currentRevision: {
                  select: {
                    id: true,
                    exportedJpgUrl: true,
                  },
                },
              },
            },
          },
          orderBy: [{ id: "asc" }],
        },
        packPurchaseEntitlement: {
          select: {
            id: true,
            status: true,
            snapshotJson: true,
            redeemedOrder: {
              select: {
                id: true,
                status: true,
                checkoutPaymentSource: true,
                preCompraPaymentRef: true,
                isTest: true,
                preventaPackSnapshotJson: true,
                items: {
                  select: {
                    id: true,
                    lineOrigin: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const studentNameFromSnapshot =
      `${order.studentFirstName ?? ""} ${order.studentLastName ?? ""}`.trim() || null;
    const studentNameFromRoster =
      `${order.albumRosterEntry?.snapshotFirstName ?? ""} ${
        order.albumRosterEntry?.snapshotLastName ?? ""
      }`.trim() || null;
    const studentNameFromEntity =
      `${order.student?.firstName ?? ""} ${order.student?.lastName ?? ""}`.trim() || null;

    const studentFullName =
      studentNameFromSnapshot || studentNameFromRoster || studentNameFromEntity || "Sin alumno";

    const studentLevel =
      order.studentLevelSnapshot || order.albumRosterEntry?.level || null;
    const studentCourse =
      order.studentCourseSnapshot || order.albumRosterEntry?.courseName || null;
    const studentDivision =
      order.studentDivisionSnapshot || order.albumRosterEntry?.division || null;
    const studentShift = order.studentShiftSnapshot || order.albumRosterEntry?.shift || null;

    const selectedPhotos = order.items.flatMap((item) =>
      (item.selection?.photos ?? []).map((selectionPhoto) => ({
        selectionPhotoId: selectionPhoto.id,
        photoId: selectionPhoto.photo.id,
        previewUrl: selectionPhoto.photo.previewUrl,
        position: selectionPhoto.position,
        role: selectionPhoto.role,
        orderItemId: item.id,
      }))
    );

    const designProjects = order.items
      .filter((item) => item.designProject != null)
      .map((item) => ({
        orderItemId: item.id,
        projectId: item.designProject!.id,
        status: item.designProject!.status,
        previewUrl: item.designProject!.currentRevision?.exportedJpgUrl ?? null,
        exportUrl: item.designProject!.currentRevision?.exportedJpgUrl ?? null,
      }));

    const diagnostics: DiagnosticAlert[] = [];
    if (
      order.status === "PAID_HELD" &&
      order.studentId == null &&
      order.albumRosterEntryId == null
    ) {
      diagnostics.push({
        code: "paid_without_student_link",
        severity: "error",
        message: "Pedido pagado pero sin alumno asociado",
      });
    }

    const manualStudent = isManualStudentSource(order.studentSourceType ?? null);
    if (manualStudent) {
      diagnostics.push({
        code: "manual_student_source",
        severity: "warning",
        message: "Pedido con alumno manual",
      });
    }

    const hasPackDeletedOrInactive = order.items.some(
      (item) => item.packDefinitionId != null && !item.packDefinition?.isActive
    );
    if (hasPackDeletedOrInactive) {
      diagnostics.push({
        code: "inactive_or_missing_pack",
        severity: "warning",
        message: "Pedido con pack eliminado o inactivo",
      });
    }

    const hasSelectedPhotos = selectedPhotos.length > 0;
    const hasAnySelectionPending = order.items.some((item) => item.status === "WAITING_SELECTION");
    if (order.status === "PAID_HELD" && !hasSelectedPhotos && !hasAnySelectionPending) {
      diagnostics.push({
        code: "without_pending_selection",
        severity: "warning",
        message: "Pedido sin selección pendiente",
      });
    }

    const itemsRequiringDesignWithoutProject = order.items.filter((item) => {
      const packRequiresDesign =
        item.packDefinition?.benefits.some(
          (benefit) => benefit.templatePolicy === "REQUIRED" || benefit.templateId != null
        ) ?? false;
      const productRequiresDesign = item.albumProduct?.requiresDesign ?? false;
      const requiresDesign = packRequiresDesign || productRequiresDesign;
      return requiresDesign && item.designProject == null;
    });
    if (itemsRequiringDesignWithoutProject.length > 0) {
      diagnostics.push({
        code: "design_required_without_project",
        severity: "warning",
        message: "Pedido con diseño requerido pero sin proyecto",
      });
    }

    if (order.album.isTest && order.status === "PAID_HELD" && !order.isTest) {
      diagnostics.push({
        code: "test_album_with_real_payment",
        severity: "error",
        message: "Pedido en álbum TEST con pago real",
      });
    }

    const response = {
      order: {
        id: order.id,
        createdAt: order.createdAt,
        paymentStatus: order.status,
        total: order.totalCents,
        checkoutPaymentSource:
          order.packPurchaseEntitlement?.redeemedOrder?.checkoutPaymentSource ?? null,
        preCompraPaymentRef:
          order.packPurchaseEntitlement?.redeemedOrder?.preCompraPaymentRef ?? null,
        isTest: order.isTest,
      },
      client: {
        name: order.buyerName ?? null,
        email: order.buyerEmail,
        phone: order.buyerPhone ?? null,
      },
      student: {
        studentId: order.studentId,
        albumRosterEntryId: order.albumRosterEntryId,
        firstName: order.studentFirstName ?? order.albumRosterEntry?.snapshotFirstName ?? null,
        lastName: order.studentLastName ?? order.albumRosterEntry?.snapshotLastName ?? null,
        fullName: studentFullName,
        course: studentCourse,
        division: studentDivision,
        shift: studentShift,
        level: studentLevel,
        studentSourceType: order.studentSourceType ?? null,
      },
      school: {
        schoolId: order.album.school?.id ?? null,
        name: order.album.school?.name ?? null,
      },
      album: {
        albumId: order.album.id,
        title: order.album.title,
        publicSlug: order.album.publicSlug,
        isTest: order.album.isTest,
      },
      items: order.items.map((item) => ({
        id: item.id,
        quantity: 1,
        price: item.priceCents,
        status: item.status,
        lineOrigin: null as string | null,
        pack: item.packDefinition
          ? {
              id: item.packDefinition.id,
              name: item.packDefinition.name,
              isActive: item.packDefinition.isActive,
            }
          : null,
        product: item.albumProduct
          ? {
              id: item.albumProduct.id,
              name: item.albumProduct.name,
              requiresDesign: item.albumProduct.requiresDesign,
            }
          : null,
        snapshots: {
          student: {
            firstName: order.studentFirstName ?? null,
            lastName: order.studentLastName ?? null,
            course: order.studentCourseSnapshot ?? null,
            division: order.studentDivisionSnapshot ?? null,
            shift: order.studentShiftSnapshot ?? null,
            level: order.studentLevelSnapshot ?? null,
          },
          packPurchase: order.packPurchaseEntitlement?.snapshotJson ?? null,
          redeemOrderPackSnapshot:
            order.packPurchaseEntitlement?.redeemedOrder?.preventaPackSnapshotJson ?? null,
          redemptionOrderLineOrigins:
            order.packPurchaseEntitlement?.redeemedOrder?.items.map((orderItem) => ({
              orderItemId: orderItem.id,
              lineOrigin: orderItem.lineOrigin,
            })) ?? [],
        },
      })),
      selection: {
        hasSelection: hasSelectedPhotos,
        selectedPhotosCount: selectedPhotos.length,
        selectedPhotos,
      },
      design: {
        hasDesignProject: designProjects.length > 0,
        projects: designProjects,
      },
      diagnostics,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/admin/precompra-orders/[orderId]:", err);
    return NextResponse.json(
      { error: "Error obteniendo detalle de preventa/pedido" },
      { status: 500 }
    );
  }
}
