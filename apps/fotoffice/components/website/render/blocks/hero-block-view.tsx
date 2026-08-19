import type { HeroBlockConfig } from "@/lib/website/blocks";

export function HeroBlockView({ config }: { config: HeroBlockConfig }) {
  const align = config.align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: "var(--wsite-secondary)",
        backgroundImage: config.imageUrl ? `url(${config.imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: config.imageUrl ? "rgba(15, 23, 42, 0.45)" : "transparent" }}
      />
      <div className={`relative flex flex-col gap-4 px-6 py-20 sm:py-28 max-w-4xl mx-auto ${align}`}>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white" style={{ textWrap: "balance" }}>
          {config.title || "Título principal"}
        </h1>
        {config.subtitle ? (
          <p className="text-lg sm:text-xl max-w-2xl leading-relaxed text-white/90">{config.subtitle}</p>
        ) : null}
        {config.buttonLabel && config.buttonUrl ? (
          <a
            href={config.buttonUrl}
            className="inline-flex mt-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--wsite-accent)", color: "#ffffff" }}
          >
            {config.buttonLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
