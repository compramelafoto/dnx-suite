/**
 * Único punto del módulo que toca Prisma. Se mantiene separado de las funciones puras
 * (`album-instructivo-profile`, `album-instructivo-steps`) para que las combinaciones se
 * puedan probar sin base de datos.
 */

import { prisma } from "@/lib/prisma";
import { getAlbumReadiness } from "@/lib/analysis/album-analysis-readiness";
import { countPublicReadyVideos } from "@/lib/videos/public-ready-videos";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";

/**
 * Mismo criterio que la galería pública (`app/a/[id]/page.tsx`): el logo puede estar
 * guardado como URL absoluta o como clave de R2, y una URL de localhost no sirve fuera
 * de la máquina del desarrollador.
 */
function normalizarLogo(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    if (!logoUrl.includes("localhost") && !logoUrl.includes("127.0.0.1")) return logoUrl;
    return getR2PublicUrl(urlToR2Key(logoUrl));
  }
  return getR2PublicUrl(logoUrl.replace(/^\//, ""));
}
import {
  resolveAlbumInstructivoProfile,
  type AlbumInstructivoProfile,
} from "./album-instructivo-profile";

function baseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://compramelafoto.com";
  return raw.replace(/\/+$/, "");
}

const SELECCION_ALBUM = {
  id: true,
  title: true,
  publicSlug: true,
  isPublic: true,
  isHidden: true,
  hiddenPhotosEnabled: true,
  preCompraCloseAt: true,
  enableDigitalPhotos: true,
  enablePrintedPhotos: true,
  includeDigitalWithPrint: true,
  deliveryType: true,
  pickupBy: true,
  expiresAt: true,
  deletedAt: true,
  selectedLabId: true,
  user: {
    select: { name: true, logoUrl: true, primaryColor: true, handler: true },
  },
} as const;

export async function loadAlbumInstructivo(
  slugOrId: string,
  ahora: Date = new Date()
): Promise<AlbumInstructivoProfile | null> {
  const clave = slugOrId.trim();
  if (!clave) return null;

  let album = await prisma.album.findUnique({
    where: { publicSlug: clave },
    select: SELECCION_ALBUM,
  });
  if (!album && /^\d+$/.test(clave)) {
    album = await prisma.album.findUnique({
      where: { id: Number.parseInt(clave, 10) },
      select: SELECCION_ALBUM,
    });
  }
  if (!album || album.deletedAt) return null;

  const [
    fotosCargadas,
    rostrosDetectados,
    tokens,
    readiness,
    packsGaleriaActivos,
    packsPreventaAlbumPack,
    packsPreventaDefinition,
    videosPublicados,
    lab,
  ] = await Promise.all([
    prisma.photo.count({ where: { albumId: album.id } }),
    prisma.photoFace.count({ where: { photo: { albumId: album.id } } }),
    prisma.ocrToken.findMany({
      where: { photo: { albumId: album.id } },
      select: { textNorm: true },
      take: 500,
    }),
    getAlbumReadiness(album.id),
    prisma.albumPack.count({
      where: {
        albumId: album.id,
        isActive: true,
        availabilityPhase: { in: ["POST_UPLOAD", "ALWAYS"] },
      },
    }),
    prisma.albumPack.count({
      where: { albumId: album.id, isActive: true, availabilityPhase: "PRE_UPLOAD" },
    }),
    prisma.packDefinition.count({
      where: { albumId: album.id, isActive: true, availabilityPhase: "PRE_UPLOAD" },
    }),
    // El helper ya sabe qué video cuenta como publicado y respeta el flag del módulo.
    countPublicReadyVideos(prisma, album.id),
    album.selectedLabId
      ? prisma.lab.findUnique({ where: { id: album.selectedLabId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const tokensNumericos = tokens.filter((t) => /^\d+$/.test(t.textNorm)).length;
  const tokensDeTexto = tokens.length - tokensNumericos;

  return resolveAlbumInstructivoProfile({
    album: {
      id: album.id,
      title: album.title,
      publicSlug: album.publicSlug,
      isPublic: album.isPublic,
      isHidden: album.isHidden,
      hiddenPhotosEnabled: album.hiddenPhotosEnabled,
      preCompraCloseAt: album.preCompraCloseAt,
      enableDigitalPhotos: album.enableDigitalPhotos,
      enablePrintedPhotos: album.enablePrintedPhotos,
      includeDigitalWithPrint: album.includeDigitalWithPrint,
      deliveryType: album.deliveryType ? String(album.deliveryType) : null,
      pickupBy: album.pickupBy ? String(album.pickupBy) : null,
      expiresAt: album.expiresAt,
    },
    fotografo: {
      nombre: album.user?.name ?? null,
      logoUrl: normalizarLogo(album.user?.logoUrl),
      primaryColor: album.user?.primaryColor ?? null,
      handler: album.user?.handler ?? null,
    },
    senales: {
      fotosCargadas,
      rostrosDetectados,
      tokensNumericos,
      tokensDeTexto,
      packsPreventaActivos: packsPreventaAlbumPack + packsPreventaDefinition,
      packsGaleriaActivos,
      videosPublicados,
      laboratorio: lab?.name ?? null,
      listo: readiness.ready,
    },
    baseUrl: baseUrl(),
    ahora,
  });
}
