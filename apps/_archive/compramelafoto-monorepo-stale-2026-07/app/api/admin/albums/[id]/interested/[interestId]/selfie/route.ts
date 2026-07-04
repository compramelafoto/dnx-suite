import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFromR2 } from "@/lib/r2-client";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/albums/[id]/interested/[interestId]/selfie
 * Servir selfie de un interesado (solo accesible por el admin del álbum)
 *
 * Headers de respuesta:
 * - Cache-Control: no-store (no cachear)
 * - Content-Type: image/jpeg (o el tipo detectado)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; interestId: string } | Promise<{ id: string; interestId: string }> }
) {
  try {
    const { id: albumIdParam, interestId: interestIdParam } = await Promise.resolve(params);
    const albumId = parseInt(albumIdParam, 10);
    const interestId = parseInt(interestIdParam, 10);

    if (!Number.isFinite(albumId) || !Number.isFinite(interestId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // Verificar autenticación
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo PHOTOGRAPHER, LAB_PHOTOGRAPHER o ADMIN pueden acceder
    if (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER && user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "No autorizado. Se requiere rol PHOTOGRAPHER, LAB_PHOTOGRAPHER o ADMIN." }, { status: 403 });
    }

    // Verificar que el álbum existe y que el usuario es el dueño
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, userId: true },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    // Verificar que el usuario es el dueño del álbum (o es ADMIN)
    if (album.userId !== user.id && user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "No autorizado. Solo el dueño del álbum puede ver los selfies." }, { status: 403 });
    }

    // Obtener el AlbumInterest con el selfieKey
    const interest = await prisma.albumInterest.findUnique({
      where: { id: interestId },
      select: {
        id: true,
        albumId: true,
        email: true,
        selfieKey: true,
        biometricDeletedAt: true,
      },
    });

    if (!interest) {
      return NextResponse.json({ error: "Interesado no encontrado" }, { status: 404 });
    }

    // Verificar que el interés pertenece al álbum
    if (interest.albumId !== albumId) {
      return NextResponse.json({ error: "El interés no pertenece a este álbum" }, { status: 400 });
    }

    // Verificar que tiene selfie y no fue eliminado
    if (!interest.selfieKey) {
      return NextResponse.json({ error: "Este interesado no tiene selfie registrado" }, { status: 404 });
    }

    if (interest.biometricDeletedAt) {
      return NextResponse.json({ error: "Los datos biométricos de este interesado fueron eliminados" }, { status: 410 });
    }

    try {
      // Leer el selfie desde R2
      const selfieBuffer = await readFromR2(interest.selfieKey);

      // Determinar content type basado en la extensión del key
      let contentType = "image/jpeg"; // Por defecto JPEG
      if (interest.selfieKey.toLowerCase().endsWith(".png")) {
        contentType = "image/png";
      } else if (interest.selfieKey.toLowerCase().endsWith(".webp")) {
        contentType = "image/webp";
      }

      // Devolver como stream con headers de seguridad
      // Convertir Buffer a Uint8Array para NextResponse
      return new NextResponse(new Uint8Array(selfieBuffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          // Prevenir que se descargue directamente (opcional, puede comentarse si se quiere permitir descarga)
          "Content-Disposition": "inline",
          // Headers de seguridad adicionales
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (r2Err: any) {
      console.error("Error leyendo selfie desde R2:", r2Err);
      return NextResponse.json(
        { error: "Error cargando selfie. El archivo puede no existir." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error en GET /api/admin/albums/[id]/interested/[interestId]/selfie:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
