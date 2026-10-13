import { NextResponse } from "next/server";
import { requireAlbumOwnerOrAdmin } from "@/lib/canje-externo/require-album-owner";
import { albumTienePacksCanjeables, prepararPackDePrueba } from "@/lib/canje-externo/crear-pack-de-prueba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id?: string }> };

/** GET — ¿se puede "Probar como cliente" en este álbum? (tiene packs de preventa canjeables). */
export async function GET(_req: Request, { params }: Ctx) {
  const access = await requireAlbumOwnerOrAdmin((await params).id);
  if (!access.ok) return access.response;
  return NextResponse.json({ disponible: await albumTienePacksCanjeables(access.albumId) });
}

/**
 * POST — "Probar como cliente": crea (o reusa y reinicia) el pack de prueba del álbum y devuelve
 * el link del canje, para abrirlo como lo abriría una familia. Sólo dueño del álbum o admin.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const access = await requireAlbumOwnerOrAdmin((await params).id);
  if (!access.ok) return access.response;
  try {
    const r = await prepararPackDePrueba(access.albumId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({
      url: `/canje/preventa/${encodeURIComponent(r.token)}`,
      orderId: r.orderId,
      reutilizado: r.reutilizado,
    });
  } catch (err) {
    console.error("POST /api/dashboard/albums/[id]/pack-de-prueba", err);
    return NextResponse.json({ error: "No pudimos armar la prueba. Probá de nuevo." }, { status: 500 });
  }
}
