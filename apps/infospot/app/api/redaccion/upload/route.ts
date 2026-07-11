import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getAuthUser } from "@/lib/auth";
import { uploadInfoSpotCover, validateInfoSpotImageFile } from "@/lib/storage";

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

  const caption = String(formData.get("caption") ?? "").trim() || null;
  const credit = String(formData.get("credit") ?? "").trim() || null;
  const photographerName = String(formData.get("photographerName") ?? "").trim() || null;
  const copyrightText = String(formData.get("copyrightText") ?? "").trim() || null;

  try {
    const uploaded = await uploadInfoSpotCover(file);
    const asset = await prisma.infoSpotEditorialAsset.create({
      data: {
        sourceType: "UPLOAD",
        url: uploaded.url,
        thumbnailUrl: uploaded.url,
        caption,
        credit,
        photographerName,
        copyrightText,
        isPermanentEditorialAsset: false,
      },
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
