import type { MapBlockConfig } from "@/lib/website/blocks";
import { googleMapsDirectionsUrl, googleMapsEmbedUrl } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/** Mapa de Google a partir de una dirección o de coordenadas, con el botón «Cómo llegar». El
 * iframe siempre apunta a google.com/maps: lo que escribe el dueño sólo viaja codificado como
 * búsqueda, nunca como dirección del marco. Sin dirección, en el sitio no se dibuja. */
export function MapBlockView({ config, data }: { config: MapBlockConfig; blockId?: string; data?: unknown }) {
  const src = googleMapsEmbedUrl(config.query);
  const directions = googleMapsDirectionsUrl(config.query);
  if (!src) {
    if (data !== undefined) return null;
    return (
      <section className="px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-2xl border border-dashed p-8 text-center opacity-60" style={levelStyle("body", { color: true })}>
          Escribí la dirección para ver el mapa.
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        {config.title.trim() ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        <iframe
          src={src}
          title={config.title.trim() || `Mapa: ${config.query.trim()}`}
          className="w-full rounded-2xl border-0"
          style={{ height: config.heightPx }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        {config.showDirections && directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
            style={{
              ...levelStyle("button", { color: false }),
              borderRadius: "var(--wsite-button-radius)",
              paddingInline: "var(--wsite-button-padding-x)",
              paddingBlock: "var(--wsite-button-padding-y)",
              backgroundColor: "var(--wsite-primary)",
              color: "#ffffff",
            }}
          >
            Cómo llegar
          </a>
        ) : null}
      </div>
    </section>
  );
}
