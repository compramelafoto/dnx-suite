import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getAuthUser } from "@/lib/auth";
import {
  uploadInfoSpotCover,
  uploadInfoSpotEditorialImage,
  validateInfoSpotImageFile,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const validation = validateInfoSpotImageFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const purpose = String(formData.get("purpose") ?? "cover").trim() || "cover";
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const credit = String(formData.get("credit") ?? "").trim() || null;
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const photographerName = String(formData.get("photographerName") ?? "").trim() || null;
  const copyrightText = String(formData.get("copyrightText") ?? "").trim() || null;
  const articleId = String(formData.get("articleId") ?? "").trim() || undefined;

  if (purpose === "inline") {
    if (!alt) {
      return NextResponse.json(
        { error: "El texto alternativo (alt) es obligatorio para imágenes del cuerpo." },
        { status: 400 },
      );
    }
    if (!credit) {
      return NextResponse.json(
        { error: "El crédito fotográfico es obligatorio para imágenes del cuerpo." },
        { status: 400 },
      );
    }
  }

  try {
    const uploaded =
      purpose === "inline"
        ? await uploadInfoSpotEditorialImage(file, articleId)
        : await uploadInfoSpotCover(file);

    const asset = await prisma.infoSpotEditorialAsset.create({
      data: {
        sourceType: "UPLOAD",
        url: uploaded.url,
        thumbnailUrl: uploaded.url,
        caption: caption || alt,
        credit,
        photographerName,
        copyrightText,
        isPermanentEditorialAsset: purpose === "inline",
        r2Key: uploaded.key.startsWith("infospot/") ? uploaded.key : null,
      },
    });

    if (purpose === "inline" && articleId) {
      const maxSort = await prisma.infoSpotArticleAsset.aggregate({
        where: { articleId, usageType: "INLINE" },
        _max: { sortOrder: true },
      });
      await prisma.infoSpotArticleAsset.create({
        data: {
          articleId,
          assetId: asset.id,
          usageType: "INLINE",
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
          captionOverride: caption,
        },
      });
    }

    return NextResponse.json(
      {
        asset: {
          id: asset.id,
          url: asset.url,
          caption: asset.caption,
          credit: asset.credit,
          alt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
