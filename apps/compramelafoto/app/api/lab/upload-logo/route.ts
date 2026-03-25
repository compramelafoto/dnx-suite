/**
 * Endpoint de subida de logo de laboratorio a Cloudflare R2
 * 
 * IMPORTANTE: En Vercel (y otros entornos serverless), el filesystem es de solo lectura.
 * No se puede escribir en /public/uploads/ ni en ningún directorio del filesystem.
 * Por eso usamos Cloudflare R2 (S3 compatible) para almacenar archivos estáticos.
 */

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const labId = formData.get("labId") as string | null;

    const authUser = await getAuthUser();
    if (!authUser || (authUser.role !== Role.LAB && authUser.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol LAB o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const labIdNum = Number(labId ?? authUser.labId ?? NaN);
    if (!Number.isFinite(labIdNum)) {
      return NextResponse.json({ error: "ID de laboratorio inválido" }, { status: 400 });
    }

    // Verificar que el laboratorio existe
    const lab = await prisma.lab.findUnique({
      where: { id: labIdNum },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Validar tipo de archivo
    if (!file.type.startsWith("image/png")) {
      return NextResponse.json(
        { error: "Solo se permiten archivos PNG" },
        { status: 400 }
      );
    }

    // Convertir File a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generar key única para R2
    const key = generateR2Key(`logo_lab_${labIdNum}_${file.name}`, "logos/labs");

    // Subir a R2
    const { url } = await uploadToR2(buffer, key, "image/png", {
      labId: labIdNum.toString(),
      type: "lab_logo",
    });

    // Actualizar el laboratorio
    try {
      const updatedLab = await prisma.lab.update({
        where: { id: labIdNum },
        data: { logoUrl: url },
        select: {
          id: true,
          logoUrl: true,
        },
      });

      return NextResponse.json({ logoUrl: updatedLab.logoUrl });
    } catch (dbError: any) {
      // Si falta una columna en la BD, usar SQL directo como fallback
      if (
        dbError?.code === "P2022" ||
        String(dbError?.message ?? "").includes("does not exist")
      ) {
        await prisma.$executeRaw`UPDATE "Lab" SET "logoUrl" = ${url} WHERE id = ${labIdNum}`;
        return NextResponse.json({ logoUrl: url });
      }

      // Si falla por campos faltantes en el schema
      if (
        dbError.message?.includes("Unknown arg") ||
        dbError.message?.includes("does not exist") ||
        dbError.code === "P2021"
      ) {
        return NextResponse.json(
          {
            error:
              "Campo 'logoUrl' no encontrado en el schema. Ejecutá: npx prisma migrate dev --name add_lab_customization",
            detail: dbError.message,
          },
          { status: 500 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error("Error subiendo logo:", error);
    return NextResponse.json(
      { error: "Error subiendo logo", detail: error.message },
      { status: 500 }
    );
  }
}
