import { BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import type { CardsBlockConfig } from "@/lib/website/blocks";
import { cardHref, isShowableImageUrl } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/** Dos tarjetas ocupan media pantalla cada una; con tres o más, tres por fila (cuatro en pantallas muy anchas). */
function columnas(n: number): string {
  if (n <= 1) return "mx-auto max-w-sm";
  if (n === 2) return "sm:grid-cols-2 max-w-4xl mx-auto";
  if (n === 4 || n === 8) return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

/**
 * Tarjetas con foto: grilla de tarjetas chicas (portada 16:10 arriba, etiqueta sobre la foto, título,
 * texto y botón al pie). Todas las tarjetas de una fila miden lo mismo y el botón queda abajo, alineado.
 * Las que no tienen título ni foto no se dibujan; sin ninguna, en el sitio la sección no aparece y en la
 * vista previa del constructor se ve un aviso.
 */
export function CardsBlockView({ config, data }: { config: CardsBlockConfig; blockId?: string; data?: unknown }) {
  const preview = data === undefined;
  const items = config.items.filter((i) => i.title.trim() || isShowableImageUrl(i.imageUrl));
  if (items.length === 0) {
    if (!preview) return null;
    return (
      <section className="px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-2xl border border-dashed p-8 text-center opacity-60" style={levelStyle("body", { color: true })}>
          Agregá las tarjetas: cada una con su foto, título, texto y botón.
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        {config.title.trim() || config.intro.trim() ? (
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            {config.title.trim() ? (
              <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
            ) : null}
            {config.intro.trim() ? (
              <p className="whitespace-pre-line leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.8 }}>
                {config.intro}
              </p>
            ) : null}
          </div>
        ) : null}
        <ul className={`grid grid-cols-1 gap-6 ${columnas(items.length)}`}>
          {items.map((item, i) => {
            const href = cardHref(item.buttonUrl);
            const externo = !!href && /^https?:\/\//i.test(href);
            return (
              <li
                key={item.id || i}
                className="group flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-lg"
                style={{ borderColor: BLOG_SOFT_BORDER, backgroundColor: "var(--wsite-bg)" }}
              >
                <div className="relative aspect-[16/10] overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--wsite-primary) 10%, transparent)" }}>
                  {isShowableImageUrl(item.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- las fotos viven en R2
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                  {item.badge.trim() ? (
                    <span
                      className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow"
                      style={{ backgroundColor: "var(--wsite-primary)", color: "#ffffff" }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  {item.title.trim() ? (
                    <h3 className="text-lg leading-snug" style={{ ...levelStyle("body", { color: true }), fontWeight: 700 }}>
                      {item.title}
                    </h3>
                  ) : null}
                  {item.text.trim() ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.75 }}>
                      {item.text}
                    </p>
                  ) : null}
                  {href && item.buttonLabel.trim() ? (
                    <a
                      href={href}
                      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="mt-auto inline-flex items-center justify-center gap-1 self-start pt-2 text-sm font-semibold transition-opacity hover:opacity-80"
                      style={{ color: "var(--wsite-primary)" }}
                    >
                      {item.buttonLabel} <span aria-hidden>→</span>
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
