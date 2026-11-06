import type { CtaBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { enlaceDeBoton } from "@/lib/website/button-href";
import { levelStyle } from "@/lib/website/typography";

/** Sobre la franja de color principal el texto va siempre en blanco: no toma el color del nivel. */
export function CtaBlockView({ config, data }: { config: CtaBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const solid = config.stylePreset === "solid";
  const href = enlaceDeBoton(config.buttonUrl, data?.paginasDelSitio) ?? "#";
  const estiloBase = {
    ...levelStyle("button", { color: false }),
    borderRadius: "var(--wsite-button-radius)",
    paddingInline: "var(--wsite-button-padding-x)",
    paddingBlock: "var(--wsite-button-padding-y)",
  };
  // Sólo un botón, sin título ni texto (los «+ INFO» / «Programar una cita» importados de Alboom,
  // que van debajo de la sección que presentan): sin franja de color ni un «Título» de relleno.
  if (!config.title?.trim() && !config.text?.trim()) {
    return (
      <section className="px-6 py-6">
        <div className="mx-auto max-w-2xl text-center">
          <a
            href={href}
            className="inline-flex transition-transform hover:scale-[1.02]"
            style={{
              ...estiloBase,
              ...(solid
                ? { backgroundColor: "var(--wsite-accent)", color: "#ffffff" }
                : {
                    border: "2px solid var(--wsite-accent)",
                    color: "var(--wsite-accent)",
                  }),
            }}
          >
            {config.buttonLabel || "Botón"}
          </a>
        </div>
      </section>
    );
  }
  return (
    <section className="px-6 py-16" style={{ backgroundColor: "var(--wsite-primary)" }}>
      <div className="max-w-2xl mx-auto text-center space-y-4">
        {config.title ? (
          <h2
            style={{
              ...levelStyle("heading", { color: false }),
              color: "#ffffff",
              letterSpacing: "var(--wsite-letter-spacing)",
            }}
          >
            {config.title}
          </h2>
        ) : null}
        {config.text ? (
          <p
            className="leading-relaxed"
            style={{
              ...levelStyle("body", { color: false }),
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {config.text}
          </p>
        ) : null}
        <a
          href={href}
          className="inline-flex mt-2"
          style={{
            ...estiloBase,
            ...(solid ? { backgroundColor: "#ffffff", color: "var(--wsite-primary)" } : { border: "2px solid #ffffff", color: "#ffffff" }),
          }}
        >
          {config.buttonLabel || "Botón"}
        </a>
      </div>
    </section>
  );
}
