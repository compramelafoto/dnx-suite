import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { albumUsaPagoSimulado } from "@/lib/demos/pago-simulado-galeria";
import { canAccessEventByShareSlug } from "@/lib/public/public-events";
import { cargarConfigPiloto } from "../split-1n-piloto/receptores-clf";
import { buscarOrganizador } from "../split-1n-piloto/organizador";
import { buscarReferidorActivo } from "../split-1n-piloto/referidor";
import { carritoActivoParaEvento, resolveCarritoConfig } from "./config";
import { evaluarElegibilidadGrupo, type AlbumDelCarrito, type MotivoGrupo } from "./elegibilidad-grupo";
import { eventoListoParaCarrito } from "./evento-listo";
import { marcarSnapshotGrupo, urlPagoGrupo } from "./marca";
import { describirCombinacion, preciosConPacksDelEvento, type PackDelEvento, type PreciosDelCarrito } from "./packs-evento";

export { urlPagoGrupo };

/** Tope de fotos por carrito: la galería del evento muestra hasta 500. */
export const MAX_FOTOS_CARRITO = 200;

export type AlbumDelEvento = {
  albumId: number;
  titulo: string;
  fotografo: string;
  photoIds: number[];
};

/** Álbum para pagar por separado cuando el carrito no puede ir en un solo pago. */
export type PagoPorAlbum = { albumId: number; fotografo: string; fotos: number; url: string };

export type ResultadoCarrito =
  | { ok: false; status: number; error: string }
  | { ok: true; modo: "por_album"; albumes: PagoPorAlbum[]; motivos: MotivoGrupo[] }
  | {
      ok: true;
      modo: "grupo";
      totalPesos: number;
      porFotografo: Array<{ albumId: number; fotografo: string; fotos: number; totalPesos: number }>;
      /** Packs del evento aplicados («1 × Pack digital 5 fotos + 2 fotos sueltas»), si alguno conviene. */
      pack?: { descripcion: string; totalSinPackPesos: number };
    }
  | { ok: true; modo: "pagar"; url: string; grupoId: string };

/** URL de compra de un álbum con las fotos ya elegidas (la misma que arma la galería). */
export function urlCompraAlbum(albumId: number, photoIds: number[]): string {
  const ids = [...new Set(photoIds)].sort((a, b) => a - b);
  return ids.length ? `/a/${albumId}/comprar?photoIds=${ids.join(",")}` : `/a/${albumId}/comprar`;
}

function idsDeFotos(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = new Set<number>();
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) return null;
    ids.add(n);
  }
  return [...ids];
}

/**
 * Carga el evento y las fotos elegidas, agrupadas por álbum, y evalúa si el carrito se cobra en
 * un solo pago. Sólo fotos visibles en la galería pública de ese evento.
 */
async function prepararCarrito(shareSlug: string, fotosRaw: unknown) {
  const event = await prisma.event.findUnique({
    where: { shareSlug },
    select: { id: true, title: true, visibility: true, archivedAt: true, creatorId: true },
  });
  const piloto = await cargarConfigPiloto();
  const carrito = resolveCarritoConfig();
  if (!event || !canAccessEventByShareSlug(event) || !carritoActivoParaEvento(carrito, piloto, event.id)) {
    return { ok: false as const, status: 404, error: "No disponible." };
  }
  const fotos = idsDeFotos(fotosRaw);
  if (!fotos || fotos.length === 0) {
    return { ok: false as const, status: 400, error: "Elegí al menos una foto." };
  }
  if (fotos.length > MAX_FOTOS_CARRITO) {
    return { ok: false as const, status: 400, error: `Podés comprar hasta ${MAX_FOTOS_CARRITO} fotos por vez.` };
  }

  const filas = await prisma.photo.findMany({
    where: {
      id: { in: fotos },
      isRemoved: false,
      album: { eventId: event.id, isHidden: false, isPublic: true, deletedAt: null },
    },
    select: {
      id: true,
      userId: true,
      albumId: true,
      album: {
        select: {
          title: true,
          userId: true,
          eventId: true,
          schoolId: true,
          user: { select: { id: true, name: true, tags: true } },
        },
      },
    },
  });
  if (filas.length !== fotos.length) {
    return {
      ok: false as const,
      status: 409,
      error: "Alguna de las fotos ya no está disponible. Recargá la página y volvé a elegir.",
    };
  }

  const porAlbum = new Map<number, { album: NonNullable<(typeof filas)[number]["album"]>; fotos: typeof filas }>();
  for (const f of filas) {
    if (!f.album) continue;
    const g = porAlbum.get(f.albumId) ?? { album: f.album, fotos: [] };
    g.fotos.push(f);
    porAlbum.set(f.albumId, g);
  }

  const organizador = await buscarOrganizador(event.id);
  const albumes: AlbumDelCarrito[] = [];
  const delEvento: AlbumDelEvento[] = [];
  for (const [albumId, { album, fotos: fotosAlbum }] of porAlbum) {
    const photographerUserId = album.userId ?? null;
    albumes.push({
      albumId,
      eventId: album.eventId,
      photographerUserId,
      referrerUserId: photographerUserId != null ? await buscarReferidorActivo(photographerUserId) : null,
      organizador,
      esEscolar: album.schoolId != null,
      items: fotosAlbum.map(() => ({ productType: "DIGITAL" })),
      tieneVideos: false,
      esCanje: false,
      esPagoSimulado: albumUsaPagoSimulado(album.user ?? null),
      origenEstandar: true,
      autoresDeFotos: fotosAlbum.map((f) => f.userId),
    });
    delEvento.push({
      albumId,
      titulo: album.title,
      fotografo: album.user?.name?.trim() || "Fotógrafo",
      photoIds: fotosAlbum.map((f) => f.id),
    });
  }
  delEvento.sort((a, b) => a.albumId - b.albumId);
  // Condición del carrito: todas las partes del evento aceptaron el cobro dividido. Si alguna
  // dejó de tenerlo, la compra se ofrece álbum por álbum, como siempre.
  const elegibilidad = (await eventoListoParaCarrito({ piloto, carrito, eventId: event.id }))
    ? evaluarElegibilidadGrupo({ piloto, carrito, eventId: event.id, albumes })
    : { ok: false as const, motivos: [{ albumId: null, motivo: "evento_incompleto" }] };
  return {
    ok: true as const,
    event,
    delEvento,
    elegibilidad,
    organizadorUserId: organizador?.userId ?? event.creatorId,
  };
}

function porAlbum(delEvento: AlbumDelEvento[], motivos: MotivoGrupo[]): ResultadoCarrito {
  console.info("[carrito-evento] por_album", { motivos });
  return {
    ok: true,
    modo: "por_album",
    motivos,
    albumes: delEvento.map((a) => ({
      albumId: a.albumId,
      fotografo: a.fotografo,
      fotos: a.photoIds.length,
      url: urlCompraAlbum(a.albumId, a.photoIds),
    })),
  };
}

function itemsDigitales(photoIds: number[]) {
  return photoIds.map((id) => ({ fileKey: albumPhotoFileKey(id), tipo: "digital" as const, quantity: 1 }));
}

/**
 * Packs del evento: los packs digitales activos del álbum de quien organiza el evento, con su
 * precio por foto suelta. Sólo packs de fotos digitales sin diseño ni impresiones. Nunca lanza:
 * ante un error, el carrito sigue con los precios de siempre.
 */
export async function cargarPacksDelEvento(
  eventId: number,
  organizadorUserId: number | null,
): Promise<{ precioSuelto: number; packs: PackDelEvento[] } | null> {
  if (organizadorUserId == null) return null;
  try {
    const album = await prisma.album.findFirst({
      where: {
        eventId,
        userId: organizadorUserId,
        deletedAt: null,
        isPublic: true,
        isHidden: false,
        albumPackPayEnabled: true,
      },
      orderBy: { id: "asc" },
      select: {
        digitalPhotoPriceCents: true,
        packs: {
          where: {
            isActive: true,
            packType: "DIGITAL",
            requiresDesign: false,
            includedPhotoCount: { gt: 0 },
            availabilityPhase: { in: ["POST_UPLOAD", "ALWAYS"] },
            components: { none: { kind: { in: ["PRINT", "DESIGN_PRODUCT"] } } },
          },
          select: { id: true, name: true, price: true, includedPhotoCount: true },
        },
      },
    });
    const precioSuelto = Math.round(Number(album?.digitalPhotoPriceCents ?? 0));
    if (!album || precioSuelto <= 0 || album.packs.length === 0) return null;
    return {
      precioSuelto,
      packs: album.packs.map((p) => ({ id: p.id, nombre: p.name, fotos: p.includedPhotoCount ?? 0, precio: p.price })),
    };
  } catch (err: unknown) {
    console.error("[carrito-evento] packs_no_leidos", { eventId, err });
    return null;
  }
}

async function preciosDelCarrito(
  eventId: number,
  organizadorUserId: number | null,
  delEvento: AlbumDelEvento[],
): Promise<PreciosDelCarrito | null> {
  const packs = await cargarPacksDelEvento(eventId, organizadorUserId);
  if (!packs) return null;
  return preciosConPacksDelEvento({
    albumes: delEvento.map((a) => ({ albumId: a.albumId, photoIds: a.photoIds })),
    precioSuelto: packs.precioSuelto,
    packs: packs.packs,
  });
}

/** Total del carrito, por fotógrafo, con los precios de cada álbum. No crea nada. */
export async function cotizarCarrito(shareSlug: string, fotosRaw: unknown): Promise<ResultadoCarrito> {
  const p = await prepararCarrito(shareSlug, fotosRaw);
  if (!p.ok) return p;
  if (!p.elegibilidad.ok) return porAlbum(p.delEvento, p.elegibilidad.motivos);

  const precios = await preciosDelCarrito(p.event.id, p.organizadorUserId, p.delEvento);
  const porFotografo = [];
  let totalPesos = 0;
  let totalSinPackPesos = 0;
  for (const a of p.delEvento) {
    const totals = await computeCheckoutTotals({
      flow: "ALBUM_ORDER",
      albumId: a.albumId,
      items: itemsDigitales(a.photoIds),
      digitalBasePesosPorFoto: precios?.basePorFoto ?? null,
    });
    const total = Math.round(totals.displayTotalCents);
    totalPesos += total;
    if (precios) {
      const sinPack = await computeCheckoutTotals({ flow: "ALBUM_ORDER", albumId: a.albumId, items: itemsDigitales(a.photoIds) });
      totalSinPackPesos += Math.round(sinPack.displayTotalCents);
    }
    porFotografo.push({ albumId: a.albumId, fotografo: a.fotografo, fotos: a.photoIds.length, totalPesos: total });
  }
  const pack =
    precios && totalSinPackPesos > totalPesos
      ? { descripcion: describirCombinacion(precios.combinacion), totalSinPackPesos }
      : undefined;
  return { ok: true, modo: "grupo", totalPesos, porFotografo, ...(pack ? { pack } : {}) };
}

/**
 * Crea un pedido por álbum con la ruta de pedidos de siempre y los agrupa bajo un cobro.
 * `crearPedido` es esa ruta (se inyecta para que este módulo no dependa de Next).
 *
 * Todo o nada: si un álbum no puede ir por el split no se crea nada y se ofrece pagar cada
 * álbum por separado; si falla la creación de un pedido, los ya creados quedan `FAILED`.
 */
export async function crearCarritoEvento(params: {
  shareSlug: string;
  fotos: unknown;
  crearPedido: (
    albumId: number,
    items: ReturnType<typeof itemsDigitales>,
    /** Precio base por foto con los packs del evento (si alguno conviene). */
    basePorFoto: ReadonlyMap<number, number> | null,
  ) => Promise<
    { ok: true; pedidoId: number } | { ok: false; status: number; error: string }
  >;
}): Promise<ResultadoCarrito> {
  const p = await prepararCarrito(params.shareSlug, params.fotos);
  if (!p.ok) return p;
  if (!p.elegibilidad.ok) return porAlbum(p.delEvento, p.elegibilidad.motivos);

  const precios = await preciosDelCarrito(p.event.id, p.organizadorUserId, p.delEvento);
  const creados: number[] = [];
  const deshacer = async () => {
    if (creados.length === 0) return;
    await prisma.order
      .updateMany({ where: { id: { in: creados }, status: "PENDING" }, data: { status: "FAILED" } })
      .catch((err: unknown) => console.error("[carrito-evento] deshacer_fallido", { creados, err }));
  };

  for (const a of p.delEvento) {
    let r: Awaited<ReturnType<typeof params.crearPedido>>;
    try {
      r = await params.crearPedido(a.albumId, itemsDigitales(a.photoIds), precios?.basePorFoto ?? null);
    } catch (err: unknown) {
      console.error("[carrito-evento] crear_pedido_fallido", { albumId: a.albumId, err });
      r = { ok: false, status: 500, error: "No pudimos armar tu compra. Probá de nuevo en unos minutos." };
    }
    if (!r.ok) {
      await deshacer();
      return r;
    }
    creados.push(r.pedidoId);
  }

  const grupoId = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      const pedidos = await tx.order.findMany({
        where: { id: { in: creados } },
        select: { id: true, pricingSnapshot: true },
      });
      for (const pedido of pedidos) {
        const r = await tx.order.updateMany({
          where: { id: pedido.id, status: "PENDING" },
          data: {
            pricingSnapshot: marcarSnapshotGrupo(pedido.pricingSnapshot, {
              grupoId,
              pedidos: creados,
              estado: "PENDIENTE",
            }) as Prisma.InputJsonValue,
          },
        });
        if (r.count !== 1) throw new Error(`pedido_no_marcado_${pedido.id}`);
      }
      if (pedidos.length !== creados.length) throw new Error("pedidos_incompletos");
    });
  } catch (err: unknown) {
    console.error("[carrito-evento] marcar_grupo_fallido", { creados, err });
    await deshacer();
    return { ok: false, status: 500, error: "No pudimos armar tu compra. Probá de nuevo en unos minutos." };
  }
  console.info("[carrito-evento] grupo_creado", { grupoId, pedidos: creados, eventId: p.event.id });
  return { ok: true, modo: "pagar", url: urlPagoGrupo(grupoId), grupoId };
}
