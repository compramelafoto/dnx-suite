import { NextResponse } from "next/server";
import { generateR2Key, uploadToR2 } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FOLDERS = new Set(["carnet", "polaroids"]);
const MAX_BYTES = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const folder = String(formData.get("folder") || "").toLowerCase();
    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: "Folder inválido" }, { status: 400 });
    }
    const file = formData.get("file");
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    const filename = String(formData.get("filename") || (file as any).name || "archivo");
    const contentType = (file as any).type || "application/octet-stream";
    const buffer = Buffer.from(await (file as File).arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${Math.round(MAX_BYTES / 1024 / 1024)} MB` },
        { status: 400 }
      );
    }
    const key = generateR2Key(filename, `prints/${folder}`);
    const { url } = await uploadToR2(buffer, key, contentType, {
      originalName: filename,
    });

    return NextResponse.json({ ok: true, key, url }, { status: 200 });
  } catch (err: any) {
    console.error("UPLOAD FINAL PRINT ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo archivo final", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
