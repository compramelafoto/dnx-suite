import "server-only";
import { NextResponse } from "next/server";
import { Role, prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { MosaicoError } from "@/lib/mosaico/curso";

/**
 * Permisos del «Mosaico del curso» en el panel: los mismos que el padrón (el fotógrafo dueño del
 * álbum), y además un ADMIN puede entrar a cualquier álbum.
 */
export async function accesoAlMosaico(
  idParam: string,
): Promise<{ ok: true; albumId: number; userId: number } | { ok: false; res: NextResponse }> {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
  if (error || !user) {
    return { ok: false, res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  const albumId = parseInt(idParam, 10);
  if (!Number.isInteger(albumId) || albumId <= 0) {
    return { ok: false, res: NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 }) };
  }
  const album = await prisma.album.findFirst({
    where: user.role === Role.ADMIN ? { id: albumId } : { id: albumId, userId: user.id },
    select: { id: true },
  });
  if (!album) {
    return { ok: false, res: NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 }) };
  }
  return { ok: true, albumId, userId: user.id };
}

export function respuestaDeError(e: unknown, donde: string) {
  if (e instanceof MosaicoError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(`${donde}:`, e);
  return NextResponse.json({ error: "No se pudo completar. Probá de nuevo en un rato." }, { status: 500 });
}
