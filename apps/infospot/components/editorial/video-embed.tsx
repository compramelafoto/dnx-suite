"use client";

import { useEffect, useId, useRef } from "react";
import {
  instagramPermalink,
  videoEmbedLayoutClass,
  type EditorialVideoAttrs,
} from "@repo/editor";
import { VideoIframe } from "./video-iframe";
import { useInstagramEmbedScript } from "./instagram-embed-script";

type Props = {
  video: EditorialVideoAttrs;
  selected?: boolean;
  showEditorChrome?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

const PROVIDER_LABEL: Record<EditorialVideoAttrs["provider"], string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  instagram: "Instagram",
};

/**
 * Render compartido entre el editor TipTap y la nota pública.
 * Genera iframes / embed oficial internamente; nunca usa HTML del redactor.
 */
export function VideoEmbed({
  video,
  selected = false,
  showEditorChrome = false,
  onEdit,
  onDelete,
}: Props) {
  const isInstagram = video.provider === "instagram";
  useInstagramEmbedScript(isInstagram);
  const permalink = isInstagram ? instagramPermalink(video) : video.url;
  const title = video.caption || `Video de ${PROVIDER_LABEL[video.provider]}`;
  const layoutClass = videoEmbedLayoutClass(video);

  return (
    <figure
      className={`is-video-embed-root ${layoutClass}${selected ? " is-video-selected" : ""}`}
      data-editorial-video="true"
      data-provider={video.provider}
      data-video-id={video.videoId}
      data-url={video.url}
      data-width={video.width}
      data-alignment={video.alignment}
      data-variant={video.variant}
    >
      {showEditorChrome ? (
        <div className="is-video-chrome">
          <span className="is-video-chrome-label">{PROVIDER_LABEL[video.provider]}</span>
          <div className="is-video-chrome-actions">
            {onEdit ? (
              <button
                type="button"
                className="is-video-chrome-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onEdit}
              >
                Editar
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="is-video-chrome-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onDelete}
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isInstagram && permalink ? (
        <InstagramOfficialEmbed permalink={permalink} variant={video.variant} />
      ) : (
        <div className="is-video-frame">
          <VideoIframe video={video} title={title} />
        </div>
      )}

      {video.caption ? (
        <figcaption className="is-figcaption">
          <span data-caption="true" className="is-caption">
            {video.caption}
          </span>
        </figcaption>
      ) : null}

      <p className="is-video-fallback-link">
        <a href={video.url} target="_blank" rel="noopener noreferrer">
          Abrir en {PROVIDER_LABEL[video.provider]}
        </a>
      </p>
    </figure>
  );
}

function InstagramOfficialEmbed({
  permalink,
  variant,
}: {
  permalink: string;
  variant: EditorialVideoAttrs["variant"];
}) {
  const mountId = useId();
  const ref = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const iframe = el.querySelector("iframe");
    if (iframe) iframe.setAttribute("loading", "lazy");
  }, [permalink, mountId]);

  return (
    <div className={`is-video-instagram${variant === "reel" ? " is-video-instagram-reel" : ""}`}>
      <blockquote
        ref={ref}
        className="instagram-media"
        data-instgrm-permalink={permalink}
        data-instgrm-version="14"
        data-infospot-ig={mountId}
      >
        <a href={permalink} target="_blank" rel="noopener noreferrer">
          Ver en Instagram
        </a>
      </blockquote>
    </div>
  );
}

export { VideoEmbedFallback } from "./video-embed-fallback";
