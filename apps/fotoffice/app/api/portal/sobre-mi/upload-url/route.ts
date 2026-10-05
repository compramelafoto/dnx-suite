import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isFotofficeR2Configured } from "@/lib/images/r2-client";
import { createFotofficeUploadUrl } from "@/lib/images/r2-presign";
import { featuredPhotoPrefix, memberForAboutMe } from "@/lib/spotlight/about-store";

export const runtime = "nodejs";

/**
 * Dónde subir una foto para la placa del Socio de la semana.
 *
 * Igual que el portfolio: el archivo no pasa por acá (Vercel corta a los 4,5 MB), el navegador
 * sube directo a R2 con una URL de un solo uso. El prefijo sale de la sesión —institución y
 * socio—, así que es imposible escribir en el espacio de otro. `registerFeaturedPhotoAction`
 * verifica el archivo después de subido.
 */
export async function POST(request: Request) {
  const user = await requireAuth();
  const socio = await memberForAboutMe(user.id);
  if (!socio) {
    return NextResponse.json({ error: "No encontramos tu ficha de socio." }, { status: 403 });
  }
  if (!isFotofficeR2Configured()) {
    return NextResponse.json(
      { error: "El almacenamiento de fotos no está configurado. Avisale a la administración." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { filename?: string; contentType?: string };
  try {
    const { uploadUrl, key } = await createFotofficeUploadUrl({
      prefix: featuredPhotoPrefix(socio.workspaceId, socio.id),
      originalFilename: (body.filename ?? "").trim() || "foto.jpg",
      contentType: (body.contentType ?? "").trim(),
    });
    return NextResponse.json({ uploadUrl, key }, { status: 200 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No pudimos preparar la subida. Probá de nuevo.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
