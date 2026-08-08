import { NextResponse } from "next/server";
import {
  PartnersDomainError,
  canReusePartnerLogoFamilyFromGeneral,
  isPartnerLogoAssetType,
  type DnxPartnerBrandAssetType,
} from "@repo/partners";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ partnerId: string }> };

/**
 * Activa/desactiva reutilizar Logo general en otra familia (principal, horizontal, etc.).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getClickatonAuthUser();
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          message: "Sesión expirada. Volvé a iniciar sesión.",
        },
        { status: 401 },
      );
    }
    if (
      !hasClickatonAdminAccess({
        email: user.email,
        globalRole: user.globalRole,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "forbidden",
          message: "Sin permisos administrativos.",
        },
        { status: 403 },
      );
    }
    const actor = toPartnerActor(user);
    const { partnerId } = await params;
    if (!partnerId?.trim()) {
      return NextResponse.json({ ok: false, error: "partner_required" }, { status: 400 });
    }

    let body: { assetType?: string; enabled?: boolean };
    try {
      body = (await request.json()) as { assetType?: string; enabled?: boolean };
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const rawType = (body.assetType ?? "").trim();
    if (!isPartnerLogoAssetType(rawType) || !canReusePartnerLogoFamilyFromGeneral(rawType)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_asset_type",
          message: "Elegí una sección distinta de Logo general.",
        },
        { status: 400 },
      );
    }
    const assetType = rawType as DnxPartnerBrandAssetType;
    const enabled = Boolean(body.enabled);

    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      return svc.reusePartnerLogoFamilyFromGeneral(actor, {
        partnerId,
        targetType: assetType,
        enabled,
      });
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "db_unavailable", message: result.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      enabled,
      assetType,
      count: result.data.length,
      assets: result.data.map((a) => ({
        id: a.id,
        type: a.type,
        backgroundType: a.backgroundType,
        fileUrl: a.fileUrl,
        storageKey: a.storageKey,
        approvalStatus: a.approvalStatus,
      })),
    });
  } catch (error) {
    if (error instanceof PartnersDomainError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    console.error("[clickaton] partner logo reuse-general failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "reuse_failed",
        message: "No se pudo actualizar la reutilización de Logo general.",
      },
      { status: 500 },
    );
  }
}
