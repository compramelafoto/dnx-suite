import type { TextBlockConfig } from "@/lib/website/blocks";

export function TextBlockView({ config }: { config: TextBlockConfig }) {
  const align = config.align === "center" ? "text-center mx-auto" : "text-left";
  const paragraphs = (config.content ?? "").split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <section className="px-6 py-14">
      <div className={`max-w-3xl space-y-4 ${align}`}>
        {config.title ? (
          <h2
            className="text-2xl"
            style={{ color: "var(--wsite-text)", fontFamily: "var(--wsite-heading-font)", fontWeight: "var(--wsite-heading-weight)", letterSpacing: "var(--wsite-letter-spacing)" }}
          >
            {config.title}
          </h2>
        ) : null}
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed whitespace-pre-line" style={{ color: "var(--wsite-text)", opacity: 0.85 }}>
              {p}
            </p>
          ))
        ) : (
          <p className="leading-relaxed opacity-50" style={{ color: "var(--wsite-text)" }}>
            Sin contenido todavía.
          </p>
        )}
      </div>
    </section>
  );
}
