import type { VideoBlockConfig } from "@/lib/website/blocks";
import { toVideoEmbedUrl } from "@/lib/website/embed-hosts";
import { levelStyle } from "@/lib/website/typography";

/** Video de YouTube o Vimeo. Si la URL no es de uno de los dos (o no es https), no se dibuja nada. */
export function VideoBlockView({ config }: { config: VideoBlockConfig }) {
  const src = toVideoEmbedUrl(config.url);
  if (!src) return null;

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-4">
        {config.title ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <iframe
            src={src}
            title={config.title || "Video"}
            className="h-full w-full border-0"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}
