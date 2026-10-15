/**
 * Acceso al panel "Canjes": la dueña del álbum o un administrador. Tiene teléfonos de
 * familias y genera links que regalan fotos, así que nadie más lo puede ver.
 */

import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];

export async function requireAlbumOwnerOrAdmin(
  rawAlbumId: string | undefined
): Promise<{ ok: true; albumId: number } | { ok: false; response: NextResponse }> {
  const { error, user } = await requireAuth([
    Role.PHOTOGRAPHER,
    Role.LAB_PHOTOGRAPHER,
    ...ADMIN_ROLES,
  ]);
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) };
  }
  const albumId = Number.parseInt(String(rawAlbumId ?? ""), 10);
  if (!Number.isFinite(albumId) || albumId <= 0) {
    return { ok: false, response: NextResponse.json({ error: "Álbum inválido" }, { status: 400 }) };
  }
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { userId: true, deletedAt: true },
  });
  if (!album || album.deletedAt) {
    return { ok: false, response: NextResponse.json({ error: "No encontrado" }, { status: 404 }) };
  }
  if (album.userId !== user.id && !ADMIN_ROLES.includes(user.role as Role)) {
    return { ok: false, response: NextResponse.json({ error: "Este álbum no es tuyo" }, { status: 403 }) };
  }
  return { ok: true, albumId };
}
