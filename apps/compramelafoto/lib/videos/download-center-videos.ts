import { isVideoFilePurged } from "@/lib/videos/video-download-access";

/**
 * Los videos comprados, para la pantalla donde el cliente descarga lo suyo.
 *
 * Van al lado de las fotos, en la misma pantalla: el cliente compró una vez y
 * descarga de un solo lugar. La diferencia con las fotos es que el video no
 * entra en el zip — cada uno se baja por su cuenta, con su propio link.
 */

export type DownloadCenterVideo = {
  videoId: number;
  title: string;
  durationLabel: string | null;
  thumbnailKey: string | null;
  /** `null` si el archivo ya no está. */
  downloadUrl: string | null;
  available: boolean;
  unavailableReason: string | null;
};

export type VideoOrderItemRow = {
  videoId: number;
  videoTitle: string | null;
  video: {
    id: number;
    originalKey: string;
    durationSeconds: number | null;
    thumbnailKey: string | null;
  } | null;
};

export function buildDownloadCenterVideos(
  items: VideoOrderItemRow[],
  opts: { accessToken: string; baseUrl?: string }
): DownloadCenterVideo[] {
  const base = opts.baseUrl?.replace(/\/$/, "") ?? "";

  return items.map((item) => {
    // El título se guarda en el pedido justamente para esto: el video se borra
    // a los 15 días y el cliente tiene que seguir sabiendo qué compró.
    const title = item.videoTitle?.trim() || `Video ${item.videoId}`;

    const purgado = !item.video || isVideoFilePurged(item.video);
    if (purgado) {
      return {
        videoId: item.videoId,
        title,
        durationLabel: formatDuration(item.video?.durationSeconds ?? null),
        thumbnailKey: null,
        downloadUrl: null,
        available: false,
        unavailableReason:
          "El archivo ya no está disponible: pasaron los 15 días de publicación",
      };
    }

    return {
      videoId: item.videoId,
      title,
      durationLabel: formatDuration(item.video!.durationSeconds),
      thumbnailKey: item.video!.thumbnailKey,
      downloadUrl: `${base}/api/descargas/${opts.accessToken}/videos/${item.videoId}`,
      available: true,
      unavailableReason: null,
    };
  });
}

/** "12:00" a partir de los segundos. */
function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
