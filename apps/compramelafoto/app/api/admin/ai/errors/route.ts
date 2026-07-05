import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/errors
 * 
 * Obtiene los errores recientes del procesamiento de análisis
 * Solo accesible por ADMIN
 */
export async function GET(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 100)));

    // Obtener errores recientes agrupados por tipo (últimas 24 horas)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const errorJobs = await prisma.photoAnalysisJob.findMany({
      where: { 
        status: "ERROR",
        updatedAt: { gte: last24Hours },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        photo: {
          select: {
            id: true,
            albumId: true,
            originalKey: true,
            previewUrl: true,
            analysisStatus: true,
            analysisError: true,
          },
        },
      },
    });

    // Agrupar errores por mensaje (normalizado para agrupar errores similares)
    const errorGroups: Record<string, { count: number; examples: typeof errorJobs; errorType: string }> = {};
    errorJobs.forEach((job) => {
      const errorMsg = job.lastError || "Error desconocido";
      
      // Normalizar el mensaje para agrupar errores similares
      let normalizedMsg = errorMsg;
      let errorType = "UNKNOWN";
      
      // Detectar tipos de error comunes
      if (errorMsg.toLowerCase().includes('autenticación') || errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('credentials')) {
        errorType = "AUTH_ERROR";
        normalizedMsg = "Error de autenticación en APIs (Google Vision o AWS Rekognition)";
      } else if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('throttling')) {
        errorType = "RATE_LIMIT";
        normalizedMsg = "Rate limit excedido en APIs (Google Vision o AWS Rekognition)";
      } else if (errorMsg.toLowerCase().includes('corrupta') || errorMsg.toLowerCase().includes('decoder') || errorMsg.includes('1E08010C')) {
        errorType = "IMAGE_CORRUPT";
        normalizedMsg = "Imagen corrupta o formato no soportado";
      } else if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('econnreset')) {
        errorType = "NETWORK_ERROR";
        normalizedMsg = "Error de red o timeout";
      } else if (errorMsg.toLowerCase().includes('sin originalkey')) {
        errorType = "MISSING_KEY";
        normalizedMsg = "Foto sin originalKey";
      } else {
        // Mantener el mensaje original pero extraer el tipo si es posible
        if (errorMsg.includes('Google Vision')) {
          errorType = "GOOGLE_VISION_ERROR";
        } else if (errorMsg.includes('AWS Rekognition') || errorMsg.includes('Rekognition')) {
          errorType = "AWS_REKOGNITION_ERROR";
        }
      }
      
      if (!errorGroups[normalizedMsg]) {
        errorGroups[normalizedMsg] = { count: 0, examples: [], errorType };
      }
      errorGroups[normalizedMsg].count += 1;
      if (errorGroups[normalizedMsg].examples.length < 5) {
        errorGroups[normalizedMsg].examples.push(job);
      }
    });

    // Obtener estadísticas de fotos sin originalKey (string vacío)
    const photosWithoutKey = await prisma.photo.count({
      where: {
        isRemoved: false,
        originalKey: "",
      },
    });

    // Verificar configuración de servicios
    const hasGoogleVision = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const hasAwsRekognition = !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.REKOGNITION_COLLECTION_ID
    );

    // Ordenar por cantidad (más comunes primero)
    const sortedErrorGroups = Object.entries(errorGroups)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([error, data]) => ({
        error,
        errorType: data.errorType,
        count: data.count,
        examples: data.examples.map((job) => ({
          jobId: job.id,
          photoId: job.photoId,
          photo: job.photo,
          attempts: job.attempts,
          updatedAt: job.updatedAt,
          lastError: job.lastError, // Incluir el error completo para debugging
        })),
      }));

    return NextResponse.json({
      ok: true,
      errorGroups: sortedErrorGroups,
      photosWithoutKey,
      config: {
        hasGoogleVision,
        hasAwsRekognition,
        googleVisionConfigured: hasGoogleVision,
        awsRekognitionConfigured: hasAwsRekognition,
      },
      totalErrors: errorJobs.length,
      errorTypesSummary: {
        AUTH_ERROR: sortedErrorGroups.filter(g => g.errorType === "AUTH_ERROR").reduce((sum, g) => sum + g.count, 0),
        RATE_LIMIT: sortedErrorGroups.filter(g => g.errorType === "RATE_LIMIT").reduce((sum, g) => sum + g.count, 0),
        IMAGE_CORRUPT: sortedErrorGroups.filter(g => g.errorType === "IMAGE_CORRUPT").reduce((sum, g) => sum + g.count, 0),
        NETWORK_ERROR: sortedErrorGroups.filter(g => g.errorType === "NETWORK_ERROR").reduce((sum, g) => sum + g.count, 0),
        MISSING_KEY: sortedErrorGroups.filter(g => g.errorType === "MISSING_KEY").reduce((sum, g) => sum + g.count, 0),
        GOOGLE_VISION_ERROR: sortedErrorGroups.filter(g => g.errorType === "GOOGLE_VISION_ERROR").reduce((sum, g) => sum + g.count, 0),
        AWS_REKOGNITION_ERROR: sortedErrorGroups.filter(g => g.errorType === "AWS_REKOGNITION_ERROR").reduce((sum, g) => sum + g.count, 0),
        UNKNOWN: sortedErrorGroups.filter(g => g.errorType === "UNKNOWN").reduce((sum, g) => sum + g.count, 0),
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo errores:", error);
    return NextResponse.json(
      { error: "Error al obtener errores", detail: error?.message },
      { status: 500 }
    );
  }
}
