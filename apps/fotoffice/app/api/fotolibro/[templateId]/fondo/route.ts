import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { getFotofficeR2PublicUrl } from "@/lib/images/r2-client";
import { verifyUploadedImage } from "@/lib/images/r2-presign";
import { puedeEditarFotolibro } from "@/lib/fotolibro/permisos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * Registra el fondo de un pliego que dibujó un estilo en el navegador: verifica que esté dentro de
 * este fotolibro y que sea una imagen de verdad, y devuelve su dirección para guardarla.
 */
export async function POST(request: Request, context: Ctx) {
  const user = await requireAuth();
  const { templateId } = await context.params;
  if (!(await puedeEditarFotolibro(user.id, templateId))) {
    return NextResponse.json({ error: "No podés cambiar este fotolibro." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { key?: unknown };
  const prefijo = `${FOTOFFICE_R2_PREFIXES.fotolibroPhoto}/${templateId}/fondo/`;
  if (typeof body.key !== "string" || !body.key.startsWith(prefijo)) {
    return NextResponse.json({ error: "Ese fondo no es de este fotolibro." }, { status: 400 });
  }
  const v = await verifyUploadedImage({ key: body.key, maxFileSizeBytes: 30 * 1024 * 1024, acceptedFormats: ["image/jpeg", "image/png"] });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  return NextResponse.json({ url: getFotofficeR2PublicUrl(body.key) });
}
