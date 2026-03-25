import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

const APP_URL = process.env.APP_URL || "https://www.compramelafoto.com";
const REFERRAL_SIGNUP_PATH = "/land";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const roleFilter = searchParams.get("role") as Role | null;
    const q = searchParams.get("q")?.toLowerCase().trim() || "";

    const where: any = {};

    // Filtrar por rol
    if (roleFilter && Object.values(Role).includes(roleFilter)) {
      where.role = roleFilter;
    }

    // Búsqueda por texto (email, nombre, teléfono)
    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        city: true,
        province: true,
        country: true,
        createdAt: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
        platformCommissionPercentOverride: true,
        mpAccessToken: true,
        mpUserId: true,
        mpConnectedAt: true,
        publicPageHandler: true,
        isPublicPageEnabled: true,
        lastLoginAt: true,
        referralCodeOwned: { select: { code: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500, // Límite razonable
    });

    const list = users.map((u) => {
      const { referralCodeOwned, ...rest } = u;
      const referralUrl = referralCodeOwned
        ? `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(referralCodeOwned.code)}`
        : null;
      return { ...rest, referralUrl };
    });

    return NextResponse.json(list);
  } catch (err: any) {
    console.error("GET /api/admin/users ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo usuarios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

const ALLOWED_CREATE_ROLES: Role[] = ["CUSTOMER", "PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "LAB", "ORGANIZER"];

export async function POST(req: NextRequest) {
  try {
    const { error, user: adminUser } = await requireAuth([Role.ADMIN]);
    if (error || !adminUser) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role as Role | undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email inválido o vacío." },
        { status: 400 }
      );
    }
    if (!role || !ALLOWED_CREATE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Rol inválido. Debe ser uno de: CUSTOMER, PHOTOGRAPHER, LAB_PHOTOGRAPHER, LAB, ORGANIZER." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email." },
        { status: 400 }
      );
    }

    const bcrypt = await import("bcryptjs").then((m) => m.default);
    const temporaryPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-6);
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Cualquier tipo de usuario puede tener link de referidos; la comisión solo se paga cuando el referido es un FOTÓGRAFO que vende.
    let referralUrl: string | null = null;
    const { generateReferralCode } = await import("@/lib/referral-helpers");
    let code = generateReferralCode();
    for (let i = 0; i < 10; i++) {
      const exists = await prisma.referralCode.findUnique({ where: { code }, select: { id: true } });
      if (!exists) break;
      code = generateReferralCode();
    }
    await prisma.referralCode.create({
      data: { code, ownerUserId: user.id, isActive: true },
    });
    referralUrl = `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(code)}`;

    if (role === "LAB") {
      await prisma.lab.create({
        data: {
          name: email.split("@")[0] || "Lab",
          email,
          userId: user.id,
          approvalStatus: "PENDING",
        },
      });
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Usuario creado por admin: ${email} (${role})`,
      afterData: { email, role },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      user: { ...user, referralUrl },
      referralUrl,
      temporaryPassword,
    });
  } catch (err: any) {
    console.error("POST /api/admin/users ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando usuario", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

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

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    const blocked: Array<{ id: number; reason: string }> = [];
    const deletableIds: number[] = [];

    const labUsers = await prisma.lab.findMany({
      where: { userId: { in: ids } },
      select: { userId: true },
    });
    const labUserIds = new Set(labUsers.map((l) => l.userId).filter((id): id is number => Number.isFinite(id)));

    for (const u of users) {
      if (u.role === "ADMIN") {
        blocked.push({ id: u.id, reason: "ADMIN" });
        continue;
      }
      if (u.id === user.id) {
        blocked.push({ id: u.id, reason: "SELF" });
        continue;
      }
      if (labUserIds.has(u.id)) {
        blocked.push({ id: u.id, reason: "LAB_USER" });
        continue;
      }
      const albumsCount = await prisma.album.count({ where: { userId: u.id } });
      const photographerOrders = await prisma.printOrder.count({ where: { photographerId: u.id } });
      if (albumsCount > 0 || photographerOrders > 0) {
        blocked.push({ id: u.id, reason: "HAS_ALBUMS_OR_ORDERS" });
        continue;
      }
      deletableIds.push(u.id);
    }

    if (deletableIds.length > 0) {
      await prisma.$transaction([
        prisma.printOrder.updateMany({
          where: { clientId: { in: deletableIds } },
          data: { clientId: null },
        }),
        prisma.user.deleteMany({
          where: { id: { in: deletableIds } },
        }),
      ]);
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_BULK",
      entityType: "User",
      description: `Eliminación masiva de usuarios: ${deletableIds.join(", ")}`,
      beforeData: { ids },
      afterData: { deleted: deletableIds.length, blocked },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, deleted: deletableIds.length, blocked });
  } catch (err: any) {
    console.error("DELETE /api/admin/users ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando usuarios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
