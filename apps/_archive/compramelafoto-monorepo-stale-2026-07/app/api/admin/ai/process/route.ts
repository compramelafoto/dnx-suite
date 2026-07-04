import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2ObjectMetadata, readFromR2 } from "@/lib/r2-client";
import { extractOcrTokensFromImage } from "@/lib/ocr/googleVision";
import { indexFaces } from "@/lib/faces/rekognition";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // 13.3 minutos máximo (igual que /api/internal/analysis/run)

const BATCH_SIZE = 5; // Reducido de 10 a 5 para evitar timeouts con APIs lentas
const MAX_ATTEMPTS = 3;

/**
 * POST /api/admin/ai/process
 * 
 * Endpoint para ejecutar el procesamiento de análisis de fotos
 * Solo accesible por ADMIN
 * 
 * Este endpoint ejecuta directamente la lógica de análisis (mismo código que /api/internal/analysis/run)
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const debugChecks: Array<Record<string, unknown>> = [];

    const now = new Date();
    
    // Crear jobs para fotos sin análisis (excluyendo las marcadas como excluidas)
    const missingPhotos = await prisma.photo.findMany({
      where: { 
        analysisJob: null, 
        isRemoved: false,
        // Excluir fotos que fueron marcadas como excluidas del procesamiento
        NOT: {
          OR: [
            { analysisError: { contains: "excluida del procesamiento automático" } },
            { analysisError: { contains: "Error en análisis - excluida del procesamiento automático" } },
            { analysisError: { contains: "Pendiente excluida del procesamiento automático" } },
          ],
        },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });
    if (missingPhotos.length > 0) {
      await prisma.photoAnalysisJob.createMany({
        data: missingPhotos.map((p) => ({
          photoId: p.id,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
      await prisma.photo.updateMany({
        where: { id: { in: missingPhotos.map((p) => p.id) } },
        data: { analysisStatus: "PENDING", analysisError: null },
      });
    }

    // Obtener jobs pendientes
    const jobs = await prisma.photoAnalysisJob.findMany({
      where: {
        status: "PENDING",
        OR: [{ runAfter: null }, { runAfter: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      include: {
        photo: {
          select: {
            id: true,
            albumId: true,
            originalKey: true,
            previewUrl: true,
          },
        },
      },
    });

    if (!jobs.length) {
      return NextResponse.json({ ok: true, processed: 0, backfilled: missingPhotos.length });
    }

    const jobIds = jobs.map((j) => j.id);
    await prisma.photoAnalysisJob.updateMany({
      where: { id: { in: jobIds }, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: now },
    });

    let processed = 0;
    const errors: Array<{ jobId: number; photoId: number; error: string }> = [];

    for (const job of jobs) {
      const photo = job.photo;
      
      // Asegurar que siempre se actualice el estado, incluso si hay un error no capturado
      let jobCompleted = false;
      const photoId = job.photoId;
      
      try {
        if (!photo?.originalKey) {
          await prisma.photoAnalysisJob.update({
            where: { id: job.id },
            data: {
              status: "ERROR",
              lastError: "Foto sin originalKey",
              lockedAt: null,
            },
          });
          await prisma.photo.update({
            where: { id: photoId },
            data: { analysisStatus: "ERROR", analysisError: "Foto sin originalKey" },
          });
          jobCompleted = true;
          continue;
        }
        await prisma.photo.update({
          where: { id: photo.id },
          data: { analysisStatus: "PROCESSING", analysisError: null },
        });

        const r2Metadata = await getR2ObjectMetadata(photo.originalKey).catch(() => null);
        const imageBuffer = await readFromR2(photo.originalKey);

        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error("Imagen vacía o no se pudo leer desde R2");
        }

        const firstBytes = imageBuffer?.slice(0, 12)?.toString("hex");
        const looksLikeText = imageBuffer?.[0] === 0x3c; // "<"
        const textPreview = looksLikeText ? imageBuffer?.slice(0, 80)?.toString("utf8") : undefined;

        const r2Check = {
          key: photo.originalKey,
          jobId: job.id,
          photoId: photo.id,
          contentType: r2Metadata?.contentType ?? null,
          size: r2Metadata?.size ?? null,
          isBuffer: Buffer.isBuffer(imageBuffer),
          length: imageBuffer?.length,
          firstBytes,
          textPreview,
        };

        console.log("R2 IMAGE CHECK", r2Check);
        if (debug) {
          debugChecks.push(r2Check);
        }

        // Validar y normalizar la imagen usando Sharp antes de procesar
        // Convertir a JPEG ayuda a "sanar" imágenes parcialmente corruptas
        let normalizedBuffer: Buffer;
        let imageFormat: string | undefined;
        
        try {
          console.log("Starting image validation", {
            photoId: photo.id,
            originalSize: imageBuffer.length,
            contentType: r2Metadata?.contentType,
            firstBytes: firstBytes?.substring(0, 24),
          });
          
          const image = sharp(imageBuffer);
          const metadata = await image.metadata();
          
          console.log("Image metadata retrieved", {
            photoId: photo.id,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            hasProfile: !!metadata.icc,
            hasOrientation: !!metadata.orientation,
          });
          
          if (!metadata.width || !metadata.height) {
            throw new Error(`Imagen inválida: sin dimensiones (width: ${metadata.width}, height: ${metadata.height})`);
          }

          imageFormat = metadata.format;
          
          // Verificar que el formato es soportado
          const supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'tiff', 'heic', 'heif'];
          if (!imageFormat || !supportedFormats.includes(imageFormat)) {
            throw new Error(`Formato de imagen no soportado: ${imageFormat || 'desconocido'}`);
          }

          // Normalizar a JPEG para asegurar compatibilidad con servicios de IA
          // Esto ayuda a "sanar" imágenes parcialmente corruptas
          // Remover metadatos EXIF/ICC que pueden causar problemas con Google Vision
          console.log("Converting to JPEG", {
            photoId: photo.id,
            originalFormat: imageFormat,
            originalSize: imageBuffer.length,
          });
          
          normalizedBuffer = await image
            .removeAlpha() // Remover canal alpha si existe
            .jpeg({ 
              quality: 95, 
              mozjpeg: true,
              progressive: false, // No usar progressive JPEG para evitar problemas
            })
            .toBuffer();
          
          // Validar que el buffer normalizado es realmente un JPEG válido
          const jpegStart = normalizedBuffer.slice(0, 2);
          if (jpegStart[0] !== 0xFF || jpegStart[1] !== 0xD8) {
            throw new Error(`Buffer normalizado no es un JPEG válido (inicio: ${jpegStart.toString('hex')})`);
          }

          console.log("Image validation and normalization OK", {
            photoId: photo.id,
            originalFormat: imageFormat,
            originalSize: imageBuffer.length,
            normalizedSize: normalizedBuffer.length,
            width: metadata.width,
            height: metadata.height,
          });
        } catch (validationError: any) {
          const errorMsg = String(validationError?.message || validationError);
          const errorCode = validationError?.code || "UNKNOWN";
          const isDecoderError = errorMsg.toLowerCase().includes('decoder') || 
                                 errorMsg.includes('1E08010C') ||
                                 errorMsg.toLowerCase().includes('unsupported') ||
                                 errorMsg.toLowerCase().includes('vips') ||
                                 errorMsg.toLowerCase().includes('input buffer');
          
          // Si Sharp falla completamente, intentar usar el buffer original como último recurso
          // (algunas imágenes pueden funcionar sin normalizar)
          if (isDecoderError && imageBuffer && imageBuffer.length > 0) {
            console.warn("Sharp failed, attempting to use original buffer as fallback", {
              photoId: photo.id,
              error: errorMsg,
              originalSize: imageBuffer.length,
            });
            
            // Validar que el buffer original parece ser una imagen válida
            const bufferStart = imageBuffer.slice(0, 4);
            const isValidImage = 
              (bufferStart[0] === 0xFF && bufferStart[1] === 0xD8) || // JPEG
              (bufferStart[0] === 0x89 && bufferStart[1] === 0x50 && bufferStart[2] === 0x4E && bufferStart[3] === 0x47) || // PNG
              (bufferStart[0] === 0x47 && bufferStart[1] === 0x49 && bufferStart[2] === 0x46) || // GIF
              (bufferStart[0] === 0x52 && bufferStart[1] === 0x49 && bufferStart[2] === 0x46 && bufferStart[3] === 0x46); // WebP/RIFF
            
            if (isValidImage) {
              console.log("Using original buffer as fallback", {
                photoId: photo.id,
                bufferSize: imageBuffer.length,
              });
              normalizedBuffer = imageBuffer;
              imageFormat = "unknown"; // No sabemos el formato exacto
            } else {
              const finalErrorMsg = `Imagen corrupta o formato no soportado: no se puede leer metadatos (error: ${errorMsg})`;
              console.error("Image validation/normalization failed DETAILED", {
                photoId: photo.id,
                error: finalErrorMsg,
                originalError: errorMsg,
                errorCode,
                contentType: r2Metadata?.contentType,
                size: imageBuffer.length,
                firstBytes: firstBytes?.substring(0, 24),
                stack: validationError?.stack?.substring(0, 500),
              });
              throw new Error(finalErrorMsg);
            }
          } else {
            const finalErrorMsg = isDecoderError
              ? `Imagen corrupta o formato no soportado: no se puede leer metadatos (error: ${errorMsg})`
              : `Imagen inválida: ${errorMsg}`;
            
            console.error("Image validation/normalization failed DETAILED", {
              photoId: photo.id,
              error: finalErrorMsg,
              originalError: errorMsg,
              errorCode,
              contentType: r2Metadata?.contentType,
              size: imageBuffer.length,
              firstBytes: firstBytes?.substring(0, 24),
              stack: validationError?.stack?.substring(0, 500),
            });
            throw new Error(finalErrorMsg);
          }
        }

        await prisma.$transaction([
          prisma.ocrToken.deleteMany({ where: { photoId: photo.id } }),
          prisma.faceDetection.deleteMany({ where: { photoId: photo.id } }),
        ]);

        let ocrTokens: Awaited<ReturnType<typeof extractOcrTokensFromImage>> = [];
        try {
          // Usar el buffer normalizado en lugar del original
          console.log("Calling Google Vision API", {
            photoId: photo.id,
            bufferSize: normalizedBuffer.length,
            originalFormat: imageFormat,
          });
          ocrTokens = await extractOcrTokensFromImage({ buffer: normalizedBuffer });
          console.log("Google Vision API success", {
            photoId: photo.id,
            tokensFound: ocrTokens.length,
          });
        } catch (err: any) {
          const errorMsg = String(err?.message ?? err);
          const errorCode = err?.code || err?.statusCode || err?.status || "UNKNOWN";
          const errorName = err?.name || "UnknownError";
          const isDecoderError = errorMsg.toLowerCase().includes('decoder') || 
                                 errorMsg.includes('1E08010C') ||
                                 errorMsg.toLowerCase().includes('unsupported') ||
                                 errorMsg.toLowerCase().includes('getting metadata');
          
          // Detectar errores comunes de API
          const isAuthError = errorMsg.toLowerCase().includes('unauthorized') ||
                             errorMsg.toLowerCase().includes('permission') ||
                             errorMsg.toLowerCase().includes('credentials') ||
                             errorCode === 401 ||
                             errorCode === 403;
          const isRateLimitError = errorMsg.toLowerCase().includes('rate limit') ||
                                  errorMsg.toLowerCase().includes('quota') ||
                                  errorMsg.toLowerCase().includes('too many') ||
                                  errorCode === 429;
          const isNetworkError = errorMsg.toLowerCase().includes('network') ||
                                errorMsg.toLowerCase().includes('timeout') ||
                                errorMsg.toLowerCase().includes('econnreset') ||
                                errorMsg.toLowerCase().includes('enotfound');
          
          console.error("OCR ERROR DETAILED", {
            photoId: photo.id,
            message: errorMsg,
            errorCode,
            errorName,
            isDecoderError,
            isAuthError,
            isRateLimitError,
            isNetworkError,
            bufferSize: normalizedBuffer.length,
            originalFormat: imageFormat,
            stack: err?.stack?.substring(0, 500),
          });
          
          if (isDecoderError) {
            throw new Error(`Imagen corrupta: Google Vision API no puede procesar la imagen (${errorMsg})`);
          }
          if (isAuthError) {
            throw new Error(`Error de autenticación Google Vision API: ${errorMsg} (código: ${errorCode})`);
          }
          if (isRateLimitError) {
            throw new Error(`Rate limit excedido en Google Vision API: ${errorMsg} (código: ${errorCode})`);
          }
          throw err;
        }
        if (ocrTokens.length > 0) {
          await prisma.ocrToken.createMany({
            data: ocrTokens.map((t) => ({
              photoId: photo.id,
              textRaw: t.textRaw,
              textNorm: t.textNorm,
              confidence: t.confidence ?? null,
            })),
          });
        }

        let faces: Awaited<ReturnType<typeof indexFaces>> = [];
        try {
          // Usar el buffer normalizado en lugar del original
          console.log("Calling AWS Rekognition", {
            photoId: photo.id,
            bufferSize: normalizedBuffer.length,
            originalFormat: imageFormat,
          });
          faces = await indexFaces({
            imageBytes: normalizedBuffer,
            externalImageId: String(photo.id),
          });
          console.log("AWS Rekognition success", {
            photoId: photo.id,
            facesFound: faces.length,
          });
        } catch (err: any) {
          const errorMsg = String(err?.message ?? err);
          const errorCode = err?.code || err?.statusCode || err?.status || err?.$metadata?.httpStatusCode || "UNKNOWN";
          const errorName = err?.name || err?.$metadata?.requestId || "UnknownError";
          const isDecoderError = errorMsg.toLowerCase().includes('decoder') || 
                                 errorMsg.includes('1E08010C') ||
                                 errorMsg.toLowerCase().includes('unsupported') ||
                                 errorMsg.toLowerCase().includes('invalidimage') ||
                                 errorMsg.toLowerCase().includes('invalidimageexception');
          
          // Detectar errores comunes de API
          const isAuthError = errorMsg.toLowerCase().includes('unauthorized') ||
                             errorMsg.toLowerCase().includes('accessdenied') ||
                             errorMsg.toLowerCase().includes('invalidkey') ||
                             errorMsg.toLowerCase().includes('credentials') ||
                             errorCode === 401 ||
                             errorCode === 403 ||
                             errorName?.includes('UnauthorizedException') ||
                             errorName?.includes('AccessDeniedException');
          const isRateLimitError = errorMsg.toLowerCase().includes('rate limit') ||
                                  errorMsg.toLowerCase().includes('throttling') ||
                                  errorMsg.toLowerCase().includes('too many') ||
                                  errorCode === 429 ||
                                  errorName?.includes('ThrottlingException');
          const isNetworkError = errorMsg.toLowerCase().includes('network') ||
                                errorMsg.toLowerCase().includes('timeout') ||
                                errorMsg.toLowerCase().includes('econnreset') ||
                                errorMsg.toLowerCase().includes('enotfound');
          
          console.error("FACE ERROR DETAILED", {
            photoId: photo.id,
            message: errorMsg,
            errorCode,
            errorName,
            isDecoderError,
            isAuthError,
            isRateLimitError,
            isNetworkError,
            bufferSize: normalizedBuffer.length,
            originalFormat: imageFormat,
            awsMetadata: err?.$metadata,
            stack: err?.stack?.substring(0, 500),
          });
          
          if (isDecoderError) {
            throw new Error(`Imagen corrupta: AWS Rekognition no puede procesar la imagen (${errorMsg})`);
          }
          if (isAuthError) {
            throw new Error(`Error de autenticación AWS Rekognition: ${errorMsg} (código: ${errorCode}, nombre: ${errorName})`);
          }
          if (isRateLimitError) {
            throw new Error(`Rate limit excedido en AWS Rekognition: ${errorMsg} (código: ${errorCode}, nombre: ${errorName})`);
          }
          throw err;
        }
        if (faces.length > 0) {
          await prisma.faceDetection.createMany({
            data: faces.map((f) => ({
              photoId: photo.id,
              rekognitionFaceId: f.rekognitionFaceId,
              confidence: f.confidence ?? null,
              bbox: f.bbox,
            })),
          });
        }

        await prisma.photo.update({
          where: { id: photo.id },
          data: { analysisStatus: "DONE", analyzedAt: new Date(), analysisError: null },
        });
        await prisma.photoAnalysisJob.update({
          where: { id: job.id },
          data: { status: "DONE", lastError: null, lockedAt: null },
        });
        processed += 1;
        jobCompleted = true;
      } catch (err: any) {
        const message = String(err?.message ?? err);
        const errorLower = message.toLowerCase();
        
        // Detectar errores de imagen inválida/corrupta
        const isInvalidImage = 
          errorLower.includes("decoder") ||
          errorLower.includes("unsupported") ||
          errorLower.includes("invalid") ||
          errorLower.includes("corrupt") ||
          errorLower.includes("corrupta") ||
          errorLower.includes("imagen inválida") ||
          errorLower.includes("formato no soportado") ||
          errorLower.includes("sin dimensiones");

        console.error("Photo analysis error", { 
          jobId: job.id, 
          photoId: photoId, 
          error: message,
          isInvalidImage,
        });
        errors.push({ jobId: job.id, photoId: photoId, error: message });

        const nextAttempts = (job.attempts ?? 0) + 1;
        // Si es imagen inválida, fallar inmediatamente (no reintentar)
        const shouldFail = isInvalidImage || nextAttempts >= MAX_ATTEMPTS;
        
        await prisma.photoAnalysisJob.update({
          where: { id: job.id },
          data: {
            status: shouldFail ? "ERROR" : "PENDING",
            attempts: nextAttempts,
            lastError: message,
            runAfter: shouldFail ? null : new Date(Date.now() + 10 * 60 * 1000),
            lockedAt: null,
          },
        });
        if (shouldFail) {
          await prisma.photo.update({
            where: { id: photoId },
            data: { 
              analysisStatus: "ERROR", 
              analysisError: isInvalidImage 
                ? `Imagen inválida o corrupta: ${message}` 
                : message 
            },
          });
        }
        jobCompleted = true; // Marcar como completado (aunque sea con error)
      } finally {
        // Asegurar que si el job no se completó, se desbloquee
        if (!jobCompleted) {
          try {
            const currentJob = await prisma.photoAnalysisJob.findUnique({
              where: { id: job.id },
              select: { status: true },
            });
            // Solo actualizar si todavía está en PROCESSING (no fue actualizado por el catch)
            if (currentJob?.status === "PROCESSING") {
              await prisma.photoAnalysisJob.update({
                where: { id: job.id },
                data: {
                  status: "PENDING",
                  lockedAt: null,
                  runAfter: new Date(Date.now() + 5 * 60 * 1000), // Reintentar en 5 minutos
                },
              });
              await prisma.photo.update({
                where: { id: photoId },
                data: { 
                  analysisStatus: "PENDING",
                  analysisError: "Error no capturado durante procesamiento",
                },
              });
            }
          } catch (cleanupErr) {
            console.error("Error en cleanup de job:", cleanupErr);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      backfilled: missingPhotos.length,
      errors,
      ...(debug ? { debugChecks } : {}),
    });
  } catch (error: any) {
    console.error("Error en process:", error);
    return NextResponse.json(
      { error: "Error al procesar análisis", detail: error?.message },
      { status: 500 }
    );
  }
}
