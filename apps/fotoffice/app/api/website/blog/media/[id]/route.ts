import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { parseRouteId, requireBlogEditorApi } from "@/lib/blog/access";
import { handleBlogApiError, idInvalido } from "@/lib/blog/admin-errors";
import { readOptionalText, stripClientScope } from "@/lib/blog/admin-utils";
import { blogWhere } from "@/lib/blog/scope";
import { deleteFotofficeR2Object } from "@/lib/images/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const noEncontrada = () => NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });

const CAMPOS_DE_TEXTO = [
  { field: "title", max: 200 },
  { field: "altText", max: 500 },
  { field: "caption", max: 1000 },
] as const;

/** PATCH — título, texto alternativo y epígrafe de una imagen de la biblioteca. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const id = parseRouteId((await params).id);
  if (!id) return idInvalido();

  const body = stripClientScope(await req.json().catch(() => ({})));
  const data: Record<string, string | null> = {};
  for (const { field, max } of CAMPOS_DE_TEXTO) {
    const leido = readOptionalText(body, field, max);
    if (!leido.ok) {
      return NextResponse.json({ error: `El campo "${leido.field}" tiene que ser texto.` }, { status: 400 });
    }
    if (leido.value !== undefined) data[field] = leido.value;
  }

  try {
    const where = { id, ...blogWhere(ctx.workspace.id) };
    const updated = await prisma.blogMedia.updateMany({ where, data });
    if (updated.count === 0) return noEncontrada();
    return NextResponse.json({ media: await prisma.blogMedia.findFirst({ where }) });
  } catch (err) {
    return handleBlogApiError(err, "la imagen");
  }
}

/**
 * DELETE — saca la imagen de la biblioteca y, si se puede, borra el archivo.
 *
 * Primero la fila y después el archivo: si el almacenamiento falla queda un archivo huérfano
 * (cuesta centavos), mientras que al revés quedaría en la biblioteca una imagen rota. Los
 * artículos que ya la usan conservan la dirección copiada en su contenido, así que borrar una
 * imagen en uso la rompe en esos artículos: es lo mismo que pasa en Clickatón.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { ctx, response } = await requireBlogEditorApi();
  if (!ctx) return response;

  const id = parseRouteId((await params).id);
  if (!id) return idInvalido();

  try {
    const where = { id, ...blogWhere(ctx.workspace.id) };
    const media = await prisma.blogMedia.findFirst({ where, select: { r2Key: true } });
    if (!media) return noEncontrada();

    await prisma.blogMedia.deleteMany({ where });

    if (media.r2Key) {
      const borrado = await deleteFotofficeR2Object(media.r2Key).catch((err: unknown) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      }));
      if (!borrado.ok) console.error("[fotoffice][blog] no se pudo borrar el archivo de R2:", media.r2Key, borrado.error);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleBlogApiError(err, "la imagen");
  }
}
