import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { HIDDEN_ALBUM_GRANT_COOKIE, resolveHiddenAlbumVisitorAccess } from "@/lib/hidden-album-audit";
import { leerAlumno } from "@/lib/compra-directa/compra-directa";
import { valoresDelLibritoComprado } from "@/lib/compra-directa/disenos-al-pagar";
import { colegioDelAlbum } from "@/lib/compra-directa/cursos-del-album";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Textos de la vista previa del librito en la compra directa (alumno, curso, colegio y listado
 * del curso): los mismos que va a llevar el diseño al aprobarse el pago.
 *
 * El listado trae los nombres de los compañeros, así que en un álbum con fotos ocultas sólo se
 * responde a quien ya pasó la selfie (o al fotógrafo).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumId = Number.parseInt(id, 10);
  if (!Number.isFinite(albumId)) return NextResponse.json({ error: "Álbum inválido" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit({ key: `llevar-valores:${albumId}:${ip}`, limit: 60, windowMs: 10 * 60 * 1000 }).allowed) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Probá en un rato." }, { status: 429 });
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      userId: true,
      deletedAt: true,
      hiddenPhotosEnabled: true,
      school: { select: { name: true, logoUrl: true } },
      user: { select: { name: true } },
    },
  });
  if (!album || album.deletedAt) return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });

  if (album.hiddenPhotosEnabled) {
    const viewer = await getAuthUser().catch(() => null);
    const esDelFotografo = viewer != null && (viewer.id === album.userId || viewer.role === "ADMIN");
    if (!esDelFotografo) {
      const grant = await resolveHiddenAlbumVisitorAccess(
        album.id,
        (await cookies()).get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null,
        prisma
      );
      if (!grant.hasGrant) return NextResponse.json({ error: "Primero verificá con la selfie." }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const alumno = leerAlumno(body?.alumno);
  const colegio = await colegioDelAlbum(album.id, album.school);
  const values = await valoresDelLibritoComprado({
    albumId: album.id,
    alumno,
    buyerName: typeof body?.buyerName === "string" ? body.buyerName.slice(0, 80) : null,
    schoolName: colegio.name,
    schoolLogoUrl: colegio.logoUrl,
    photographerName: album.user?.name,
  });
  return NextResponse.json({ values });
}
