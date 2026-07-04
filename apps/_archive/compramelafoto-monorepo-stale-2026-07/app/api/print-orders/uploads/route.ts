/**
 * Endpoint de subida de archivos para pedidos de impresión
 * 
 * IMPORTANTE: En Vercel (y otros entornos serverless), el filesystem es de solo lectura.
 * No se puede escribir en /public/uploads/ ni en ningún directorio del filesystem.
 * Por eso usamos Cloudflare R2 (S3 compatible) para almacenar archivos estáticos.
 */

import { NextResponse } from "next/server";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import { convertImageToJpeg } from "@/lib/image-processing";

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
      url: string;
      name: string;
      size: number;
      type: string;
    }> = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;

      const bytes = await f.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const originalName = f.name;
      const contentType = getContentType(originalName);
      const fileSize = buffer.length;

      // Validación de tamaño (opcional, preparado para configuración)
      const maxSize = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 10 * 1024 * 1024; // 10MB por defecto
      if (fileSize > maxSize) {
        console.error(`Archivo ${originalName} excede el tamaño máximo: ${fileSize} bytes`);
        continue; // Saltar este archivo pero continuar con los demás
      }

      try {
        if (contentType.startsWith("image/")) {
          const { buffer: jpegBuffer, outputName } = await convertImageToJpeg(
            buffer,
            originalName,
            92,
            300
          );
          const key = generateR2Key(outputName, "print-orders");
          const { url } = await uploadToR2(jpegBuffer, key, "image/jpeg", {
            originalName: outputName,
            type: "print_order",
          });

          saved.push({
            key,
            url,
            name: outputName,
            size: jpegBuffer.length,
            type: "image/jpeg",
          });
        } else {
          const key = generateR2Key(originalName, "print-orders");
          const { url } = await uploadToR2(buffer, key, contentType, {
            originalName,
            type: "print_order",
          });

          saved.push({
            key,
            url,
            name: originalName,
            size: fileSize,
            type: contentType,
          });
        }
      } catch (uploadErr: any) {
        console.error(`Error subiendo ${originalName}:`, uploadErr);
        // Continuar con el siguiente archivo
      }
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { error: "No files were successfully uploaded", detail: "Todos los archivos fallaron al subirse" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, files: saved },
      { status: 200 }
    );
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
