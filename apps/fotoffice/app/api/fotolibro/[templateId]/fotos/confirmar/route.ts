import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { verifyUploadedImage } from "@/lib/images/r2-presign";
import { puedeEditarFotolibro } from "@/lib/fotolibro/permisos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ templateId: string }> };

const FORMATOS = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Confirma que llegaron los originales de fotos registradas antes de tiempo (ver `/fotos`). Se
 * llama al terminar cada subida de fondo y al abrir el libro, por si se cerró la pestaña a mitad.
 * Devuelve, por clave, si el original está y es una imagen válida.
 */
export async function POST(request: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) {
    return NextResponse.json({ error: "No podés cargar fotos en este fotolibro." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { claves?: unknown };
  const prefijo = `${FOTOFFICE_R2_PREFIXES.fotolibroPhoto}/${templateId}/original/`;
  const claves = (Array.isArray(body.claves) ? body.claves : [])
    .filter((k): k is string => typeof k === "string" && k.startsWith(prefijo))
    .slice(0, 200);
  const resultado: Record<string, boolean> = {};
  await Promise.all(
    claves.map(async (key) => {
      // Si el original no llegó, el almacenamiento responde "no existe" con un error.
      try {
        const v = await verifyUploadedImage({ key, maxFileSizeBytes: 80 * 1024 * 1024, acceptedFormats: FORMATOS });
        resultado[key] = v.ok;
      } catch {
        resultado[key] = false;
      }
    }),
  );
  return NextResponse.json({ resultado });
}
