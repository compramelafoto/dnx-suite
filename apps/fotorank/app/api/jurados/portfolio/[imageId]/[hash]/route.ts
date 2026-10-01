/**
 * Sirve una imagen de portfolio desde el bucket privado.
 *
 * La imagen es pública por naturaleza —se muestra en la página pública del
 * jurado y en el directorio—, pero el archivo vive en el bucket privado: esta
 * ruta es la que decide qué se entrega, y sólo entrega la clave que esa fila
 * tiene guardada.
 */
import { prisma } from "@repo/db";

import { parsePortfolioKey } from "../../../../../lib/fotorank/judges/portfolioKeys";
import { getPrivateContestStorageProvider } from "../../../../../lib/fotorank/storage/provider";

type Ctx = { params: Promise<{ imageId: string; hash: string }> };

type ConLectura = { readObject(key: string): Promise<Uint8Array> };

function puedeLeer(p: unknown): p is ConLectura {
  return typeof (p as ConLectura).readObject === "function";
}

export async function GET(_req: Request, ctx: Ctx) {
  const { imageId, hash } = await ctx.params;

  const imagen = await prisma.fotorankJudgePortfolioImage.findUnique({
    where: { id: imageId },
    select: { storageKey: true, contentHash: true, contentType: true },
  });
  if (!imagen) return new Response("No encontrada", { status: 404 });

  const parsed = parsePortfolioKey(imagen.storageKey);
  if (!parsed) return new Response("No encontrada", { status: 404 });

  // El hash pedido tiene que ser el que esta fila tiene guardado: así una URL
  // vieja no sirve una imagen nueva ni al revés.
  const pedido = hash.replace(/\.(jpg|png|webp)$/, "");
  if (pedido !== imagen.contentHash) return new Response("No encontrada", { status: 404 });

  const storage = getPrivateContestStorageProvider();
  if (!puedeLeer(storage)) return new Response("No disponible", { status: 503 });

  let bytes: Uint8Array;
  try {
    bytes = await storage.readObject(imagen.storageKey);
  } catch {
    return new Response("No encontrada", { status: 404 });
  }

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": imagen.contentType,
      "Content-Length": String(bytes.byteLength),
      // El hash está en la ruta: si cambia la imagen, cambia la URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
