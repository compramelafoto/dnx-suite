"use client";

import { buildSafeIframeSrc, type EditorialVideoAttrs } from "@repo/editor";
import { useState } from "react";

const YOUTUBE_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
const VIMEO_ALLOW = "autoplay; fullscreen; picture-in-picture; clipboard-write";

type Props = {
  video: EditorialVideoAttrs;
  title: string;
};

export function VideoIframe({ video, title }: Props) {
  const [failed, setFailed] = useState(false);
  const src = buildSafeIframeSrc(video);

  if (!src || failed) {
    return (
      <div className="is-video-fallback-card">
        <p>No se pudo mostrar este video.</p>
        <p>
          <a href={video.url} target="_blank" rel="noopener noreferrer">
            Abrir la publicación original
          </a>
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={src}
      title={title}
      loading="lazy"
      referrerPolicy="origin-when-cross-origin"
      allow={video.provider === "vimeo" ? VIMEO_ALLOW : YOUTUBE_ALLOW}
      allowFullScreen
      onError={() => setFailed(true)}
    />
  );
}
