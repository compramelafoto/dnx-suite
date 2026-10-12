import { prisma } from "@/lib/prisma";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import type { PaginaComprador } from "./pagina";

/** Enlace de descarga o de pack que la persona tiene abierto: prueba que el pedido es suyo. */
export type EnlaceComprador = { tipo: "descarga" | "pack"; orderId: number; albumId: number };
export type DatosPagina = { albumId: number | null; orderId: number | null; enlace: EnlaceComprador | null };

const VACIO: DatosPagina = { albumId: null, orderId: null, enlace: null };

async function albumDelPedido(orderId: number): Promise<number | null> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { albumId: true } });
  return o?.albumId ?? null;
}

function conEnlace(tipo: EnlaceComprador["tipo"], orderId: number, albumId: number): DatosPagina {
  return { albumId, orderId, enlace: { tipo, orderId, albumId } };
}

async function resolver(p: PaginaComprador | null): Promise<DatosPagina> {
  if (!p) return VACIO;
  switch (p.tipo) {
    case "album": {
      const a = await prisma.album.findUnique({ where: { publicSlug: p.slug }, select: { id: true } });
      return a ? { ...VACIO, albumId: a.id } : VACIO;
    }
    case "album_id": {
      const a = await prisma.album.findUnique({ where: { id: p.albumId }, select: { id: true } });
      return a ? { ...VACIO, albumId: a.id } : VACIO;
    }
    case "descarga": {
      const t = await prisma.orderDownloadToken.findUnique({
        where: { token: p.token },
        select: { orderId: true, albumId: true, type: true },
      });
      // Aunque esté vencido: tenerlo prueba que el pedido es suyo y así puede renovarlo.
      if (!t || t.type !== "CLIENT_DIGITAL" || t.orderId == null) return VACIO;
      const albumId = t.albumId ?? (await albumDelPedido(t.orderId));
      return albumId == null ? VACIO : conEnlace("descarga", t.orderId, albumId);
    }
    case "pack": {
      const r = await getOrderIdForPackAccessToken(p.token);
      if (!r.ok) return VACIO; // vencido, revocado o inválido
      const albumId = await albumDelPedido(r.orderId);
      return albumId == null ? VACIO : conEnlace("pack", r.orderId, albumId);
    }
    case "pago": {
      if (p.orderId == null) return VACIO;
      const albumId = await albumDelPedido(p.orderId);
      return albumId == null ? VACIO : { albumId, orderId: p.orderId, enlace: null };
    }
    default:
      return VACIO;
  }
}

/** Datos de la página para el bot. Nunca lanza: si la base falla, todo null. */
export async function resolverPagina(p: PaginaComprador | null): Promise<DatosPagina> {
  try {
    return await resolver(p);
  } catch (e) {
    console.error("[bot comprador] no se pudo resolver la página", e);
    return VACIO;
  }
}
