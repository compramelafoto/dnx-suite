import { NextResponse } from "next/server";
import {
  assertPartnerLogoUploadAllowed,
  assertSafeStorageFilename,
  isPartnerLogoAssetType,
  PartnersDomainError,
  type DnxPartnerBrandAssetType,
  type PartnerActor,
} from "@repo/partners";
import { withClickatonDb } from "@/lib/admin/db";
import { getPartnerAssetStorage } from "@/lib/admin/partners/partner-asset-storage";
import { getClickatonPartnersService } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const GENERIC_INVALID = {
  ok: false as const,
  error: "invalid_or_expired",
  message: "Este enlace no es válido o ya no está disponible.",
};

/** Actor interno para persistir assets vía token público validado. */
const PUBLIC_ONBOARDING_ACTOR: PartnerActor = {
  userId: 0,
  isOpsAdmin: true,
};

/**
 * Upload de logo vía token público de onboarding.
 * Solo PNG/WEBP (assertPartnerLogoUploadAllowed).
 */
export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file_required", message: "Archivo requerido." },
      { status: 400 },
    );
  }

  const rawType = (form.get("assetType")?.toString() || "LOGO_PRIMARY").trim();
  if (!isPartnerLogoAssetType(rawType)) {
    return NextResponse.json(
      { ok: false, error: "invalid_asset_type", message: "Tipo de logo inválido." },
      { status: 400 },
    );
  }
  const assetType = rawType as DnxPartnerBrandAssetType;

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

  try {
    const result = await withClickatonDb(async () => {
      const svc = getClickatonPartnersService();
      const { partnerId } = await svc.resolvePartnerIdForOnboardingToken(token.trim());

      const safeName = assertSafeStorageFilename(
        file.name || `logo.${detected.extension}`,
      );
      const storage = getPartnerAssetStorage();
      const stored = await storage.put({
        partnerId,
        extension: detected.extension,
        body: buffer,
        contentType: detected.mime,
      });

      const asset = await svc.createPartnerAsset(PUBLIC_ONBOARDING_ACTOR, {
        partnerId,
        type: assetType,
        name: assetType === "LOGO_PRIMARY" ? "Logo principal" : assetType,
        storageProvider:
          process.env.R2_BUCKET || process.env.R2_BUCKET_NAME ? "R2" : "LOCAL",
        storageKey: stored.key,
        fileUrl: stored.publicUrl,
        originalFilename: safeName,
        mimeType: detected.mime,
        fileExtension: detected.extension,
        fileSize: stored.bytes,
        isPrimary: assetType === "LOGO_PRIMARY",
        status: "DRAFT",
        approvalStatus: "PENDING",
        altText: null,
        notes: null,
        metadata: {
          contentHash: stored.contentHash,
          source: "public_onboarding_upload",
        },
      });

      return asset;
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: result.message },
        { status: 503 },
      );
    }

    const asset = result.data;
    return NextResponse.json({
      ok: true,
      asset: {
        assetId: asset.id,
        type: asset.type,
        fileUrl: asset.fileUrl,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
      },
    });
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      if (
        err.code === "NOT_FOUND" ||
        err.code === "FORBIDDEN" ||
        err.code === "INVALID_STATE"
      ) {
        return NextResponse.json(GENERIC_INVALID, { status: 404 });
      }
      return NextResponse.json(
        { ok: false, error: err.code.toLowerCase(), message: err.message },
        { status: 400 },
      );
    }
    return NextResponse.json(GENERIC_INVALID, { status: 404 });
  }
}
