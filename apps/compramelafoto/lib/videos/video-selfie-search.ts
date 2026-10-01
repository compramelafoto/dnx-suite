import type { PrismaClient } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { VIDEO_CATEGORY_LABELS } from "@/lib/videos/video-validation";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import {
  formatVideoTimestamp,
  summarizeVideoMatches,
  type FrameFaceHit,
  type VideoSelfieHit,
} from "@/lib/videos/video-frame-matching";

/**
 * Busca en qué videos del álbum aparece la persona de la selfie.
 *
 * Reusa los ids de cara que ya devolvió la única llamada a Amazon que hace la
 * búsqueda de fotos: no cuesta una consulta más al proveedor. Lo que agrega es
 * el segundo exacto del video donde mejor se la reconoce, que es lo que permite
 * llevar al cliente directo a ese momento del reproductor.
 */
export async function findVideosBySelfieFaceIds(
  prisma: PrismaClient,
  params: {
    albumId: number;
    faceIds: string[];
    similarityByFace: Map<string, number>;
  }
): Promise<VideoSelfieHit[]> {
  if (!isVideoMvpEnabled()) return [];
  if (params.faceIds.length === 0) return [];

  const caras = await prisma.videoFrameFace.findMany({
    where: { rekognitionFaceId: { in: params.faceIds } },
    select: {
      rekognitionFaceId: true,
      videoFrame: {
        select: {
          timeSeconds: true,
          videoId: true,
          albumId: true,
          video: {
            select: {
              id: true,
              title: true,
              category: true,
              durationSeconds: true,
              thumbnailKey: true,
              previewKey: true,
              isRemoved: true,
              expiresAt: true,
              processingStatus: true,
            },
          },
        },
      },
    },
  });

  const ahora = new Date();
  const hits: FrameFaceHit[] = [];
  const videos = new Map<number, NonNullable<(typeof caras)[number]["videoFrame"]>["video"]>();

  for (const cara of caras) {
    const frame = cara.videoFrame;
    if (!frame || frame.albumId !== params.albumId) continue;

    const video = frame.video;
    // Mismas condiciones que la galería pública: no ofrecer lo que no se puede ver.
    if (
      video.isRemoved ||
      video.processingStatus !== "READY" ||
      video.expiresAt.getTime() <= ahora.getTime()
    ) {
      continue;
    }

    hits.push({
      videoId: frame.videoId,
      timeSeconds: frame.timeSeconds,
      similarity: params.similarityByFace.get(cara.rekognitionFaceId) ?? 0,
    });
    videos.set(video.id, video);
  }

  return summarizeVideoMatches(hits).flatMap((match) => {
    const video = videos.get(match.videoId);
    if (!video) return [];
    return [
      {
        ...match,
        title: video.title,
        categoryLabel: VIDEO_CATEGORY_LABELS[video.category],
        durationSeconds: video.durationSeconds,
        thumbnailUrl: r2UrlOrNull(video.thumbnailKey),
        previewUrl: r2UrlOrNull(video.previewKey),
        timestampLabel: formatVideoTimestamp(match.timeSeconds),
      },
    ];
  });
}

function r2UrlOrNull(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  try {
    return getR2PublicUrl(key);
  } catch {
    return null;
  }
}
