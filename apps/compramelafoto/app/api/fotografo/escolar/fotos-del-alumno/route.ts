import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puedeUsarPackDePrueba } from "@/lib/canje-externo/reiniciar-pack-de-prueba";
import { searchFacesByFaceId } from "@/lib/faces/rekognition";
import { fotosDelAlumno } from "@/lib/faces/fotos-del-alumno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET `?albumId=&photoId=&detectionId=`: las fotos del álbum donde aparece el chico que el
 * fotógrafo tocó (canje en modo fotógrafo). Sólo el dueño del álbum (o un admin).
 *
 * - Foto con varias caras y sin `detectionId` → `{ caras: [{ detectionId, bbox }] }` para elegir.
 * - Una cara, o `detectionId` → `{ photoIds }`, con la foto tocada primero.
 * - Sin caras → `{ photoIds: [photoId], aviso }`.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const albumId = Number(sp.get("albumId"));
  const photoId = Number(sp.get("photoId"));
  const detectionId = sp.get("detectionId") ? Number(sp.get("detectionId")) : null;
  if (!Number.isInteger(albumId) || !Number.isInteger(photoId)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const viewer = await getAuthUser().catch(() => null);
  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { userId: true } });
  if (!album || !puedeUsarPackDePrueba(viewer, album.userId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const foto = await prisma.photo.findFirst({
    where: { id: photoId, albumId, isRemoved: false },
    select: { id: true, faceDetections: { select: { id: true, rekognitionFaceId: true, bbox: true }, orderBy: { id: "asc" } } },
  });
  if (!foto) return NextResponse.json({ error: "Esa foto no es de este álbum" }, { status: 404 });

  const caras = foto.faceDetections;
  if (caras.length === 0) {
    return NextResponse.json({ photoIds: [photoId], aviso: "No encontramos caras en esta foto. Probá con otra." });
  }
  const cara = detectionId != null ? caras.find((c) => c.id === detectionId) : caras.length === 1 ? caras[0] : null;
  if (!cara) {
    return NextResponse.json({ caras: caras.map((c) => ({ detectionId: c.id, bbox: c.bbox })) });
  }

  try {
    const matches = await searchFacesByFaceId(cara.rekognitionFaceId);
    const ids = matches.map((m) => m.rekognitionFaceId);
    const detecciones = ids.length
      ? await prisma.faceDetection.findMany({
          where: { rekognitionFaceId: { in: ids }, photo: { albumId, isRemoved: false } },
          select: { rekognitionFaceId: true, photoId: true },
        })
      : [];
    const photoIds = fotosDelAlumno(
      { photoId },
      matches.map((m) => ({ faceId: m.rekognitionFaceId, similarity: m.similarity ?? 0 })),
      detecciones,
      new Set(detecciones.map((d) => d.photoId).concat(photoId)),
    );
    return NextResponse.json({ photoIds });
  } catch (err) {
    console.error("[fotos-del-alumno] search_failed", { albumId, photoId, err });
    return NextResponse.json(
      { error: "No pudimos buscar por la cara en este momento. Elegí mirando la galería completa." },
      { status: 502 }
    );
  }
}
