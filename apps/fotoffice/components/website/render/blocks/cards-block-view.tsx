import { BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import type { CardItem, CardsBlockConfig } from "@/lib/website/blocks";
import { cardHref, isShowableImageUrl } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/** El color de los botones del sitio (el de acento; si el tema no lo define, el principal). */
const ACENTO = "var(--wsite-accent, var(--wsite-primary))";

/** Qué parte de la foto queda a la vista al recortarla (por ejemplo, la cara en un retrato). */
const ENCUADRE: Record<NonNullable<CardItem["imagePosition"]>, string> = {
  top: "object-[50%_15%]",
  center: "object-center",
  bottom: "object-[50%_85%]",
};

/** Dos tarjetas ocupan media pantalla cada una; con tres o más, tres por fila (cuatro en pantallas muy anchas). */
function columnas(n: number): string {
  if (n <= 1) return "mx-auto max-w-sm";
  if (n === 2) return "sm:grid-cols-2 max-w-4xl mx-auto";
  if (n === 4 || n === 8) return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

function Portada({ item, className }: { item: CardItem; className: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: "color-mix(in srgb, var(--wsite-primary) 10%, transparent)" }}>
      {isShowableImageUrl(item.imageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element -- las fotos viven en R2
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${ENCUADRE[item.imagePosition ?? "center"]}`}
        />
      ) : null}
      {item.badge.trim() ? (
        <span
          className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow"
          style={{ backgroundColor: ACENTO, color: "#ffffff" }}
        >
          {item.badge}
        </span>
      ) : null}
    </div>
  );
}

function Boton({ item, grande }: { item: CardItem; grande?: boolean }) {
  const href = cardHref(item.buttonUrl);
  if (!href || !item.buttonLabel.trim()) return null;
  const externo = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`mt-auto inline-flex items-center justify-center gap-1.5 self-start rounded-full font-semibold transition-opacity hover:opacity-85 ${grande ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"}`}
      style={{ backgroundColor: ACENTO, color: "#ffffff" }}
    >
      {item.buttonLabel} <span aria-hidden>→</span>
    </a>
  );
}

/**
 * Tarjetas con foto. En grilla (`grid`, el normal): tarjetas chicas, portada 16:10 arriba, etiqueta sobre
 * la foto, título, texto y botón al pie; las de una fila miden lo mismo y el botón queda alineado abajo.
 * Destacadas (`featured`): una tarjeta grande por renglón, con la foto a un lado y el texto al otro (en el
 * teléfono, la foto arriba), para lo principal. Las que no tienen título ni foto no se dibujan; sin ninguna,
 * en el sitio la sección no aparece y en la vista previa del constructor se ve un aviso.
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
  const destacadas = config.variant === "featured";
  const tarjeta = "group overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-lg";
  const estiloTarjeta = { borderColor: BLOG_SOFT_BORDER, backgroundColor: "var(--wsite-bg)" };

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
        {destacadas ? (
          <ul className="mx-auto flex max-w-5xl flex-col gap-8">
            {items.map((item, i) => (
              <li key={item.id || i} className={`${tarjeta} flex flex-col md:flex-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`} style={estiloTarjeta}>
                <Portada item={item} className="aspect-[16/10] w-full md:aspect-auto md:min-h-[20rem] md:w-[55%] md:shrink-0" />
                <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
                  {item.title.trim() ? (
                    <h3 className="text-2xl leading-tight sm:text-3xl" style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>
                      {item.title}
                    </h3>
                  ) : null}
                  {item.text.trim() ? (
                    <p className="whitespace-pre-line text-base leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.8 }}>
                      {item.text}
                    </p>
                  ) : null}
                  <Boton item={item} grande />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={`grid grid-cols-1 gap-6 ${columnas(items.length)}`}>
            {items.map((item, i) => (
              <li key={item.id || i} className={`${tarjeta} flex flex-col`} style={estiloTarjeta}>
                <Portada item={item} className="aspect-[16/10]" />
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
                  <Boton item={item} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
