import type { TextBlockConfig } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";

export function TextBlockView({ config }: { config: TextBlockConfig }) {
  const align = config.align === "center" ? "text-center mx-auto" : "text-left";
  const paragraphs = (config.content ?? "").split(/\n{2,}/).filter((p) => p.trim().length > 0);

  return (
    <section className="px-6 py-14">
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
    </section>
  );
}
