import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDesignActor } from "@/lib/design-v2/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cómo se muestra el tipo de cada ítem en la vista previa. */
function etiqueta(productType: string, size: string | null): string {
  if (productType === "DIGITAL") return "Digital";
  return size?.trim() || "Impresa";
}

/**
 * GET ?canje=ID — las fotos de un pedido de canje (pack cobrado por fuera) para la vista previa
 * de la ficha: miniatura y versión más grande, con el tamaño de cada copia. Sólo el dueño del
 * álbum (o un admin). Las imágenes salen de /api/photos/[id]/view, que ya las tiene generadas.
 */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const canje = Number(req.nextUrl.searchParams.get("canje") ?? "");
  if (!Number.isInteger(canje) || canje <= 0) {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  const pedido = await prisma.order.findUnique({
    where: { id: canje },
    select: {
      albumId: true,
      album: { select: { userId: true } },
      items: { select: { photoId: true, productType: true, size: true, quantity: true }, orderBy: { id: "asc" } },
    },
  });
  if (!pedido || (actor.role !== "ADMIN" && pedido.album?.userId !== actor.id)) {
    return NextResponse.json({ ok: false, error: "No encontramos ese pedido." }, { status: 404 });
  }

  // Una entrada por foto: si la misma foto va en varios tamaños, se juntan las etiquetas.
  const porFoto = new Map<number, string[]>();
  for (const it of pedido.items) {
    const texto = `${etiqueta(String(it.productType), it.size)}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`;
    porFoto.set(it.photoId, [...(porFoto.get(it.photoId) ?? []), texto]);
  }
  const ver = (photoId: number, mode: "thumb" | "preview") =>
    `/api/photos/${photoId}/view?${new URLSearchParams({ mode, albumId: String(pedido.albumId) })}`;
  return NextResponse.json(
    {
      ok: true,
      fotos: [...porFoto.entries()].map(([photoId, tipos]) => ({
        photoId,
        tipos,
        miniatura: ver(photoId, "thumb"),
        grande: ver(photoId, "preview"),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
