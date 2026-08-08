import { NextResponse } from "next/server";
import {
  PartnersDomainError,
  assertPartnerLogoUploadAllowed,
  assertSafeStorageFilename,
  getPartnerLogoFamilyGuide,
  getPartnerLogoSlotGuide,
  isPartnerLogoAssetType,
  isPartnerLogoSlotBackground,
  type DnxPartnerBrandAssetType,
  type PartnerLogoSlotBackground,
} from "@repo/partners";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getPartnerAssetStorage } from "@/lib/admin/partners/partner-asset-storage";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ partnerId: string }> };

/**
 * Upload de logo de partner (archivo → R2 → DnxPartnerAsset).
 * Solo PNG/WEBP. No publica automáticamente. Queda PENDING de aprobación.
 *
 * Auth JSON (sin redirect): este endpoint lo consume fetch del admin.
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

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_body",
          message:
            "No se pudo leer el archivo. Si pesa más de 4 MB, comprimilo e intentá de nuevo.",
        },
        { status: 413 },
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
    }

    const rawType = (form.get("assetType")?.toString() || "LOGO_PRIMARY").trim();
    if (!isPartnerLogoAssetType(rawType)) {
      return NextResponse.json(
        { ok: false, error: "invalid_asset_type", message: "Tipo de logo inválido." },
        { status: 400 },
      );
    }
    const assetType = rawType as DnxPartnerBrandAssetType;
    const rawBg = (form.get("backgroundType")?.toString() || "COLOR").trim().toUpperCase();
    if (!isPartnerLogoSlotBackground(rawBg)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_background_type",
          message: "Tratamiento inválido (COLOR, LIGHT o DARK).",
        },
        { status: 400 },
      );
    }
    const backgroundType = rawBg as PartnerLogoSlotBackground;

    const buffer = Buffer.from(await file.arrayBuffer());
    let detected;
    try {
      detected = assertPartnerLogoUploadAllowed({
        buffer,
        declaredMime: file.type || undefined,
        declaredExtension: file.name?.split(".").pop(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Archivo no permitido.";
      return NextResponse.json({ ok: false, error: "invalid_file", message }, { status: 400 });
    }

    // Storage key ya usa UUID; el nombre original es solo metadata.
    // Si el cliente manda nombre vacío/raro, no bloquear el upload.
    let safeName: string;
    try {
      safeName = assertSafeStorageFilename(
        file.name?.trim() || `logo.${detected.extension}`,
      );
    } catch {
      safeName = `logo.${detected.extension}`;
    }
    const storage = getPartnerAssetStorage();
    let stored;
    try {
      stored = await storage.put({
        partnerId,
        extension: detected.extension,
        body: buffer,
        contentType: detected.mime,
      });
    } catch (err) {
      console.error("[clickaton] partner logo storage put failed:", err);
      return NextResponse.json(
        {
          ok: false,
          error: "storage_failed",
          message:
            "No se pudo guardar el archivo. Probá de nuevo con un PNG/WEBP más liviano (máx. 4 MB).",
        },
        { status: 502 },
      );
    }

    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      await svc.getPartner(actor, partnerId);
      const family = getPartnerLogoFamilyGuide(assetType);
      const slotGuide = getPartnerLogoSlotGuide(assetType, backgroundType);
      const assetName =
        family && slotGuide
          ? `${family.title} · ${slotGuide.title}`
          : `${assetType}:${backgroundType}`;
      const asset = await svc.createPartnerAsset(actor, {
        partnerId,
        type: assetType,
        name: assetName,
        storageProvider: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME ? "R2" : "LOCAL",
        storageKey: stored.key,
        fileUrl: stored.publicUrl,
        originalFilename: safeName,
        mimeType: detected.mime,
        fileExtension: detected.extension,
        fileSize: stored.bytes,
        backgroundType,
        isPrimary:
          (assetType === "LOGO_GENERAL" || assetType === "LOGO_PRIMARY") &&
          backgroundType === "COLOR",
        status: "DRAFT",
        approvalStatus: "PENDING",
        altText: null,
        notes: null,
        metadata: {
          contentHash: stored.contentHash,
          source: "admin_upload",
          slotKey: `${assetType}:${backgroundType}`,
        },
      });
      return asset;
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "db_unavailable", message: result.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      asset: {
        id: result.data.id,
        type: result.data.type,
        backgroundType: result.data.backgroundType,
        fileUrl: result.data.fileUrl,
        storageKey: result.data.storageKey,
        approvalStatus: result.data.approvalStatus,
        status: result.data.status,
      },
    });
  } catch (error) {
    if (error instanceof PartnersDomainError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code.toLowerCase(),
          message: error.message,
        },
        { status: 400 },
      );
    }
    console.error("[clickaton] partner logo upload failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "upload_failed",
        message: "No se pudo subir el logo. Probá de nuevo o con un archivo más liviano (máx. 4 MB).",
      },
      { status: 500 },
    );
  }
}
