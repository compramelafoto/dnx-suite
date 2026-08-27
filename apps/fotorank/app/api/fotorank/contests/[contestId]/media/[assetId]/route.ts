/**
 * Sirve una imagen de concurso desde el storage privado.
 *
 * Es el único camino por el que se ven estos bytes, y por eso es donde se
 * decide la visibilidad: mientras el concurso esté en borrador la imagen sólo
 * la ve el equipo de la organización. Publicado el concurso, la misma URL pasa
 * a ser pública y cacheable.
 */

import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  contestMediaIsPubliclyVisible,
  getContestMediaAsset,
  resolveContestMediaAccess,
} from "../../../../../../lib/fotorank/contest-media";
import { getPrivateContestStorageProvider } from "../../../../../../lib/fotorank/storage/provider";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ contestId: string; assetId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { contestId, assetId } = await params;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, status: true },
  });
  if (!contest) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const asset = await getContestMediaAsset(contestId, assetId);
  if (!asset) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const isPublic = contestMediaIsPubliclyVisible(String(contest.status));

  /**
   * Concurso todavía no publicado: sólo el equipo de la organización.
   *
   * La respuesta a quien no tiene permiso es 404 y no 403 — un 403 confirmaría
   * que en esa dirección hay una imagen de un concurso que aún no se anunció.
   */
  if (!isPublic) {
    const user = await getAuthUser();
    const access = await resolveContestMediaAccess(user, contestId);
    if (!access?.canPreview) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }
  }

  let body: Uint8Array;
  try {
    const storage = getPrivateContestStorageProvider();
    if (!storage.readObject) {
      return NextResponse.json({ error: "Almacenamiento no disponible." }, { status: 500 });
    }
    body = await storage.readObject(asset.storageKey);
  } catch {
    /**
     * La fila existe pero los bytes no. Pasa si alguien borró el objeto por
     * fuera de la aplicación. Se responde 404 y no 500 porque, para quien mira,
     * el resultado es el mismo: esa imagen no está.
     */
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  /**
   * Cache larga y `immutable` sólo cuando el concurso es público: la URL lleva
   * el id del asset, así que al reemplazar la imagen cambia la dirección y no
   * hay riesgo de servir la anterior. Mientras el concurso está en borrador la
   * respuesta depende de quién pregunta, así que no se cachea en ningún lado.
   */
  const cacheControl = isPublic
    ? "public, max-age=31536000, immutable"
    : "private, no-store, max-age=0";

  return new NextResponse(Buffer.from(body), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      ...(isPublic ? {} : { Vary: "Cookie" }),
    },
  });
}
