import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";
import {
  getReferralAttributionForReferredUser,
  parseStartsAt,
  removeManualReferralAttribution,
  upsertManualReferralAttribution,
} from "@/lib/admin/referral-attribution-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveReferredUserId(params: { id: string } | Promise<{ id: string }>) {
  const { id } = await Promise.resolve(params);
  const referredUserId = parseInt(id, 10);
  if (!Number.isFinite(referredUserId)) {
    return { error: NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 }) };
  }
  return { referredUserId };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const resolved = await resolveReferredUserId(params);
    if ("error" in resolved) return resolved.error;

    const referred = await prisma.user.findUnique({
      where: { id: resolved.referredUserId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!referred) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const attribution = await getReferralAttributionForReferredUser(resolved.referredUserId);
    return NextResponse.json({ referred, attribution });
  } catch (err: unknown) {
    console.error("GET referral-attribution ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo atribución de referido" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user: admin } = await requireAuth([Role.ADMIN]);
    if (error || !admin) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const resolved = await resolveReferredUserId(params);
    if ("error" in resolved) return resolved.error;

    const body = await req.json().catch(() => ({}));
    const referrerUserId = Number(body.referrerUserId);
    if (!Number.isFinite(referrerUserId)) {
      return NextResponse.json({ error: "referrerUserId es requerido" }, { status: 400 });
    }

    const startsAtRaw = typeof body.startsAt === "string" ? body.startsAt : "";
    const startsAt = parseStartsAt(startsAtRaw) ?? parseStartsAt(new Date().toISOString().slice(0, 10));
    if (!startsAt) {
      return NextResponse.json(
        { error: "startsAt inválido. Usá formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const before = await getReferralAttributionForReferredUser(resolved.referredUserId);

    const result = await upsertManualReferralAttribution({
      referredUserId: resolved.referredUserId,
      referrerUserId,
      startsAt,
    });

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: before ? "UPDATE_REFERRAL_ATTRIBUTION" : "CREATE_REFERRAL_ATTRIBUTION",
      entityType: "ReferralAttribution",
      entityId: result.attribution.id,
      description: before
        ? `Atribución de referido actualizada (admin): referido #${resolved.referredUserId} → referidor #${referrerUserId}`
        : `Atribución de referido creada (admin): referido #${resolved.referredUserId} → referidor #${referrerUserId}`,
      beforeData: before,
      afterData: result.attribution,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      warnings: result.warnings,
      attribution: result.attribution,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error guardando atribución";
    console.error("POST referral-attribution ERROR >>>", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const resolved = await resolveReferredUserId(params);
    if ("error" in resolved) return resolved.error;

    const before = await getReferralAttributionForReferredUser(resolved.referredUserId);
    if (!before) {
      return NextResponse.json({ error: "Este usuario no tiene atribución de referido." }, { status: 404 });
    }

    const removed = await removeManualReferralAttribution(resolved.referredUserId);

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_REFERRAL_ATTRIBUTION",
      entityType: "ReferralAttribution",
      entityId: before.id,
      description: `Atribución de referido eliminada (admin) para usuario #${resolved.referredUserId}`,
      beforeData: before,
      afterData: null,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      earningsRemoved: removed.earningsRemoved,
    });
  } catch (err: unknown) {
    console.error("DELETE referral-attribution ERROR >>>", err);
    return NextResponse.json({ error: "Error eliminando atribución" }, { status: 500 });
  }
}
