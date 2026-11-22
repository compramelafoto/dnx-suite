import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { previewAlbumStory } from "@/lib/social/album-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vista previa de una historia de un álbum: `?albumId=…&modelo=0…19&historia=1…3`. Devuelve el JPEG tal
 * como saldría, sin subirlo ni guardar nada. Solo admin.
 */
export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 });
  const albumId = Number(req.nextUrl.searchParams.get("albumId"));
  const modelo = Number(req.nextUrl.searchParams.get("modelo") ?? "0");
  const historia = Number(req.nextUrl.searchParams.get("historia") ?? "1");
  if (!Number.isInteger(albumId) || !Number.isInteger(modelo) || !Number.isInteger(historia)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  try {
    const bytes = await previewAlbumStory(albumId, modelo, historia);
    if (!bytes) return NextResponse.json({ error: "El álbum no tiene fotos suficientes" }, { status: 404 });
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    console.error("[social] vista previa falló", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "No se pudo armar la vista previa" }, { status: 500 });
  }
}
