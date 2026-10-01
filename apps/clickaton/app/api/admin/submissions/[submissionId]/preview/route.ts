/**
 * Vista previa de una entrega, para la organización.
 *
 * Las fotos viven en `clickaton/private/` y `/api/media` se niega a servir ese
 * namespace, con razón: son obras en concurso. Sin esta ruta la pantalla de
 * Envíos no puede mostrar ni una imagen, que es justo lo que hay que mirar
 * para admitir o rechazar.
 *
 * Los bytes se sirven acá, con sesión de administración y sin caché
 * compartida: no se publica ninguna URL permanente del original.
 */
import { NextResponse } from "next/server";
import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { getPrivateEntryStorage } from "@/lib/photo-upload/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

type Params = { params: Promise<{ submissionId: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasClickatonAdminAccess(user)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { submissionId } = await params;
  const submission = await prisma.clickatonPhotoSubmission.findUnique({
    where: { id: submissionId },
    select: { previewStorageKey: true, originalStorageKey: true },
  });
  if (!submission) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // El original sólo se sirve si no llegó a generarse la versión liviana.
  const preferirOriginal = new URL(request.url).searchParams.get("original") === "1";
  const key = preferirOriginal
    ? (submission.originalStorageKey ?? submission.previewStorageKey)
    : (submission.previewStorageKey ?? submission.originalStorageKey);
  if (!key) {
    return NextResponse.json({ ok: false, error: "ASSET_MISSING" }, { status: 404 });
  }

  try {
    const body = await getPrivateEntryStorage().get(key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForKey(key),
        // Material en concurso: ni CDN ni caché compartida.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "MEDIA_NOT_FOUND" }, { status: 404 });
  }
}
