import { BlogArticleBody } from "@/components/website/blog/blog-article-body";
import { sanitizeRichTextConfig, type RichTextBlockConfig } from "@/lib/website/blocks";
import { levelStyle } from "@/lib/website/typography";

const WIDTH_CLASS: Record<RichTextBlockConfig["width"], string> = {
  narrow: "max-w-xl",
  normal: "max-w-3xl",
  wide: "max-w-5xl",
};

/**
 * Texto con formato. Aunque el HTML ya se sanea al guardar, se vuelve a sanear acá: el borrador
 * y los sitios publicados viejos no pasaron por ese filtro, y nada que no esté limpio llega al HTML
 * de la página. La tipografía es la del cuerpo de los artículos del blog.
 */
export function RichTextBlockView({ config }: { config: RichTextBlockConfig }) {
  const { html } = sanitizeRichTextConfig(config);
  if (!html.trim() && !config.title) return null;
  const align = config.align === "center" ? "text-center mx-auto" : "text-left";

  return (
    <section className="px-6 py-14">
      <div className={`space-y-4 ${WIDTH_CLASS[config.width]} ${align}`}>
        {config.title ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        {html.trim() ? <BlogArticleBody html={html} /> : null}
      </div>
    </section>
  );
}
