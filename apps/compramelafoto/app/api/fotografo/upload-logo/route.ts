/**
 * Endpoint de subida de logo de fotógrafo a Cloudflare R2
 * 
 * IMPORTANTE: En Vercel (y otros entornos serverless), el filesystem es de solo lectura.
 * No se puede escribir en /public/uploads/ ni en ningún directorio del filesystem.
 * Por eso usamos Cloudflare R2 (S3 compatible) para almacenar archivos estáticos.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const photographerId = formData.get("photographerId")?.toString();

    // Validar usuario autenticado
    const authUser = await getAuthUser();
    if (!authUser || (authUser.role !== Role.PHOTOGRAPHER && authUser.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    const id = authUser.id;

    if (photographerId && Number.isFinite(Number(photographerId)) && Number(photographerId) !== id) {
      return NextResponse.json(
        { error: "No autorizado para actualizar otro usuario" },
        { status: 403 }
      );
    }

    // Verificar que el usuario existe y es fotógrafo
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user || (user.role !== "PHOTOGRAPHER" && user.role !== "LAB_PHOTOGRAPHER")) {
      return NextResponse.json(
        { error: "Usuario no encontrado o no tiene rol válido" },
        { status: 404 }
      );
    }

    // Validar que sea PNG
    const ext = file.name.toLowerCase().endsWith(".png") ? ".png" : null;
    if (!ext) {
      return NextResponse.json(
        { error: "El archivo debe ser un PNG" },
        { status: 400 }
      );
    }

    // Leer el archivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generar key única para R2
    const key = generateR2Key(`logo_photographer_${id}_${file.name}`, "logos/photographers");

    // Subir a R2
    const { url } = await uploadToR2(buffer, key, "image/png", {
      photographerId: id.toString(),
      type: "photographer_logo",
    });

    // Actualizar usuario con la URL del logo
    try {
      await prisma.user.update({
        where: { id },
        data: { logoUrl: url },
      });
    } catch (updateErr: any) {
      // Si falta una columna en la BD (ej: googleId), usar SQL directo como fallback
      if (
        updateErr?.code === "P2022" ||
        String(updateErr?.message ?? "").includes("does not exist")
      ) {
        await prisma.$executeRaw`UPDATE "User" SET "logoUrl" = ${url} WHERE id = ${id}`;
      } else if (
        updateErr?.message?.includes("Unknown argument") ||
        updateErr?.message?.includes("Unknown field")
      ) {
        return NextResponse.json(
          {
            error:
              "Error: El campo logoUrl no existe en la base de datos. Por favor ejecuta: npx prisma migrate dev --name add_photographer_customization",
            detail: updateErr?.message,
          },
          { status: 500 }
        );
      } else {
        throw updateErr;
      }
    }

    return NextResponse.json({ logoUrl: url }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/fotografo/upload-logo ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo logo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
