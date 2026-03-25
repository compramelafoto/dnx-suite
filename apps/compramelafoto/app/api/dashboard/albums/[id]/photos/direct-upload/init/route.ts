import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ensureAlbumUploadAccess, ensureMpConnected } from "../../upload-helpers";
import { generateR2Key, getSignedPutUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = process.env.MAX_FILE_SIZE
  ? parseInt(process.env.MAX_FILE_SIZE)
  : 10 * 1024 * 1024;
const MAX_MB = Math.round(MAX_BYTES / 1024 / 1024);
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const mpCheck = await ensureMpConnected(user);
    if (!mpCheck.ok) {
      return NextResponse.json({ error: mpCheck.error }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const contentType = String(body?.contentType || "").toLowerCase();
    const size = Number(body?.size || 0);

    if (!name || !contentType || !size) {
      return NextResponse.json({ error: "Faltan datos del archivo" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
    }

    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${MAX_MB}MB.` },
        { status: 400 }
      );
    }

    const key = generateR2Key(name, `albums/${albumId}/raw`);
    const uploadUrl = await getSignedPutUrl(key, contentType, 900);

    return NextResponse.json({ uploadUrl, key, maxMb: MAX_MB }, { status: 200 });
  } catch (err: any) {
    console.error("POST direct-upload init ERROR >>>", err);
    return NextResponse.json(
      { error: "Error generando URL de subida", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
