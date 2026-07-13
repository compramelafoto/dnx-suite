/**
 * Endpoint de subida de archivos para pedidos de impresión (prefix R2: print-orders)
 */

import { NextResponse } from "next/server";
import { uploadToR2, generateR2Key } from "@/lib/r2-client";
import { convertImageToJpeg } from "@/lib/image-processing";
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
      url: string;
      name: string;
      size: number;
      type: string;
    }> = [];
    const rejected: Array<{ name: string; reason: string }> = [];
    const maxSize = getMaxUploadBytes();

    for (const f of files) {
      if (!(f instanceof File)) continue;

      const originalName = sanitizeUploadBasename(f.name || "archivo");
      const check = isAllowedPrintUpload(originalName, f.type);
      if (!check.ok) {
        rejected.push({ name: originalName, reason: check.reason || "No permitido" });
        continue;
      }

      const bytes = await f.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileSize = buffer.length;
      const contentType = check.contentType;

      if (fileSize > maxSize) {
        rejected.push({
          name: originalName,
          reason: `Excede tamaño máximo (${maxSize} bytes)`,
        });
        continue;
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
      } catch (uploadErr: unknown) {
        console.error(`Error subiendo ${originalName}:`, uploadErr);
        rejected.push({
          name: originalName,
          reason: uploadErr instanceof Error ? uploadErr.message : "Error de storage",
        });
      }
    }

    if (saved.length === 0) {
      return NextResponse.json(
        {
          error: "No files were successfully uploaded",
          detail: "Todos los archivos fallaron al subirse",
          rejected,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, files: saved, rejected }, { status: 200 });
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
