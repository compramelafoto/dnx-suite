import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import { deleteFace } from "@/lib/faces/rekognition";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { Role } from "@prisma/client";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Verifica y decodifica un token de eliminación biométrica.
 * Formato: base64url(interestId:email:expiresAt:signature)
 */
function verifyBiometricDeletionToken(token: string): { interestId: number; email: string } | null {
  try {
    const secret = process.env.BIOMETRIC_DELETION_SECRET || process.env.CRON_SECRET || "default-secret-change-in-production";
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 4) return null;

    const signature = parts.pop()!;
    const payload = parts.join(":");
    const [interestIdStr, email, expiresAtStr] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Verificar expiración
    if (Date.now() > expiresAt) {
      return null; // Token expirado
    }

    // Verificar firma
    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (signature !== expectedSignature) {
      return null; // Firma inválida
    }

    const interestId = parseInt(interestIdStr, 10);
    if (!Number.isFinite(interestId) || !email) {
      return null;
    }

    return { interestId, email };
  } catch (err) {
    return null;
  }
}

/**
 * POST /api/interested/[id]/delete-biometric
 * Elimina datos biométricos de un interesado
 * 
 * Dos modos de acceso:
 * 1. Público: con token firmado (desde email)
 * 2. Admin: usuario autenticado que es dueño del álbum
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id: interestIdParam } = await Promise.resolve(params);
    const interestId = parseInt(interestIdParam, 10);

    if (!Number.isFinite(interestId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const token = body.token as string | undefined;

    // Rate limit para acceso público (por token)
    if (token) {
      const ip = getClientIp(req);
      const rate = checkRateLimit({ key: `delete-biometric:${ip}`, limit: 20, windowMs: 60 * 1000 });
      if (!rate.allowed) {
        return NextResponse.json({ error: "Demasiados intentos. Intentá de nuevo en un minuto." }, { status: 429 });
      }
    }

    let interest: { id: number; email: string; albumId: number; faceId: string | null; selfieKey: string | null; biometricDeletedAt: Date | null } | null = null;

    // Verificar acceso: token público o admin del álbum
    if (token) {
      // Modo público con token
      const tokenData = verifyBiometricDeletionToken(token);
      if (!tokenData || tokenData.interestId !== interestId) {
        return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
      }

      interest = await prisma.albumInterest.findUnique({
        where: { id: interestId },
        select: {
          id: true,
          email: true,
          albumId: true,
          faceId: true,
          selfieKey: true,
          biometricDeletedAt: true,
        },
      });

      if (!interest) {
        return NextResponse.json({ error: "Interesado no encontrado" }, { status: 404 });
      }

      // Verificar que el email del token coincide
      if (interest.email !== tokenData.email) {
        return NextResponse.json({ error: "Token inválido" }, { status: 401 });
      }
    } else {
      // Modo admin: verificar autenticación y permisos
      const user = await getAuthUser();
      if (!user) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }

      if (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER && user.role !== Role.ADMIN) {
        return NextResponse.json({ error: "No autorizado. Se requiere rol PHOTOGRAPHER, LAB_PHOTOGRAPHER o ADMIN." }, { status: 403 });
      }

      interest = await prisma.albumInterest.findUnique({
        where: { id: interestId },
        select: {
          id: true,
          email: true,
          albumId: true,
          faceId: true,
          selfieKey: true,
          biometricDeletedAt: true,
        },
        include: {
          album: {
            select: {
              userId: true,
            },
          },
        },
      } as any);

      if (!interest) {
        return NextResponse.json({ error: "Interesado no encontrado" }, { status: 404 });
      }

      const album = (interest as any).album;
      if (!album) {
        return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
      }

      // Verificar que el usuario es el dueño del álbum (o es ADMIN)
      if (album.userId !== user.id && user.role !== Role.ADMIN) {
        return NextResponse.json({ error: "No autorizado. Solo el dueño del álbum puede eliminar datos biométricos." }, { status: 403 });
      }
    }

    // Verificar que no esté ya eliminado
    if (interest.biometricDeletedAt) {
      return NextResponse.json({ error: "Los datos biométricos ya fueron eliminados" }, { status: 410 });
    }

    // Verificar que tenga datos biométricos
    if (!interest.faceId && !interest.selfieKey) {
      return NextResponse.json({ error: "Este interesado no tiene datos biométricos registrados" }, { status: 404 });
    }

    // Eliminar datos biométricos
    const errors: string[] = [];

    // 1. Eliminar faceId de Rekognition
    if (interest.faceId) {
      try {
        await deleteFace(interest.faceId);
        console.log("FaceId eliminado de Rekognition:", interest.faceId);
      } catch (rekErr: any) {
        console.error("Error eliminando faceId de Rekognition:", rekErr);
        errors.push(`Error eliminando de Rekognition: ${rekErr?.message || "Error desconocido"}`);
        // Continuar aunque falle (puede que ya no exista)
      }
    }

    // 2. Eliminar selfie de R2
    if (interest.selfieKey) {
      try {
        await deleteFromR2(interest.selfieKey);
        console.log("Selfie eliminado de R2:", interest.selfieKey);
      } catch (r2Err: any) {
        console.error("Error eliminando selfie de R2:", r2Err);
        errors.push(`Error eliminando selfie: ${r2Err?.message || "Error desconocido"}`);
        // Continuar aunque falle (puede que ya no exista)
      }
    }

    // 3. Actualizar DB (marcar como eliminado, pero mantener email/whatsapp)
    await prisma.albumInterest.update({
      where: { id: interestId },
      data: {
        faceId: null,
        selfieKey: null,
        biometricDeletedAt: new Date(),
        // NO eliminar: email, whatsapp, name, etc.
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Datos biométricos eliminados exitosamente",
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("Error en delete-biometric:", err);
    return NextResponse.json(
      { error: err?.message || "Error eliminando datos biométricos" },
      { status: 500 }
    );
  }
}
