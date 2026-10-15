/**
 * Descarga del original de una entrega, para la organización.
 *
 * Con R2 redirige a una URL firmada de 5 minutos: el original suele pesar más
 * que el tope de respuesta de una función de Vercel (4,5 MB) y no puede pasar
 * por acá. En disco local (desarrollo) sirve los bytes directamente.
 *
 * El archivo se llama como la persona, la edición y la consigna, para que una
 * carpeta de descargas se entienda sola.
 */
import { NextResponse } from "next/server";
import { getClickatonAuthUser, hasClickatonAdminAccess } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { nombreDeArchivoSeguro } from "@/lib/photo-upload/presign";
import { getPrivateEntryStorage } from "@/lib/photo-upload/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ submissionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  if (!hasClickatonAdminAccess(user)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { submissionId } = await params;
  const envio = await prisma.clickatonPhotoSubmission.findUnique({
    where: { id: submissionId },
    select: {
      originalStorageKey: true,
      previewStorageKey: true,
      registration: { select: { firstName: true, lastName: true, visibleCode: true } },
      edition: { select: { slug: true } },
      prompt: { select: { sequence: true } },
    },
  });
  if (!envio) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const key = envio.originalStorageKey ?? envio.previewStorageKey;
  if (!key) return NextResponse.json({ ok: false, error: "ASSET_MISSING" }, { status: 404 });

  const extension = key.split(".").pop()?.toLowerCase() || "jpg";
  const nombre = nombreDeArchivoSeguro(
    [
      envio.registration.lastName,
      envio.registration.firstName,
      envio.edition.slug,
      `consigna-${envio.prompt.sequence}`,
    ].join("-") + `.${extension}`,
  );

  const storage = getPrivateEntryStorage();
  const firmada = storage.presignDownload?.(key, nombre) ?? null;
  if (firmada) return NextResponse.redirect(firmada, 302);

  try {
    const body = await storage.get(key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "MEDIA_NOT_FOUND" }, { status: 404 });
  }
}
