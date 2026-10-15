import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError } from "@/lib/blog/admin-errors";
import { listAdminBlogMedia } from "@/lib/blog/admin-queries";
import { parseListLimit, parseUploadKind, trimOptionalFormValue } from "@/lib/blog/admin-utils";
import { blogWhere } from "@/lib/blog/scope";
import { uploadBlogImage } from "@/lib/blog/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — la biblioteca de imágenes del blog de la institución, la más nueva primero. */
export async function GET(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const { searchParams } = new URL(req.url);
  try {
    const media = await listAdminBlogMedia(ctx.workspace.id, {
      q: searchParams.get("q") ?? undefined,
      limit: parseListLimit(searchParams.get("limit"), 50),
    });
    return NextResponse.json({ media });
  } catch (err) {
    return handleBlogApiError(err, "la biblioteca");
  }
}

/**
 * POST — sube una imagen (FormData `file`, y `kind` = "hero" para la portada o "media" para la
 * biblioteca). Las dos quedan en la biblioteca: una portada también se puede reutilizar
 * adentro de otro artículo.
 */
export async function POST(req: NextRequest) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 });
  }

  const subida = await uploadBlogImage({
    workspaceId: ctx.workspace.id,
    kind: parseUploadKind(form.get("kind")),
    bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name || "imagen",
    mimeType: file.type,
    title: trimOptionalFormValue(form.get("title"), 200),
    altText: trimOptionalFormValue(form.get("altText"), 500),
  }).catch((err: unknown) => {
    console.error("[fotoffice][blog] subida de imagen:", err);
    return { ok: false as const, error: "No se pudo subir la imagen." };
  });
  // Los errores de la subida (formato, peso, medidas) ya vienen redactados para mostrar.
  if (!subida.ok) return NextResponse.json({ error: subida.error }, { status: 400 });

  try {
    // La fila completa, con la forma que espera la biblioteca del editor.
    const media = await prisma.blogMedia.findFirst({ where: { id: subida.id, ...blogWhere(ctx.workspace.id) } });
    return NextResponse.json({ media, url: subida.url, heroImageUrl: subida.url }, { status: 201 });
  } catch (err) {
    return handleBlogApiError(err, "la imagen");
  }
}
