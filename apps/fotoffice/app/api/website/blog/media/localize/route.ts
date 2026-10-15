import { NextResponse } from "next/server";
import { requireBlogEditorApi } from "@/lib/blog/access";
import { countExternalBlogImages, localizeBlogImages } from "@/lib/blog/localize-images";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Cuántas imágenes del blog siguen en otro sitio. */
export async function GET() {
  const guard = await requireBlogEditorApi();
  if (guard.response) return guard.response;
  return NextResponse.json({ pendientes: await countExternalBlogImages(guard.ctx.workspace.id) });
}

/** Copia una tanda al almacenamiento de FOTOFFICE. El panel repite mientras queden. */
export async function POST() {
  const guard = await requireBlogEditorApi();
  if (guard.response) return guard.response;
  return NextResponse.json(await localizeBlogImages(guard.ctx.workspace.id, { limit: 12 }));
}
