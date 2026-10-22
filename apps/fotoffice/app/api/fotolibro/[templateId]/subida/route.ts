import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { isFotofficeR2Configured } from "@/lib/images/r2-client";
import { createFotofficeUploadUrl } from "@/lib/images/r2-presign";
import { puedeEditarFotolibro } from "@/lib/fotolibro/permisos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * Permisos de subida para una foto del fotolibro: el original y sus dos copias livianas (vista y
 * miniatura), que arma el navegador. **Los archivos no pasan por acá**: el navegador sube directo
 * al almacenamiento, porque una foto para imprimir pesa más que lo que acepta una función de Vercel.
 *
 * El prefijo sale del fotolibro, nunca del navegador; lo subido se verifica en `/fotos`.
 */
export async function POST(request: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) {
    return NextResponse.json({ error: "No podés cargar fotos en este fotolibro." }, { status: 403 });
  }
  if (!isFotofficeR2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de fotos no está configurado." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    archivos?: { tipo?: string; filename?: string; contentType?: string }[];
  };
  const archivos = Array.isArray(body.archivos) ? body.archivos.slice(0, 3) : [];
  if (archivos.length === 0) return NextResponse.json({ error: "No hay archivos." }, { status: 400 });

  try {
    const permisos = await Promise.all(
      archivos.map(async (a) => {
        // "fondo": el fondo de un pliego dibujado por un estilo (ver `/fondo`).
        const tipo = a.tipo === "vista" || a.tipo === "mini" || a.tipo === "fondo" ? a.tipo : "original";
        const { uploadUrl, key } = await createFotofficeUploadUrl({
          prefix: `${FOTOFFICE_R2_PREFIXES.fotolibroPhoto}/${templateId}/${tipo}`,
          originalFilename: (a.filename ?? "").trim() || "foto.jpg",
          contentType: (a.contentType ?? "").trim(),
        });
        return { tipo, uploadUrl, key };
      }),
    );
    return NextResponse.json({ permisos });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No pudimos preparar la subida.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
