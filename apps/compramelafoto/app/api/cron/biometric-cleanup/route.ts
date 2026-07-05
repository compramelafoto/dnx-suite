import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import { deleteFace } from "@/lib/faces/rekognition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Verificar autorización (solo cron interno o con secret)
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret || isVercelCron;
}

/**
 * GET /api/cron/biometric-cleanup
 * Limpia datos biométricos expirados (90 días desde el registro)
 * 
 * Elimina:
 * - FaceId de Rekognition
 * - Selfie de R2
 * - Actualiza DB (faceId=null, selfieKey=null, biometricDeletedAt=now)
 * 
 * NO elimina:
 * - Email
 * - WhatsApp
 * - Nombre
 * - Otros datos de contacto
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();

    // Buscar interesados con datos biométricos expirados
    const expiredInterests = await prisma.albumInterest.findMany({
      where: {
        expiresAt: { lt: now },
        faceId: { not: null },
        biometricDeletedAt: null, // Solo los que no fueron eliminados manualmente
      },
      select: {
        id: true,
        email: true,
        faceId: true,
        selfieKey: true,
        expiresAt: true,
      },
      take: 100, // Procesar máximo 100 a la vez para evitar timeouts
    });

    if (expiredInterests.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay datos biométricos expirados para limpiar",
        processed: 0,
        deleted: 0,
        errors: 0,
      });
    }

    let deleted = 0;
    let errors = 0;
    const errorDetails: Array<{ id: number; error: string }> = [];

    for (const interest of expiredInterests) {
      try {
        // 1. Eliminar faceId de Rekognition
        if (interest.faceId) {
          try {
            await deleteFace(interest.faceId);
            console.log(`FaceId eliminado de Rekognition para interés ${interest.id}:`, interest.faceId);
          } catch (rekErr: any) {
            console.warn(`Error eliminando faceId de Rekognition (puede que ya no exista):`, rekErr);
            // Continuar aunque falle (puede que ya no exista en Rekognition)
          }
        }

        // 2. Eliminar selfie de R2
        if (interest.selfieKey) {
          try {
            await deleteFromR2(interest.selfieKey);
            console.log(`Selfie eliminado de R2 para interés ${interest.id}:`, interest.selfieKey);
          } catch (r2Err: any) {
            console.warn(`Error eliminando selfie de R2 (puede que ya no exista):`, r2Err);
            // Continuar aunque falle (puede que ya no exista en R2)
          }
        }

        // 3. Actualizar DB (marcar como eliminado, mantener datos de contacto)
        await prisma.albumInterest.update({
          where: { id: interest.id },
          data: {
            faceId: null,
            selfieKey: null,
            biometricDeletedAt: now,
            // NO eliminar: email, whatsapp, name, etc.
          },
        });

        deleted++;
      } catch (err: any) {
        errors++;
        const errorMsg = String(err?.message || err);
        errorDetails.push({ id: interest.id, error: errorMsg });
        console.error(`Error procesando interés ${interest.id}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Procesados ${expiredInterests.length} interesados con datos biométricos expirados`,
      processed: expiredInterests.length,
      deleted,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    });
  } catch (err: any) {
    console.error("Error en biometric-cleanup:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
