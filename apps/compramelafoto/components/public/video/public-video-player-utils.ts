import type { PublicVideoDto } from "@/lib/videos/public-video-dto";

export type PublicVideoPlayerErrorInfo = {
  message: string;
  errorCode: number | null;
  networkState: number;
  readyState: number;
};

export function readVideoElementError(el: HTMLVideoElement): PublicVideoPlayerErrorInfo {
  const code = el.error?.code ?? null;
  let message = "No se pudo reproducir la vista previa";
  if (code === MediaError.MEDIA_ERR_ABORTED) {
    message = "Reproducción cancelada";
  } else if (code === MediaError.MEDIA_ERR_NETWORK) {
    message = "No se pudo reproducir la vista previa (error de red o CORS)";
  } else if (code === MediaError.MEDIA_ERR_DECODE) {
    message = "No se pudo reproducir la vista previa (formato no soportado)";
  } else if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    message = "No se pudo reproducir la vista previa (URL no accesible)";
  }

  return {
    message,
    errorCode: code,
    networkState: el.networkState,
    readyState: el.readyState,
  };
}

export function logPublicVideoPlayerError(
  video: Pick<PublicVideoDto, "id" | "previewUrl">,
  info: PublicVideoPlayerErrorInfo
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn("[public-video-player-error]", {
    id: video.id,
    previewUrl: video.previewUrl,
    errorCode: info.errorCode,
    networkState: info.networkState,
    readyState: info.readyState,
    message: info.message,
  });
}

export function openPreviewInNewTab(previewUrl: string | null | undefined): void {
  if (!previewUrl?.trim()) return;
  window.open(previewUrl, "_blank", "noopener,noreferrer");
}
