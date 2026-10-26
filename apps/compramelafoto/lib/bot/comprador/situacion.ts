import { computeAlbumHideAt } from "@/lib/album-cleanup/eligibility";
import { resolveDownloadLinkDays } from "@/lib/digital-download/download-link-policy";
import { albumConOriginales } from "@/lib/digital-download/reenviar-descarga";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import { fechaAR } from "./herramientas/lectura";
import { albumVisiblePara } from "./herramientas/visibilidad";
import { nivelDe, type CompradorActor } from "./identidad";
import { enmascararEmail, etiquetaEstadoPedido } from "./mascara";
import type { PaginaComprador } from "./pagina";

/*
 * Situación del comprador para el modelo: texto variable (no se cachea), armado en cada turno.
 * Nunca lleva tokens de descarga o de pack ni mails completos (Review Focus 2): sólo números de
 * pedido, el mail enmascarado y datos del álbum sin precios (los precios salen de cotizar_fotos).
 * Si una consulta falla, se omite su línea: la situación nunca corta el turno.
 */

const RESULTADO_PAGO: Record<"failure" | "pending" | "success", string> = {
  failure: "fallido",
  pending: "pendiente",
  success: "aprobado",
};

type AlbumSituacion = { linea: string; titulo: string | null };

/** "20/10": día y mes en hora argentina. */
function diaMes(d: Date): string {
  return fechaAR(d).slice(0, 5);
}

async function intentar<T>(que: string, f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    console.error(`[bot comprador] situación: falló ${que}`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function datosDelAlbum(a: CompradorActor, albumId: number): Promise<AlbumSituacion | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true, title: true, isPublic: true, isHidden: true, deletedAt: true, cleanupStatus: true,
      firstPhotoDate: true, expirationExtensionDays: true, hiddenPhotosEnabled: true,
    },
  });
  if (!album) return null;
  // El título sólo si la persona puede ver el álbum o tiene el enlace de un pedido de ese álbum.
  if (!albumVisiblePara(a, album) && a.enlace?.albumId !== album.id) {
    return { linea: `Álbum #${album.id} · oculto`, titulo: null };
  }
  const [fotos, packsPreventa] = await Promise.all([
    prisma.photo.count({ where: { albumId: album.id, isRemoved: false } }),
    prisma.packDefinition.count({ where: { albumId: album.id, isActive: true } }),
  ]);
  // Desde la primera foto, como ver_album y la galería: `expiresAt` nace con el álbum y miente.
  const visibleHasta = computeAlbumHideAt(album);
  const estado = !albumConOriginales(album)
    ? "ya no está disponible"
    : !visibleHasta
      ? "disponible"
      : visibleHasta.getTime() < Date.now()
        ? `venció el ${diaMes(visibleHasta)}`
        : `disponible hasta el ${diaMes(visibleHasta)}`;
  return {
    titulo: album.title,
    linea: [
      `Álbum #${album.id} «${album.title}»`,
      estado,
      `${fotos} fotos`,
      `fotos ocultas: ${album.hiddenPhotosEnabled ? "sí" : "no"}`,
      `preventa: ${packsPreventa > 0 ? "sí" : "no"}`,
    ].join(" · "),
  };
}

/** Pedido de la página: el del enlace (probó que es suyo) o el de la página de pago (sólo el estado). */
function pedidoDeLaPagina(a: CompradorActor): number | null {
  if (a.enlace) return a.enlace.orderId;
  if (a.pagina?.tipo === "pago") return a.pagina.orderId;
  return null;
}

async function datosDelPedido(a: CompradorActor, orderId: number): Promise<string | null> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, isTest: true } });
  if (!o || o.isTest) return null;
  let linea = `Pedido #${o.id}: ${etiquetaEstadoPedido(o.status)}`;
  if (a.enlace?.tipo === "descarga" && a.enlace.orderId === o.id) {
    const token = await prisma.orderDownloadToken.findFirst({
      where: { orderId: o.id, type: "CLIENT_DIGITAL", photoId: null },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    });
    if (token) {
      linea += token.expiresAt.getTime() > Date.now() ? ` · descarga vigente hasta ${diaMes(token.expiresAt)}` : " · descarga vencida";
    }
  }
  return linea;
}

function lineaPagina(a: CompradorActor, p: PaginaComprador | null, album: AlbumSituacion | null): string {
  const delAlbum = album?.titulo ? ` «${album.titulo}»` : a.albumId != null ? ` #${a.albumId}` : "";
  if (!p) return "Página: otra página del sitio";
  switch (p.tipo) {
    case "album":
      return `Página: álbum${delAlbum}`;
    case "album_id":
      return p.photoId != null ? `Página: pedir que se quite la foto #${p.photoId} del álbum${delAlbum}` : `Página: álbum${delAlbum}`;
    case "descarga":
      return a.enlace?.tipo === "descarga"
        ? `Página: descarga del pedido #${a.enlace.orderId}`
        : "Página: descarga (el enlace no es válido)";
    case "pack":
      return a.enlace?.tipo === "pack"
        ? `Página: pack de preventa del pedido #${a.enlace.orderId}`
        : "Página: pack de preventa (el enlace venció o no es válido)";
    case "recuperar_pack":
      return "Página: recuperar el enlace del pack de preventa";
    case "pago":
      return `Página: resultado de pago (${RESULTADO_PAGO[p.resultado]})${p.orderId != null ? ` del pedido #${p.orderId}` : ""}`;
    case "mis_pedidos":
      return "Página: mis pedidos";
    case "soporte":
      return "Página: soporte";
    case "caso":
      return "Página: seguimiento de un reclamo (link del mail de respuesta)";
  }
}

function lineaNivel(a: CompradorActor): string {
  switch (nivelDe(a)) {
    case "verificado":
      return `Nivel: verificado (${enmascararEmail(a.emailVerificado)})`;
    case "con_enlace":
      return `Nivel: con enlace (pedido #${a.enlace!.orderId})`;
    default:
      return "Nivel: visitante";
  }
}

/** Situación del comprador en este turno. No lanza. */
export async function buildBuyerSituation(a: CompradorActor): Promise<string> {
  const orderId = pedidoDeLaPagina(a);
  const [album, pedido, dias] = await Promise.all([
    a.albumId != null ? intentar("el álbum", () => datosDelAlbum(a, a.albumId!)) : Promise.resolve(null),
    orderId != null ? intentar("el pedido", () => datosDelPedido(a, orderId)) : Promise.resolve(null),
    intentar("la configuración", async () => resolveDownloadLinkDays(await getAppConfig())),
  ]);

  const lineas = ["# Situación", lineaPagina(a, a.pagina, album), lineaNivel(a)];
  if (album) lineas.push(album.linea);
  if (pedido) lineas.push(pedido);
  if (dias != null) lineas.push(`Los enlaces de descarga duran ${dias} días.`);
  return lineas.join("\n");
}
