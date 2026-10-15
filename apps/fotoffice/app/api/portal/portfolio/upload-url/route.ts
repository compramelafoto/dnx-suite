import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { isFotofficeR2Configured } from "@/lib/images/r2-client";
import { createFotofficeUploadUrl } from "@/lib/images/r2-presign";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { ensurePortfolio } from "@/lib/portfolio/repository";
import { canAcceptAnotherPhoto } from "@/lib/portfolio/upload-guard";

export const runtime = "nodejs";

/**
 * Dónde subir una foto del portfolio.
 *
 * **El archivo no pasa por acá.** Esta ruta devuelve una URL de un solo uso contra la que el
 * navegador sube directo: las funciones de Vercel rechazan cualquier pedido de más de 4,5 MB, y la
 * obra de un fotógrafo pesa más que eso. Igual que los videos de las clases en el módulo de Cursos.
 *
 * Lo que este endpoint decide y el cliente no puede torcer:
 *
 * - **de quién es el portfolio** — sale de la sesión, nunca de lo que mande el navegador;
 * - **dónde se escribe** — el prefijo se arma acá con el workspace de la sesión, así que es
 *   estructuralmente imposible escribir en el namespace de otra institución;
 * - **cuántas fotos entran** — el tope se valida antes de firmar.
 *
 * Lo único que aporta el cliente es el nombre del archivo y su tipo, y los dos son sospechosos: se
 * usan sólo para firmar. La verdad sobre el archivo se establece DESPUÉS de la subida, cuando
 * `registerPortfolioPhotoAction` verifica el objeto ya escrito.
 */
export async function POST(request: Request) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) {
    return NextResponse.json({ error: "No encontramos tu ficha de socio." }, { status: 403 });
  }

  if (!(await isModuleEnabledForWorkspace(context.workspace.id, PORTFOLIO_MODULE_KEY))) {
    return NextResponse.json({ error: "Los portfolios no están habilitados." }, { status: 404 });
  }

  /*
   * Sin R2 configurado esto no puede funcionar, y conviene decirlo ahora: el fallback a disco que
   * usan las otras imágenes no sirve acá, porque la subida directa necesita un destino real contra
   * el que el navegador pueda hacer PUT.
   */
  if (!isFotofficeR2Configured()) {
    return NextResponse.json(
      { error: "El almacenamiento de fotos no está configurado. Avisale a la administración." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
  };
  const filename = (body.filename ?? "").trim() || "foto.jpg";
  const contentType = (body.contentType ?? "").trim();

  const portfolio = await ensurePortfolio({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    firstName: context.member.firstName,
    lastName: context.member.lastName,
  });

  const cantidad = await prisma.fotofficeMemberPortfolioPhoto.count({
    where: { portfolioId: portfolio.id },
  });
  const cupo = canAcceptAnotherPhoto(cantidad);
  if (!cupo.ok) return NextResponse.json({ error: cupo.error }, { status: 400 });

  try {
    const { uploadUrl, key } = await createFotofficeUploadUrl({
      prefix: `${FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto}/${context.workspace.id}`,
      originalFilename: filename,
      contentType,
    });
    // La dirección pública no se devuelve acá: la resuelve el servidor al registrar la foto, después
    // de verificar que lo subido sea realmente una imagen.
    return NextResponse.json({ uploadUrl, key }, { status: 200 });
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "No pudimos preparar la subida. Probá de nuevo.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
