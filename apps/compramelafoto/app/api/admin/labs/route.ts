import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role, LabApprovalStatus, LabType } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

const APP_URL = process.env.APP_URL || "https://www.compramelafoto.com";
const REFERRAL_SIGNUP_PATH = "/land";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: Crear nuevo laboratorio
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      phone,
      address,
      city,
      province,
      country,
      labType,
      approvalStatus,
    } = body;

    // Validar campos requeridos
    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    // Validar email único si se proporciona
    if (email) {
      const existingLab = await prisma.lab.findUnique({
        where: { email },
      });
      if (existingLab) {
        return NextResponse.json(
          { error: "Ya existe un laboratorio con ese email" },
          { status: 400 }
        );
      }
    }

    // Crear laboratorio
    const finalApprovalStatus = (approvalStatus as LabApprovalStatus) || LabApprovalStatus.APPROVED;
    const lab = await prisma.lab.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        province: province?.trim() || null,
        country: country?.trim() || "Argentina",
        labType: labType || "TYPE_B",
        approvalStatus: finalApprovalStatus,
        isActive: finalApprovalStatus !== LabApprovalStatus.REJECTED,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "CREATE_LAB",
      entityType: "Lab",
      entityId: lab.id,
      description: `Laboratorio creado: ${lab.name}`,
      beforeData: null,
      afterData: {
        id: lab.id,
        name: lab.name,
        email: lab.email,
        approvalStatus: lab.approvalStatus,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, lab }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/labs ERROR >>>", err);

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un laboratorio con ese email" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error creando laboratorio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as LabApprovalStatus | null;

    const where: any = {};
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.approvalStatus = status;
    }

    const labs = await prisma.lab.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        approvalStatus: true,
        isActive: true,
        isSuspended: true,
        commissionOverrideBps: true,
        createdAt: true,
        mpAccessToken: true,
        mpUserId: true,
        mpConnectedAt: true,
        publicPageHandler: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            createdAt: true,
            lastLoginAt: true,
            referralCodeOwned: { select: { code: true } },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const list = labs.map((lab) => {
      const referralUrl = lab.user?.referralCodeOwned
        ? `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(lab.user.referralCodeOwned.code)}`
        : null;
      const { referralCodeOwned, ...userRest } = lab.user || {};
      return {
        ...lab,
        user: lab.user ? { ...userRest } : null,
        referralUrl,
      };
    });

    return NextResponse.json(list);
  } catch (err: any) {
    console.error("GET /api/admin/labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo laboratorios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// DELETE: Eliminación masiva de laboratorios
export async function DELETE(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id)) : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "ids debe ser un array con al menos un ID válido" },
        { status: 400 }
      );
    }

    const blocked: Array<{ id: number; reason: string }> = [];
    const deletableIds: number[] = [];

    for (const labId of ids) {
      const ordersCount = await prisma.printOrder.count({ where: { labId } });
      if (ordersCount > 0) {
        blocked.push({ id: labId, reason: "HAS_ORDERS" });
      } else {
        deletableIds.push(labId);
      }
    }

    if (deletableIds.length > 0) {
      await prisma.lab.deleteMany({
        where: { id: { in: deletableIds } },
      });
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_BULK",
      entityType: "Lab",
      description: `Eliminación masiva de laboratorios: ${deletableIds.join(", ")}`,
      beforeData: { ids },
      afterData: { deleted: deletableIds.length, blocked },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, deleted: deletableIds.length, blocked });
  } catch (err: any) {
    console.error("DELETE /api/admin/labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando laboratorios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
