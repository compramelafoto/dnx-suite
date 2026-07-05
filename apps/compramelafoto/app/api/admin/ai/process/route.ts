import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { runAnalysisPipeline } from "@/lib/analysis/analysis-runner";
import { resolveIncludeOcrFromRequest } from "@/lib/analysis/resolve-include-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // 13.3 minutos máximo (igual que /api/internal/analysis/run)

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
    const includeOcr = resolveIncludeOcrFromRequest(url);
    return runAnalysisPipeline({ includeOcr, debug, source: "admin" });
  } catch (error: any) {
    console.error("Error en process:", error);
    return NextResponse.json(
      { error: "Error al procesar análisis", detail: error?.message },
      { status: 500 }
    );
  }
}
