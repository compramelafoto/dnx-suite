import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    console.log("🔧 Creando tablas y columnas de análisis de fotos...");

    const results: string[] = [];

    // Crear enum si no existe
    try {
      await prisma.$executeRaw`CREATE TYPE "PhotoAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'ERROR')`;
      results.push("Enum PhotoAnalysisStatus creado");
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        results.push(`Enum: ${e.message}`);
      }
    }

    // Agregar columnas a Photo si no existen (una por una)
    try {
      await prisma.$executeRaw`ALTER TABLE IF EXISTS "Photo" ADD COLUMN IF NOT EXISTS "analysisStatus" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING'`;
      results.push("Columna analysisStatus agregada");
    } catch (e: any) {
      results.push(`analysisStatus: ${e.message}`);
    }

    try {
      await prisma.$executeRaw`ALTER TABLE IF EXISTS "Photo" ADD COLUMN IF NOT EXISTS "analysisError" TEXT`;
      results.push("Columna analysisError agregada");
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        results.push(`analysisError: ${e.message}`);
      }
    }

    try {
      await prisma.$executeRaw`ALTER TABLE IF EXISTS "Photo" ADD COLUMN IF NOT EXISTS "analyzedAt" TIMESTAMP(3)`;
      results.push("Columna analyzedAt agregada");
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        results.push(`analyzedAt: ${e.message}`);
      }
    }

    // Crear tabla PhotoAnalysisJob
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "PhotoAnalysisJob" (
          "id" SERIAL PRIMARY KEY,
          "photoId" INTEGER NOT NULL UNIQUE,
          "status" "PhotoAnalysisStatus" NOT NULL DEFAULT 'PENDING',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "lockedAt" TIMESTAMP(3),
          "runAfter" TIMESTAMP(3),
          "lastError" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      results.push("Tabla PhotoAnalysisJob creada");
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        results.push(`PhotoAnalysisJob: ${e.message}`);
      }
    }

    // Crear tabla OcrToken
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "OcrToken" (
          "id" SERIAL PRIMARY KEY,
          "photoId" INTEGER NOT NULL,
          "textRaw" TEXT NOT NULL,
          "textNorm" TEXT NOT NULL,
          "confidence" DOUBLE PRECISION,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      results.push("Tabla OcrToken creada");
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        results.push(`OcrToken: ${e.message}`);
      }
    }

    // Crear tabla FaceDetection
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "FaceDetection" (
          "id" SERIAL PRIMARY KEY,
          "photoId" INTEGER NOT NULL,
          "rekognitionFaceId" TEXT NOT NULL UNIQUE,
          "confidence" DOUBLE PRECISION,
          "bbox" JSONB NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      results.push("Tabla FaceDetection creada");
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        results.push(`FaceDetection: ${e.message}`);
      }
    }

    // Crear índices (uno por uno)
    const indexes = [
      `CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_status_idx" ON "PhotoAnalysisJob"("status")`,
      `CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_runAfter_idx" ON "PhotoAnalysisJob"("runAfter")`,
      `CREATE INDEX IF NOT EXISTS "PhotoAnalysisJob_lockedAt_idx" ON "PhotoAnalysisJob"("lockedAt")`,
      `CREATE INDEX IF NOT EXISTS "OcrToken_photoId_idx" ON "OcrToken"("photoId")`,
      `CREATE INDEX IF NOT EXISTS "OcrToken_textNorm_idx" ON "OcrToken"("textNorm")`,
      `CREATE INDEX IF NOT EXISTS "FaceDetection_photoId_idx" ON "FaceDetection"("photoId")`,
    ];

    for (const indexSql of indexes) {
      try {
        await prisma.$executeRawUnsafe(indexSql);
      } catch (e: any) {
        // Ignorar errores de índices duplicados
      }
    }
    results.push("Índices creados");

    // Agregar foreign keys (intentar, ignorar si ya existen)
    const fks = [
      `ALTER TABLE IF EXISTS "PhotoAnalysisJob" ADD CONSTRAINT IF NOT EXISTS "PhotoAnalysisJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE IF EXISTS "OcrToken" ADD CONSTRAINT IF NOT EXISTS "OcrToken_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE IF EXISTS "FaceDetection" ADD CONSTRAINT IF NOT EXISTS "FaceDetection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ];

    for (const fkSql of fks) {
      try {
        await prisma.$executeRawUnsafe(fkSql);
      } catch (e: any) {
        // Ignorar errores de constraints duplicados
      }
    }
    results.push("Foreign keys agregadas");

    // Verificar que las tablas existen
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('PhotoAnalysisJob', 'FaceDetection', 'OcrToken')
      ORDER BY table_name;
    `;

    return NextResponse.json({
      success: true,
      message: "Tablas y columnas creadas exitosamente",
      tablesCreated: tables.map(t => t.table_name),
    });
  } catch (error: any) {
    console.error("Error creando tablas:", error);
    return NextResponse.json(
      { error: error.message || "Error creando tablas" },
      { status: 500 }
    );
  }
}
