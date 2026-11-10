import type { PilotoConfig } from "../split-1n-piloto/config";
import type { CarritoConfig } from "./config";
import { evaluarElegibilidadGrupo, type AlbumDelCarrito, type ElegibilidadGrupo } from "./elegibilidad-grupo";

/**
 * ¿Todas las partes del evento aceptaron el cobro dividido? Condición para mostrar el carrito:
 * cada álbum público con fotos del evento tiene que poder cobrar por el split (fotógrafo,
 * referidores y organizador con la autorización de Mercado Pago ACTIVA, sólo un autor por
 * álbum, nada escolar ni de demostración). Si una sola parte falta, el evento sigue como hoy:
 * cada foto lleva a su álbum.
 *
 * El tope de receptores no se mira acá: es por compra (una compra elige algunos álbumes) y lo
 * controla el carrito al cobrar.
 */
export function evaluarEventoCompleto(params: {
  piloto: PilotoConfig;
  carrito: CarritoConfig;
  eventId: number;
  albumes: AlbumDelCarrito[];
}): ElegibilidadGrupo {
  return evaluarElegibilidadGrupo({
    ...params,
    carrito: { ...params.carrito, maxReceptores: Number.POSITIVE_INFINITY },
  });
}

/** Lee de la base los álbumes públicos con fotos del evento y evalúa si todas las partes aceptaron. */
export async function eventoListoParaCarrito(params: {
  piloto: PilotoConfig;
  carrito: CarritoConfig;
  eventId: number;
}): Promise<boolean> {
  try {
    const [{ prisma }, { buscarOrganizador }, { buscarReferidorActivo }, { albumUsaPagoSimulado }] =
      await Promise.all([
        import("@/lib/prisma"),
        import("../split-1n-piloto/organizador"),
        import("../split-1n-piloto/referidor"),
        import("@/lib/demos/pago-simulado-galeria"),
      ]);
    const albumes = await prisma.album.findMany({
      where: {
        eventId: params.eventId,
        isPublic: true,
        isHidden: false,
        deletedAt: null,
        photos: { some: { isRemoved: false } },
      },
      select: {
        id: true,
        userId: true,
        eventId: true,
        schoolId: true,
        user: { select: { id: true, tags: true } },
        photos: { where: { isRemoved: false }, select: { userId: true }, distinct: ["userId"] },
      },
    });
    const organizador = await buscarOrganizador(params.eventId);
    const referidores = new Map<number, number | null>();
    const entrada: AlbumDelCarrito[] = [];
    for (const a of albumes) {
      const photographerUserId = a.userId ?? null;
      if (photographerUserId != null && !referidores.has(photographerUserId)) {
        referidores.set(photographerUserId, await buscarReferidorActivo(photographerUserId));
      }
      entrada.push({
        albumId: a.id,
        eventId: a.eventId,
        photographerUserId,
        referrerUserId: photographerUserId != null ? referidores.get(photographerUserId) ?? null : null,
        organizador,
        esEscolar: a.schoolId != null,
        items: [{ productType: "DIGITAL" }],
        tieneVideos: false,
        esCanje: false,
        esPagoSimulado: albumUsaPagoSimulado(a.user ?? null),
        origenEstandar: true,
        autoresDeFotos: a.photos.map((p) => p.userId),
      });
    }
    const r = evaluarEventoCompleto({ ...params, albumes: entrada });
    if (!r.ok) console.info("[carrito-evento] evento_no_listo", { eventId: params.eventId, motivos: r.motivos });
    return r.ok;
  } catch (err: unknown) {
    // Ante la duda, el evento sigue como hoy.
    console.error("[carrito-evento] evento_listo_fallido", {
      eventId: params.eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
