import type { TextBlockConfig } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";

export function TextBlockView({ config }: { config: TextBlockConfig }) {
  const align = config.align === "center" ? "text-center mx-auto" : "text-left";
  const paragraphs = (config.content ?? "").split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const texto = (
    <div className={`max-w-3xl space-y-4 ${align}`}>
      {config.title ? (
        <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
      ) : null}
      {paragraphs.length > 0 ? (
        paragraphs.map((p, i) => (
          <p key={i} className="leading-relaxed whitespace-pre-line" style={{ ...levelStyle("body", { color: true }), opacity: 0.85 }}>
            {p}
          </p>
        ))
      ) : (
        <p className="leading-relaxed opacity-50" style={levelStyle("body", { color: true })}>
          Sin contenido todavía.
        </p>
      )}
    </div>
  );

  if (!config.imageUrl) return <section className="px-6 py-14">{texto}</section>;

  // Con foto: al costado desde tablet; en el celular, arriba del texto. Sin `mx-auto`: arranca
  // en el mismo borde izquierdo que los bloques de texto sin foto, así los títulos quedan alineados.
  return (
    <section className="px-6 py-14">
      <div className={`flex max-w-5xl flex-col items-center gap-8 md:gap-12 ${config.imageSide === "left" ? "md:flex-row" : "md:flex-row-reverse"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={config.imageUrl}
          alt={config.imageAlt ?? ""}
          className="h-auto w-full max-w-xs shrink-0 rounded-2xl object-cover md:w-80"
        />
        <div className="min-w-0 flex-1">{texto}</div>
      </div>
    </section>
  );
}
