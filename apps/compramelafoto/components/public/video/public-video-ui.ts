import type { PublicVideoDto } from "@/lib/videos/public-video-dto";

export type VideoOrientation = "landscape" | "portrait" | "square";

function orientationFromDimensions(
  width?: number | null,
  height?: number | null
): VideoOrientation | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

export function normalizeVideoOrientation(
  raw: string | null | undefined,
  width?: number | null,
  height?: number | null
): VideoOrientation {
  const fromDims = orientationFromDimensions(width, height);
  if (raw === "landscape" || raw === "portrait" || raw === "square") {
    if (fromDims && fromDims !== raw) {
      return fromDims;
    }
    return raw;
  }
  return fromDims ?? "landscape";
}

export function aspectClassForOrientation(orientation: VideoOrientation): string {
  switch (orientation) {
    case "portrait":
      return "aspect-[9/16]";
    case "square":
      return "aspect-square";
    default:
      return "aspect-video";
  }
}

export function objectFitClassForOrientation(orientation: VideoOrientation): string {
  return orientation === "portrait" ? "object-contain" : "object-cover";
}

export function formatVideoDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function displayVideoTitle(video: PublicVideoDto): string {
  return video.title?.trim() || `Video ${video.id}`;
}

export function orientationLabel(orientation: VideoOrientation): string {
  switch (orientation) {
    case "portrait":
      return "Vertical";
    case "square":
      return "Cuadrado";
    default:
      return "Horizontal";
  }
}

export function devLogPublicVideoCard(video: PublicVideoDto, orientation: VideoOrientation) {
  if (process.env.NODE_ENV !== "development") return;
  console.log("[public-video-card]", {
    id: video.id,
    orientation,
    storedOrientation: video.orientation,
    width: video.width,
    height: video.height,
    previewUrl: video.previewUrl,
    thumbnailUrl: video.thumbnailUrl,
  });
  if (video.previewUrl) {
    console.log(
      `[public-video-card] Abrir preview en nueva pestaña: window.open(${JSON.stringify(video.previewUrl)})`
    );
  }
}
