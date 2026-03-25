import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

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
 * Genera un token firmado para eliminación de datos biométricos
 * Válido por 24 horas
 */
function generateBiometricDeletionToken(interestId: number, email: string): string {
  const secret = process.env.BIOMETRIC_DELETION_SECRET || process.env.CRON_SECRET || "default-secret-change-in-production";
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
  const payload = `${interestId}:${email}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

/** Token para acceder directo a fotos filtradas por rostro (link en email) */
function generateFacePhotosToken(interestId: number, albumId: number): string {
  const secret = process.env.BIOMETRIC_DELETION_SECRET || process.env.CRON_SECRET || "default-secret-change-in-production";
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 días
  const payload = `fotos:${interestId}:${albumId}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

/**
 * Genera el HTML del email de notificación de match facial
 */
function generateFaceMatchEmailHtml(
  albumTitle: string,
  albumSlug: string,
  albumId: number,
  matchesCount: number,
  deletionToken: string,
  facePhotosToken: string,
  userName?: string
): string {
  const appUrl = process.env.APP_URL || "https://compramelafoto.com";
  // Link directo a fotos filtradas por rostro (el cliente carga con ?fotos=1&t=TOKEN)
  const albumUrl = `${appUrl}/a/${albumSlug}?fotos=1&t=${facePhotosToken}`;
  const deletionUrl = `${appUrl}/delete-biometric?token=${deletionToken}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
    <h1 style="color: #1a1a1a; margin-bottom: 20px;">¡Encontramos tus fotos! 📸</h1>
    
    <p>Hola${userName ? ` ${userName}` : ""},</p>
    
    <p>¡Buenas noticias! Detectamos que aparecés en ${matchesCount} ${matchesCount === 1 ? "foto" : "fotos"} del álbum <strong>"${albumTitle}"</strong>.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${albumUrl}" style="background-color: #c27b3d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Ver mis fotos
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">
      O copiá y pegá este enlace en tu navegador:<br>
      <a href="${albumUrl}" style="color: #c27b3d; word-break: break-all;">${albumUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #6b7280;">
      <strong>¿Querés eliminar tus datos biométricos?</strong><br>
      Si ya no querés recibir estas notificaciones automáticas, podés eliminar tu selfie y datos de reconocimiento facial haciendo clic en el siguiente enlace:
    </p>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${deletionUrl}" style="color: #ef4444; text-decoration: underline; font-size: 14px;">
        Eliminar reconocimiento facial
      </a>
    </div>
    
    <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
      Este enlace expirará en 24 horas. Tus datos biométricos se eliminarán automáticamente después de 90 días desde el registro.
    </p>
    
    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
      Saludos,<br>
      El equipo de ComprameLaFoto
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * GET /api/internal/face-matching/notify
 * Procesa FaceMatchEvent pendientes y envía notificaciones por email
 * 
 * Este endpoint debe ser llamado periódicamente (cron) o después de crear matches
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener matches pendientes de notificación (agrupados por interesado para evitar spam)
    const pendingMatches = await prisma.faceMatchEvent.findMany({
      where: {
        notifiedAt: null,
      },
      include: {
        albumInterest: {
          include: {
            album: {
              select: {
                id: true,
                title: true,
                publicSlug: true,
              },
            },
          },
        },
        photo: {
          select: {
            id: true,
            albumId: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 100, // Procesar máximo 100 a la vez
    });

    if (pendingMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay matches pendientes de notificación",
        processed: 0,
      });
    }

    // Agrupar matches por interesado y álbum para enviar un solo email por interesado/álbum
    const matchesByInterest = new Map<
      number,
      Array<typeof pendingMatches[0] & { album: { id: number; title: string; publicSlug: string } }>
    >();

    for (const match of pendingMatches) {
      const interest = match.albumInterest as any;
      if (!interest || interest.biometricDeletedAt || !interest.expiresAt || new Date(interest.expiresAt) < new Date()) {
        continue; // Saltar si el interesado eliminó biometría o expiró
      }

      const album = (interest.album as any) || match.albumInterest.album;
      if (!album) continue;

      if (!matchesByInterest.has(interest.id)) {
        matchesByInterest.set(interest.id, []);
      }
      matchesByInterest.get(interest.id)!.push({
        ...match,
        album: {
          id: album.id,
          title: album.title,
          publicSlug: album.publicSlug,
        },
      } as any);
    }

    let notified = 0;
    let errors = 0;

    // Enviar email a cada interesado (solo 1 vez: si ya notificamos antes, no reenviar)
    for (const [interestId, matches] of matchesByInterest.entries()) {
      if (matches.length === 0) continue;

      const firstMatch = matches[0];
      const interest = firstMatch.albumInterest as any;
      const album = firstMatch.album;

      try {
        // Si ya notificamos a este interesado antes, no enviar otro email - solo marcar matches como notificados
        const interestWithLastNotified = await prisma.albumInterest.findUnique({
          where: { id: interest.id },
          select: { lastNotifiedAt: true },
        });
        const alreadyNotified = !!interestWithLastNotified?.lastNotifiedAt;

        if (alreadyNotified) {
          // Marcar matches como notificados sin enviar otro email
          const matchIds = matches.map((m) => m.id);
          await prisma.faceMatchEvent.updateMany({
            where: { id: { in: matchIds } },
            data: { notifiedAt: new Date() },
          });
          notified += matches.length;
          continue;
        }

        const deletionToken = generateBiometricDeletionToken(interest.id, interest.email);
        const facePhotosToken = generateFacePhotosToken(interest.id, album.id);

        const emailHtml = generateFaceMatchEmailHtml(
          album.title,
          album.publicSlug,
          album.id,
          matches.length,
          deletionToken,
          facePhotosToken,
          interest.name || interest.firstName || undefined
        );

        const emailResult = await sendEmail({
          to: interest.email,
          subject: `¡Encontramos tus fotos en "${album.title}"!`,
          html: emailHtml,
          text: `¡Encontramos tus fotos! Detectamos que aparecés en ${matches.length} ${matches.length === 1 ? "foto" : "fotos"} del álbum "${album.title}". Ver tus fotos (ya filtradas): ${process.env.APP_URL || "https://compramelafoto.com"}/a/${album.publicSlug}?fotos=1&t=${facePhotosToken}`,
        });

        if (emailResult.success) {
          const matchIds = matches.map((m) => m.id);
          await prisma.faceMatchEvent.updateMany({
            where: {
              id: { in: matchIds },
            },
            data: {
              notifiedAt: new Date(),
            },
          });

          // Actualizar lastNotifiedAt en AlbumInterest
          await prisma.albumInterest.update({
            where: { id: interest.id },
            data: { lastNotifiedAt: new Date() },
          });

          notified += matches.length;
        } else {
          console.error("Error enviando email de match:", emailResult.error);
          errors += matches.length;
        }
      } catch (err: any) {
        console.error("Error procesando matches para interesado:", {
          interestId,
          error: String(err?.message || err),
        });
        errors += matches.length;
      }
    }

    return NextResponse.json({
      ok: true,
      processed: pendingMatches.length,
      notified,
      errors,
      message: `Procesados ${pendingMatches.length} matches, ${notified} notificados, ${errors} errores`,
    });
  } catch (err: any) {
    console.error("Error en face-matching/notify:", err);
    return NextResponse.json(
      { error: err?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
