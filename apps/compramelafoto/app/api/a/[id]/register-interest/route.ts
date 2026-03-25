import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2, generateR2Key, deleteFromR2 } from "@/lib/r2-client";
import { indexFaces } from "@/lib/faces/rekognition";
import { checkRateLimit } from "@/lib/rate-limit";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELFIE_MAX_BYTES = 300 * 1024; // 300KB
const SELFIE_QUALITY = 85;
const SELFIE_MAX_DIMENSION = 1024;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

async function compressSelfie(buffer: Buffer): Promise<Buffer> {
  let quality = SELFIE_QUALITY;
  let result: Buffer;

  do {
    result = await sharp(buffer)
      .rotate()
      .resize(SELFIE_MAX_DIMENSION, SELFIE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    quality -= 10;
  } while (result.length > SELFIE_MAX_BYTES && quality > 40);

  return result;
}

/**
 * POST /api/a/[id]/register-interest
 * Registrar interés en álbum con selfie opcional para reconocimiento facial
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit({ key: `register-interest:${albumId}:${ip}`, limit: 10, windowMs: 60 * 1000 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Demasiados intentos. Intentá de nuevo en un minuto." }, { status: 429 });
    }

    // Parsear FormData
    const formData = await req.formData();
    const name = formData.get("name")?.toString()?.trim() || "";
    const lastName = formData.get("lastName")?.toString()?.trim() || "";
    const whatsapp = formData.get("whatsapp")?.toString()?.trim() || "";
    const email = formData.get("email")?.toString()?.trim().toLowerCase() || "";
    const selfieFile = formData.get("selfie") as File | null;
    const termsAccepted = formData.get("termsAccepted") === "true";
    const biometricConsent = formData.get("biometricConsent") === "true";

    // Validaciones básicas
    if (!name) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }
    if (!whatsapp) {
      return NextResponse.json({ error: "WhatsApp es requerido" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Email es requerido" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    if (!termsAccepted) {
      return NextResponse.json({ error: "Debés aceptar los Términos y Condiciones" }, { status: 400 });
    }

    // Si hay selfie, validar consentimiento biométrico
    if (selfieFile && !biometricConsent) {
      return NextResponse.json({ error: "Si subís una selfie, debés aceptar el consentimiento biométrico" }, { status: 400 });
    }

    // Verificar que el álbum existe
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, userId: true },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    let selfieKey: string | null = null;
    let faceId: string | null = null;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 días desde ahora

    // Si hay selfie, procesarlo
    if (selfieFile && biometricConsent) {
      // Convertir File a Buffer y validar
      const arrayBuffer = await selfieFile.arrayBuffer();
      let selfieBuffer = Buffer.from(arrayBuffer);

      if (!selfieFile.type.startsWith("image/")) {
        return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
      }
      if (selfieBuffer.length > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "La selfie no puede superar 5MB" }, { status: 400 });
      }

      try {
        selfieBuffer = Buffer.from(await compressSelfie(selfieBuffer));
      } catch (compressErr: any) {
        console.warn("Error comprimiendo selfie, usando original:", compressErr?.message);
      }

      const originalName = selfieFile.name || "selfie.jpg";
      selfieKey = generateR2Key(originalName.replace(/\.[^.]+$/, ".jpg"), "selfies");

      // Subir selfie a R2
      try {
        await uploadToR2(selfieBuffer, selfieKey, "image/jpeg");
      } catch (uploadErr: any) {
        console.error("Error subiendo selfie a R2:", uploadErr);
        return NextResponse.json({ error: "Error guardando la selfie. Intentá de nuevo." }, { status: 500 });
      }

      // Indexar cara en Rekognition (si falla, continuar sin biometría)
      try {
        // Rekognition solo permite [a-zA-Z0-9_.\-:] en ExternalImageId; sanitizar email
        const safeEmail = email.replace(/[^a-zA-Z0-9_.\-:]/g, "_");
        const externalImageId = `interest_${albumId}_${safeEmail}`;
        const faceResults = await indexFaces({
          imageBytes: new Uint8Array(selfieBuffer),
          externalImageId,
        });

        if (faceResults.length > 0) {
          faceId = faceResults[0].rekognitionFaceId;
        } else {
          console.warn(`No se detectó cara en selfie de ${email} para álbum ${albumId}`);
        }
      } catch (rekErr: any) {
        console.warn(`Rekognition falló para selfie de ${email} álbum ${albumId}:`, rekErr?.message);
        // No fallar: registrar interesado sin biometría; selfie queda en R2 para revisión manual
        faceId = null;
      }
    }

    // Crear o actualizar AlbumInterest
    try {
      const interest = await prisma.albumInterest.upsert({
        where: {
          albumId_email: {
            albumId,
            email,
          },
        },
        update: {
          name: name,
          firstName: name,
          lastName: lastName || null,
          whatsapp: whatsapp,
          // Solo actualizar campos biométricos si hay selfie y consentimiento
          ...(selfieFile && biometricConsent
            ? {
                biometricConsent: true,
                biometricConsentAt: now,
                biometricDeletedAt: null, // Si había sido eliminado, reactivar
                selfieKey: selfieKey,
                faceId: faceId,
                expiresAt: expiresAt,
              }
            : {}),
        },
        create: {
          albumId,
          email,
          name: name,
          firstName: name,
          lastName: lastName || null,
          whatsapp: whatsapp,
          biometricConsent: selfieFile && biometricConsent ? true : false,
          biometricConsentAt: selfieFile && biometricConsent ? now : null,
          selfieKey: selfieKey,
          faceId: faceId,
          expiresAt: expiresAt,
        },
      });

      // También crear AlbumNotification para compatibilidad con el sistema existente
      try {
        await prisma.albumNotification.upsert({
          where: {
            albumId_email: {
              albumId,
              email,
            },
          },
          update: {
            name: name,
            lastName: lastName || null,
            whatsapp: whatsapp || null,
          },
          create: {
            albumId,
            email,
            name: name,
            lastName: lastName || null,
            whatsapp: whatsapp || null,
            notifiedWhenReady: false,
            notifiedAt3Weeks: false,
            notifiedAt2Weeks: false,
            notifiedAt1Week: false,
          },
        });
      } catch (notifErr: any) {
        // Si falla por campos desconocidos, continuar (es opcional)
        console.warn("Error creando AlbumNotification:", notifErr);
      }

      return NextResponse.json({
        ok: true,
        message: selfieFile && faceId
          ? "Registro exitoso. Te avisaremos automáticamente cuando aparezcan tus fotos."
          : "Registro exitoso. Te avisaremos cuando las fotos estén disponibles.",
        interestId: interest.id,
        hasBiometric: !!faceId,
      });
    } catch (dbErr: any) {
      if (selfieKey) {
        try {
          await deleteFromR2(selfieKey);
          console.warn("Selfie eliminado de R2 tras fallo en DB, key:", selfieKey);
        } catch (cleanupErr) {
          console.error("Error limpiando selfie tras fallo DB:", cleanupErr);
        }
      }
      throw dbErr;
    }
  } catch (err: any) {
    console.error("Error en register-interest:", err);
    return NextResponse.json(
      { error: err?.message || "Error registrando interés" },
      { status: 500 }
    );
  }
}
