import "server-only";
import { prisma } from "@repo/db";
import { enlaceDelAlbumClf, interpretarEnlaceClf } from "./enlace";
import { leerResumenAlbumClf, type DepsResumenClf } from "./resumen";

/**
 * Vínculo de un pedido (o de un proyecto sin pedido) con su álbum de CompraMeLaFoto (etapa 1 de la
 * conexión FOTOFFICE ↔ CLF). Sin permisos: quien llama ya validó el nivel en el módulo del destino.
 * Todo id se valida contra el workspace.
 */

export type DestinoVinculo = { pedidoId: string } | { proyectoId: string };

export type VinculoVista = {
  titulo: string;
  enlace: string;
  albumId: number;
  tienePreventa: boolean;
  preventaCierraEl: Date | null;
  /** El proyecto muestra el álbum de su pedido: no se edita desde el proyecto. */
  heredadoDelPedido: boolean;
};

export const MENSAJES_VINCULO_CLF = {
  enlace: "Pegá el enlace del álbum o de la preventa de CompraMeLaFoto.",
  noExiste: "Ese álbum no existe en CompraMeLaFoto o no está publicado.",
  sinConexion: "No pudimos consultar CompraMeLaFoto. Probá de nuevo en un rato.",
  pedido: "No encontramos el pedido.",
  proyecto: "No encontramos el proyecto.",
  heredado: "Este proyecto toma el álbum de su pedido. Vinculalo desde el pedido.",
} as const;

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

const SELECT = { clfAlbumId: true, albumSlug: true, tituloSnapshot: true, tienePreventa: true, preventaCierraEl: true } as const;

type FilaVinculo = { clfAlbumId: number; albumSlug: string; tituloSnapshot: string; tienePreventa: boolean; preventaCierraEl: Date | null };

function aVista(f: FilaVinculo, heredadoDelPedido: boolean): VinculoVista {
  return {
    titulo: f.tituloSnapshot,
    enlace: enlaceDelAlbumClf({ slug: f.albumSlug, tienePreventa: f.tienePreventa }),
    albumId: f.clfAlbumId,
    tienePreventa: f.tienePreventa,
    preventaCierraEl: f.preventaCierraEl,
    heredadoDelPedido,
  };
}

/** Dónde vive el vínculo: el pedido, o el proyecto si no tiene pedido. null si el destino no es del workspace. */
async function resolverDestino(
  workspaceId: string,
  destino: DestinoVinculo,
): Promise<{ donde: { pedidoId: string } | { proyectoId: string }; heredado: boolean } | { error: string }> {
  if ("pedidoId" in destino) {
    const p = await prisma.fotofficePedido.findFirst({ where: { id: destino.pedidoId, workspaceId }, select: { id: true } });
    return p ? { donde: { pedidoId: p.id }, heredado: false } : { error: MENSAJES_VINCULO_CLF.pedido };
  }
  const pr = await prisma.fotofficeProyecto.findFirst({ where: { id: destino.proyectoId, workspaceId }, select: { id: true, pedidoId: true } });
  if (!pr) return { error: MENSAJES_VINCULO_CLF.proyecto };
  return pr.pedidoId ? { donde: { pedidoId: pr.pedidoId }, heredado: true } : { donde: { proyectoId: pr.id }, heredado: false };
}

export async function vinculoDe(workspaceId: string, destino: DestinoVinculo): Promise<VinculoVista | null> {
  const d = await resolverDestino(workspaceId, destino);
  if ("error" in d) return null;
  const f = await prisma.fotofficeClfVinculo.findFirst({ where: { workspaceId, ...d.donde }, select: SELECT });
  return f ? aVista(f, d.heredado) : null;
}

/** Para `[preventa_enlace]`: el enlace del álbum vinculado al pedido, o null. */
export async function enlacePreventaDelPedido(workspaceId: string, pedidoId: string): Promise<string | null> {
  const f = await prisma.fotofficeClfVinculo.findFirst({ where: { workspaceId, pedidoId }, select: SELECT });
  return f ? aVista(f, false).enlace : null;
}

export async function vincularAlbum(
  workspaceId: string,
  userId: number,
  destino: DestinoVinculo,
  texto: string,
  deps: DepsResumenClf = {},
): Promise<Resultado<{ vinculo: VinculoVista }>> {
  const ref = interpretarEnlaceClf(texto);
  if (!ref) return { ok: false, error: MENSAJES_VINCULO_CLF.enlace };
  const d = await resolverDestino(workspaceId, destino);
  if ("error" in d) return { ok: false, error: d.error };
  if (d.heredado) return { ok: false, error: MENSAJES_VINCULO_CLF.heredado };

  const r = await leerResumenAlbumClf(ref, deps);
  if (!r.ok) return { ok: false, error: r.codigo === "NO_EXISTE" ? MENSAJES_VINCULO_CLF.noExiste : MENSAJES_VINCULO_CLF.sinConexion };

  const datos = {
    clfAlbumId: r.resumen.id,
    albumSlug: r.resumen.slug,
    tituloSnapshot: r.resumen.titulo,
    tienePreventa: r.resumen.tienePreventa,
    preventaCierraEl: r.resumen.preventaCierraEl,
    creadoPorUserId: userId,
  };
  const f = await prisma.fotofficeClfVinculo.upsert({
    where: "pedidoId" in d.donde ? { pedidoId: d.donde.pedidoId } : { proyectoId: d.donde.proyectoId },
    create: { workspaceId, ...d.donde, ...datos },
    update: datos,
    select: SELECT,
  });
  return { ok: true, vinculo: aVista(f, false) };
}

export async function quitarVinculo(workspaceId: string, destino: DestinoVinculo): Promise<Resultado<object>> {
  const d = await resolverDestino(workspaceId, destino);
  if ("error" in d) return { ok: false, error: d.error };
  if (d.heredado) return { ok: false, error: MENSAJES_VINCULO_CLF.heredado };
  await prisma.fotofficeClfVinculo.deleteMany({ where: { workspaceId, ...d.donde } });
  return { ok: true };
}
