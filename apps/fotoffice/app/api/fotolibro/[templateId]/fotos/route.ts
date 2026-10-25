import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { getFotofficeR2PublicUrl } from "@/lib/images/r2-client";
import { verifyUploadedImage } from "@/lib/images/r2-presign";
import { puedeEditarFotolibro } from "@/lib/fotolibro/permisos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ templateId: string }> };

const MB = 1024 * 1024;
const MAXIMO = { original: 80 * MB, vista: 10 * MB, mini: 2 * MB } as const;
const FORMATOS = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Registra una foto ya subida: verifica que los tres objetos estén dentro de este fotolibro y que
 * sean imágenes de verdad (por su firma binaria, no por lo que dijo el navegador), y devuelve la
 * foto lista para sumar a la tira. El fotolibro la guarda en su estado al guardarse.
 */
export async function POST(request: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) {
    return NextResponse.json({ error: "No podés cargar fotos en este fotolibro." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const claves = { original: body.original, vista: body.vista, mini: body.mini };
  const w = Number(body.w);
  const h = Number(body.h);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return NextResponse.json({ error: "Faltan las medidas de la foto." }, { status: 400 });
  }

  for (const tipo of ["original", "vista", "mini"] as const) {
    const key = claves[tipo];
    const prefijo = `${FOTOFFICE_R2_PREFIXES.fotolibroPhoto}/${templateId}/${tipo}/`;
    if (typeof key !== "string" || !key.startsWith(prefijo)) {
      return NextResponse.json({ error: "Esa foto no es de este fotolibro." }, { status: 400 });
    }
    const v = await verifyUploadedImage({ key, maxFileSizeBytes: MAXIMO[tipo], acceptedFormats: FORMATOS });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.slice(0, 120) : "";
  return NextResponse.json({
    foto: {
      id: randomUUID().slice(0, 12),
      url: getFotofficeR2PublicUrl(claves.original as string),
      vista: getFotofficeR2PublicUrl(claves.vista as string),
      mini: getFotofficeR2PublicUrl(claves.mini as string),
      w: Math.round(w),
      h: Math.round(h),
      nombre,
    },
  });
}
