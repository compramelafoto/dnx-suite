/**
 * Endpoint de subida de archivos a Cloudflare R2
 * 
 * IMPORTANTE: En Vercel (y otros entornos serverless), el filesystem es de solo lectura.
 * No se puede escribir en /public/uploads/ ni en ningún directorio del filesystem.
 * Por eso usamos Cloudflare R2 (S3 compatible) para almacenar archivos estáticos.
 * 
 * Este endpoint:
 * - Acepta múltiples archivos en el campo "files" (multipart/form-data)
 * - Procesa cada imagen (crea preview con marca de agua + original sin marca)
 * - Sube las imágenes a R2
 * - Devuelve URLs públicas de los archivos subidos
 */

import { NextResponse } from "next/server";
import { processPhoto } from "@/lib/image-processing";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";

// Fuerza runtime Node (necesario para sharp y procesamiento de imágenes)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detecta el Content-Type basado en la extensión del archivo
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf(".") + 1);
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
  };
  return contentTypes[ext] || "application/octet-stream";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded", detail: "Se requiere al menos un archivo en el campo 'files'" },
        { status: 400 }
      );
    }

    const saved: Array<{
      key: string;
      fileKey?: string;
      url: string;
      name: string;
      size: number;
      type: string;
    }> = [];

    for (const f of files) {
      // Compatible con runtimes donde File no existe como clase
      if (!f || typeof (f as any).arrayBuffer !== "function") continue;

      const file = f as unknown as File;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const originalName = (file as any).name || "archivo";
      const contentType = getContentType(originalName);
      const fileSize = buffer.length;

      // Validación de tamaño (opcional, preparado para configuración)
      const maxSize = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 10 * 1024 * 1024; // 10MB por defecto
      if (fileSize > maxSize) {
        console.error(`Archivo ${originalName} excede el tamaño máximo: ${fileSize} bytes`);
        continue; // Saltar este archivo pero continuar con los demás
      }

      try {
        const applyWatermark =
          String(formData.get("applyWatermark") ?? "true").toLowerCase() !== "false";
        // Si es una imagen, procesarla (aplica marca de agua y crea preview + original)
        if (contentType.startsWith("image/")) {
          const { previewUrl, originalKey, originalUrl, outputName } = await processPhoto(
            buffer,
            originalName,
            applyWatermark, // Aplicar marca de agua al preview
            "print-uploads"
          );

          // Guardar ambos: preview (con marca de agua) y original (sin marca)
          saved.push({
            key: originalKey,
            fileKey: originalKey,
            url: previewUrl, // URL de preview (la que se muestra normalmente, con marca de agua)
            name: outputName,
            size: fileSize,
            type: "image/jpeg",
          });

          // También incluir el original en la respuesta si se necesita
          // (opcional, dependiendo de los requisitos del frontend)
        } else {
          // Para archivos no-imagen, subir directamente a R2 sin procesamiento
          const key = generateR2Key(originalName, "print-uploads");
          const { url } = await uploadToR2(buffer, key, contentType, {
            originalName,
          });

          saved.push({
            key,
            fileKey: key,
            url,
            name: originalName,
            size: fileSize,
            type: contentType,
          });
        }
      } catch (processErr: any) {
        console.error(`Error procesando ${originalName}:`, {
          errorMessage: processErr?.message,
          errorStack: processErr?.stack,
          errorName: processErr?.name,
        });
        
        // Si falla el procesamiento, intentar subir el archivo original sin procesar directamente a R2
        try {
          const key = generateR2Key(originalName, "print-uploads");
          const { url } = await uploadToR2(buffer, key, contentType, {
            originalName,
            error: "processing_failed",
          });

          saved.push({
            key,
            url,
            name: originalName,
            size: fileSize,
            type: contentType,
          });
        } catch (uploadErr: any) {
          console.error(`Error subiendo ${originalName} sin procesar a R2:`, {
            errorMessage: uploadErr?.message,
            errorStack: uploadErr?.stack,
            errorName: uploadErr?.name,
            originalName,
          });
          // Continuar con el siguiente archivo (no fallar todo el request)
        }
      }
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { error: "No files were successfully uploaded", detail: "Todos los archivos fallaron al procesarse o subirse" },
        { status: 500 }
      );
    }

    // Respuesta con compatibilidad: si hay un solo archivo, también incluir "url" en el nivel superior
    const response: any = { ok: true, files: saved };
    if (saved.length === 1) {
      response.url = saved[0].url; // Compatibilidad con frontend que espera { url }
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("UPLOAD ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Upload failed",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
