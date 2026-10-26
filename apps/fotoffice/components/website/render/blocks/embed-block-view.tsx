import type { EmbedBlockConfig } from "@/lib/website/blocks";
import { isAllowedEmbedUrl } from "@/lib/website/embed-hosts";
import { levelStyle } from "@/lib/website/typography";

/** Página ajena dentro del sitio (CompraMeLaFoto, YouTube/Vimeo, mapa de Google). Si el host no
 * está en la lista de `embed-hosts.ts`, no se dibuja nada — nunca un iframe a cualquier lado. */
export function EmbedBlockView({ config }: { config: EmbedBlockConfig }) {
  if (!isAllowedEmbedUrl(config.url)) return null;

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        {config.title ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        <iframe
          src={config.url.trim()}
          title={config.title || "Contenido insertado"}
          className="w-full rounded-2xl border-0"
          style={{ height: config.heightPx }}
          loading="lazy"
          allow="fullscreen; clipboard-write; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
