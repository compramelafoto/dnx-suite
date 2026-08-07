import { NextResponse } from "next/server";
import {
  assertPartnerLogoUploadAllowed,
  assertSafeStorageFilename,
  getPartnerLogoVariantGuide,
  isPartnerLogoAssetType,
  type DnxPartnerBrandAssetType,
} from "@repo/partners";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getPartnerAssetStorage } from "@/lib/admin/partners/partner-asset-storage";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ partnerId: string }> };

/**
 * Upload de logo de partner (archivo → R2 → DnxPartnerAsset).
 * Solo PNG/WEBP. No publica automáticamente. Queda PENDING de aprobación.
 */
export async function POST(request: Request, { params }: Params) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { partnerId } = await params;
  if (!partnerId?.trim()) {
    return NextResponse.json({ ok: false, error: "partner_required" }, { status: 400 });
  }

  const form = await request.formData();
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

  const safeName = assertSafeStorageFilename(file.name || `logo.${detected.extension}`);
  const storage = getPartnerAssetStorage();
  const stored = await storage.put({
    partnerId,
    extension: detected.extension,
    body: buffer,
    contentType: detected.mime,
  });

  const result = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    await svc.getPartner(actor, partnerId);
    const asset = await svc.createPartnerAsset(actor, {
      partnerId,
      type: assetType,
      name: getPartnerLogoVariantGuide(assetType)?.title ?? assetType,
      storageProvider: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME ? "R2" : "LOCAL",
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
      metadata: { contentHash: stored.contentHash, source: "admin_upload" },
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
      fileUrl: result.data.fileUrl,
      storageKey: result.data.storageKey,
      approvalStatus: result.data.approvalStatus,
      status: result.data.status,
    },
  });
}
