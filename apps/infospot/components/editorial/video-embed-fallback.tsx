import { parseVideoUrl } from "@repo/editor";

type Props = {
  url?: string | null;
  caption?: string;
};

export function VideoEmbedFallback({ url, caption }: Props) {
  const safeUrl = url && parseVideoUrl(url).ok ? url : null;
  return (
    <figure className="is-video-embed-root is-video-fallback">
      <div className="is-video-fallback-card">
        <p>No se pudo mostrar este video.</p>
        {safeUrl ? (
          <p>
            <a href={safeUrl} target="_blank" rel="noopener noreferrer">
              Abrir la publicación original
            </a>
          </p>
        ) : null}
      </div>
      {caption ? <figcaption className="is-figcaption">{caption}</figcaption> : null}
    </figure>
  );
}
