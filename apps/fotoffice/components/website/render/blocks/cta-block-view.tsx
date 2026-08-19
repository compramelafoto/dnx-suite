import type { CtaBlockConfig } from "@/lib/website/blocks";

export function CtaBlockView({ config }: { config: CtaBlockConfig }) {
  const solid = config.stylePreset === "solid";
  return (
    <section className="px-6 py-16" style={{ backgroundColor: "var(--wsite-primary)" }}>
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: "#ffffff" }}>
          {config.title || "Título"}
        </h2>
        {config.text ? (
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
            {config.text}
          </p>
        ) : null}
        <a
          href={config.buttonUrl || "#"}
          className="inline-flex mt-2 rounded-full px-6 py-3 text-sm font-semibold"
          style={
            solid
              ? { backgroundColor: "#ffffff", color: "var(--wsite-primary)" }
              : { border: "2px solid #ffffff", color: "#ffffff" }
          }
        >
          {config.buttonLabel || "Botón"}
        </a>
      </div>
    </section>
  );
}
