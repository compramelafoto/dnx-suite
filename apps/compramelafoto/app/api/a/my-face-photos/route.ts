import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifica el token de fotos filtradas por rostro
 * Token: fotos:interestId:albumId:expiresAt:signature
 */
function verifyFacePhotosToken(token: string): { interestId: number; albumId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 5 || parts[0] !== "fotos") return null;

    const [, interestIdStr, albumIdStr, expiresAtStr, signature] = parts;
    const interestId = parseInt(interestIdStr, 10);
    const albumId = parseInt(albumIdStr, 10);
    const expiresAt = parseInt(expiresAtStr, 10);

    if (!Number.isFinite(interestId) || !Number.isFinite(albumId) || !Number.isFinite(expiresAt)) {
      return null;
    }
    if (Date.now() > expiresAt) return null;

    const secret = process.env.BIOMETRIC_DELETION_SECRET || process.env.CRON_SECRET || "default-secret-change-in-production";
    const payload = `fotos:${interestId}:${albumId}:${expiresAt}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (signature !== expectedSig) return null;

    return { interestId, albumId };
  } catch {
    return null;
  }
}

/**
 * GET /api/a/my-face-photos?t=TOKEN
 * Devuelve los IDs de fotos que coinciden con el rostro del interesado (token del email)
 */
export async function GET(req: NextRequest) {
  try {
    const t = req.nextUrl.searchParams.get("t");
    if (!t) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const parsed = verifyFacePhotosToken(t);
    if (!parsed) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }

    const { interestId, albumId } = parsed;

    // Verificar que el interesado existe y pertenece al álbum
    const interest = await prisma.albumInterest.findFirst({
      where: {
        id: interestId,
        albumId,
        biometricDeletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });

    if (!interest) {
      return NextResponse.json({ error: "Acceso no válido" }, { status: 403 });
    }

    // Obtener photoIds de FaceMatchEvent para este interesado en este álbum
    const matches = await prisma.faceMatchEvent.findMany({
      where: {
        albumInterestId: interestId,
        photo: {
          albumId,
          isRemoved: false,
        },
      },
      select: { photoId: true },
    });

    const photoIds = [...new Set(matches.map((m) => m.photoId))];

    return NextResponse.json({ photoIds });
  } catch (err: any) {
    console.error("Error en my-face-photos:", err);
    return NextResponse.json(
      { error: "Error obteniendo fotos" },
      { status: 500 }
    );
  }
}
