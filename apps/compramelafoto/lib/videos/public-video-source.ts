import type { PublicVideoDto } from "@/lib/videos/public-video-dto";
import {
  albumPublicVideosApiPath,
  eventPublicVideosApiPath,
} from "@/lib/videos/public-video-api-paths";

export type PublicVideoSource =
  | { type: "album"; slug: string }
  | { type: "event"; shareSlug: string };

export function publicVideosEndpoint(source: PublicVideoSource): string {
  if (source.type === "event") {
    return eventPublicVideosApiPath(source.shareSlug);
  }
  return albumPublicVideosApiPath(source.slug);
}

const EVENT_LOAD_ERROR = "No pudimos cargar los videos por ahora.";

function devLog(payload: { source: PublicVideoSource; endpoint: string }) {
  if (process.env.NODE_ENV === "development") {
    console.log("[public-videos]", payload);
  }
}

export type FetchPublicVideosResult = {
  videos: PublicVideoDto[];
  /** Solo true cuando source.type === "event" y hay metadatos de álbum en el DTO */
  showEventAlbumContext: boolean;
  loadError: string | null;
};

export async function fetchPublicVideos(
  source: PublicVideoSource
): Promise<FetchPublicVideosResult> {
  const endpoint = publicVideosEndpoint(source);
  devLog({ source, endpoint });

  try {
    const res = await fetch(endpoint, { credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (source.type === "event") {
        console.warn("[public-videos] event fetch failed", res.status, data);
        return { videos: [], showEventAlbumContext: true, loadError: EVENT_LOAD_ERROR };
      }
      const msg =
        typeof data?.error === "string" && !data.error.includes("Álbum no disponible")
          ? data.error
          : EVENT_LOAD_ERROR;
      console.warn("[public-videos] album fetch failed", res.status, data);
      return { videos: [], showEventAlbumContext: false, loadError: msg };
    }

    const videos = Array.isArray(data.videos) ? (data.videos as PublicVideoDto[]) : [];
    if (process.env.NODE_ENV === "development" && data._devDiagnostics) {
      console.log("[public-videos] API diagnostics", data._devDiagnostics);
    }
    return {
      videos,
      showEventAlbumContext: source.type === "event",
      loadError: null,
    };
  } catch (err: unknown) {
    console.warn("[public-videos] fetch error", err);
    return {
      videos: [],
      showEventAlbumContext: source.type === "event",
      loadError: EVENT_LOAD_ERROR,
    };
  }
}
