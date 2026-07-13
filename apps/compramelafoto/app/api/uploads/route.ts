/**
 * Endpoint de subida de archivos a Cloudflare R2 (usado por /imprimir).
 * Procesa imágenes (preview con watermark + original) vía processPhoto.
 */

import { NextResponse } from "next/server";
import { processPhoto } from "@/lib/image-processing";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import {
  getMaxUploadBytes,
  isAllowedPrintUpload,
  sanitizeUploadBasename,
} from "@/lib/print-orders/upload-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const rejected: Array<{ name: string; reason: string }> = [];
    const maxSize = getMaxUploadBytes();

    for (const f of files) {
      if (!f || typeof (f as { arrayBuffer?: unknown }).arrayBuffer !== "function") continue;

      const file = f as unknown as File;
      const originalName = sanitizeUploadBasename((file as { name?: string }).name || "archivo");
      const declaredMime = (file as { type?: string }).type || null;
      const check = isAllowedPrintUpload(originalName, declaredMime);
      if (!check.ok) {
        rejected.push({ name: originalName, reason: check.reason || "No permitido" });
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const contentType = check.contentType;
      const fileSize = buffer.length;

      if (fileSize > maxSize) {
        rejected.push({
          name: originalName,
          reason: `Excede tamaño máximo (${maxSize} bytes)`,
        });
        continue;
      }

      try {
        const applyWatermark =
          String(formData.get("applyWatermark") ?? "true").toLowerCase() !== "false";
        if (contentType.startsWith("image/")) {
          const { previewUrl, originalKey, outputName } = await processPhoto(
            buffer,
            originalName,
            applyWatermark,
            "print-uploads"
          );

          saved.push({
            key: originalKey,
            fileKey: originalKey,
            url: previewUrl,
            name: outputName,
            size: fileSize,
            type: "image/jpeg",
          });
        } else {
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
      } catch (processErr: unknown) {
        console.error(`Error procesando ${originalName}:`, processErr);

        try {
          const key = generateR2Key(originalName, "print-uploads");
          const { url } = await uploadToR2(buffer, key, contentType, {
            originalName,
            error: "processing_failed",
          });

          saved.push({
            key,
            fileKey: key,
            url,
            name: originalName,
            size: fileSize,
            type: contentType,
          });
        } catch (uploadErr: unknown) {
          console.error(`Error subiendo ${originalName} sin procesar a R2:`, uploadErr);
          rejected.push({
            name: originalName,
            reason: uploadErr instanceof Error ? uploadErr.message : "Error de storage",
          });
        }
      }
    }

    if (saved.length === 0) {
      return NextResponse.json(
        {
          error: "No files were successfully uploaded",
          detail: "Todos los archivos fallaron al procesarse o subirse",
          rejected,
        },
        { status: 400 }
      );
    }

    const response: {
      ok: true;
      files: typeof saved;
      rejected: typeof rejected;
      url?: string;
    } = { ok: true, files: saved, rejected };
    if (saved.length === 1) {
      response.url = saved[0].url;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    console.error("UPLOAD ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Upload failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
