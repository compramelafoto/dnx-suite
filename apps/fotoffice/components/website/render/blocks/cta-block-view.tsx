import type { CtaBlockConfig } from "@/lib/website/blocks";
import { enlaceDeBoton } from "@/lib/website/button-href";
import { levelStyle } from "@/lib/website/typography";

/** Sobre la franja de color principal el texto va siempre en blanco: no toma el color del nivel. */
export function CtaBlockView({ config }: { config: CtaBlockConfig }) {
  const solid = config.stylePreset === "solid";
  return (
    <section className="px-6 py-16" style={{ backgroundColor: "var(--wsite-primary)" }}>
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h2 style={{ ...levelStyle("heading", { color: false }), color: "#ffffff", letterSpacing: "var(--wsite-letter-spacing)" }}>
          {config.title || "Título"}
        </h2>
        {config.text ? (
          <p className="leading-relaxed" style={{ ...levelStyle("body", { color: false }), color: "rgba(255,255,255,0.9)" }}>
            {config.text}
          </p>
        ) : null}
        <a
          href={enlaceDeBoton(config.buttonUrl) ?? "#"}
          className="inline-flex mt-2"
          style={{
            ...levelStyle("button", { color: false }),
            borderRadius: "var(--wsite-button-radius)",
            paddingInline: "var(--wsite-button-padding-x)",
            paddingBlock: "var(--wsite-button-padding-y)",
            ...(solid ? { backgroundColor: "#ffffff", color: "var(--wsite-primary)" } : { border: "2px solid #ffffff", color: "#ffffff" }),
          }}
        >
          {config.buttonLabel || "Botón"}
        </a>
      </div>
    </section>
  );
}
